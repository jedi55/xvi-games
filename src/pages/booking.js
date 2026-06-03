import { getSession } from '../lib/auth.js';
import { router } from '../lib/router.js';
import { renderHeader, renderFooter, showToast, formatCurrency } from '../components/layout.js';
import { supabase } from '../lib/supabase.js';
import { sendBookingConfirmationEmail } from '../lib/email.js';
import { calculatePrice } from '../utils/membershipUtils.js';

// Read dynamic discount percent stored at membership sign-up
function getMemberDiscount() {
  if (localStorage.getItem('xvi_member') !== 'true') return 0;
  return parseInt(localStorage.getItem('xvi_member_discount') || '15');
}

async function handleBookingPayment(bookingData, app, state, render) {
  const { data: { session } } = await supabase.auth.getSession();

  if (!session?.user) {
    window.location.href = '/#/login';
    return;
  }

  // Check if user is a member for discount
  const isMember = localStorage.getItem('xvi_member') === 'true';
  const discountPercent = getMemberDiscount();

  const baseAmount = bookingData.totalAmount;
  const discountAmount = discountPercent > 0
    ? Math.round(baseAmount * (discountPercent / 100)) : 0;
  const finalAmount = baseAmount - discountAmount;

  if (typeof PaystackPop === 'undefined') {
    alert('Payment system not loaded. Please refresh and try again.');
    return;
  }

  const confirmBtn = document.getElementById('confirm-booking-btn');
  if (confirmBtn) {
    confirmBtn.innerHTML = '<span class="material-symbols-outlined spin" style="animation: spin 1s linear infinite;">refresh</span> Processing...';
    confirmBtn.disabled = true;
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
        { display_name: 'Table', variable_name: 'table', value: bookingData.tableLabel },
        { display_name: 'Booking Date', variable_name: 'date', value: bookingData.date },
        { display_name: 'Start Time', variable_name: 'start_time', value: bookingData.startTime },
        { display_name: 'Booking Type', variable_name: 'type', value: bookingData.reservationType },
        { display_name: 'Member Discount', variable_name: 'member_discount', value: isMember ? discountPercent + '%' : 'None' }
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
          .single();

        // 2. Calculate end time
        const startDateTime = new Date(bookingData.date + 'T' + bookingData.startTime);
        const endDateTime = new Date(startDateTime);

        if (bookingData.reservationType === 'time') {
          endDateTime.setHours(endDateTime.getHours() + parseInt(bookingData.duration));
        } else {
          endDateTime.setMinutes(endDateTime.getMinutes() + parseInt(bookingData.games) * 30);
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
            number_of_games: bookingData.reservationType === 'games' ? parseInt(bookingData.games) : null,
            duration_hours: bookingData.reservationType === 'time' ? parseInt(bookingData.duration) : null,
            total_amount: finalAmount * 100,
            payment_status: 'paid',
            paystack_reference: transaction.reference,
            status: 'confirmed'
          })
          .select()
          .single();

        // Generate unique code in format XVI-[YEAR]-[5CHARS]
        const year = new Date().getFullYear();
        const rand5 = Math.random().toString(36).substring(2, 7).toUpperCase();
        const refCode = booking?.reference_code || `XVI-${year}-${rand5}`;

        // 4. Send confirmation email (non-blocking)
        sendBookingConfirmationEmail({
          to: bookingData.email || session.user.email,
          customerName: bookingData.customerName,
          referenceCode: refCode,
          tableLabel: bookingData.tableLabel,
          date: bookingData.date,
          startTime: bookingData.startTime,
          duration: bookingData.reservationType === 'time'
            ? bookingData.duration + ' hour(s)'
            : bookingData.games + ' game(s)',
          totalPaid: finalAmount,
          isMember: isMember,
          discount: discountAmount
        }).catch(e => console.warn('Email non-fatal:', e));

        // 5. Save confirmation to sessionStorage for /#/confirmed page
        sessionStorage.setItem('confirmedReservation', JSON.stringify({
          refCode:     refCode,
          tableName:   bookingData.tableLabel,
          date:        bookingData.date,
          timeSlot:    state.timeSlot || bookingData.startTime,
          bookingType: bookingData.reservationType,
          duration:    bookingData.duration,
          frames:      bookingData.games,
          totalAmount: finalAmount,
          fullName:    bookingData.customerName,
          phone:       bookingData.phone,
          email:       bookingData.email || session.user.email
        }));

        // Navigate to the dedicated confirmation page
        window.location.hash = '#/confirmed';

      } catch (err) {
        console.error('Booking save error:', err);
        // Payment succeeded — still navigate to confirmation with fallback code
        const year = new Date().getFullYear();
        const rand5 = Math.random().toString(36).substring(2, 7).toUpperCase();
        const fallbackCode = `XVI-${year}-${rand5}`;
        sessionStorage.setItem('confirmedReservation', JSON.stringify({
          refCode:     fallbackCode,
          tableName:   bookingData.tableLabel,
          date:        bookingData.date,
          timeSlot:    state.timeSlot || bookingData.startTime,
          bookingType: bookingData.reservationType,
          duration:    bookingData.duration,
          frames:      bookingData.games,
          totalAmount: finalAmount,
          fullName:    bookingData.customerName,
          phone:       bookingData.phone,
          email:       bookingData.email || session.user.email
        }));
        window.location.hash = '#/confirmed';
      }
    },

    onCancel: () => {
      if (confirmBtn) {
        confirmBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1.125rem;">check_circle</span> Confirm & Pay';
        confirmBtn.disabled = false;
      }
    }
  });

  handler.openIframe();
}

// ── Table Data ──
let TABLES = [];

const TIME_SLOTS = [
  '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM',
  '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM',
  '8:00 PM', '9:00 PM', '10:00 PM'
];

const UNAVAILABLE_SLOTS = ['1:00 PM', '5:00 PM', '9:00 PM'];

export async function renderBookingPage(app, params = {}) {
  const session = await getSession();

  async function fetchLiveTables() {
    try {
      const { data: tables, error } = await supabase
        .from('snooker_tables')
        .select('*')
        .order('table_number', { ascending: true });
      
      if (error) throw error;
      return tables || [];
    } catch (e) {
      console.error('Failed to fetch tables:', e);
      return [];
    }
  }

  const dbTables = await fetchLiveTables();
  TABLES = dbTables.map(t => ({
    id: t.id,
    name: t.label || t.name,
    desc: `Table #${t.table_number}`,
    hourly: t.hourly_rate / 100,
    game: t.per_game_rate / 100,
    vip: (t.label || t.name || '').includes('VIP'),
    isAvailable: true,
    isActive: t.is_active
  }));

  const initialTableId = params.tableId ? parseInt(params.tableId) : null;

  // State
  const state = {
    _session: session,
    step: 1,
    selectedTable: initialTableId ? TABLES.find(t => t.id === initialTableId) : null,
    bookingType: 'time',       // 'time' or 'games'
    duration: '1',             // hours
    frames: '1',               // number of frames
    date: new Date().toISOString().split('T')[0],
    timeSlot: '',
    fullName: session?.user?.user_metadata?.full_name || '',
    phone: '',
    email: session?.user?.email || '',
    confirmationDetails: null
  };

  async function updateTableAvailability() {
    if (!state.date || !state.timeSlot) return;

    try {
      const { data: bookings, error } = await supabase
        .from('reservations')
        .select('table_id, start_time, end_time')
        .in('status', ['confirmed'])
        .eq('date', state.date);

      if (error) throw error;

      const userStart = formatTo24H(state.timeSlot);
      const isTime = state.bookingType === 'time';
      const qty = parseInt(isTime ? state.duration : state.frames);
      const startDateTime = new Date(state.date + 'T' + userStart);
      const endDateTime = new Date(startDateTime);

      if (isTime) {
        endDateTime.setHours(endDateTime.getHours() + qty);
      } else {
        endDateTime.setMinutes(endDateTime.getMinutes() + qty * 30);
      }

      const userEnd = endDateTime.toTimeString().split(' ')[0];

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
          if (userStart < bEnd && userEnd > bStart) {
            bookedTableIds.add(b.table_id);
          }
        });
      }

      TABLES.forEach(t => {
        t.isAvailable = !bookedTableIds.has(t.id);
      });
    } catch (e) {
      console.error('Failed to update table availability:', e);
    }
  }

  function render() {
    app.innerHTML = `
      ${renderHeader(session, '')}
      <main class="page-content">
        <section class="booking-wizard">
          <div class="wizard-container">

            <!-- Progress Bar -->
            <div class="wizard-progress" id="booking-progress">
              ${[1, 2, 3, 4].map(s => `
                <div class="progress-step ${state.step >= s ? 'active' : ''} ${state.step > s ? 'completed' : ''}">
                  <div class="step-circle">
                    ${state.step > s ? '<span class="material-symbols-outlined" style="font-size:1rem;">check</span>' : s}
                  </div>
                  <span class="step-label">
                    ${s === 1 ? 'Booking Type' : s === 2 ? 'Select Table' : s === 3 ? 'Summary & Payment' : 'Confirmation'}
                  </span>
                </div>
                ${s < 4 ? '<div class="progress-line ' + (state.step > s ? 'filled' : '') + '"></div>' : ''}
              `).join('')}
            </div>

            <!-- Step Content -->
            <div class="wizard-body">
              ${state.step === 1 ? renderStep1(state) : ''}
              ${state.step === 2 ? renderStep2(state) : ''}
              ${state.step === 3 ? renderStep3(state) : ''}
              ${state.step === 4 ? renderStep4(state) : ''}
            </div>

          </div>
        </section>
      </main>
      ${renderFooter()}
    `;

    attachHandlers(state, render, updateTableAvailability);
  }

  render();
}

// ═══════════════════════════════════════
// STEP 1 — Choose Booking Type
// ═══════════════════════════════════════
function renderStep1(state) {
  return `
    <div class="step-content">
      <div class="step-header">
        <span class="gold-dash"></span>
        <p class="section-label">Step 1 of 4</p>
        <h2 class="wizard-title">Choose Booking Type</h2>
      </div>

      <div class="booking-type-options" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
        <button class="booking-type-card ${state.bookingType === 'time' ? 'active' : ''}" 
                id="select-type-time"
                style="padding: 2rem; border-radius: 12px; background: ${state.bookingType === 'time' ? 'rgba(105,223,94,0.05)' : 'var(--surface-container-low)'}; border: 2px solid ${state.bookingType === 'time' ? 'var(--primary)' : 'var(--outline-variant)'}; color: white; cursor: pointer; text-align: center; transition: all 0.2s;">
          <span class="material-symbols-outlined" style="font-size: 3rem; color: ${state.bookingType === 'time' ? 'var(--primary)' : 'inherit'}; margin-bottom: 0.5rem; display: block;">schedule</span>
          <span style="font-weight: 700; font-size: 1.1rem; display: block;">Book by Time</span>
          <span style="font-size: 0.8rem; opacity: 0.7; display: block; margin-top: 0.25rem;">Reserve tables for a set duration</span>
        </button>

        <button class="booking-type-card ${state.bookingType === 'games' ? 'active' : ''}" 
                id="select-type-games"
                style="padding: 2rem; border-radius: 12px; background: ${state.bookingType === 'games' ? 'rgba(105,223,94,0.05)' : 'var(--surface-container-low)'}; border: 2px solid ${state.bookingType === 'games' ? 'var(--primary)' : 'var(--outline-variant)'}; color: white; cursor: pointer; text-align: center; transition: all 0.2s;">
          <span class="material-symbols-outlined" style="font-size: 3rem; color: ${state.bookingType === 'games' ? 'var(--primary)' : 'inherit'}; margin-bottom: 0.5rem; display: block;">sports_score</span>
          <span style="font-weight: 700; font-size: 1.1rem; display: block;">Book by Games</span>
          <span style="font-size: 0.8rem; opacity: 0.7; display: block; margin-top: 0.25rem;">Reserve tables for a number of frames</span>
        </button>
      </div>

      ${state.bookingType === 'time' ? `
        <div class="duration-selector-wrapper" style="margin-bottom: 2rem;">
          <label class="wizard-field-label" style="display: block; margin-bottom: 0.75rem; font-weight: 600; color: var(--gold);">Select Duration</label>
          <select id="duration-select" class="wizard-select" style="width: 100%; padding: 0.85rem; background: var(--surface-container-low); border: 1px solid var(--outline-variant); border-radius: 8px; color: white;">
            ${Array.from({length: 10}, (_, i) => i + 1).map(h => `<option value="${h}" ${state.duration == h ? 'selected' : ''}>${h} Hour${h > 1 ? 's' : ''}</option>`).join('')}
          </select>
        </div>
      ` : `
        <div class="frames-selector-wrapper" style="margin-bottom: 2rem;">
          <label class="wizard-field-label" style="display: block; margin-bottom: 0.75rem; font-weight: 600; color: var(--gold);">Select Number of Frames</label>
          <select id="frames-select" class="wizard-select" style="width: 100%; padding: 0.85rem; background: var(--surface-container-low); border: 1px solid var(--outline-variant); border-radius: 8px; color: white;">
            ${Array.from({length: 20}, (_, i) => i + 1).map(f => `<option value="${f}" ${state.frames == f ? 'selected' : ''}>${f} Frame${f > 1 ? 's' : ''}</option>`).join('')}
          </select>
        </div>
      `}

      <div class="wizard-actions" style="display: flex; justify-content: flex-end; margin-top: 2rem;">
        <button class="btn-wizard-next" id="step1-next" style="padding: 0.85rem 2rem; background: #1a5c1a; color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
          Next
          <span class="material-symbols-outlined" style="font-size:1.125rem;">arrow_forward</span>
        </button>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════
// STEP 2 — Select Table & Session
// ═══════════════════════════════════════
function renderStep2(state) {
  const isTime = state.bookingType === 'time';
  return `
    <div class="step-content">
      <div class="step-header">
        <span class="gold-dash"></span>
        <p class="section-label">Step 2 of 4</p>
        <h2 class="wizard-title">Select Table & Session</h2>
      </div>

      <div class="session-picker-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 1.5rem; margin-bottom: 2rem;">
        <!-- Date Picker -->
        <div class="date-section">
          <label class="wizard-field-label" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--gold);">Select Date</label>
          <input type="date" id="booking-date" class="wizard-date-input"
            value="${state.date}"
            min="${new Date().toISOString().split('T')[0]}" 
            style="width: 100%; padding: 0.85rem; background: var(--surface-container-low); border: 1px solid var(--outline-variant); border-radius: 8px; color: white;" />
        </div>

        <!-- Time Slot Picker -->
        <div class="time-section">
          <label class="wizard-field-label" style="display: block; margin-bottom: 0.5rem; font-weight: 600; color: var(--gold);">Select Start Time</label>
          <select id="booking-time-slot" class="wizard-select" style="width: 100%; padding: 0.85rem; background: var(--surface-container-low); border: 1px solid var(--outline-variant); border-radius: 8px; color: white;">
            <option value="" ${!state.timeSlot ? 'selected' : ''}>-- Choose a Time Slot --</option>
            ${TIME_SLOTS.map(slot => {
              const unavailable = UNAVAILABLE_SLOTS.includes(slot);
              return `<option value="${slot}" ${state.timeSlot === slot ? 'selected' : ''} ${unavailable ? 'disabled' : ''}>${slot}${unavailable ? ' (Booked)' : ''}</option>`;
            }).join('')}
          </select>
        </div>
      </div>

      <!-- Table Selection Section -->
      <div class="table-selection-section" style="margin-bottom: 2rem;">
        <h3 class="wizard-subtitle" style="margin-bottom: 1rem; color: white;">Available Tables</h3>
        
        ${!state.timeSlot ? `
          <div style="text-align: center; padding: 3rem; background: var(--surface-container-low); border-radius: 12px; border: 1px dashed var(--outline-variant);">
            <span class="material-symbols-outlined" style="font-size: 3rem; color: var(--on-surface-variant); opacity: 0.5; margin-bottom: 0.5rem; display: block;">info</span>
            <p style="color: var(--on-surface-variant); margin: 0;">Please select a date and start time slot to view table availability.</p>
          </div>
        ` : `
          <div class="booking-table-stack" style="display: flex; flex-direction: column; gap: 1rem;">
            ${TABLES.map(t => {
              const isSelected = state.selectedTable?.id === t.id;
              const isAvailable = t.isAvailable && t.isActive;
              
              let statusBadge = '';
              let statusMsg = '';
              if (!t.isActive) {
                statusBadge = `<span style="font-size: 0.75rem; color: #757575; background: rgba(117,117,117,0.15); padding: 0.2rem 0.5rem; border-radius: 12px; font-weight: bold;">✕ Inactive</span>`;
                statusMsg = `<p style="color:#757575; font-size:0.75rem; margin-top:0.25rem;">Table is currently out of service</p>`;
              } else if (!t.isAvailable) {
                statusBadge = `<span style="font-size: 0.75rem; color: #ef4444; background: rgba(239,68,68,0.15); padding: 0.2rem 0.5rem; border-radius: 12px; font-weight: bold;">✕ Booked</span>`;
                statusMsg = `<p style="color:#ef4444; font-size:0.75rem; margin-top:0.25rem;">Unavailable for the selected time slot</p>`;
              } else {
                statusBadge = `<span style="font-size: 0.75rem; color: #4caf50; background: rgba(76,175,80,0.15); padding: 0.2rem 0.5rem; border-radius: 12px; font-weight: bold;">✓ Available</span>`;
              }

              const displayPrice = isTime ? t.hourly : t.game;

              return `
                <div class="booking-table-card table-select-card ${t.vip ? 'vip' : ''} ${isSelected ? 'selected' : ''}" 
                     data-id="${t.id}"
                     data-label="${t.name}"
                     data-hourly="${t.hourly}"
                     data-game="${t.game}"
                     data-desc="${t.desc}"
                     data-available="${isAvailable ? '1' : '0'}"
                     style="padding: 1.25rem; border-radius: 12px; background: ${isSelected ? 'rgba(201,168,76,0.08)' : 'var(--surface)'}; border: ${isSelected ? '2px solid #c9a84c' : '1px solid var(--outline-variant)'}; display: flex; align-items: center; justify-content: space-between; cursor: ${isAvailable ? 'pointer' : 'not-allowed'}; opacity: ${isAvailable ? '1' : '0.55'}; transition: all 0.2s;">
                  
                  <div style="display: flex; align-items: center; gap: 1rem;">
                    <div style="width: 48px; height: 48px; border-radius: 8px; background: ${t.vip ? 'rgba(201,168,76,0.15)' : 'rgba(105,223,94,0.1)'}; display: flex; align-items: center; justify-content: center;">
                      <span class="material-symbols-outlined" style="color: ${t.vip ? '#c9a84c' : '#69df5e'};">${t.vip ? 'stars' : 'sports'}</span>
                    </div>
                    <div>
                      <h4 style="margin: 0; font-size: 1.1rem; color: white; display: flex; align-items: center; gap: 0.5rem;">
                        ${t.name}
                        ${t.vip ? '<span style="font-size: 0.65rem; background: #c9a84c; color: #000; padding: 0.15rem 0.4rem; border-radius: 4px; font-weight: 700;">VIP</span>' : ''}
                      </h4>
                      <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: var(--on-surface-variant);">${t.desc}</p>
                      ${statusMsg}
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; gap: 2rem;">
                    <div style="text-align: right;">
                      <span style="font-size: 0.75rem; color: var(--on-surface-variant); display: block;">Price (${isTime ? 'Hourly' : 'per Game'})</span>
                      <span style="font-size: 1.25rem; font-weight: 700; color: #c9a84c;">₦${calculatePrice(displayPrice).toLocaleString()}</span>
                    </div>
                    <div style="display: flex; align-items: center; gap: 0.75rem;">
                      ${statusBadge}
                      ${isAvailable ? `
                        <input type="radio" class="table-radio" name="table_selection" style="width: 1.25rem; height: 1.25rem; accent-color: #c9a84c; pointer-events: none; cursor: pointer;" ${isSelected ? 'checked' : ''} />
                      ` : ''}
                    </div>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        `}
      </div>

      <!-- Actions -->
      <div class="wizard-actions" style="display: flex; justify-content: space-between; margin-top: 2rem;">
        <button class="btn-wizard-back" id="step2-back" style="padding: 0.85rem 2rem; background: transparent; border: 1px solid var(--outline-variant); color: white; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
          <span class="material-symbols-outlined" style="font-size:1.125rem;">arrow_back</span>
          Back
        </button>
        <button class="btn-wizard-next" id="step2-next" 
                style="padding: 0.85rem 2rem; background: #1a5c1a; color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; ${(!state.selectedTable || !state.timeSlot) ? 'opacity: 0.55;' : ''}">
          Next
          <span class="material-symbols-outlined" style="font-size:1.125rem;">arrow_forward</span>
        </button>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════
// STEP 3 — Summary & Payment
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
      <div class="osc-row" style="margin-top:-0.5rem;margin-bottom:0.5rem; display: flex; justify-content: space-between;">
        <span class="osc-label" style="font-size:0.75rem;color:var(--outline);">Estimated duration</span>
        <span class="osc-value" style="font-size:0.75rem;color:var(--outline);">~${formatMins(minMins)} - ${formatMins(maxMins)}</span>
      </div>
    `;
  }
  
  const isMember = localStorage.getItem('xvi_member') === 'true';
  const discountPercent = getMemberDiscount();
  const basePrice = isTime ? (table.hourly * qty) : (table.game * qty);
  const discountAmount = discountPercent > 0 ? Math.round(basePrice * (discountPercent / 100)) : 0;
  const totalPrice = basePrice - discountAmount;

  const dateFormatted = new Date(state.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  return `
    <div class="step-content">
      <div class="step-header">
        <span class="gold-dash"></span>
        <p class="section-label">Step 3 of 4</p>
        <h2 class="wizard-title">Summary & Payment</h2>
      </div>

      <div class="step3-layout" style="display: grid; grid-template-columns: 1.2fr 0.8fr; gap: 2.5rem; margin-bottom: 2rem;">
        <!-- Left: Form -->
        <div class="details-form">
          <h3 class="wizard-subtitle" style="margin-bottom: 1.5rem; color: white;">Your Details</h3>
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
        <div class="order-summary-card" id="order-summary" style="background: var(--surface-container-low); border: 1px solid rgba(201, 168, 76, 0.15); border-radius: 12px; padding: 1.5rem; display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div class="osc-header" style="display: flex; align-items: center; gap: 0.5rem; border-bottom: 1px solid var(--outline-variant); padding-bottom: 0.75rem; margin-bottom: 1rem;">
              <span class="material-symbols-outlined" style="color:var(--gold);">receipt_long</span>
              <h3 style="margin: 0; font-size: 1rem; color: var(--gold); text-transform: uppercase; letter-spacing: 0.1em;">Order Summary</h3>
            </div>
            <div class="osc-rows" style="display: flex; flex-direction: column; gap: 0.75rem;">
              <div class="osc-row" style="display: flex; justify-content: space-between;">
                <span class="osc-label" style="color: var(--on-surface-variant);">Table</span>
                <span class="osc-value" style="color: white; font-weight: 600;">${table.name}${table.desc ? ' · ' + table.desc : ''}</span>
              </div>
              <div class="osc-row" style="display: flex; justify-content: space-between;">
                <span class="osc-label" style="color: var(--on-surface-variant);">Date</span>
                <span class="osc-value" style="color: white;">${dateFormatted}</span>
              </div>
              <div class="osc-row" style="display: flex; justify-content: space-between;">
                <span class="osc-label" style="color: var(--on-surface-variant);">Time</span>
                <span class="osc-value" style="color: white;">${state.timeSlot}</span>
              </div>
              <div class="osc-row" style="display: flex; justify-content: space-between;">
                <span class="osc-label" style="color: var(--on-surface-variant);">${isTime ? 'Duration' : 'Games'}</span>
                <span class="osc-value" style="color: white;">${unitLabel}</span>
              </div>
              ${estimatedDurationHtml}
              <div class="osc-row" style="display: flex; justify-content: space-between; border-top: 1px dashed var(--outline-variant); padding-top: 0.75rem; margin-top: 0.5rem;">
                <span class="osc-label" style="color: var(--on-surface-variant);">Base Price</span>
                <span class="osc-value" style="color: white; ${isMember ? 'text-decoration:line-through;opacity:0.6;' : ''}">${formatCurrency(basePrice)}</span>
              </div>
              ${isMember ? `
              <div class="osc-row" style="display: flex; justify-content: space-between; background:rgba(105,223,94,0.07); border-radius:6px; padding:0.4rem 0.5rem; margin-top: 0.25rem;">
                <span class="osc-label" style="color:#69df5e;">👑 Member Discount (${discountPercent}%)</span>
                <span class="osc-value" style="color:#69df5e;">−${formatCurrency(discountAmount)}</span>
              </div>
              ` : ''}
            </div>
          </div>
          
          <div style="margin-top: 1.5rem; border-top: 1px solid var(--outline-variant); padding-top: 1rem;">
            <div class="osc-total" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <span class="osc-total-label" style="color: white; font-weight: 700; font-size: 1.1rem;">Total</span>
              <span class="osc-total-value" style="color: #c9a84c; font-weight: 800; font-size: 1.4rem;">${formatCurrency(totalPrice)}</span>
            </div>
            
            ${isMember ? `
            <div style="text-align:center; margin-bottom: 0.5rem;">
              <span style="color:#69df5e;font-size:0.75rem;font-weight:600;">✓ XVI Member discount applied</span>
            </div>
            ` : `
            <div style="text-align:center; margin-bottom: 0.5rem;">
              <a href="/#/membership" style="color:#c9a84c;font-size:0.75rem;text-decoration:underline;">
                👑 Join membership to save ${discountPercent}%
              </a>
            </div>
            `}
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="wizard-actions" style="display: flex; justify-content: space-between; margin-top: 2rem;">
        <button class="btn-wizard-back" id="step3-back" style="padding: 0.85rem 2rem; background: transparent; border: 1px solid var(--outline-variant); color: white; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
          <span class="material-symbols-outlined" style="font-size:1.125rem;">arrow_back</span>
          Back
        </button>
        <button class="btn-confirm-booking" id="confirm-booking-btn" style="padding: 0.85rem 2rem; background: #1a5c1a; color: white; border: none; border-radius: 8px; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.5rem;">
          <span class="material-symbols-outlined" style="font-size:1.125rem;">check_circle</span>
          Confirm & Pay
        </button>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════
// STEP 4 — Booking Confirmation
// ═══════════════════════════════════════
function renderStep4(state) {
  const details = state.confirmationDetails;
  if (!details) {
    return `
      <div style="text-align: center; padding: 3rem;">
        <p style="color: red;">No booking confirmation details found.</p>
        <a href="/#/" style="color: var(--primary); text-decoration: underline;">Go back home</a>
      </div>
    `;
  }

  return `
    <div class="step-content" style="max-width: 500px; margin: 0 auto;">
      <div class="step-header" style="text-align: center; margin-bottom: 2rem;">
        <div style="width:72px; height:72px; border-radius:50%; background:rgba(76,175,80,0.15); border:2px solid #4caf50; display:flex; align-items:center; justify-content:center; margin:0 auto 1.25rem;">
          <span style="color:#4caf50; font-size:2rem; line-height:1; font-weight: bold;">✓</span>
        </div>
        <h2 class="wizard-title" style="color: white; margin-bottom: 0.5rem;">Booking Confirmed!</h2>
        <p style="color: var(--on-surface-variant); font-size: 0.95rem; margin: 0;">Present this code at the location.</p>
      </div>

      <!-- Prominent Booking Code Card -->
      <div style="background:rgba(201,168,76,0.1); border:2px dashed rgba(201,168,76,0.4); border-radius:12px; padding:1.5rem; text-align:center; margin-bottom:1.5rem; position: relative;">
        <p style="color:rgba(255,255,255,0.5); font-size:0.75rem; text-transform:uppercase; letter-spacing:2px; margin:0 0 0.5rem;">
          Your Booking Code
        </p>
        <p id="booking-code-text" style="color:#c9a84c; font-size:2.25rem; font-weight:800; letter-spacing:4px; font-family:monospace; margin:0 0 1rem 0;">
          ${details.referenceCode}
        </p>
        
        <div style="display: flex; justify-content: center; gap: 1rem;">
          <button id="copy-code-btn" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: white; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.35rem;">
            <span class="material-symbols-outlined" style="font-size: 1rem;">content_copy</span>
            Copy Code
          </button>
          <button id="download-code-btn" style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.12); color: white; padding: 0.5rem 1rem; border-radius: 6px; font-size: 0.85rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.35rem;">
            <span class="material-symbols-outlined" style="font-size: 1rem;">download</span>
            Download Receipt
          </button>
        </div>
      </div>

      <!-- Detail rows -->
      <div style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:1.25rem; margin-bottom:2rem;">
        <div style="display:grid; gap:0.75rem;">
          <div style="display:flex; justify-content:space-between;">
            <span style="color:rgba(255,255,255,0.5); font-size:0.85rem;">Table</span>
            <span style="color:white; font-size:0.9rem; font-weight:600;">${details.tableLabel}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:rgba(255,255,255,0.5); font-size:0.85rem;">Date</span>
            <span style="color:white; font-size:0.9rem;">${details.date}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:rgba(255,255,255,0.5); font-size:0.85rem;">Time</span>
            <span style="color:white; font-size:0.9rem;">${details.startTime}</span>
          </div>
          <div style="display:flex; justify-content:space-between;">
            <span style="color:rgba(255,255,255,0.5); font-size:0.85rem;">Duration</span>
            <span style="color:white; font-size:0.9rem;">${details.duration}</span>
          </div>
          <div style="display:flex; justify-content:space-between; padding-top:0.75rem; border-top:1px solid rgba(255,255,255,0.08);">
            <span style="color:rgba(255,255,255,0.5); font-size:0.85rem;">Total Paid</span>
            <span style="color:#c9a84c; font-weight:700; font-size:1.1rem;">₦${details.totalPaid.toLocaleString()}</span>
          </div>
        </div>
      </div>

      <div style="display: flex; flex-direction: column; gap: 0.75rem;">
        <button id="book-another-wizard-btn" style="width:100%; padding:0.875rem; background:#1a5c1a; color:white; border:none; border-radius:8px; font-size:0.95rem; font-weight:600; cursor:pointer;">
          Book Another Table
        </button>
        <a href="/#/" style="text-align: center; color: var(--on-surface-variant); font-size: 0.9rem; text-decoration: none; padding: 0.5rem 0;">
          Go back to Home
        </a>
      </div>
    </div>
  `;
}

// ═══════════════════════════════════════
// EVENT HANDLERS
// ═══════════════════════════════════════
function attachHandlers(state, render, updateTableAvailability) {
  // ── Step 1 handlers ──
  if (state.step === 1) {
    document.getElementById('select-type-time')?.addEventListener('click', () => {
      state.bookingType = 'time';
      render();
    });

    document.getElementById('select-type-games')?.addEventListener('click', () => {
      state.bookingType = 'games';
      render();
    });

    const durSelect = document.getElementById('duration-select');
    if (durSelect) durSelect.addEventListener('change', (e) => { state.duration = e.target.value; });

    const framesSelect = document.getElementById('frames-select');
    if (framesSelect) framesSelect.addEventListener('change', (e) => { state.frames = e.target.value; });

    document.getElementById('step1-next')?.addEventListener('click', () => {
      state.step = 2;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── Step 2 handlers ──
  if (state.step === 2) {
    const dateInput = document.getElementById('booking-date');
    if (dateInput) {
      dateInput.addEventListener('change', async (e) => {
        state.date = e.target.value;
        state.selectedTable = null; // reset selected table on date change
        await updateTableAvailability();
        render();
      });
    }

    const timeSlotSelect = document.getElementById('booking-time-slot');
    if (timeSlotSelect) {
      timeSlotSelect.addEventListener('change', async (e) => {
        state.timeSlot = e.target.value;
        state.selectedTable = null; // reset selected table on time slot change
        await updateTableAvailability();
        render();
      });
    }

    // Table selection clicks — DOM-first approach (no re-render needed for visual toggle)
    document.querySelectorAll('.table-select-card').forEach(card => {
      card.addEventListener('click', (e) => {
        // Guard: only available tables are selectable
        if (card.dataset.available !== '1') return;

        // Deselect all cards visually
        document.querySelectorAll('.table-select-card').forEach(c => {
          c.style.border = '1px solid var(--outline-variant)';
          c.style.background = 'var(--surface)';
          const radio = c.querySelector('.table-radio');
          if (radio) radio.checked = false;
        });

        // Select this card visually
        card.style.border = '2px solid #c9a84c';
        card.style.background = 'rgba(201,168,76,0.08)';
        const radio = card.querySelector('.table-radio');
        if (radio) radio.checked = true;

        // Update state — include desc so Step 3 can show table number
        state.selectedTable = {
          id: parseInt(card.dataset.id),
          name: card.dataset.label,
          desc: card.dataset.desc || '',
          hourly: parseFloat(card.dataset.hourly),
          game: parseFloat(card.dataset.game),
          vip: card.classList.contains('vip')
        };

        // Enable Next button visually
        const nextBtn = document.getElementById('step2-next');
        if (nextBtn) nextBtn.style.opacity = '1';
      });
    });

    document.getElementById('step2-back')?.addEventListener('click', () => {
      state.step = 1;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    document.getElementById('step2-next')?.addEventListener('click', () => {
      if (!state.timeSlot) {
        showToast('Please select a starting time slot to check table availability', 'error');
        return;
      }
      if (!state.selectedTable) {
        showToast('Please select a table to continue', 'error');
        return;
      }
      state.step = 3;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  // ── Step 3 handlers ──
  if (state.step === 3) {
    const nameInput = document.getElementById('input-name');
    const phoneInput = document.getElementById('input-phone');
    const emailInput = document.getElementById('input-email');

    if (nameInput) nameInput.addEventListener('input', (e) => { state.fullName = e.target.value; });
    if (phoneInput) phoneInput.addEventListener('input', (e) => { state.phone = e.target.value; });
    if (emailInput) emailInput.addEventListener('input', (e) => { state.email = e.target.value; });

    document.getElementById('step3-back')?.addEventListener('click', () => {
      state.step = 2;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });

    const confirmBtn = document.getElementById('confirm-booking-btn');
    if (confirmBtn) {
      confirmBtn.addEventListener('click', async () => {
        if (!state.fullName.trim() || !state.phone.trim() || !state.email.trim()) {
          showToast('Please fill in all your details', 'error');
          return;
        }

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

        const app = document.getElementById('app');
        handleBookingPayment(bookingData, app, state, render);
      });
    }
  }

  // ── Step 4 handlers ──
  if (state.step === 4) {
    const details = state.confirmationDetails;
    
    document.getElementById('copy-code-btn')?.addEventListener('click', () => {
      if (details) {
        navigator.clipboard.writeText(details.referenceCode);
        showToast('Booking code copied to clipboard!', 'success');
      }
    });

    document.getElementById('download-code-btn')?.addEventListener('click', () => {
      if (details) {
        const receiptText = `
========================================
           XVI SNOOKER CLUB
          BOOKING CONFIRMATION
========================================
Booking Code : ${details.referenceCode}
Table        : ${details.tableLabel}
Date         : ${details.date}
Time         : ${details.startTime}
Duration     : ${details.duration}
Total Paid   : ₦${details.totalPaid.toLocaleString()}
========================================
Please present this code at the location.
Thank you for your patronage!
`;
        const blob = new Blob([receiptText], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `XVI-Booking-${details.referenceCode}.txt`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        showToast('Booking receipt downloaded!', 'success');
      }
    });

    document.getElementById('book-another-wizard-btn')?.addEventListener('click', () => {
      // Reset state and go back to step 1
      state.step = 1;
      state.selectedTable = null;
      state.bookingType = 'time';
      state.duration = '1';
      state.frames = '1';
      state.date = new Date().toISOString().split('T')[0];
      state.timeSlot = '';
      state.confirmationDetails = null;
      render();
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
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
