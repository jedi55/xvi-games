import { createPayment, updatePaymentStatus, updateReservationStatus } from '../lib/api.js';
import { sendBookingConfirmationEmail } from '../lib/email.js';
import { getSession, getUser } from '../lib/auth.js';
import { router } from '../lib/router.js';
import { renderHeader, renderFooter, showToast, formatCurrency, formatDate, formatTime } from '../components/layout.js';

export async function renderPaymentPage(app) {
  const session = await getSession();
  if (!session) {
    router.navigate('/login');
    return;
  }

  const reservationData = sessionStorage.getItem('pendingReservation');
  if (!reservationData) {
    showToast('No pending reservation found', 'error');
    router.navigate('/tables');
    return;
  }

  const reservation = JSON.parse(reservationData);

  app.innerHTML = `
    ${renderHeader(session)}
    <main class="page-content">
      <section class="page-section">
        <div style="max-width: 36rem; margin: 0 auto; text-align: center;">
          <span class="material-symbols-outlined text-primary" style="font-size: 3rem; margin-bottom: 1rem; display: block;">payments</span>
          <h1 class="headline-md" style="margin-bottom: 0.5rem;">Complete Your Payment</h1>
          <p class="body-lg text-on-surface-variant" style="margin-bottom: 2rem;">
            Secure payment powered by Paystack
          </p>

          <!-- Order Summary -->
          <div class="pricing-summary" style="text-align: left; margin-bottom: 2rem;">
            <div class="summary-header">
              <p class="label-md text-primary" style="letter-spacing: 0.2em;">ORDER SUMMARY</p>
            </div>
            <div class="summary-rows">
              <div class="summary-row">
                <span class="label">Reference</span>
                <span class="value serif-numbers text-primary">#${reservation.reference_code || 'SC-0000'}</span>
              </div>
              <div class="summary-row">
                <span class="label">Table</span>
                <span class="value">${reservation.tableName || 'Table ' + reservation.table_id}</span>
              </div>
              <div class="summary-row">
                <span class="label">Date</span>
                <span class="value serif-numbers">${formatDate(reservation.date)}</span>
              </div>
              <div class="summary-row">
                <span class="label">Time</span>
                <span class="value serif-numbers">${formatTime(reservation.start_time)} — ${formatTime(reservation.end_time)}</span>
              </div>
              <div class="summary-row">
                <span class="label">Type</span>
                <span class="value">${reservation.booking_type === 'time' ? 'Time-based' : reservation.num_games + ' Game(s)'}</span>
              </div>
            </div>
            <div class="summary-total">
              <span class="total-label">Amount to Pay</span>
              <span class="total-value serif-numbers">${formatCurrency(reservation.total_amount)}</span>
            </div>
          </div>

          <!-- Pay Button -->
          <button id="pay-btn" class="btn btn-primary btn-lg" style="width: 100%;">
            <span class="material-symbols-outlined" style="font-size: 1.125rem;">lock</span>
            Pay ${formatCurrency(reservation.total_amount)}
          </button>

          <p style="margin-top: 1rem; font-size: 0.75rem; color: var(--outline);">
            <span class="material-symbols-outlined" style="font-size: 0.875rem; vertical-align: middle;">shield</span>
            Your payment is secured by Paystack encryption
          </p>

          <a href="#/tables" class="btn btn-tertiary" style="margin-top: 1rem;">Cancel Booking</a>
        </div>
      </section>
    </main>
    ${renderFooter()}
  `;

  setupPaymentHandlers(reservation, session);
}

function setupPaymentHandlers(reservation, session) {
  const payBtn = document.getElementById('pay-btn');

  payBtn.addEventListener('click', async () => {
    payBtn.disabled = true;
    payBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;"></span> Initializing payment...';

    try {
      // Create payment record
      let paymentRecord;
      try {
        paymentRecord = await createPayment({
          reservation_id: reservation.id,
          user_id: session.user.id,
          amount: reservation.total_amount,
          currency: reservation.currency || 'NGN',
          status: 'pending'
        });
      } catch (e) {
        // Demo mode fallback
        paymentRecord = { id: 0 };
      }

      // Initialize Paystack
      const paystackKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY;

      if (!paystackKey || paystackKey === 'pk_test_your-paystack-key-here') {
        // Demo mode: simulate successful payment
        showToast('Demo mode: Simulating successful payment...');
        await simulatePaymentSuccess(reservation, paymentRecord);
        return;
      }

      const handler = PaystackPop.setup({
        key: paystackKey,
        email: reservation.email || session.user.email,
        amount: reservation.total_amount * 100, // Paystack uses kobo
        currency: reservation.currency || 'NGN',
        ref: `SC-${Date.now()}-${reservation.id}`,
        metadata: {
          reservation_id: reservation.id,
          table_name: reservation.tableName,
          custom_fields: [
            {
              display_name: 'Reservation',
              variable_name: 'reservation_ref',
              value: reservation.reference_code
            }
          ]
        },
        onClose: () => {
          payBtn.disabled = false;
          payBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 1.125rem;">lock</span> Pay ${formatCurrency(reservation.total_amount)}`;
          showToast('Payment cancelled', 'error');
        },
        callback: async (response) => {
          try {
            // Update payment status
            if (paymentRecord.id) {
              await updatePaymentStatus(paymentRecord.id, 'success', response.reference);
            }
            // Update reservation status
            if (reservation.id) {
              await updateReservationStatus(reservation.id, 'confirmed');
            }

            // Send confirmation email (non-blocking — failure won't stop redirect)
            const customerEmail = reservation.email || session.user.email;
            const customerName = reservation.fullName || session.user.user_metadata?.full_name || 'Valued Customer';
            const isTime = reservation.booking_type === 'time';
            const durationLabel = isTime
              ? `${reservation.duration} Hour${reservation.duration > 1 ? 's' : ''}`
              : `${reservation.num_games} Game${reservation.num_games > 1 ? 's' : ''}`;

            sendBookingConfirmationEmail({
              customerEmail,
              customerName,
              referenceCode: reservation.reference_code,
              tableName: reservation.tableName || `Table ${reservation.table_id}`,
              bookingDate: new Date(reservation.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
              bookingTime: reservation.start_time,
              duration: durationLabel,
              totalAmount: reservation.total_amount
            }).catch(err => console.warn('Email send failed (non-critical):', err));

            sessionStorage.setItem('confirmedReservation', JSON.stringify({
              ...reservation,
              paystack_reference: response.reference,
              status: 'confirmed'
            }));
            sessionStorage.removeItem('pendingReservation');
            router.navigate('/confirmed');
          } catch (err) {
            showToast('Payment received but confirmation failed. Contact support.', 'error');
          }
        }
      });

      handler.openIframe();
    } catch (err) {
      showToast(err.message || 'Payment initialization failed', 'error');
      payBtn.disabled = false;
      payBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size: 1.125rem;">lock</span> Pay ${formatCurrency(reservation.total_amount)}`;
    }
  });
}

async function simulatePaymentSuccess(reservation, paymentRecord) {
  await new Promise(r => setTimeout(r, 1500));

  try {
    if (paymentRecord.id) {
      await updatePaymentStatus(paymentRecord.id, 'success', 'DEMO-' + Date.now());
    }
    if (reservation.id) {
      await updateReservationStatus(reservation.id, 'confirmed');
    }
  } catch (e) {
    // Demo mode
  }

  // Send confirmation email in demo mode (non-blocking)
  const isTime = reservation.booking_type === 'time';
  const durationLabel = isTime
    ? `${reservation.duration} Hour${reservation.duration > 1 ? 's' : ''}`
    : `${reservation.num_games} Game${reservation.num_games > 1 ? 's' : ''}`;

  if (reservation.email) {
    sendBookingConfirmationEmail({
      customerEmail: reservation.email,
      customerName: reservation.fullName || 'Valued Customer',
      referenceCode: reservation.reference_code,
      tableName: reservation.tableName || `Table ${reservation.table_id}`,
      bookingDate: new Date(reservation.date + 'T00:00:00').toLocaleDateString('en-GB', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }),
      bookingTime: reservation.start_time,
      duration: durationLabel,
      totalAmount: reservation.total_amount
    }).catch(err => console.warn('Email send failed (non-critical):', err));
  }

  sessionStorage.setItem('confirmedReservation', JSON.stringify({
    ...reservation,
    paystack_reference: 'DEMO-' + Date.now(),
    status: 'confirmed'
  }));
  sessionStorage.removeItem('pendingReservation');
  showToast('Payment successful!');
  router.navigate('/confirmed');
}
