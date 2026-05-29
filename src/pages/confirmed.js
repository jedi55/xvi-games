import { getSession } from '../lib/auth.js';
import { renderHeader, renderFooter, formatCurrency } from '../components/layout.js';

export async function renderConfirmedPage(app) {
  try {
  const session = await getSession();

  // Get reservation data from sessionStorage
  const raw = sessionStorage.getItem('confirmedReservation');
  const res = raw ? JSON.parse(raw) : {
    refCode: 'SC-0001',
    tableName: 'Table 1',
    date: new Date().toISOString().split('T')[0],
    timeSlot: '10:00 AM',
    bookingType: 'time',
    duration: '2',
    frames: '1',
    totalAmount: 3000,
    fullName: 'Demo User',
    phone: '+234 808 794 8773',
    email: 'demo@example.com'
  };

  const isTime = res.bookingType === 'time';
  const qty = isTime ? res.duration : res.frames;
  const durationLabel = isTime
    ? `${qty} Hour${qty > 1 ? 's' : ''}`
    : `${qty} Frame${qty > 1 ? 's' : ''}`;

  const dateFormatted = new Date(res.date + 'T00:00:00').toLocaleDateString('en-US', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  app.innerHTML = `
    ${renderHeader(session)}
    <main class="page-content">
      <div class="confirmed-centered">

        <!-- Green Checkmark -->
        <div class="confirmed-check-circle" id="confirmed-icon">
          <span class="material-symbols-outlined icon-filled">check_circle</span>
        </div>

        <!-- Heading -->
        <h1 class="confirmed-heading">Booking Confirmed!</h1>
        <p class="confirmed-subheading">Your table is reserved</p>

        <!-- Info Card -->
        <div class="confirmed-info-card" id="confirmed-details">
          <div class="cic-row">
            <span class="cic-label">Booking Reference</span>
            <span class="cic-value cic-ref">${res.refCode}</span>
          </div>
          <div class="cic-row">
            <span class="cic-label">Table</span>
            <span class="cic-value">${res.tableName}</span>
          </div>
          <div class="cic-row">
            <span class="cic-label">Date</span>
            <span class="cic-value">${dateFormatted}</span>
          </div>
          <div class="cic-row">
            <span class="cic-label">Time</span>
            <span class="cic-value">${res.timeSlot}</span>
          </div>
          <div class="cic-row">
            <span class="cic-label">${isTime ? 'Duration' : 'Games'}</span>
            <span class="cic-value">${durationLabel}</span>
          </div>
          <div class="cic-row cic-total-row">
            <span class="cic-label">Total Paid</span>
            <span class="cic-value cic-total">${formatCurrency(res.totalAmount)}</span>
          </div>
        </div>

        <!-- Green Confirmation Notice -->
        <div class="confirmed-notice" id="confirmed-notice">
          <span class="material-symbols-outlined" style="font-size: 1.25rem;">notifications_active</span>
          <p>A confirmation has been sent to your phone and email</p>
        </div>

        <!-- Action Buttons -->
        <div class="confirmed-actions">
          <a href="#/booking" class="btn-confirmed-primary" id="book-another-btn">
            <span class="material-symbols-outlined" style="font-size: 1rem;">add_circle</span>
            Book Another Table
          </a>
          <a href="#/" class="btn-confirmed-secondary" id="view-tables-btn">
            <span class="material-symbols-outlined" style="font-size: 1rem;">sports</span>
            View Our Tables
          </a>
        </div>

      </div>
    </main>
    ${renderFooter()}
  `;

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

