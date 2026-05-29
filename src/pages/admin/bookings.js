import { getAllReservations, updateReservationStatus } from '../../lib/api.js';
import { getSession } from '../../lib/auth.js';
import { renderAdminSidebar, showToast, formatCurrency, formatTime, formatDate, getStatusChipClass } from '../../components/layout.js';

export async function renderAdminBookings(app) {
  try {
  // Password-based admin auth check (same as overview)
  if (sessionStorage.getItem('adminAuth') !== 'true') {
    location.hash = '/admin';
    return;
  }
  const session = await getSession();
  let reservations = [];
  let totalCount = 0;
  let currentPage = 1;
  const perPage = 10;

  async function loadBookings(page = 1, search = '') {
    try {
      const result = await getAllReservations({ page, perPage, search });
      reservations = result.data || [];
      totalCount = result.count || 0;
      currentPage = page;
    } catch (e) {
      reservations = [
        { id: 1, reference_code: 'SC-0021', status: 'confirmed', date: '2026-03-28', start_time: '18:00:00', end_time: '20:00:00', booking_type: 'time', total_amount: 3500, tables: { name: 'Table 1' }, profiles: { full_name: 'Arthur Jenkins', phone: '+234 800 000 0122' } },
        { id: 2, reference_code: 'SC-0025', status: 'pending', date: '2026-03-28', start_time: '20:30:00', end_time: '22:30:00', booking_type: 'time', total_amount: 3500, tables: { name: 'Table 2' }, profiles: { full_name: 'Elena Moretti', phone: '+234 800 000 0451' } },
        { id: 3, reference_code: 'SC-0018', status: 'completed', date: '2026-03-27', start_time: '17:00:00', end_time: '19:00:00', booking_type: 'time', total_amount: 3500, tables: { name: 'Table 2' }, profiles: { full_name: 'David Blackwell', phone: '+234 800 000 0882' } },
        { id: 4, reference_code: 'SC-0033', status: 'cancelled', date: '2026-03-26', start_time: '21:00:00', end_time: '23:00:00', booking_type: 'games', num_games: 3, total_amount: 3500, tables: { name: 'Table 3' }, profiles: { full_name: 'Marcus Sterling', phone: '+234 800 000 0773' } }
      ];
      totalCount = 4;
    }
  }

  await loadBookings();
  renderPage();

  function renderPage() {
    const totalPages = Math.ceil(totalCount / perPage) || 1;

    app.innerHTML = `
      <div class="admin-layout">
        ${renderAdminSidebar('bookings')}
        <main class="admin-main">
          <header style="margin-bottom: 3rem;">
            <p class="label-xs text-primary" style="margin-bottom: 0.5rem; letter-spacing: 0.2em;">MANAGE</p>
            <h1 class="headline-md" style="font-size: 2.25rem;">All Bookings</h1>
          </header>

          <!-- Booking Code Lookup -->
          <div style="display:flex;gap:0.75rem;align-items:center;
            margin-bottom:1.25rem;padding:1rem;
            background:var(--surface);border-radius:10px;
            border:1px solid var(--outline-variant);">
            <span style="color:var(--outline);font-size:0.85rem;white-space:nowrap;">
              🔍 Lookup booking code:
            </span>
            <input type="text" id="code-lookup-input"
              placeholder="Enter code e.g. A3F9C1B2"
              style="flex:1;padding:0.6rem 1rem;
                background:var(--background);
                border:1px solid var(--outline-variant);
                border-radius:6px;color:var(--on-surface);
                font-family:monospace;font-size:0.95rem;
                text-transform:uppercase;letter-spacing:2px;outline:none;"/>
            <button id="code-lookup-btn" class="btn btn-primary btn-sm">Find Booking</button>
          </div>

          <section class="data-table-container">
            <div class="data-table-toolbar">
              <div class="search-input">
                <span class="material-symbols-outlined">search</span>
                <input type="text" placeholder="Search customer or ref..." id="bookings-search" />
              </div>
              <div style="display: flex; gap: 0.5rem;">
                <select id="status-filter" style="background: var(--surface-container); border: 1px solid rgba(64,73,66,0.2); color: var(--on-surface); padding: 0.5rem 1rem; font-family: var(--font-label); font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.05em;">
                  <option value="">All Bookings</option>
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                  <option value="members">Members Only</option>
                </select>
              </div>
            </div>

            <div style="overflow-x: auto;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Ref Code</th>
                    <th>Customer</th>
                    <th>Phone</th>
                    <th>Table</th>
                    <th>Date</th>
                    <th>Time</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th style="text-align: right;">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  ${reservations.map(res => {
                    const initials = (res.profiles?.full_name || 'U').split(' ').map(n => n[0]).join('').toUpperCase();
                    const statusColor = { confirmed: 'var(--primary)', pending: 'var(--secondary)', completed: 'var(--outline)', cancelled: 'var(--error)' }[res.status] || 'var(--outline)';
                    
                    const memberBadge = res.profiles?.is_member 
                      ? `<span style="background:linear-gradient(135deg,#c9a84c,#f0d080);color:#0a1f0a;font-size:0.6rem;font-weight:800;padding:0.15rem 0.4rem;border-radius:4px;margin-left:0.4rem;vertical-align:middle;letter-spacing:0.5px;text-transform:uppercase;">👑 ${res.profiles.membership_plan || 'MEMBER'}</span>` 
                      : '';
                      
                    return `
                      <tr data-ref="${(res.reference_code || '').toUpperCase()}">
                        <td class="ref-code">#${res.reference_code || 'SC-' + String(res.id).padStart(4, '0')}</td>
                        <td>
                          <div class="customer-cell">
                            <div class="customer-avatar">${initials}</div>
                            <span style="font-weight: 600;">${res.profiles?.full_name || 'Unknown'}${memberBadge}</span>
                          </div>
                        </td>
                        <td style="color: var(--outline); font-size: 0.8rem;">${res.profiles?.phone || '—'}</td>
                        <td><span class="table-badge standard">${res.tables?.name || 'Table'}</span></td>
                        <td class="serif-numbers" style="font-size: 0.8rem;">${formatDate(res.date).split(',').slice(0,2).join(',')}</td>
                        <td class="serif-numbers" style="font-size: 0.85rem;">${res.start_time ? formatTime(res.start_time) : '—'} - ${res.end_time ? formatTime(res.end_time) : '—'}</td>
                        <td class="serif-numbers" style="font-weight: 700; font-size: 0.85rem;">${formatCurrency(res.total_amount)}</td>
                        <td>
                          <span style="display: flex; align-items: center; gap: 0.375rem; color: ${statusColor};">
                            <span class="status-dot ${res.status}"></span>
                            <span class="label-xs" style="font-weight: 700;">${res.status}</span>
                          </span>
                        </td>
                        <td>
                          <div class="actions-cell">
                            ${res.status === 'pending' ? `
                              <button class="action-btn approve-btn" data-id="${res.id}" title="Approve">
                                <span class="material-symbols-outlined" style="font-size: 1.125rem;">check_circle</span>
                              </button>
                            ` : ''}
                            ${['pending', 'confirmed'].includes(res.status) ? `
                              <button class="action-btn danger cancel-btn" data-id="${res.id}" title="Cancel">
                                <span class="material-symbols-outlined" style="font-size: 1.125rem;">cancel</span>
                              </button>
                            ` : ''}
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('')}
                </tbody>
              </table>
            </div>
            <div class="pagination">
              <span class="pagination-info">Showing ${(currentPage - 1) * perPage + 1}-${Math.min(currentPage * perPage, totalCount)} of ${totalCount} bookings</span>
              <div class="pagination-controls">
                <button class="page-arrow" id="prev-page" ${currentPage === 1 ? 'disabled' : ''}>
                  <span class="material-symbols-outlined">chevron_left</span>
                </button>
                ${Array.from({ length: Math.min(totalPages, 5) }, (_, i) => `
                  <button class="${i + 1 === currentPage ? 'active' : ''}" data-page="${i + 1}">${i + 1}</button>
                `).join('')}
                <button class="page-arrow" id="next-page" ${currentPage >= totalPages ? 'disabled' : ''}>
                  <span class="material-symbols-outlined">chevron_right</span>
                </button>
              </div>
            </div>
          </section>
        </main>
      </div>
    `;

    setupHandlers();
  }

  function setupHandlers() {
    // Booking Code Lookup
    document.getElementById('code-lookup-btn')?.addEventListener('click', () => {
      const input = document.getElementById('code-lookup-input')
      const code = (input?.value || '').trim().toUpperCase()
      if (!code) return

      // Reset any previous highlights
      document.querySelectorAll('tr[data-ref]').forEach(r => {
        r.style.background = ''
        r.style.outline = ''
      })

      const matchedRow = document.querySelector(`tr[data-ref="${code}"]`)
      if (matchedRow) {
        matchedRow.style.background = 'rgba(201,168,76,0.15)'
        matchedRow.style.outline = '2px solid #c9a84c'
        matchedRow.scrollIntoView({ behavior: 'smooth', block: 'center' })
        showToast('✅ Valid booking found: ' + code)
      } else {
        showToast('Code not found: ' + code, 'error')
      }
    })

    // Allow pressing Enter in the lookup input
    document.getElementById('code-lookup-input')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') document.getElementById('code-lookup-btn')?.click()
    })

    // Logout
    const logoutBtn = document.getElementById('admin-logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        sessionStorage.removeItem('adminAuth');
        location.hash = '/admin';
      });
    }

    // Search
    let searchTimeout;
    document.getElementById('bookings-search')?.addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(async () => {
        await loadBookings(1, e.target.value);
        renderPage();
      }, 400);
    });

    // Status filter
    document.getElementById('status-filter')?.addEventListener('change', async (e) => {
      try {
        const val = e.target.value;
        const filters = { page: 1, perPage };
        if (val === 'members') {
          filters.members_only = true;
        } else if (val) {
          filters.status = val;
        }
        
        const result = await getAllReservations(filters);
        reservations = result.data || [];
        totalCount = result.count || 0;
        currentPage = 1;
        renderPage();
      } catch (err) {
        // Keep existing data in demo mode
      }
    });

    // Approve / Cancel
    document.querySelectorAll('.approve-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          await updateReservationStatus(parseInt(btn.dataset.id), 'confirmed');
          showToast('Booking approved!');
          await loadBookings(currentPage);
          renderPage();
        } catch (e) { showToast('Failed: ' + e.message, 'error'); }
      });
    });

    document.querySelectorAll('.cancel-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (confirm('Cancel this booking?')) {
          try {
            await updateReservationStatus(parseInt(btn.dataset.id), 'cancelled');
            showToast('Booking cancelled');
            await loadBookings(currentPage);
            renderPage();
          } catch (e) { showToast('Failed: ' + e.message, 'error'); }
        }
      });
    });

    // Pagination
    document.querySelectorAll('.pagination-controls button[data-page]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await loadBookings(parseInt(btn.dataset.page));
        renderPage();
      });
    });
  }

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

