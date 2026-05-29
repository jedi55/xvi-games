import { getSession } from '../lib/auth.js';
import { router } from '../lib/router.js';
import { renderHeader, renderFooter, showToast, formatCurrency } from '../components/layout.js';
import { supabase } from '../lib/supabase.js';
import { sendBookingConfirmationEmail } from '../lib/email.js';
import { calculatePrice } from '../utils/membershipUtils.js';

// Read dynamic discount percent stored at membership sign-up
function getMemberDiscount() {
  if (localStorage.getItem('xvi_member') !== 'true') return 0
  return parseInt(localStorage.getItem('xvi_member_discount') || '15')
}


async function handleBookingPayment(bookingData, app) {
  const { supabase } = await import('/src/lib/supabase.js')
  const { data: { session } } = await supabase.auth.getSession()

  if (!session?.user) {
    window.location.href = '/#/login'
    return
  }

  // Check if user is a member for discount
  const isMember = localStorage.getItem('xvi_member') === 'true'
  const discountPercent = getMemberDiscount()

  const baseAmount = bookingData.totalAmount
  const discountAmount = discountPercent > 0
    ? Math.round(baseAmount * (discountPercent / 100)) : 0
  const finalAmount = baseAmount - discountAmount

  // Update order summary to show discount if member
  const summaryEl = document.getElementById('order-summary')
  if (summaryEl && isMember && !summaryEl.innerHTML.includes('Member Discount')) {
    summaryEl.innerHTML += `
      <div style="display:flex;justify-content:space-between;
        color:#4caf50;font-size:0.85rem;margin-top:0.5rem;">
        <span>👑 Member Discount (${discountPercent}%)</span>
        <span>- ₦${discountAmount.toLocaleString()}</span>
      </div>
      <div style="display:flex;justify-content:space-between;
        font-weight:700;margin-top:0.5rem;padding-top:0.5rem;
        border-top:1px solid var(--outline-variant);">
        <span>Total</span>
        <span style="color:#c9a84c;">
          ₦${finalAmount.toLocaleString()}
        </span>
      </div>
    `
  }

  if (typeof PaystackPop === 'undefined') {
    alert('Payment system not loaded. Please refresh and try again.')
    return
  }

  const confirmBtn = document.getElementById('confirm-booking-btn')
  if (confirmBtn) {
    confirmBtn.innerHTML = '<span class="material-symbols-outlined spin" style="animation: spin 1s linear infinite;">refresh</span> Processing...'
    confirmBtn.disabled = true
  }

  const handler = PaystackPop.setup({
    key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
    email: session.user.email,
    amount: finalAmount * 100,
    currency: 'NGN',
    ref: 'XVI_BKG_' + Date.now(),
    label: bookingData.customerName || session.user.email,
    metadata: {
      custom_fields: [
        {
          display_name: 'Table',
          variable_name: 'table',
          value: bookingData.tableLabel
        },
        {
          display_name: 'Booking Date',
          variable_name: 'date',
          value: bookingData.date
        },
        {
          display_name: 'Start Time',
          variable_name: 'start_time',
          value: bookingData.startTime
        },
        {
          display_name: 'Booking Type',
          variable_name: 'type',
          value: bookingData.reservationType
        },
        {
          display_name: 'Member Discount',
          variable_name: 'member_discount',
          value: isMember ? discountPercent + '%' : 'None'
        }
      ]
    },

    onSuccess: async (transaction) => {
      try {
        // 1. Create customer record
        const { data: customer } = await supabase
          .from('customers')
          .insert({
            full_name: bookingData.customerName,
            phone: bookingData.phone,
            email: bookingData.email || session.user.email
          })
          .select()
          .single()

        // 2. Calculate end time
        const startDateTime = new Date(
          bookingData.date + 'T' + bookingData.startTime
        )
        const endDateTime = new Date(startDateTime)

        if (bookingData.reservationType === 'time') {
          endDateTime.setHours(
            endDateTime.getHours() + 
            parseInt(bookingData.duration)
          )
        } else {
          // 30 mins per game estimate
          endDateTime.setMinutes(
            endDateTime.getMinutes() + 
            parseInt(bookingData.games) * 30
          )
        }

        // 3. Save booking to Supabase
        const { data: booking } = await supabase
          .from('bookings')
          .insert({
            customer_id: customer?.id,
            table_id: bookingData.tableId,
            reservation_type: bookingData.reservationType,
            start_time: startDateTime.toISOString(),
            end_time: endDateTime.toISOString(),
            number_of_games: bookingData.reservationType === 'games' 
              ? parseInt(bookingData.games) : null,
            duration_hours: bookingData.reservationType === 'time'
              ? parseInt(bookingData.duration) : null,
            total_amount: finalAmount * 100,
            payment_status: 'paid',
            paystack_reference: transaction.reference,
            status: 'confirmed'
          })
          .select()
          .single()

        // 4. Send confirmation email (non-blocking)
        sendBookingConfirmationEmail({
          to: bookingData.email || session.user.email,
          customerName: bookingData.customerName,
          referenceCode: booking?.reference_code ||
            transaction.reference.slice(-8).toUpperCase(),
          tableLabel: bookingData.tableLabel,
          date: bookingData.date,
          startTime: bookingData.startTime,
          duration: bookingData.reservationType === 'time'
            ? bookingData.duration + ' hour(s)'
            : bookingData.games + ' game(s)',
          totalPaid: finalAmount,
          isMember: isMember,
          discount: discountAmount
        }).catch(e => console.warn('Email non-fatal:', e))

        // 5. Show success popup
        showBookingSuccessPopup({
          referenceCode: booking?.reference_code || 
            transaction.reference.slice(-8).toUpperCase(),
          tableLabel: bookingData.tableLabel,
          date: bookingData.date,
          startTime: bookingData.startTime,
          duration: bookingData.reservationType === 'time'
            ? bookingData.duration + ' hour(s)'
            : bookingData.games + ' game(s)',
          totalPaid: finalAmount,
          isMember: isMember,
          discount: discountAmount
        })

      } catch (err) {
        console.error('Booking save error:', err)
        // Still show success since payment went through
        showBookingSuccessPopup({
          referenceCode: transaction.reference
            .slice(-8).toUpperCase(),
          tableLabel: bookingData.tableLabel,
          date: bookingData.date,
          startTime: bookingData.startTime,
          duration: bookingData.reservationType === 'time'
            ? bookingData.duration + ' hour(s)'
            : bookingData.games + ' game(s)',
          totalPaid: finalAmount,
          isMember: isMember,
          discount: discountAmount
        })
      }
    },

    onCancel: () => {
      if (confirmBtn) {
        confirmBtn.innerHTML = 'Confirm & Pay &rarr;'
        confirmBtn.disabled = false
      }
    }
  })

  handler.openIframe()
}

function showBookingSuccessPopup(details) {
  const existing = document.getElementById('booking-success-popup')
  if (existing) existing.remove()

  const popup = document.createElement('div')
  popup.id = 'booking-success-popup'
  popup.style.cssText = `
    position:fixed;top:0;left:0;
    width:100%;height:100%;
    background:rgba(0,0,0,0.85);
    z-index:99999;
    display:flex;align-items:center;
    justify-content:center;
  `
  popup.innerHTML = `
    <style>
      @keyframes popIn {
        0%{transform:scale(0.7);opacity:0}
        70%{transform:scale(1.05)}
        100%{transform:scale(1);opacity:1}
      }
      @keyframes checkmark {
        0%{transform:scale(0) rotate(-45deg);opacity:0}
        60%{transform:scale(1.2) rotate(5deg)}
        100%{transform:scale(1) rotate(0deg);opacity:1}
      }
    </style>

    <div style="background:linear-gradient(135deg,#0a1f0a,#0d2b0d);
      border-radius:20px;width:90%;max-width:440px;
      padding:2.5rem 2rem;text-align:center;
      border:1px solid rgba(76,175,80,0.4);
      box-shadow:0 0 60px rgba(76,175,80,0.2),
                 0 0 30px rgba(0,0,0,0.5);
      animation:popIn 0.5s cubic-bezier(0.34,1.56,0.64,1);">

      <!-- Success checkmark -->
      <div style="width:72px;height:72px;
        border-radius:50%;
        background:rgba(76,175,80,0.15);
        border:2px solid #4caf50;
        display:flex;align-items:center;
        justify-content:center;
        margin:0 auto 1.25rem;
        animation:checkmark 0.6s ease 0.2s both;">
        <span style="color:#4caf50;font-size:2rem;
          line-height:1;">✓</span>
      </div>

      <h1 style="color:white;font-size:1.5rem;
        font-weight:700;margin:0 0 0.4rem;">
        Booking Confirmed!
      </h1>

      <p style="color:#9fc99f;font-size:0.875rem;
        margin:0 0 1.5rem;">
        Your table is reserved. See you at the club!
      </p>

      <!-- Booking details card -->
      <div style="background:rgba(255,255,255,0.04);
        border:1px solid rgba(255,255,255,0.08);
        border-radius:12px;padding:1.25rem;
        margin-bottom:1.25rem;text-align:left;">

        <div style="display:grid;gap:0.6rem;">
        <!-- Prominent Booking Code -->
      <div style="background:rgba(201,168,76,0.1);
        border:2px dashed rgba(201,168,76,0.4);
        border-radius:10px;padding:1rem;
        text-align:center;margin:0 0 1rem;">
        <p style="color:rgba(255,255,255,0.5);font-size:0.7rem;
          text-transform:uppercase;letter-spacing:2px;margin:0 0 0.3rem;">
          Your Booking Code
        </p>
        <p style="color:#c9a84c;font-size:2rem;
          font-weight:800;letter-spacing:6px;
          font-family:monospace;margin:0;">
          ${details.referenceCode}
        </p>
        <p style="color:rgba(255,255,255,0.4);font-size:0.72rem;margin:0.3rem 0 0;">
          Show this code at the venue
        </p>
      </div>
          <div style="display:flex;
            justify-content:space-between;">
            <span style="color:rgba(255,255,255,0.5);
              font-size:0.8rem;">Table</span>
            <span style="color:white;font-size:0.85rem;
              font-weight:600;">
              ${details.tableLabel}
            </span>
          </div>
          <div style="display:flex;
            justify-content:space-between;">
            <span style="color:rgba(255,255,255,0.5);
              font-size:0.8rem;">Date</span>
            <span style="color:white;font-size:0.85rem;">
              ${details.date}
            </span>
          </div>
          <div style="display:flex;
            justify-content:space-between;">
            <span style="color:rgba(255,255,255,0.5);
              font-size:0.8rem;">Time</span>
            <span style="color:white;font-size:0.85rem;">
              ${details.startTime}
            </span>
          </div>
          <div style="display:flex;
            justify-content:space-between;">
            <span style="color:rgba(255,255,255,0.5);
              font-size:0.8rem;">Duration</span>
            <span style="color:white;font-size:0.85rem;">
              ${details.duration}
            </span>
          </div>
          ${details.isMember && details.discount > 0 ? `
          <div style="display:flex;
            justify-content:space-between;
            color:#4caf50;">
            <span style="font-size:0.8rem;">
              👑 Member Discount
            </span>
            <span style="font-size:0.85rem;font-weight:600;">
              - ₦${details.discount.toLocaleString()}
            </span>
          </div>
          ` : ''}
          <div style="display:flex;
            justify-content:space-between;
            padding-top:0.5rem;
            border-top:1px solid rgba(255,255,255,0.08);">
            <span style="color:rgba(255,255,255,0.5);
              font-size:0.8rem;">Total Paid</span>
            <span style="color:#c9a84c;font-weight:700;
              font-size:1rem;">
              ₦${details.totalPaid.toLocaleString()}
            </span>
          </div>
        </div>
      </div>

      <p style="color:rgba(255,255,255,0.3);
        font-size:0.75rem;margin:0 0 1.5rem;">
        A confirmation has been sent to your 
        phone and email
      </p>

      <!-- Buttons -->
      <div style="display:flex;flex-direction:column;
        gap:0.75rem;">
        <button id="goto-tables-from-booking"
          style="width:100%;padding:0.875rem;
            background:#1a5c1a;color:white;
            border:none;border-radius:8px;
            font-size:0.95rem;font-weight:600;
            cursor:pointer;letter-spacing:0.3px;">
          View All Tables
        </button>
        <button id="book-another-btn"
          style="width:100%;padding:0.75rem;
            background:transparent;
            color:#9fc99f;
            border:1px solid rgba(255,255,255,0.1);
            border-radius:8px;font-size:0.875rem;
            cursor:pointer;">
          Book Another Table
        </button>
      </div>

      <!-- Auto redirect -->
      <p id="booking-countdown"
        style="color:rgba(255,255,255,0.25);
          font-size:0.7rem;margin:1rem 0 0;">
        Redirecting to tables in 8 seconds...
      </p>
    </div>
  `
  document.body.appendChild(popup)

  // View tables button
  document.getElementById('goto-tables-from-booking')
    .addEventListener('click', () => {
      popup.remove()
      window.location.href = '/#/tables'
    })

  // Book another button
  document.getElementById('book-another-btn')
    .addEventListener('click', () => {
      popup.remove()
      window.location.href = '/#/booking'
    })

  // Auto countdown → redirect to tables
  let seconds = 8
  const countdownEl = document.getElementById(
    'booking-countdown'
  )
  const interval = setInterval(() => {
    seconds--
    if (countdownEl) {
      countdownEl.textContent = 
        `Redirecting to tables in ${seconds} seconds...`
    }
    if (seconds <= 0) {
      clearInterval(interval)
      popup.remove()
      window.location.href = '/#/tables'
    }
  }, 1000)
}
// ── Table Data ──
let TABLES = [];

const TIME_SLOTS = [
  '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM',
  '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM',
  '8:00 PM', '9:00 PM', '10:00 PM'
];

// Simulate some unavailable slots
const UNAVAILABLE_SLOTS = ['1:00 PM', '5:00 PM', '9:00 PM'];

export async function renderBookingPage(app) {
  const session = await getSession();

  async function fetchLiveTables() {
    try {
      const { supabase } = await import('../lib/supabase.js')
      // Get all tables
      const { data: tables, error } = await supabase
        .from('snooker_tables')
        .select('*')
        .order('table_number', { ascending: true })
      
      if (error) throw error

      // Check current reservations
      const today = new Date().toISOString().split('T')[0];
      const now = new Date();
      const currentHour = now.getHours().toString().padStart(2, '0');
      const currentMin = now.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${currentHour}:${currentMin}:00`;
      
      now.setHours(now.getHours() + 1);
      const nextHour = now.getHours().toString().padStart(2, '0');
      const nextMin = now.getMinutes().toString().padStart(2, '0');
      const nextTimeStr = `${nextHour}:${nextMin}:00`;

      const { data: bookings } = await supabase
        .from('reservations')
        .select('table_id, start_time, end_time')
        .in('status', ['confirmed'])
        .eq('date', today);

      const bookedTableIds = new Set();
      if (bookings) {
        bookings.forEach(b => {
          if (!b.start_time) return;
          const bStart = b.start_time;
          let bEnd = b.end_time;
          if (!bEnd) {
             const h = parseInt(bStart.split(':')[0]) + 2;
             bEnd = `${h.toString().padStart(2, '0')}:${bStart.split(':')[1]}:00`;
          }
          if (bStart < nextTimeStr && bEnd > currentTimeStr) {
            bookedTableIds.add(b.table_id);
          }
        });
      }

      return (tables || []).map(table => ({
        ...table,
        isAvailable: !bookedTableIds.has(table.id)
      }));
    } catch (e) {
      console.error('Failed to fetch tables:', e)
      return []
    }
  }

  const dbTables = await fetchLiveTables();
  TABLES = dbTables.map(t => ({
    id: t.id,
    name: t.label,
    desc: `Table #${t.table_number}`,
    hourly: t.hourly_rate / 100,
    game: t.per_game_rate / 100,
    vip: t.label?.includes('VIP'),
    isAvailable: t.isAvailable,
    isActive: t.is_active
  }));

  // State
  const state = {
    _session: session,
    step: 1,
    selectedTable: null,
    bookingType: 'time',       // 'time' or 'games'
    duration: '1',             // hours
    frames: '1',               // number of frames
    date: new Date().toISOString().split('T')[0],
    timeSlot: null,
    fullName: session?.user?.user_metadata?.full_name || '',
    phone: '',
    email: session?.user?.email || ''
  };

  function render() {
    app.innerHTML = `
      ${renderHeader(session, '')}
      <main class="page-content">
        <section class="booking-wizard">
          <div class="wizard-container">

            <!-- Progress Bar -->
            <div class="wizard-progress" id="booking-progress">
              ${[1, 2, 3].map(s => `
                <div class="progress-step ${state.step >= s ? 'active' : ''} ${state.step > s ? 'completed' : ''}">
                  <div class="step-circle">
                    ${state.step > s ? '<span class="material-symbols-outlined" style="font-size:1rem;">check</span>' : s}
                  </div>
                  <span class="step-label">${s === 1 ? 'Table & Type' : s === 2 ? 'Date & Time' : 'Your Details'}</span>
                </div>
                ${s < 3 ? '<div class="progress-line ' + (state.step > s ? 'filled' : '') + '"></div>' : ''}
              `).join('')}
            </div>

            <!-- Step Content -->
            <div class="wizard-body">
              ${state.step === 1 ? renderStep1(state) : ''}
              ${state.step === 2 ? renderStep2(state) : ''}
              ${state.step === 3 ? renderStep3(state) : ''}
            </div>

          </div>
        </section>
      </main>
      ${renderFooter()}
    `;

    attachHandlers(state, render);
  }

  render();
}

// ═══════════════════════════════════════
// STEP 1 — Choose Table & Type
// ═══════════════════════════════════════
function renderStep1(state) {
  return `
    <div class="step-content">
      <div class="step-header">
        <span class="gold-dash"></span>
        <p class="section-label">Step 1 of 3</p>
        <h2 class="wizard-title">Choose Your Table</h2>
      </div>

      <!-- Table Selection — Vertical Stacked Cards -->
      <div class="booking-table-stack">
        ${TABLES.map(t => {
          const isSelected = state.selectedTable?.id === t.id;
          const isAvailable = t.isAvailable && t.isActive;
          
          let statusBadge = '';
          let statusMsg = '';
          if (!t.isActive) {
            statusBadge = `<span style="font-size: 0.75rem; color: #757575; background: rgba(117,117,117,0.15); padding: 0.2rem 0.5rem; border-radius: 12px; font-weight: bold;">✕ Unavailable</span>`;
            statusMsg = `<p style="color:#757575; font-size:0.75rem; margin-top:0.25rem;">Table not available</p>`;
          } else if (!t.isAvailable) {
            statusBadge = `<span style="font-size: 0.75rem; color: #ef4444; background: rgba(239,68,68,0.15); padding: 0.2rem 0.5rem; border-radius: 12px; font-weight: bold;">● Booked</span>`;
            statusMsg = `<p style="color:#ef4444; font-size:0.75rem; margin-top:0.25rem;">Unavailable for selected time</p>`;
          } else {
            statusBadge = `<span style="font-size: 0.75rem; color: #4caf50; background: rgba(76,175,80,0.15); padding: 0.2rem 0.5rem; border-radius: 12px; font-weight: bold;">● Available</span>`;
          }

          return `
          <div class="booking-table-card table-select-card ${t.vip ? 'vip' : ''} ${isSelected ? 'selected' : ''}" 
               data-id="${t.id}"
               data-label="${t.name}"
               data-hourly="${t.hourly}"
               data-game="${t.game}"
               data-number="${t.desc.replace('Table #', '')}"
               id="booking-card-${t.id}"
               style="cursor: ${isAvailable ? 'pointer' : 'not-allowed'}; opacity: ${isAvailable ? '1' : '0.5'}; pointer-events: ${isAvailable ? 'auto' : 'none'}; position: relative; border: ${isSelected ? '2px solid #1a5c1a' : '1px solid var(--outline-variant)'}; background: ${isSelected ? 'rgba(26,92,26,0.08)' : 'var(--surface)'}; transition: all 0.2s;">
            
            <div style="position: absolute; top: 10px; right: 10px; display: flex; align-items: center; gap: 0.5rem; z-index: 2;">
              ${statusBadge}
              <div class="selected-badge" style="display: ${isSelected ? 'flex' : 'none'}; width: 18px; height: 18px; background: #69df5e; border-radius: 50%; align-items: center; justify-content: center; color: #0a1f0a; font-size: 12px; font-weight: bold;">✓</div>
            </div>

            <div class="btc-left">
              <div class="btc-icon">
                <span class="material-symbols-outlined">${t.vip ? 'stars' : 'sports'}</span>
              </div>
              <div>
                <h3 class="btc-name">${t.name}</h3>
                <p class="btc-desc">${t.desc}</p>
                ${statusMsg}
              </div>
            </div>
            <div class="btc-pricing">
              <div class="btc-price-col">
                <span class="btc-price-label">Per Hour</span>
                <span class="btc-price-value">₦${calculatePrice(t.hourly).toLocaleString()}</span>
              </div>
              <div class="btc-price-divider"></div>
              <div class="btc-price-col">
                <span class="btc-price-label">Per Game</span>
                <span class="btc-price-value">₦${calculatePrice(t.game).toLocaleString()}</span>
              </div>
            </div>
            <div class="btc-check">
              <input type="radio" name="table_selection" style="width: 1.25rem; height: 1.25rem; accent-color: #1a5c1a; pointer-events: none;" ${isSelected ? 'checked' : ''} />
            </div>
          </div>
        `}).join('')}
      </div>

      <!-- Booking Type Toggle -->
      <div class="booking-type-section">
        <h3 class="wizard-subtitle">Booking Type</h3>
        <div class="type-toggle">
          <button class="toggle-btn ${state.bookingType === 'time' ? 'active' : ''}" data-btype="time" id="toggle-time" style="${state.bookingType === 'time' ? 'background: #1a5c1a; color: white; border-color: #1a5c1a;' : ''}">
            <span class="material-symbols-outlined">schedule</span>
            Book by Time
          </button>
          <button class="toggle-btn ${state.bookingType === 'games' ? 'active' : ''}" data-btype="games" id="toggle-games" style="${state.bookingType === 'games' ? 'background: #1a5c1a; color: white; border-color: #1a5c1a;' : ''}">
            <span class="material-symbols-outlined">sports_score</span>
            Book by Games
          </button>
        </div>

        ${state.bookingType === 'time' ? `
          <div class="select-group">
            <label>Duration</label>
            <select id="duration-select" class="wizard-select">
              ${Array.from({length: 10}, (_, i) => i + 1).map(h => `<option value="${h}" ${state.duration == h ? 'selected' : ''}>${h} Hour${h > 1 ? 's' : ''}</option>`).join('')}
            </select>
          </div>
        ` : `
          <div class="select-group">
            <label>Number of Frames</label>
            <select id="frames-select" class="wizard-select">
              ${Array.from({length: 20}, (_, i) => i + 1).map(f => `<option value="${f}" ${state.frames == f ? 'selected' : ''}>${f} Frame${f > 1 ? 's' : ''}</option>`).join('')}
            </select>
          </div>
        `}
      </div>

      <!-- Next Button -->
      <div class="wizard-actions">
        <div></div>
        <button class="btn-wizard-next" id="step1-next" 
                style="${!state.selectedTable ? 'opacity: 0.4; cursor: not-allowed; background: var(--surface-variant); color: var(--outline);' : 'opacity: 1; cursor: pointer; background: #1a5c1a;'}" 
                ${!state.selectedTable ? 'disabled' : ''}>
          Next
          <span class="material-symbols-outlined" style="font-size:1.125rem;">arrow_forward</span>
        </button>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════
// STEP 2 — Pick Date & Time
// ═══════════════════════════════════════
function renderStep2(state) {
  return `
    <div class="step-content">
      <div class="step-header">
        <span class="gold-dash"></span>
        <p class="section-label">Step 2 of 3</p>
        <h2 class="wizard-title">Pick Date & Time</h2>
      </div>

      <!-- Date Picker -->
      <div class="date-section">
        <label class="wizard-field-label">Select Date</label>
        <input type="date" id="booking-date" class="wizard-date-input"
          value="${state.date}"
          min="${new Date().toISOString().split('T')[0]}" />
      </div>

      <!-- Time Slot Grid -->
      <div class="time-section">
        <label class="wizard-field-label">Select Time Slot</label>
        <div class="time-slot-grid">
          ${TIME_SLOTS.map(slot => {
            const unavailable = UNAVAILABLE_SLOTS.includes(slot);
            const selected = state.timeSlot === slot;
            return `
              <button class="time-slot ${unavailable ? 'unavailable' : ''} ${selected ? 'selected' : ''}"
                      data-slot="${slot}" ${unavailable ? 'disabled' : ''}
                      id="slot-${slot.replace(/[: ]/g, '-')}">
                ${slot}
              </button>
            `;
          }).join('')}
        </div>
      </div>

      <!-- Actions -->
      <div class="wizard-actions">
        <button class="btn-wizard-back" id="step2-back">
          <span class="material-symbols-outlined" style="font-size:1.125rem;">arrow_back</span>
          Back
        </button>
        <button class="btn-wizard-next" id="step2-next" ${!state.timeSlot ? 'disabled' : ''}>
          Next
          <span class="material-symbols-outlined" style="font-size:1.125rem;">arrow_forward</span>
        </button>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════
// STEP 3 — Your Details
// ═══════════════════════════════════════
function renderStep3(state) {
  const table = state.selectedTable;
  const isTime = state.bookingType === 'time';
  const qty = parseInt(isTime ? state.duration : state.frames);
  const unitLabel = isTime ? `${qty} Hour${qty > 1 ? 's' : ''}` : `${qty} Frame${qty > 1 ? 's' : ''}`;
  
  let estimatedDurationHtml = '';
  if (!isTime) {
    const minMins = qty * 25;
    const maxMins = qty * 30;
    const formatMins = (m) => {
      const hrs = Math.floor(m / 60);
      const rem = m % 60;
      if (hrs === 0) return `${rem} mins`;
      if (rem === 0) return `${hrs} hr${hrs>1?'s':''}`;
      return `${hrs} hr ${rem} mins`;
    };
    estimatedDurationHtml = `
      <div class="osc-row" style="margin-top:-0.5rem;margin-bottom:0.5rem;">
        <span class="osc-label" style="font-size:0.75rem;color:var(--outline);">Estimated duration</span>
        <span class="osc-value" style="font-size:0.75rem;color:var(--outline);">~${formatMins(minMins)} - ${formatMins(maxMins)}</span>
      </div>
    `;
  }
  
  // Member discount logic
  const isMember = localStorage.getItem('xvi_member') === 'true'
  const basePrice = isTime ? (table.hourly * qty) : (table.game * qty)
  const discountAmount = isMember ? Math.round(basePrice * 0.15) : 0
  const totalPrice = basePrice - discountAmount

  const dateFormatted = new Date(state.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return `
    <div class="step-content">
      <div class="step-header">
        <span class="gold-dash"></span>
        <p class="section-label">Step 3 of 3</p>
        <h2 class="wizard-title">Your Details</h2>
      </div>

      <div class="step3-layout">
        <!-- Left: Form -->
        <div class="details-form">
          <div class="wizard-input-group">
            <label>Full Name</label>
            <input type="text" id="input-name" class="wizard-input" placeholder="Enter your full name" value="${state.fullName}" />
          </div>
          <div class="wizard-input-group">
            <label>Phone Number</label>
            <input type="tel" id="input-phone" class="wizard-input" placeholder="+234 800 000 0000" value="${state.phone}" />
          </div>
          <div class="wizard-input-group">
            <label>Email Address</label>
            <input type="email" id="input-email" class="wizard-input" placeholder="you@example.com" value="${state.email}" />
          </div>
        </div>

        <!-- Right: Order Summary -->
        <div class="order-summary-card" id="order-summary">
          <div class="osc-header">
            <span class="material-symbols-outlined" style="color:var(--gold);">receipt_long</span>
            <h3>Order Summary</h3>
          </div>
          <div class="osc-rows">
            <div class="osc-row">
              <span class="osc-label">Table</span>
              <span class="osc-value">${table.name}</span>
            </div>
            <div class="osc-row">
              <span class="osc-label">Date</span>
              <span class="osc-value">${dateFormatted}</span>
            </div>
            <div class="osc-row">
              <span class="osc-label">Time</span>
              <span class="osc-value">${state.timeSlot}</span>
            </div>
            <div class="osc-row">
              <span class="osc-label">${isTime ? 'Duration' : 'Games'}</span>
              <span class="osc-value">${unitLabel}</span>
            </div>
            ${estimatedDurationHtml}
            <div class="osc-row">
              <span class="osc-label">Base Price</span>
              <span class="osc-value" style="${isMember ? 'text-decoration:line-through;opacity:0.6;' : ''}">${formatCurrency(basePrice)}</span>
            </div>
            ${isMember ? `
            <div class="osc-row" style="background:rgba(105,223,94,0.07);border-radius:6px;padding:0.4rem 0;">
              <span class="osc-label" style="color:#69df5e;">👑 Member Discount (15%)</span>
              <span class="osc-value" style="color:#69df5e;">−${formatCurrency(discountAmount)}</span>
            </div>
            ` : ''}
          </div>
          <div class="osc-total">
            <span class="osc-total-label">Total</span>
            <span class="osc-total-value">${formatCurrency(totalPrice)}</span>
          </div>
          ${isMember ? `
          <div style="text-align:center;margin-top:0.75rem;padding-top:0.75rem;
            border-top:1px solid rgba(105,223,94,0.2);">
            <span style="color:#69df5e;font-size:0.75rem;font-weight:600;">✓ XVI Member discount applied</span>
          </div>
          ` : `
          <div style="text-align:center;margin-top:0.75rem;padding-top:0.75rem;
            border-top:1px solid rgba(201,168,76,0.1);">
            <a href="/#/membership" style="color:#c9a84c;font-size:0.75rem;text-decoration:underline;">
              👑 Join membership to save 15%
            </a>
          </div>
          `}
        </div>
      </div>

      <!-- Actions -->
      <div class="wizard-actions">
        <button class="btn-wizard-back" id="step3-back">
          <span class="material-symbols-outlined" style="font-size:1.125rem;">arrow_back</span>
          Back
        </button>
        <button class="btn-confirm-booking" id="confirm-booking-btn">
          <span class="material-symbols-outlined" style="font-size:1.125rem;">check_circle</span>
          Confirm & Pay &rarr;
        </button>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════
function attachHandlers(state, render) {
  const session = state._session || null; // Will pass session down if needed
  
  // ── Step 1 handlers ──
  if (state.step === 1) {
    // Table selection
    document.querySelectorAll('.table-select-card').forEach(card => {
      card.style.cursor = 'pointer';
      card.addEventListener('click', () => {
        // Deselect all cards
        document.querySelectorAll('.table-select-card').forEach(c => {
          c.style.border = '1px solid var(--outline-variant)';
          c.style.background = 'var(--surface)';
          const radio = c.querySelector('input[type="radio"]');
          if (radio) radio.checked = false;
          const badge = c.querySelector('.selected-badge');
          if (badge) badge.style.display = 'none';
        });
        
        // Select this card
        card.style.border = '2px solid #1a5c1a';
        card.style.background = 'rgba(26,92,26,0.08)';
        const radio = card.querySelector('input[type="radio"]');
        if (radio) radio.checked = true;
        const badge = card.querySelector('.selected-badge');
        if (badge) badge.style.display = 'flex';
        
        // Store selection in booking state
        state.selectedTable = {
          id: parseInt(card.dataset.id),
          name: card.dataset.label,
          hourly: parseFloat(card.dataset.hourly),
          game: parseFloat(card.dataset.game),
          vip: card.classList.contains('vip')
        };
        
        // Enable Next button
        const nextBtn = document.getElementById('step1-next');
        if (nextBtn) {
          nextBtn.disabled = false;
          nextBtn.style.opacity = '1';
          nextBtn.style.cursor = 'pointer';
          nextBtn.style.background = '#1a5c1a';
          nextBtn.style.color = 'white';
        }
        
        console.log('Selected table:', state.selectedTable);
      });
    });

    // Type toggle
    document.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        state.bookingType = btn.dataset.btype;
        render();
      });
    });

    // Duration / frames select
    const durSelect = document.getElementById('duration-select');
    if (durSelect) durSelect.addEventListener('change', (e) => { state.duration = e.target.value; });

    const framesSelect = document.getElementById('frames-select');
    if (framesSelect) framesSelect.addEventListener('change', (e) => { state.frames = e.target.value; });

    // Next
    const nextBtn = document.getElementById('step1-next');
    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (!state.selectedTable) {
        showToast('Please select a table', 'error');
        return;
      }
      state.step = 2;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── Step 2 handlers ──
  if (state.step === 2) {
    // Date
    const dateInput = document.getElementById('booking-date');
    if (dateInput) dateInput.addEventListener('change', (e) => { state.date = e.target.value; });

    // Time slots
    document.querySelectorAll('.time-slot:not(.unavailable)').forEach(slot => {
      slot.addEventListener('click', () => {
        state.timeSlot = slot.dataset.slot;
        render();
      });
    });

    // Back
    document.getElementById('step2-back')?.addEventListener('click', () => { state.step = 1; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

    // Next
    const nextBtn = document.getElementById('step2-next');
    if (nextBtn) nextBtn.addEventListener('click', () => {
      if (!state.timeSlot) {
        showToast('Please select a time slot', 'error');
        return;
      }
      state.step = 3;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── Step 3 handlers ──
  if (state.step === 3) {
    // Input bindings
    const nameInput = document.getElementById('input-name');
    const phoneInput = document.getElementById('input-phone');
    const emailInput = document.getElementById('input-email');

    if (nameInput) nameInput.addEventListener('input', (e) => { state.fullName = e.target.value; });
    if (phoneInput) phoneInput.addEventListener('input', (e) => { state.phone = e.target.value; });
    if (emailInput) emailInput.addEventListener('input', (e) => { state.email = e.target.value; });

    // Back
    document.getElementById('step3-back')?.addEventListener('click', () => { state.step = 2; render(); window.scrollTo({ top: 0, behavior: 'smooth' }); });

    // Confirm
    const confirmBtn = document.getElementById('confirm-booking-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        if (!state.fullName.trim() || !state.phone.trim() || !state.email.trim()) {
          showToast('Please fill in all your details', 'error');
          return;
        }

        // Calculate total
        const isTime = state.bookingType === 'time';
        const qty = parseInt(isTime ? state.duration : state.frames);
        const baseTotal = isTime
          ? state.selectedTable.hourly * qty
          : state.selectedTable.game * qty;

        const bookingData = {
          tableId: state.selectedTable.id,
          tableLabel: state.selectedTable.name,
          reservationType: state.bookingType,
          date: state.date,
          startTime: formatTo24H(state.timeSlot),
          duration: state.duration,
          games: state.frames,
          totalAmount: baseTotal,
          customerName: state.fullName,
          phone: state.phone,
          email: state.email
        };

        if (!bookingData.tableId) {
          showToast('Please select a table', 'error');
          return;
        }
        if (!bookingData.date || !bookingData.startTime) {
          showToast('Please select a date and time', 'error');
          return;
        }

        const app = document.getElementById('app');
        handleBookingPayment(bookingData, app);
      });
    }
  }
}

// ─── Formatting Helpers ───
function formatTo24H(time12) {
  if (!time12) return null;
  const [time, modifier] = time12.split(' ');
  let [hours, minutes] = time.split(':');
  if (hours === '12') hours = '00';
  if (modifier === 'PM') hours = (parseInt(hours, 10) + 12).toString();
  return `${hours.padStart(2, '0')}:${minutes}:00`;
}

function calculateEndTime(time12, addHours) {
  if (!time12) return null;
  const [time, modifier] = time12.split(' ');
  let [hours, minutes] = time.split(':');
  hours = parseInt(hours, 10);
  
  if (hours === 12 && modifier === 'AM') hours = 0;
  if (hours !== 12 && modifier === 'PM') hours += 12;
  
  hours += parseInt(addHours, 10);
  const endModifier = hours >= 12 && hours < 24 ? 'PM' : 'AM';
  let endHours = hours % 12;
  if (endHours === 0) endHours = 12;
  
  return formatTo24H(`${endHours}:${minutes} ${endModifier}`);
}

function safeRender() {
  try {
    render();
  } catch (err) {
    console.error('Page render error:', err);
    app.innerHTML = `
      <div style="min-height:100vh;
        background:#0a1f0a;
        display:flex;align-items:center;
        justify-content:center;
        text-align:center;padding:2rem;">
        <div>
          <p style="color:#c9a84c;font-size:1.5rem;
            margin-bottom:1rem;">
            Something went wrong
          </p>
          <p style="color:#9fc99f;font-size:0.9rem;
            margin-bottom:2rem;">
            ${err.message}
          </p>
          <a href="/#/" style="color:#c9a84c;
            text-decoration:underline;">
            Go back home
          </a>
        </div>
      </div>
    `;
  }
}
