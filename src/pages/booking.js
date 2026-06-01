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

// ─── Table Data ───
let TABLES = [];

const TIME_SLOTS = [
  '10:00 AM', '11:00 AM', '12:00 PM', '1:00 PM', '2:00 PM',
  '3:00 PM', '4:00 PM', '5:00 PM', '6:00 PM', '7:00 PM',
  '8:00 PM', '9:00 PM', '10:00 PM'
];

export async function renderBookingPage(app) {
  const session = await getSession();

  // State
  const state = {
    _session: session,
    step: 1,
    bookingType: 'time',       // Default to 'time', can toggle to 'games'
    duration: 1,               // hours
    frames: 1,                 // number of games
    selectedTable: null,
    date: new Date().toISOString().split('T')[0],
    timeSlot: null,
    fullName: session?.user?.user_metadata?.full_name || '',
    phone: session?.user?.user_metadata?.phone || '',
    email: session?.user?.email || '',
    confirmation: null         // Populated after successful payment
  };

  const STEP_LABELS = ['Booking Type', 'Select Table', 'Review & Pay', 'Confirmation'];

  // Fetch live tables and their availability for a specific date and time slot
  async function fetchLiveTablesForState() {
    try {
      const { data: tables, error } = await supabase
        .from('snooker_tables')
        .select('*')
        .order('table_number', { ascending: true });
      
      if (error) throw error;

      // Get bookings for selected date
      const { data: bookings } = await supabase
        .from('reservations')
        .select('table_id, start_time, end_time')
        .in('status', ['confirmed'])
        .eq('date', state.date);

      const bookedTableIds = new Set();
      if (bookings && state.timeSlot) {
        const slot24 = formatTo24H(state.timeSlot);
        bookings.forEach(b => {
          if (!b.start_time) return;
          const bStart = b.start_time;
          let bEnd = b.end_time;
          if (!bEnd) {
            const h = parseInt(bStart.split(':')[0]) + 2;
            bEnd = `${h.toString().padStart(2, '0')}:${bStart.split(':')[1]}:00`;
          }
          // Check overlap with the selected slot
          if (slot24 >= bStart && slot24 < bEnd) {
            bookedTableIds.add(b.table_id);
          }
        });
      }

      return (tables || []).map(table => ({
        id: table.id,
        name: table.label,
        desc: `Table #${table.table_number}`,
        hourly: table.hourly_rate / 100,
        game: table.per_game_rate / 100,
        vip: table.label?.includes('VIP'),
        isAvailable: !bookedTableIds.has(table.id),
        isActive: table.is_active
      }));
    } catch (e) {
      console.error('Failed to fetch tables:', e);
      return [];
    }
  }

  // Load tables initially
  async function refreshTables() {
    TABLES = await fetchLiveTablesForState();
  }

  await refreshTables();

  // Payment function Lexically defined inside renderBookingPage
  async function startPaystackPayment(bookingData) {
    if (typeof PaystackPop === 'undefined') {
      showToast('Payment system failed to load. Please refresh.', 'error');
      return;
    }

    const confirmBtn = document.getElementById('confirm-booking-btn');
    if (confirmBtn) {
      confirmBtn.innerHTML = '<span class="material-symbols-outlined spin" style="animation: spin 1s linear infinite;">refresh</span> Processing...';
      confirmBtn.disabled = true;
    }

    const isMember = localStorage.getItem('xvi_member') === 'true';
    const discountPercent = getMemberDiscount();
    const baseAmount = bookingData.totalAmount;
    const discountAmount = discountPercent > 0 ? Math.round(baseAmount * (discountPercent / 100)) : 0;
    const finalAmount = baseAmount - discountAmount;

    const handler = PaystackPop.setup({
      key: import.meta.env.VITE_PAYSTACK_PUBLIC_KEY,
      email: bookingData.email,
      amount: finalAmount * 100,
      currency: 'NGN',
      ref: 'XVI_BKG_' + Date.now(),
      label: bookingData.customerName || bookingData.email,
      metadata: {
        custom_fields: [
          { display_name: 'Table', variable_name: 'table', value: bookingData.tableLabel },
          { display_name: 'Booking Date', variable_name: 'date', value: bookingData.date },
          { display_name: 'Start Time', variable_name: 'start_time', value: bookingData.startTime },
          { display_name: 'Booking Type', variable_name: 'type', value: bookingData.reservationType }
        ]
      },
      onSuccess: async (transaction) => {
        try {
          // 1. Create/Update customer
          const { data: customer } = await supabase
            .from('customers')
            .insert({
              full_name: bookingData.customerName,
              phone: bookingData.phone,
              email: bookingData.email
            })
            .select()
            .single();

          // 2. End time computation
          const startDateTime = new Date(bookingData.date + 'T' + bookingData.startTime);
          const endDateTime = new Date(startDateTime);

          if (bookingData.reservationType === 'time') {
            endDateTime.setHours(endDateTime.getHours() + parseInt(bookingData.duration));
          } else {
            endDateTime.setMinutes(endDateTime.getMinutes() + parseInt(bookingData.games) * 30);
          }

          // 3. Save booking to DB
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

          const codeSuffix = booking?.reference_code || transaction.reference.slice(-8).toUpperCase();
          const uniqueBookingCode = `XVI-${new Date(bookingData.date).getFullYear()}-${codeSuffix}`;

          // Send email
          sendBookingConfirmationEmail({
            to: bookingData.email,
            customerName: bookingData.customerName,
            referenceCode: uniqueBookingCode,
            tableLabel: bookingData.tableLabel,
            date: bookingData.date,
            startTime: bookingData.startTime,
            duration: bookingData.reservationType === 'time'
              ? bookingData.duration + ' hour(s)'
              : bookingData.games + ' game(s)',
            totalPaid: finalAmount,
            isMember: isMember,
            discount: discountAmount
          }).catch(e => console.warn('Confirmation email error:', e));

          // Set state to Step 4
          state.confirmation = {
            bookingCode: uniqueBookingCode,
            tableLabel: bookingData.tableLabel,
            date: bookingData.date,
            startTime: bookingData.startTime,
            duration: bookingData.reservationType === 'time'
              ? bookingData.duration + ' hour(s)'
              : bookingData.games + ' game(s)',
            totalPaid: finalAmount,
            isMember: isMember,
            discount: discountAmount
          };
          state.step = 4;
          render();
          showToast('Booking Confirmed!', 'success');
        } catch (err) {
          console.error('Booking confirmation save error:', err);
          // Fallback success state
          const codeSuffix = transaction.reference.slice(-8).toUpperCase();
          const uniqueBookingCode = `XVI-${new Date().getFullYear()}-${codeSuffix}`;
          state.confirmation = {
            bookingCode: uniqueBookingCode,
            tableLabel: bookingData.tableLabel,
            date: bookingData.date,
            startTime: bookingData.startTime,
            duration: bookingData.reservationType === 'time'
              ? bookingData.duration + ' hour(s)'
              : bookingData.games + ' game(s)',
            totalPaid: finalAmount,
            isMember: isMember,
            discount: discountAmount
          };
          state.step = 4;
          render();
        }
      },
      onCancel: () => {
        if (confirmBtn) {
          confirmBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size:1.125rem;">check_circle</span> Confirm & Pay &rarr;';
          confirmBtn.disabled = false;
        }
      }
    });

    handler.openIframe();
  }

  function render() {
    app.innerHTML = `
      ${renderHeader(session, '')}
      <main class="page-content" style="background: #061106; min-height: calc(100vh - 160px); color: #fff;">
        <section class="booking-wizard" style="max-width: 1000px; margin: 0 auto; padding: 3rem 1.5rem;">
          <div class="wizard-container" style="background: rgba(255, 255, 255, 0.02); border: 1px solid rgba(255, 255, 255, 0.08); border-radius: 20px; padding: 2.5rem; backdrop-filter: blur(10px); box-shadow: 0 20px 50px rgba(0,0,0,0.5);">
            
            ${state.step < 4 ? `
              <!-- Progress Bar -->
              <div class="wizard-progress" style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 2rem; position: relative;">
                ${STEP_LABELS.map((label, index) => {
                  const stepNum = index + 1;
                  const isActive = state.step === stepNum;
                  const isCompleted = state.step > stepNum;
                  return `
                    <div class="progress-step" style="display: flex; flex-direction: column; align-items: center; z-index: 2; flex: 1;">
                      <div class="step-circle" style="width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 0.95rem; transition: all 0.3s;
                        background: ${isCompleted ? '#1a5c1a' : isActive ? '#c9a84c' : 'rgba(255,255,255,0.06)'};
                        color: ${isCompleted || isActive ? '#fff' : 'rgba(255,255,255,0.4)'};
                        border: 2px solid ${isCompleted ? '#1a5c1a' : isActive ? '#c9a84c' : 'rgba(255,255,255,0.1)'};
                        box-shadow: ${isActive ? '0 0 15px rgba(201, 168, 76, 0.4)' : 'none'};">
                        ${isCompleted ? '✓' : stepNum}
                      </div>
                      <span class="step-label" style="margin-top: 0.75rem; font-size: 0.8rem; font-weight: ${isActive ? '600' : '400'};
                        color: ${isActive ? '#c9a84c' : isCompleted ? 'rgba(255,255,255,0.8)' : 'rgba(255,255,255,0.4)'};">
                        ${label}
                      </span>
                    </div>
                  `;
                }).join('')}
                <div class="progress-line-bg" style="position: absolute; top: 20px; left: 10%; right: 10%; height: 2px; background: rgba(255,255,255,0.06); z-index: 1;"></div>
                <div class="progress-line-fill" style="position: absolute; top: 20px; left: 10%; width: ${((state.step - 1) / 3) * 80}%; height: 2px; background: #1a5c1a; z-index: 1; transition: width 0.4s ease;"></div>
              </div>
              <p style="text-align: center; color: rgba(255, 255, 255, 0.4); font-size: 0.75rem; letter-spacing: 2px; text-transform: uppercase; margin-bottom: 2.5rem;">Step ${state.step} of 4</p>
            ` : ''}

            <!-- Step Body -->
            <div class="wizard-body">
              ${state.step === 1 ? renderStep1() : ''}
              ${state.step === 2 ? renderStep2() : ''}
              ${state.step === 3 ? renderStep3() : ''}
              ${state.step === 4 ? renderStep4() : ''}
            </div>

          </div>
        </section>
      </main>
      ${renderFooter()}
    `;

    attachHandlers();
  }

  // ─── STEP 1: CHOOSE BOOKING TYPE ───
  function renderStep1() {
    const isTime = state.bookingType === 'time';
    const currentQty = isTime ? state.duration : state.frames;
    const maxQty = isTime ? 10 : 20;

    return `
      <div class="step-content">
        <div class="step-header" style="text-align: center; margin-bottom: 2.5rem;">
          <h2 style="font-family: 'Noto Serif', serif; color: #c9a84c; font-size: 2.25rem; margin: 0 0 0.5rem;">Choose Booking Type</h2>
          <p style="color: rgba(255,255,255,0.6); margin: 0; font-size: 0.95rem;">Select your preferred play format and session size</p>
        </div>

        <div style="display: flex; gap: 1.5rem; margin-bottom: 2.5rem;">
          <!-- Book by Time Button -->
          <button class="type-btn" data-type="time" style="flex: 1; background: ${isTime ? 'rgba(201, 168, 76, 0.08)' : 'rgba(255, 255, 255, 0.02)'};
            border: 2px solid ${isTime ? '#c9a84c' : 'rgba(255, 255, 255, 0.08)'};
            padding: 2.5rem 1.5rem; border-radius: 16px; color: #fff; cursor: pointer; text-align: center; transition: all 0.3s;
            box-shadow: ${isTime ? '0 10px 25px rgba(201, 168, 76, 0.15)' : 'none'};">
            <span class="material-symbols-outlined" style="font-size: 3rem; color: #c9a84c; display: block; margin-bottom: 1rem;">schedule</span>
            <strong style="font-size: 1.25rem; display: block; margin-bottom: 0.5rem;">Book by Time</strong>
            <span style="font-size: 0.85rem; color: rgba(255,255,255,0.5);">Reserve the table hourly (best for practice)</span>
          </button>

          <!-- Book by Games Button -->
          <button class="type-btn" data-type="games" style="flex: 1; background: ${!isTime ? 'rgba(201, 168, 76, 0.08)' : 'rgba(255, 255, 255, 0.02)'};
            border: 2px solid ${!isTime ? '#c9a84c' : 'rgba(255, 255, 255, 0.08)'};
            padding: 2.5rem 1.5rem; border-radius: 16px; color: #fff; cursor: pointer; text-align: center; transition: all 0.3s;
            box-shadow: ${!isTime ? '0 10px 25px rgba(201, 168, 76, 0.15)' : 'none'};">
            <span class="material-symbols-outlined" style="font-size: 3rem; color: #c9a84c; display: block; margin-bottom: 1rem;">sports_score</span>
            <strong style="font-size: 1.25rem; display: block; margin-bottom: 0.5rem;">Book by Games</strong>
            <span style="font-size: 0.85rem; color: rgba(255,255,255,0.5);">Reserve by number of frames/games</span>
          </button>
        </div>

        <!-- Quantity Adjuster -->
        <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 2rem; text-align: center; margin-bottom: 2.5rem;">
          <p style="color: rgba(255,255,255,0.5); font-size: 0.8rem; text-transform: uppercase; letter-spacing: 2px; margin-top: 0; margin-bottom: 1.25rem;">
            ${isTime ? 'Select Duration (Hours)' : 'Select Number of Frames'}
          </p>
          <div style="display: flex; align-items: center; justify-content: center; gap: 2.5rem;">
            <button id="qty-dec" style="width: 50px; height: 50px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: #fff; font-size: 1.5rem; cursor: pointer; transition: all 0.2s;" ${currentQty <= 1 ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>−</button>
            <div style="min-width: 120px;">
              <span id="qty-value" style="font-size: 3.5rem; font-weight: 700; color: #c9a84c; display: block; line-height: 1;">${currentQty}</span>
              <span style="font-size: 0.9rem; color: rgba(255,255,255,0.4); display: block; margin-top: 0.25rem;">${isTime ? (currentQty === 1 ? 'Hour' : 'Hours') : (currentQty === 1 ? 'Frame' : 'Frames')}</span>
            </div>
            <button id="qty-inc" style="width: 50px; height: 50px; border-radius: 50%; border: 1px solid rgba(255,255,255,0.15); background: rgba(255,255,255,0.05); color: #fff; font-size: 1.5rem; cursor: pointer; transition: all 0.2s;" ${currentQty >= maxQty ? 'disabled style="opacity: 0.3; cursor: not-allowed;"' : ''}>+</button>
          </div>
        </div>

        <div style="display: flex; justify-content: flex-end;">
          <button class="btn-wizard-next" id="step1-next" style="background: #c9a84c; color: #061106; border: none; padding: 0.9rem 2.2rem; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-size: 0.95rem; transition: all 0.3s; box-shadow: 0 4px 15px rgba(201, 168, 76, 0.25);">
            Next Step <span class="material-symbols-outlined" style="font-size: 1.15rem;">arrow_forward</span>
          </button>
        </div>
      </div>
    `;
  }

  // ─── STEP 2: SELECT TABLE ───
  function renderStep2() {
    const isTime = state.bookingType === 'time';
    const qty = isTime ? state.duration : state.frames;
    const isMember = localStorage.getItem('xvi_member') === 'true';
    const discountPercent = getMemberDiscount();

    return `
      <div class="step-content">
        <div class="step-header" style="text-align: center; margin-bottom: 2.5rem;">
          <h2 style="font-family: 'Noto Serif', serif; color: #c9a84c; font-size: 2.25rem; margin: 0 0 0.5rem;">Select Snooker Table</h2>
          <p style="color: rgba(255,255,255,0.6); margin: 0; font-size: 0.95rem;">Choose a date, time slot, and pick from our available professional tables</p>
        </div>

        <!-- Date & Time Slot Selectors -->
        <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.06); border-radius: 16px; padding: 1.75rem; margin-bottom: 2rem; display: grid; grid-template-columns: 1fr 2fr; gap: 1.5rem;">
          <div>
            <label style="display: block; font-size: 0.8rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem;">Select Date</label>
            <input type="date" id="booking-date" value="${state.date}" min="${new Date().toISOString().split('T')[0]}"
              style="width: 100%; padding: 0.8rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.3); color: #fff; font-size: 0.9rem; font-family: inherit; outline: none; transition: border-color 0.2s;" />
          </div>
          <div>
            <label style="display: block; font-size: 0.8rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 1px; margin-bottom: 0.5rem;">Select Start Time</label>
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(88px, 1fr)); gap: 0.4rem;">
              ${TIME_SLOTS.map(slot => {
                const isSelected = state.timeSlot === slot;
                return `
                  <button class="slot-btn" data-slot="${slot}" style="padding: 0.5rem; font-size: 0.78rem; font-family: inherit; font-weight: 500; border-radius: 6px; cursor: pointer; transition: all 0.2s;
                    border: 1px solid ${isSelected ? '#c9a84c' : 'rgba(255,255,255,0.12)'};
                    background: ${isSelected ? 'rgba(201, 168, 76, 0.15)' : 'rgba(255,255,255,0.02)'};
                    color: ${isSelected ? '#c9a84c' : '#fff'};">
                    ${slot}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        </div>

        <!-- Tables List -->
        <div style="margin-bottom: 2.5rem;">
          <h3 style="font-size: 1.1rem; color: #fff; margin-bottom: 1.25rem; font-weight: 600;">Available Tables</h3>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${TABLES.map(table => {
              const isSelected = state.selectedTable?.id === table.id;
              const isAvailable = table.isAvailable && table.isActive;
              
              // Calculate Price based on Step 1 selection
              const basePrice = isTime ? table.hourly * qty : table.game * qty;
              const discountAmount = isMember ? Math.round(basePrice * (discountPercent / 100)) : 0;
              const totalPrice = basePrice - discountAmount;

              return `
                <div class="table-card" data-id="${table.id}" style="border: 2px solid ${isSelected ? '#c9a84c' : 'rgba(255, 255, 255, 0.08)'};
                  background: ${isSelected ? 'rgba(201, 168, 76, 0.05)' : isAvailable ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0,0,0,0.15)'};
                  opacity: ${isAvailable ? '1' : '0.45'};
                  cursor: ${isAvailable ? 'pointer' : 'not-allowed'};
                  padding: 1.5rem 1.75rem; border-radius: 14px; display: flex; align-items: center; justify-content: space-between; transition: all 0.2s;">
                  
                  <div style="display: flex; align-items: center; gap: 1.25rem;">
                    <div style="width: 48px; height: 48px; border-radius: 50%; display: flex; align-items: center; justify-content: center;
                      background: ${table.vip ? 'rgba(201, 168, 76, 0.15)' : 'rgba(255,255,255,0.05)'};
                      color: ${table.vip ? '#c9a84c' : '#fff'};">
                      <span class="material-symbols-outlined" style="font-size: 1.5rem;">${table.vip ? 'stars' : 'sports'}</span>
                    </div>
                    <div>
                      <h4 style="margin: 0; font-size: 1.15rem; color: #fff; display: flex; align-items: center; gap: 0.5rem;">
                        ${table.name}
                        ${table.vip ? '<span style="font-size: 0.65rem; background: #c9a84c; color: #061106; padding: 0.1rem 0.4rem; border-radius: 4px; font-weight: bold; text-transform: uppercase;">VIP</span>' : ''}
                      </h4>
                      <p style="margin: 0.25rem 0 0; font-size: 0.85rem; color: rgba(255,255,255,0.5);">${table.desc}</p>
                    </div>
                  </div>

                  <div style="display: flex; align-items: center; gap: 2.5rem;">
                    <!-- Price Info -->
                    <div style="text-align: right;">
                      <div style="font-size: 0.75rem; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.5px;">Price for ${qty} ${isTime ? (qty === 1 ? 'Hour' : 'Hours') : (qty === 1 ? 'Frame' : 'Frames')}</div>
                      <div style="font-size: 1.4rem; font-weight: 700; color: #c9a84c; margin-top: 0.15rem;">
                        ₦${totalPrice.toLocaleString()}
                      </div>
                      ${isMember ? `
                        <div style="font-size: 0.8rem; color: rgba(255,255,255,0.3); text-decoration: line-through;">
                          ₦${basePrice.toLocaleString()}
                        </div>
                      ` : ''}
                    </div>

                    <!-- Availability Status -->
                    <div style="text-align: center; min-width: 100px;">
                      ${isAvailable ? `
                        <span style="font-size: 0.75rem; color: #4caf50; background: rgba(76,175,80,0.15); padding: 0.35rem 0.75rem; border-radius: 20px; font-weight: bold; display: inline-block;">● Available</span>
                      ` : `
                        <span style="font-size: 0.75rem; color: #f44336; background: rgba(244,67,54,0.15); padding: 0.35rem 0.75rem; border-radius: 20px; font-weight: bold; display: inline-block;">✕ Booked</span>
                      `}
                    </div>

                    <!-- Select indicator -->
                    ${isAvailable ? `
                      <div style="width: 22px; height: 22px; border-radius: 50%; border: 2px solid ${isSelected ? '#c9a84c' : 'rgba(255,255,255,0.3)'};
                        background: ${isSelected ? '#c9a84c' : 'transparent'}; display: flex; align-items: center; justify-content: center; transition: all 0.2s;">
                        ${isSelected ? '<span class="material-symbols-outlined" style="font-size: 0.9rem; color: #061106; font-weight: bold;">check</span>' : ''}
                      </div>
                    ` : ''}
                  </div>

                </div>
              `;
            }).join('')}
          </div>
        </div>

        <div style="display: flex; justify-content: space-between;">
          <button class="btn-wizard-back" id="step2-back" style="background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 0.85rem 1.75rem; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;">
            <span class="material-symbols-outlined" style="font-size: 1.15rem;">arrow_back</span> Go Back
          </button>
          <button class="btn-wizard-next" id="step2-next" ${!state.selectedTable || !state.timeSlot ? 'disabled style="opacity: 0.4; cursor: not-allowed;"' : ''} style="background: #c9a84c; color: #061106; border: none; padding: 0.9rem 2.2rem; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; font-size: 0.95rem; transition: all 0.3s; box-shadow: 0 4px 15px rgba(201, 168, 76, 0.25);">
            Next Step <span class="material-symbols-outlined" style="font-size: 1.15rem;">arrow_forward</span>
          </button>
        </div>
      </div>
    `;
  }

  // ─── STEP 3: SUMMARY & DETAILS ───
  function renderStep3() {
    const table = state.selectedTable;
    const isTime = state.bookingType === 'time';
    const qty = isTime ? state.duration : state.frames;
    const isMember = localStorage.getItem('xvi_member') === 'true';
    const discountPercent = getMemberDiscount();
    const basePrice = isTime ? table.hourly * qty : table.game * qty;
    const discountAmount = isMember ? Math.round(basePrice * (discountPercent / 100)) : 0;
    const totalPrice = basePrice - discountAmount;

    const formattedDate = new Date(state.date + 'T00:00:00').toLocaleDateString('en-US', {
      weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
    });

    return `
      <div class="step-content">
        <div class="step-header" style="text-align: center; margin-bottom: 2.5rem;">
          <h2 style="font-family: 'Noto Serif', serif; color: #c9a84c; font-size: 2.25rem; margin: 0 0 0.5rem;">Summary & Details</h2>
          <p style="color: rgba(255,255,255,0.6); margin: 0; font-size: 0.95rem;">Enter your contact information and review your booking details before checkout</p>
        </div>

        <div style="display: grid; grid-template-columns: 1.25fr 1fr; gap: 2rem; margin-bottom: 2.5rem;">
          <!-- Left: User Details Form -->
          <div style="display: flex; flex-direction: column; gap: 1.25rem;">
            <h3 style="font-size: 1.1rem; color: #fff; margin: 0; font-weight: 600; display: flex; align-items: center; gap: 0.5rem;">
              <span class="material-symbols-outlined" style="color: #c9a84c;">person</span> Contact Information
            </h3>
            
            <div style="display: flex; flex-direction: column; gap: 0.4rem;">
              <label for="input-name" style="font-size: 0.8rem; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">Full Name</label>
              <input type="text" id="input-name" placeholder="Enter your full name" value="${state.fullName}"
                style="width: 100%; padding: 0.85rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.3); color: #fff; font-size: 0.95rem; outline: none; transition: border-color 0.2s;" />
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.4rem;">
              <label for="input-phone" style="font-size: 0.8rem; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">Phone Number</label>
              <input type="tel" id="input-phone" placeholder="e.g. +234 800 000 0000" value="${state.phone}"
                style="width: 100%; padding: 0.85rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.3); color: #fff; font-size: 0.95rem; outline: none; transition: border-color 0.2s;" />
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.4rem;">
              <label for="input-email" style="font-size: 0.8rem; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.5px; font-weight: 500;">Email Address</label>
              <input type="email" id="input-email" placeholder="you@example.com" value="${state.email}"
                style="width: 100%; padding: 0.85rem; border-radius: 8px; border: 1px solid rgba(255,255,255,0.15); background: rgba(0,0,0,0.3); color: #fff; font-size: 0.95rem; outline: none; transition: border-color 0.2s;" />
            </div>
          </div>

          <!-- Right: Order Summary Ticket -->
          <div style="background: rgba(255,255,255,0.03); border: 1px solid rgba(255,255,255,0.08); border-radius: 16px; padding: 1.75rem; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <h3 style="font-size: 1.1rem; color: #fff; margin: 0 0 1.25rem; font-weight: 600; display: flex; align-items: center; gap: 0.5rem; padding-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.08);">
                <span class="material-symbols-outlined" style="color: #c9a84c;">receipt_long</span> Order Summary
              </h3>

              <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                  <span style="color: rgba(255,255,255,0.5);">Selected Table</span>
                  <span style="font-weight: 600; color: #fff;">${table.name}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                  <span style="color: rgba(255,255,255,0.5);">Booking Date</span>
                  <span style="color: #fff;">${formattedDate}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                  <span style="color: rgba(255,255,255,0.5);">Start Time</span>
                  <span style="color: #fff;">${state.timeSlot}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                  <span style="color: rgba(255,255,255,0.5);">Booking Type</span>
                  <span style="text-transform: capitalize; color: #fff;">By ${state.bookingType}</span>
                </div>
                <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                  <span style="color: rgba(255,255,255,0.5);">${isTime ? 'Duration' : 'Frames'}</span>
                  <span style="color: #fff; font-weight: 600;">${qty} ${isTime ? (qty === 1 ? 'Hour' : 'Hours') : (qty === 1 ? 'Frame' : 'Frames')}</span>
                </div>
                
                <div style="height: 1px; background: rgba(255,255,255,0.08); margin: 0.5rem 0;"></div>

                <div style="display: flex; justify-content: space-between; font-size: 0.9rem;">
                  <span style="color: rgba(255,255,255,0.5);">Base Amount</span>
                  <span style="color: #fff;">₦${basePrice.toLocaleString()}</span>
                </div>

                ${isMember ? `
                  <div style="display: flex; justify-content: space-between; font-size: 0.9rem; color: #4caf50;">
                    <span>👑 Member Discount (${discountPercent}%)</span>
                    <span>-₦${discountAmount.toLocaleString()}</span>
                  </div>
                ` : ''}
              </div>
            </div>

            <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px dashed rgba(255,255,255,0.15);">
              <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 0.5rem;">
                <span style="font-weight: 600; color: rgba(255,255,255,0.7); font-size: 1.05rem;">Total to Pay</span>
                <span style="font-size: 1.65rem; font-weight: 800; color: #c9a84c;">₦${totalPrice.toLocaleString()}</span>
              </div>
              ${isMember ? `
                <div style="text-align: center; color: #4caf50; font-size: 0.72rem; font-weight: 600; margin-top: 0.5rem;">✓ XVI Membership discount applied!</div>
              ` : `
                <div style="text-align: center; margin-top: 0.5rem;">
                  <a href="/#/membership" style="color: #c9a84c; font-size: 0.72rem; text-decoration: underline;">👑 Join membership & save 15%</a>
                </div>
              `}
            </div>
          </div>
        </div>

        <div style="display: flex; justify-content: space-between;">
          <button class="btn-wizard-back" id="step3-back" style="background: transparent; border: 1px solid rgba(255,255,255,0.15); color: #fff; padding: 0.85rem 1.75rem; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.5rem; transition: all 0.2s;">
            <span class="material-symbols-outlined" style="font-size: 1.15rem;">arrow_back</span> Go Back
          </button>
          <button class="btn-confirm-booking" id="confirm-booking-btn" style="background: #1a5c1a; color: #fff; border: none; padding: 0.95rem 2.5rem; border-radius: 8px; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 0.6rem; font-size: 1rem; transition: all 0.3s; box-shadow: 0 4px 15px rgba(26, 92, 26, 0.3);">
            <span class="material-symbols-outlined" style="font-size: 1.25rem;">check_circle</span> Confirm & Pay &rarr;
          </button>
        </div>
      </div>
    `;
  }

  // ─── STEP 4: BOOKING CONFIRMATION ───
  function renderStep4() {
    const details = state.confirmation;
    if (!details) return '';

    return `
      <div class="step-content" style="text-align: center; max-width: 500px; margin: 0 auto; padding: 1.5rem 0;">
        <!-- Success Ring Animation -->
        <div style="width: 76px; height: 76px; border-radius: 50%; background: rgba(76,175,80,0.12); border: 2.5px solid #4caf50; display: flex; align-items: center; justify-content: center; margin: 0 auto 1.5rem; box-shadow: 0 0 25px rgba(76,175,80,0.25);">
          <span class="material-symbols-outlined" style="color: #4caf50; font-size: 2.75rem; font-weight: bold;">check</span>
        </div>

        <h2 style="font-family: 'Noto Serif', serif; color: #c9a84c; font-size: 2.25rem; margin: 0 0 0.5rem;">Booking Confirmed!</h2>
        <p style="color: rgba(255,255,255,0.6); margin: 0 0 2rem; font-size: 0.95rem;">Your reservation is secured. We look forward to hosting you!</p>

        <!-- Prominent Ticket Card -->
        <div id="booking-ticket" style="background: linear-gradient(135deg, #0d1e0d, #061106); border: 2px dashed rgba(201,168,76,0.3); border-radius: 16px; padding: 2rem; margin-bottom: 2rem; text-align: left; position: relative;">
          
          <div style="text-align: center; margin-bottom: 1.5rem; border-bottom: 1px dashed rgba(255,255,255,0.1); padding-bottom: 1.25rem;">
            <p style="color: rgba(255,255,255,0.4); font-size: 0.72rem; text-transform: uppercase; letter-spacing: 2.5px; margin: 0 0 0.4rem;">Your Booking Code</p>
            <p id="ticket-code" style="color: #c9a84c; font-size: 1.85rem; font-weight: 800; font-family: monospace; letter-spacing: 4px; margin: 0;">${details.bookingCode}</p>
            <p style="color: rgba(76,175,80,0.85); font-size: 0.75rem; margin: 0.5rem 0 0; font-weight: 500;">✓ Present this code at the location</p>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            <div style="display: flex; justify-content: space-between; font-size: 0.88rem;">
              <span style="color: rgba(255,255,255,0.45);">Table Number</span>
              <span style="color: #fff; font-weight: 600;">${details.tableLabel}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.88rem;">
              <span style="color: rgba(255,255,255,0.45);">Reservation Date</span>
              <span style="color: #fff;">${details.date}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.88rem;">
              <span style="color: rgba(255,255,255,0.45);">Start Time</span>
              <span style="color: #fff;">${details.startTime}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.88rem;">
              <span style="color: rgba(255,255,255,0.45);">Duration Size</span>
              <span style="color: #fff; font-weight: 600;">${details.duration}</span>
            </div>
            <div style="display: flex; justify-content: space-between; font-size: 0.88rem; border-top: 1px solid rgba(255,255,255,0.06); padding-top: 0.75rem;">
              <span style="color: rgba(255,255,255,0.45);">Total Paid</span>
              <span style="color: #c9a84c; font-weight: 700;">₦${details.totalPaid.toLocaleString()}</span>
            </div>
          </div>

        </div>

        <!-- Utility Actions (Copy & Download) -->
        <div style="display: flex; gap: 1rem; margin-bottom: 2rem; justify-content: center;">
          <button id="copy-code-btn" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: #fff; padding: 0.7rem 1.25rem; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; transition: all 0.2s;">
            <span class="material-symbols-outlined" style="font-size: 1.1rem;">content_copy</span> Copy Code
          </button>
          <button id="download-ticket-btn" style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.12); color: #fff; padding: 0.7rem 1.25rem; border-radius: 8px; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; transition: all 0.2s;">
            <span class="material-symbols-outlined" style="font-size: 1.1rem;">download</span> Download Ticket
          </button>
        </div>

        <!-- Navigation Actions -->
        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <button id="book-another-btn" style="width: 100%; background: #1a5c1a; color: #fff; border: none; padding: 0.85rem; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.95rem; transition: all 0.2s;">
            Book Another Session
          </button>
          <button id="go-home-btn" style="width: 100%; background: transparent; border: 1px solid rgba(255,255,255,0.1); color: rgba(255,255,255,0.7); padding: 0.85rem; border-radius: 8px; font-weight: 600; cursor: pointer; font-size: 0.95rem; transition: all 0.2s;">
            Go to Homepage
          </button>
        </div>
      </div>
    `;
  }

  // ─── EVENT HANDLERS BINDINGS ───
  function attachHandlers() {
    // STEP 1 HANDLERS
    if (state.step === 1) {
      // Toggle booking type
      document.querySelectorAll('.type-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          state.bookingType = btn.dataset.type;
          render();
        });
      });

      // Quantity adjustments
      const decBtn = document.getElementById('qty-dec');
      const incBtn = document.getElementById('qty-inc');

      if (decBtn) {
        decBtn.addEventListener('click', () => {
          if (state.bookingType === 'time' && state.duration > 1) {
            state.duration--;
          } else if (state.bookingType === 'games' && state.frames > 1) {
            state.frames--;
          }
          render();
        });
      }

      if (incBtn) {
        incBtn.addEventListener('click', () => {
          const maxVal = state.bookingType === 'time' ? 10 : 20;
          if (state.bookingType === 'time' && state.duration < maxVal) {
            state.duration++;
          } else if (state.bookingType === 'games' && state.frames < maxVal) {
            state.frames++;
          }
          render();
        });
      }

      // Next button
      const nextBtn = document.getElementById('step1-next');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          state.step = 2;
          render();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
    }

    // STEP 2 HANDLERS
    if (state.step === 2) {
      // Date select
      const dateInput = document.getElementById('booking-date');
      if (dateInput) {
        dateInput.addEventListener('change', async (e) => {
          state.date = e.target.value;
          state.selectedTable = null; // Reset selection on change
          await refreshTables();
          render();
        });
      }

      // Time slot select
      document.querySelectorAll('.slot-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          state.timeSlot = btn.dataset.slot;
          state.selectedTable = null; // Reset selection on change
          await refreshTables();
          render();
        });
      });

      // Table card click select
      document.querySelectorAll('.table-card').forEach(card => {
        card.addEventListener('click', () => {
          const tableId = parseInt(card.dataset.id);
          const found = TABLES.find(t => t.id === tableId);
          if (found && found.isAvailable && found.isActive) {
            state.selectedTable = found;
            render();
          }
        });
      });

      // Actions
      const backBtn = document.getElementById('step2-back');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          state.step = 1;
          render();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }

      const nextBtn = document.getElementById('step2-next');
      if (nextBtn) {
        nextBtn.addEventListener('click', () => {
          if (!state.selectedTable) {
            showToast('Please select an available table.', 'error');
            return;
          }
          if (!state.timeSlot) {
            showToast('Please select a starting time slot.', 'error');
            return;
          }
          state.step = 3;
          render();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }
    }

    // STEP 3 HANDLERS
    if (state.step === 3) {
      // Bind inputs
      const nameInput = document.getElementById('input-name');
      const phoneInput = document.getElementById('input-phone');
      const emailInput = document.getElementById('input-email');

      if (nameInput) nameInput.addEventListener('input', (e) => { state.fullName = e.target.value; });
      if (phoneInput) phoneInput.addEventListener('input', (e) => { state.phone = e.target.value; });
      if (emailInput) emailInput.addEventListener('input', (e) => { state.email = e.target.value; });

      // Actions
      const backBtn = document.getElementById('step3-back');
      if (backBtn) {
        backBtn.addEventListener('click', () => {
          state.step = 2;
          render();
          window.scrollTo({ top: 0, behavior: 'smooth' });
        });
      }

      const confirmBtn = document.getElementById('confirm-booking-btn');
      if (confirmBtn) {
        confirmBtn.addEventListener('click', () => {
          if (!state.fullName.trim()) {
            showToast('Please enter your full name.', 'error');
            return;
          }
          if (!state.phone.trim()) {
            showToast('Please enter your phone number.', 'error');
            return;
          }
          if (!state.email.trim() || !state.email.includes('@')) {
            showToast('Please enter a valid email address.', 'error');
            return;
          }

          const qty = state.bookingType === 'time' ? state.duration : state.frames;
          const baseTotal = state.bookingType === 'time'
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

          startPaystackPayment(bookingData);
        });
      }
    }

    // STEP 4 HANDLERS
    if (state.step === 4 && state.confirmation) {
      const copyBtn = document.getElementById('copy-code-btn');
      if (copyBtn) {
        copyBtn.addEventListener('click', () => {
          navigator.clipboard.writeText(state.confirmation.bookingCode)
            .then(() => {
              showToast('Booking code copied to clipboard!', 'success');
              copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 1.1rem; color: #4caf50;">done</span> Copied!';
              setTimeout(() => {
                copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 1.1rem;">content_copy</span> Copy Code';
              }, 2000);
            })
            .catch(() => showToast('Failed to copy code.', 'error'));
        });
      }

      const dlBtn = document.getElementById('download-ticket-btn');
      if (dlBtn) {
        dlBtn.addEventListener('click', () => {
          const details = state.confirmation;
          const text = `
========================================
           XVI SNOOKER CLUB             
         BOOKING CONFIRMATION           
========================================
Booking Code: ${details.bookingCode}
Date:         ${details.date}
Time:         ${details.startTime}
Table:        ${details.tableLabel}
Duration:     ${details.duration}
Total Paid:   ₦${details.totalPaid.toLocaleString()}
========================================
Please present this code at the location.
Thank you for booking with XVI!
========================================
          `;
          const blob = new Blob([text], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `booking-${details.bookingCode}.txt`;
          document.body.appendChild(a);
          a.click();
          document.body.removeChild(a);
          URL.revokeObjectURL(url);
          showToast('Ticket receipt downloaded!', 'success');
        });
      }

      const bookAnother = document.getElementById('book-another-btn');
      if (bookAnother) {
        bookAnother.addEventListener('click', () => {
          state.step = 1;
          state.selectedTable = null;
          state.timeSlot = null;
          state.confirmation = null;
          render();
        });
      }

      const goHome = document.getElementById('go-home-btn');
      if (goHome) {
        goHome.addEventListener('click', () => {
          window.location.href = '/#/';
        });
      }
    }
  }

  // Initial render call
  try {
    render();
  } catch (err) {
    console.error('Page render error:', err);
    app.innerHTML = `
      <div style="min-height:100vh; background:#061106; display:flex; align-items:center; justify-content:center; text-align:center; padding:2rem;">
        <div>
          <p style="color:#c9a84c; font-size:1.5rem; margin-bottom:1rem;">Something went wrong</p>
          <p style="color:rgba(255,255,255,0.6); font-size:0.9rem; margin-bottom:2rem;">${err.message}</p>
          <a href="/#/" style="color:#c9a84c; text-decoration:underline;">Go back home</a>
        </div>
      </div>
    `;
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
