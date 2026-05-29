import { renderAdminSidebar, showToast } from '../../components/layout.js';

export async function renderAdminPayments(app) {
  try {
    const { supabase } = await import('/src/lib/supabase.js')
    const isAuth = sessionStorage.getItem('adminAuth') === 'true'
    if (!isAuth) { window.location.href = '/#/admin'; return }

    // Try bookings table first, fall back to reservations
    let bookings = []
    const { data: bData, error: bErr } = await supabase
      .from('bookings')
      .select(`
        id, reference_code, total_amount,
        payment_status, paystack_reference,
        created_at, status,
        customers(full_name, phone, email),
        snooker_tables(label)
      `)
      .not('paystack_reference', 'is', null)
      .order('created_at', { ascending: false })

    if (!bErr && bData) {
      bookings = bData
    } else {
      // Fall back to reservations table
      const { data: rData } = await supabase
        .from('reservations')
        .select(`
          id, reference_code, total_amount, status, created_at,
          profiles(full_name, phone),
          tables:table_id(name)
        `)
        .order('created_at', { ascending: false })
      bookings = (rData || []).map(r => ({
        ...r,
        payment_status: r.status === 'confirmed' ? 'paid' : 'pending',
        paystack_reference: r.reference_code,
        customers: r.profiles,
        snooker_tables: { label: r.tables?.name }
      }))
    }

    const paidBookings = bookings.filter(b => b.payment_status === 'paid')
    const totalRevenue = paidBookings.reduce((sum, b) => sum + (b.total_amount || 0), 0)
    const todayStr = new Date().toDateString()
    const todayRevenue = paidBookings
      .filter(b => new Date(b.created_at).toDateString() === todayStr)
      .reduce((sum, b) => sum + (b.total_amount || 0), 0)

    // Determine if amounts are in kobo (>10000 means kobo) or naira
    const divisor = totalRevenue > 100000 ? 100 : 1

    app.innerHTML = `
      <div class="admin-layout">
        ${renderAdminSidebar('payments')}
        <main class="admin-main">

          <header style="margin-bottom:2rem;">
            <p class="label-xs text-primary" style="margin-bottom:0.5rem;letter-spacing:0.2em;">PAYMENT MANAGEMENT</p>
            <h1 class="headline-md" style="font-size:2rem;">Payments</h1>
          </header>

          <!-- Revenue Stats -->
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:2rem;">
            <div class="stat-card">
              <p class="stat-label">Total Revenue</p>
              <p class="stat-value">₦${(totalRevenue / divisor).toLocaleString()}</p>
            </div>
            <div class="stat-card">
              <p class="stat-label">Revenue Today</p>
              <p class="stat-value">₦${(todayRevenue / divisor).toLocaleString()}</p>
            </div>
            <div class="stat-card">
              <p class="stat-label">Total Transactions</p>
              <p class="stat-value">${bookings.length}</p>
            </div>
            <div class="stat-card">
              <p class="stat-label">Successful Payments</p>
              <p class="stat-value">${paidBookings.length}</p>
            </div>
          </div>

          <!-- Filters -->
          <div style="display:flex;gap:0.75rem;margin-bottom:1.25rem;flex-wrap:wrap;align-items:center;">
            <button class="filter-btn active" data-filter="all">All</button>
            <button class="filter-btn" data-filter="paid">Paid</button>
            <button class="filter-btn" data-filter="pending">Pending</button>
            <button class="filter-btn" data-filter="failed">Failed</button>
            <input type="text" id="payment-search"
              placeholder="Search by ref or name..."
              style="margin-left:auto;padding:0.5rem 1rem;
                background:var(--surface);border:1px solid var(--outline-variant);
                border-radius:8px;color:var(--on-surface);font-size:0.85rem;
                width:220px;outline:none;"/>
          </div>

          <!-- Payments Table -->
          <div class="data-table-container">
            <div style="overflow-x:auto;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Booking Ref</th>
                    <th>Paystack Ref</th>
                    <th>Customer</th>
                    <th>Table</th>
                    <th>Amount</th>
                    <th>Status</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody id="payments-tbody">
                  ${bookings.map(b => `
                    <tr class="payment-row"
                      data-status="${b.payment_status || 'pending'}"
                      data-ref="${(b.reference_code || '').toLowerCase()}"
                      data-name="${(b.customers?.full_name || '').toLowerCase()}">
                      <td class="ref-code">#${b.reference_code || '—'}</td>
                      <td style="font-size:0.75rem;color:var(--outline);font-family:monospace;">
                        ${b.paystack_reference ? b.paystack_reference.slice(-12) : '—'}
                      </td>
                      <td style="font-weight:600;">
                        ${b.customers?.full_name || 'Guest'}
                        <br/>
                        <span style="font-size:0.75rem;color:var(--outline);font-weight:400;">
                          ${b.customers?.phone || ''}
                        </span>
                      </td>
                      <td>
                        <span class="table-badge standard">
                          ${b.snooker_tables?.label || b.snooker_tables?.name || '—'}
                        </span>
                      </td>
                      <td style="font-weight:700;color:var(--primary);">
                        ₦${((b.total_amount || 0) / divisor).toLocaleString()}
                      </td>
                      <td>
                        <span style="display:flex;align-items:center;gap:0.4rem;">
                          <span class="status-dot ${b.payment_status || 'pending'}"></span>
                          <span class="label-xs" style="font-weight:700;text-transform:capitalize;">
                            ${b.payment_status || 'pending'}
                          </span>
                        </span>
                      </td>
                      <td style="font-size:0.8rem;color:var(--outline);">
                        ${new Date(b.created_at).toLocaleDateString('en-NG')}
                      </td>
                    </tr>
                  `).join('')}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>
    `

    // Logout
    document.getElementById('admin-logout-btn')?.addEventListener('click', (e) => {
      e.preventDefault()
      sessionStorage.removeItem('adminAuth')
      location.hash = '/admin'
    })

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'))
        btn.classList.add('active')
        const f = btn.dataset.filter
        document.querySelectorAll('.payment-row').forEach(row => {
          row.style.display = f === 'all' || row.dataset.status === f ? '' : 'none'
        })
      })
    })

    // Search
    document.getElementById('payment-search')?.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase()
      document.querySelectorAll('.payment-row').forEach(row => {
        row.style.display =
          row.dataset.ref.includes(q) || row.dataset.name.includes(q) ? '' : 'none'
      })
    })

  } catch (err) {
    console.error('Admin Payments error:', err)
    app.innerHTML = `<div style="min-height:100vh;background:#0a1f0a;display:flex;
      align-items:center;justify-content:center;text-align:center;padding:2rem;">
      <div>
        <p style="color:#c9a84c;font-size:1.5rem;margin-bottom:1rem;">Something went wrong</p>
        <p style="color:#9fc99f;font-size:0.9rem;margin-bottom:2rem;">${err.message}</p>
        <a href="/#/admin" style="color:#c9a84c;text-decoration:underline;">Back to Dashboard</a>
      </div>
    </div>`
  }
}
