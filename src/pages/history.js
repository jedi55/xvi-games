import { getUserReservations } from '../lib/api.js';
import { getSession, getUser } from '../lib/auth.js';
import { router } from '../lib/router.js';
import { renderHeader, renderFooter, formatCurrency, formatDate, formatTime } from '../components/layout.js';

export async function renderHistoryPage(app) {
  const session = await getSession();
  if (!session) {
    router.navigate('/login');
    return;
  }

  const user = await getUser();
  let allReservations = [];

  try {
    allReservations = await getUserReservations(user.id);
  } catch (e) {
    // Demo fallback with mock data matching the new requested structure
    allReservations = [
      {
        id: 1, reference_code: 'A3F9C1B2', date: '2026-04-05', start_time: '18:00:00', end_time: '20:00:00',
        booking_type: 'time', duration_hours: 2, total_amount: 3500, status: 'confirmed', tables: { name: 'Table 1' }
      },
      {
        id: 2, reference_code: 'B9X4L7P0', date: '2026-04-01', start_time: '14:00:00', end_time: '15:00:00',
        booking_type: 'time', duration_hours: 1, total_amount: 2000, status: 'completed', tables: { name: 'Table 2' }
      },
      {
        id: 3, reference_code: 'C2M8J1K5', date: '2026-04-10', start_time: '19:00:00', end_time: '22:00:00',
        booking_type: 'time', duration_hours: 3, total_amount: 5000, status: 'pending', tables: { name: 'Table 3' }
      },
      {
        id: 4, reference_code: 'X9Q2Z5W4', date: '2026-03-15', start_time: '10:00:00', end_time: '11:00:00',
        booking_type: 'game', _games: 2, total_amount: 1500, status: 'cancelled', tables: { name: 'Table 1' }
      }
    ];
  }

  // Ensure sorting by date desc
  allReservations.sort((a, b) => new Date(b.date) - new Date(a.date));

  app.innerHTML = `
    ${renderHeader(session, 'my-bookings')}
    <main class="page-content" style="background-color: var(--surface);">
      <section class="page-section">
        <div style="max-width: 48rem; margin: 0 auto;">
          
          <div style="margin-bottom: 2rem;">
            <p class="label-md text-gold" style="margin-bottom: 0.5rem; letter-spacing: 0.2em; color: var(--gold);">MANAGE</p>
            <h1 class="headline-md" style="font-size: 2.25rem;">My Bookings</h1>
            <p style="color: var(--on-surface-variant); margin-top: 0.25rem;">Your reservation history</p>
          </div>

          <!-- Filter Tabs -->
          <div style="display: flex; gap: 1rem; margin-bottom: 2rem; border-bottom: 1px solid rgba(105, 223, 94, 0.1); padding-bottom: 0.25rem; overflow-x: auto;" id="filter-tabs">
            <button class="filter-tab active" data-filter="all" style="background: none; border: none; color: var(--primary); font-family: var(--font-label); font-weight: 700; text-transform: uppercase; font-size: 0.8rem; padding: 0.5rem 0.25rem; border-bottom: 2px solid var(--primary); cursor: pointer; white-space: nowrap;">All</button>
            <button class="filter-tab" data-filter="upcoming" style="background: none; border: none; color: var(--on-surface-variant); font-family: var(--font-label); font-weight: 700; text-transform: uppercase; font-size: 0.8rem; padding: 0.5rem 0.25rem; border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap;">Upcoming</button>
            <button class="filter-tab" data-filter="completed" style="background: none; border: none; color: var(--on-surface-variant); font-family: var(--font-label); font-weight: 700; text-transform: uppercase; font-size: 0.8rem; padding: 0.5rem 0.25rem; border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap;">Completed</button>
            <button class="filter-tab" data-filter="cancelled" style="background: none; border: none; color: var(--on-surface-variant); font-family: var(--font-label); font-weight: 700; text-transform: uppercase; font-size: 0.8rem; padding: 0.5rem 0.25rem; border-bottom: 2px solid transparent; cursor: pointer; white-space: nowrap;">Cancelled</button>
          </div>

          <div id="bookings-container" style="display: flex; flex-direction: column; gap: 1.25rem;">
            <!-- Cards rendered via JS -->
          </div>
          
        </div>
      </section>
    </main>
    ${renderFooter()}
  `;

  // Render logic
  function renderBookings(filter) {
    const container = document.getElementById('bookings-container');
    const filtered = allReservations.filter(res => {
      if (filter === 'all') return true;
      if (filter === 'upcoming') return res.status === 'confirmed' || res.status === 'pending';
      return res.status === filter;
    });

    if (filtered.length === 0) {
      container.innerHTML = `
        <div style="text-align: center; padding: 4rem 2rem; background: var(--surface-container-low); border-radius: 12px; border: 1px dashed rgba(105,223,94,0.2);">
          <span class="material-symbols-outlined" style="font-size: 4rem; color: var(--outline-variant); margin-bottom: 1rem;">sports_baseball</span>
          <h3 style="font-family: var(--font-headline); font-size: 1.5rem; margin-bottom: 0.5rem;">No bookings yet</h3>
          <p style="color: var(--on-surface-variant); margin-bottom: 2rem;">You don't have any ${filter !== 'all' ? filter : ''} reservations.</p>
          <a href="#/tables" class="btn btn-primary">Book a Table</a>
        </div>
      `;
      return;
    }

    container.innerHTML = filtered.map(res => {
      let badgeHtml = '';
      if (res.status === 'confirmed') {
        badgeHtml = '<span style="background: rgba(105, 223, 94, 0.1); color: #69df5e; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">CONFIRMED</span>';
      } else if (res.status === 'completed') {
        badgeHtml = '<span style="background: rgba(138, 147, 139, 0.1); color: #8a938b; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">COMPLETED</span>';
      } else if (res.status === 'cancelled') {
        badgeHtml = '<span style="background: rgba(255, 68, 68, 0.1); color: #ff4444; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">CANCELLED</span>';
      } else if (res.status === 'pending') {
        badgeHtml = '<span style="background: rgba(201, 168, 76, 0.1); color: #c9a84c; padding: 0.25rem 0.5rem; border-radius: 4px; font-size: 0.7rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase;">PENDING</span>';
      }

      // Calculate duration or show game config
      let durationText = res.booking_type === 'time' 
        ? (res.duration_hours ? `${res.duration_hours} hour${res.duration_hours > 1 ? 's' : ''}` : 'Session')
        : 'Game based';

      const timeString = res.start_time 
        ? `${formatTime(res.start_time)} — ${formatTime(res.end_time)}` 
        : 'Time TBC';

      const refCode = res.reference_code || 'SC-' + String(res.id).padStart(4, '0');

      return `
        <div style="background: var(--surface-container-low); border: 1px solid rgba(138, 147, 139, 0.1); border-radius: 12px; padding: 1.5rem; transition: transform 0.2s;">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
            <div style="font-family: monospace; font-size: 0.9rem; color: var(--tertiary); font-weight: 600;">
              Ref: ${refCode}
            </div>
            <div>
              ${badgeHtml}
            </div>
          </div>
          
          <div style="font-family: var(--font-headline); font-size: 1.5rem; font-weight: 700; color: var(--on-surface); margin-bottom: 0.5rem;">
            ${res.tables?.name || 'Table'}
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; color: var(--on-surface-variant); font-size: 0.9rem; margin-bottom: 1rem;">
            <div>
              <span style="font-weight: 600; color: var(--outline);">Date:</span> ${formatDate(res.date)}
            </div>
            <div>
              <span style="font-weight: 600; color: var(--outline);">Time:</span> ${timeString}
            </div>
            <div>
              <span style="font-weight: 600; color: var(--outline);">Duration:</span> ${durationText}
            </div>
            <div>
              <span style="font-weight: 600; color: var(--outline);">Total:</span> <span style="font-family: var(--font-headline); color: var(--on-surface); font-weight: 700;">${formatCurrency(res.total_amount)}</span>
            </div>
          </div>

        </div>
      `;
    }).join('');
  }

  // Initial render
  setTimeout(() => {
    renderBookings('all');

    // Setup tab listeners
    const tabs = document.querySelectorAll('.filter-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        // Remove active class from all
        tabs.forEach(t => {
          t.classList.remove('active');
          t.style.color = 'var(--on-surface-variant)';
          t.style.borderBottomColor = 'transparent';
        });
        
        // Add active to clicked
        const clicked = e.target;
        clicked.classList.add('active');
        clicked.style.color = 'var(--primary)';
        clicked.style.borderBottomColor = 'var(--primary)';
        
        const filter = clicked.getAttribute('data-filter');
        renderBookings(filter);
      });
    });
  }, 0);
}
