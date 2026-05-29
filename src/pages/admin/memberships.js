import { renderAdminSidebar, showToast } from '../../components/layout.js';

export async function renderAdminMemberships(app) {
  try {
    const { supabase } = await import('/src/lib/supabase.js')
    const isAuth = sessionStorage.getItem('adminAuth') === 'true'
    if (!isAuth) { window.location.href = '/#/admin'; return }

    const { data: members } = await supabase
      .from('profiles')
      .select('*')
      .eq('is_member', true)
      .order('membership_start', { ascending: false })

    const now = new Date()
    const activeMembers = (members || []).filter(m =>
      !m.membership_expires || new Date(m.membership_expires) > now
    )
    const expiredMembers = (members || []).filter(m =>
      m.membership_expires && new Date(m.membership_expires) <= now
    )
    const monthlyCount = (members || []).filter(m => m.membership_plan === 'monthly').length

    app.innerHTML = `
      <div class="admin-layout">
        ${renderAdminSidebar('memberships')}
        <main class="admin-main">

          <header style="margin-bottom:2rem;">
            <p class="label-xs text-primary" style="margin-bottom:0.5rem;letter-spacing:0.2em;">MEMBERSHIP MANAGEMENT</p>
            <h1 class="headline-md" style="font-size:2rem;">Members</h1>
          </header>

          <!-- Stats -->
          <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:1rem;margin-bottom:2rem;">
            <div class="stat-card" style="border-top:3px solid #c9a84c;">
              <p class="stat-label">Total Members 👑</p>
              <p class="stat-value">${(members || []).length}</p>
            </div>
            <div class="stat-card">
              <p class="stat-label">Active</p>
              <p class="stat-value" style="color:#4caf50;">${activeMembers.length}</p>
            </div>
            <div class="stat-card">
              <p class="stat-label">Expired</p>
              <p class="stat-value" style="color:#ef4444;">${expiredMembers.length}</p>
            </div>
            <div class="stat-card">
              <p class="stat-label">Monthly Subscribers</p>
              <p class="stat-value">${monthlyCount}</p>
            </div>
          </div>

          <!-- Filter Tabs -->
          <div style="display:flex;gap:0.75rem;margin-bottom:1.25rem;">
            <button class="filter-btn active" data-filter="all">All (${(members || []).length})</button>
            <button class="filter-btn" data-filter="monthly">Monthly</button>
            <button class="filter-btn" data-filter="annual">Annual</button>
            <button class="filter-btn" data-filter="expired">Expired</button>
          </div>

          <!-- Members Table -->
          <div class="data-table-container">
            <div style="overflow-x:auto;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>Member</th>
                    <th>Email</th>
                    <th>Phone</th>
                    <th>Plan</th>
                    <th>Started</th>
                    <th>Expires</th>
                    <th>Ref</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody id="members-tbody">
                  ${(members || []).map(m => {
                    const expired = m.membership_expires &&
                      new Date(m.membership_expires) <= now
                    return `
                      <tr class="member-row"
                        data-plan="${m.membership_plan || ''}"
                        data-expired="${expired}">
                        <td>
                          <div style="display:flex;align-items:center;gap:0.6rem;">
                            <div style="width:32px;height:32px;border-radius:50%;
                              background:rgba(201,168,76,0.2);border:1px solid #c9a84c;
                              display:flex;align-items:center;justify-content:center;
                              font-size:0.8rem;font-weight:700;color:#c9a84c;flex-shrink:0;">
                              ${(m.full_name || m.email || 'M').charAt(0).toUpperCase()}
                            </div>
                            <span style="font-weight:600;font-size:0.875rem;">
                              ${m.full_name || 'No name'}
                            </span>
                          </div>
                        </td>
                        <td style="font-size:0.82rem;color:var(--outline);">${m.email || '—'}</td>
                        <td style="font-size:0.82rem;color:var(--outline);">${m.phone || '—'}</td>
                        <td>
                          <span style="background:rgba(201,168,76,0.15);color:#c9a84c;
                            padding:0.2rem 0.6rem;border-radius:20px;
                            font-size:0.75rem;font-weight:700;text-transform:uppercase;">
                            👑 ${m.membership_plan || 'member'}
                          </span>
                        </td>
                        <td style="font-size:0.8rem;color:var(--outline);">
                          ${m.membership_start
                            ? new Date(m.membership_start).toLocaleDateString('en-NG')
                            : '—'}
                        </td>
                        <td style="font-size:0.8rem;color:${expired ? '#ef4444' : 'var(--outline)'};">
                          ${m.membership_expires
                            ? new Date(m.membership_expires).toLocaleDateString('en-NG')
                            : '—'}
                        </td>
                        <td style="font-size:0.72rem;color:var(--outline);font-family:monospace;">
                          ${m.membership_ref ? m.membership_ref.slice(-8) : '—'}
                        </td>
                        <td>
                          <span style="display:flex;align-items:center;gap:0.35rem;">
                            <span style="width:7px;height:7px;border-radius:50%;
                              background:${expired ? '#ef4444' : '#4caf50'};"></span>
                            <span class="label-xs" style="font-weight:700;
                              color:${expired ? '#ef4444' : '#4caf50'};">
                              ${expired ? 'EXPIRED' : 'ACTIVE'}
                            </span>
                          </span>
                        </td>
                        <td>
                          <button class="revoke-btn action-btn danger"
                            data-id="${m.id}"
                            data-name="${m.full_name || m.email}"
                            style="font-size:0.75rem;padding:0.3rem 0.6rem;">
                            Revoke
                          </button>
                        </td>
                      </tr>
                    `
                  }).join('')}
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
        document.querySelectorAll('.member-row').forEach(row => {
          if (f === 'all') row.style.display = ''
          else if (f === 'expired') row.style.display = row.dataset.expired === 'true' ? '' : 'none'
          else row.style.display = row.dataset.plan === f ? '' : 'none'
        })
      })
    })

    // Revoke membership
    document.querySelectorAll('.revoke-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        if (!confirm(`Revoke membership for ${btn.dataset.name}?`)) return
        const { supabase } = await import('/src/lib/supabase.js')
        const { error } = await supabase
          .from('profiles')
          .update({ is_member: false, membership_plan: null })
          .eq('id', btn.dataset.id)
        if (!error) {
          showToast('Membership revoked')
          renderAdminMemberships(app)
        } else {
          showToast('Failed to revoke: ' + error.message, 'error')
        }
      })
    })

  } catch (err) {
    console.error('Admin Memberships error:', err)
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
