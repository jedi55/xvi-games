import { renderAdminSidebar, showToast } from '../../components/layout.js';

export async function renderAdminUsers(app) {
  const isAuth = 
    sessionStorage.getItem('adminAuth') === 'true'
  if (!isAuth) {
    window.location.href = '/#/admin'
    return
  }

  // Show loading state immediately
  app.innerHTML = `
    <div class="admin-layout">
      ${renderAdminSidebar('users')}
      <main class="admin-main">
        <div style="display:flex;align-items:center;
          justify-content:center;height:50vh;">
          <p style="color:var(--outline);">
            Loading users...
          </p>
        </div>
      </main>
    </div>
  `

  try {
    const { supabase } = 
      await import('/src/lib/supabase.js')

    // Direct fetch with no complex joins
    const { data: profiles, error: profileError } = 
      await supabase
        .from('profiles')
        .select(`
          id,
          full_name,
          email,
          phone,
          role,
          is_member,
          membership_plan,
          membership_start,
          membership_expires,
          membership_ref,
          created_at
        `)
        .order('created_at', { ascending: false })

    if (profileError) {
      throw new Error(
        'Failed to fetch users: ' + profileError.message
      )
    }

    console.log('Fetched profiles:', profiles?.length)

    // Booking count from reservations table
    const { data: allBookings } = await supabase
      .from('reservations')
      .select('user_id')

    const bookingMap = {}
    ;(allBookings || []).forEach(b => {
      if (b.user_id) {
        bookingMap[b.user_id] = 
          (bookingMap[b.user_id] || 0) + 1
      }
    })

    const users = (profiles || []).map(p => ({
      ...p,
      bookingCount: bookingMap[p.id] || 0
    }))

    const totalMembers = 
      users.filter(u => u.is_member).length

    // Render the full page
    const mainEl = app.querySelector('.admin-main')
    if (!mainEl) return

    mainEl.innerHTML = `
      <header style="margin-bottom:2rem;display:flex;
        justify-content:space-between;
        align-items:center;flex-wrap:wrap;gap:1rem;">
        <div>
          <p style="color:var(--primary);
            font-size:0.7rem;font-weight:700;
            letter-spacing:0.2em;margin:0 0 0.5rem;
            text-transform:uppercase;">
            USER MANAGEMENT
          </p>
          <h1 style="font-size:2rem;margin:0;
            color:var(--on-surface);">
            All Users
          </h1>
          <p style="color:var(--outline);
            font-size:0.85rem;margin:0.25rem 0 0;">
            ${users.length} registered accounts
          </p>
        </div>
        <input type="text" id="user-search"
          placeholder="Search name or email..."
          style="padding:0.6rem 1rem;
            background:var(--surface);
            border:1px solid var(--outline-variant);
            border-radius:8px;
            color:var(--on-surface);
            font-size:0.85rem;width:240px;
            outline:none;"/>
      </header>

      <!-- Stats -->
      <div style="display:grid;
        grid-template-columns:repeat(4,1fr);
        gap:1rem;margin-bottom:2rem;">
        <div class="stat-card">
          <p class="stat-label">Total Users</p>
          <p class="stat-value">${users.length}</p>
        </div>
        <div class="stat-card"
          style="border-top:3px solid #c9a84c;">
          <p class="stat-label">Members 👑</p>
          <p class="stat-value">${totalMembers}</p>
        </div>
        <div class="stat-card">
          <p class="stat-label">Non-Members</p>
          <p class="stat-value">
            ${users.length - totalMembers}
          </p>
        </div>
        <div class="stat-card">
          <p class="stat-label">New This Month</p>
          <p class="stat-value">
            ${users.filter(u => {
              if (!u.created_at) return false
              const d = new Date(u.created_at)
              const now = new Date()
              return d.getMonth() === now.getMonth() &&
                d.getFullYear() === now.getFullYear()
            }).length}
          </p>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div style="display:flex;gap:0.5rem;
        margin-bottom:1.25rem;flex-wrap:wrap;">
        <button class="filter-btn active"
          data-filter="all"
          style="padding:0.4rem 1rem;
            border-radius:20px;border:1px solid 
              var(--outline-variant);
            background:var(--primary);
            color:white;cursor:pointer;
            font-size:0.85rem;">
          All (${users.length})
        </button>
        <button class="filter-btn"
          data-filter="member"
          style="padding:0.4rem 1rem;
            border-radius:20px;
            border:1px solid var(--outline-variant);
            background:transparent;
            color:var(--on-surface);
            cursor:pointer;font-size:0.85rem;">
          Members (${totalMembers})
        </button>
        <button class="filter-btn"
          data-filter="non-member"
          style="padding:0.4rem 1rem;
            border-radius:20px;
            border:1px solid var(--outline-variant);
            background:transparent;
            color:var(--on-surface);
            cursor:pointer;font-size:0.85rem;">
          Non-Members (${users.length - totalMembers})
        </button>
      </div>

      <!-- Users Table -->
      <div class="data-table-container">
        <div style="overflow-x:auto;">
          <table class="data-table">
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Bookings</th>
                <th>Membership</th>
                <th>Joined</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody id="users-tbody">
              ${users.map((user, i) => `
                <tr class="user-row"
                  data-filter="${user.is_member ? 
                    'member' : 'non-member'}"
                  data-search="${[
                    user.full_name,
                    user.email,
                    user.phone
                  ].filter(Boolean)
                   .join(' ').toLowerCase()}"
                  style="background:${i%2===0 ? 
                    'transparent' : 
                    'rgba(255,255,255,0.02)'}">

                  <td>
                    <div style="display:flex;
                      align-items:center;gap:0.6rem;">
                      <div style="width:36px;height:36px;
                        border-radius:50%;
                        background:${user.is_member ? 
                          'rgba(201,168,76,0.2)' : 
                          '#1a5c1a'};
                        border:${user.is_member ? 
                          '1.5px solid #c9a84c' : 'none'};
                        display:flex;align-items:center;
                        justify-content:center;
                        font-size:0.9rem;font-weight:700;
                        color:${user.is_member ? 
                          '#c9a84c' : 'white'};
                        flex-shrink:0;font-family:serif;">
                        ${(user.full_name || 
                          user.email || 'U')
                          .charAt(0).toUpperCase()}
                      </div>
                      <div>
                        <p style="margin:0;
                          font-weight:600;
                          font-size:0.9rem;
                          color:var(--on-surface);">
                          ${user.full_name || 'No name'}
                          ${user.is_member ? ' 👑' : ''}
                        </p>
                        ${user.role === 'admin' ? `
                          <span style="font-size:0.65rem;
                            color:#c9a84c;
                            font-weight:700;">
                            ADMIN
                          </span>
                        ` : ''}
                      </div>
                    </div>
                  </td>

                  <td style="font-size:0.82rem;
                    color:var(--outline);">
                    ${user.email || '—'}
                  </td>

                  <td style="font-size:0.82rem;
                    color:var(--outline);">
                    ${user.phone || '—'}
                  </td>

                  <td style="text-align:center;">
                    <span style="
                      background:var(--surface);
                      border:1px solid 
                        var(--outline-variant);
                      padding:0.2rem 0.75rem;
                      border-radius:20px;
                      font-size:0.85rem;
                      font-weight:700;">
                      ${user.bookingCount}
                    </span>
                  </td>

                  <td>
                    ${user.is_member ? `
                      <span style="
                        background:rgba(201,168,76,0.12);
                        color:#c9a84c;
                        padding:0.25rem 0.75rem;
                        border-radius:20px;
                        font-size:0.75rem;
                        font-weight:700;
                        letter-spacing:0.5px;">
                        👑 ${(user.membership_plan || 
                          'MEMBER').toUpperCase()}
                      </span>
                    ` : `
                      <span style="
                        color:var(--outline);
                        font-size:0.8rem;">
                        No membership
                      </span>
                    `}
                  </td>

                  <td style="font-size:0.8rem;
                    color:var(--outline);">
                    ${user.created_at
                      ? new Date(user.created_at)
                          .toLocaleDateString('en-NG', {
                            day:'numeric',
                            month:'short',
                            year:'numeric'
                          })
                      : '—'}
                  </td>

                  <td>
                    <div style="display:flex;
                      gap:0.4rem;flex-wrap:wrap;">
                      ${!user.is_member ? `
                        <button
                          class="grant-btn action-btn"
                          data-id="${user.id}"
                          data-name="${user.full_name 
                            || user.email || 'User'}"
                          style="font-size:0.75rem;
                            padding:0.3rem 0.6rem;
                            color:#c9a84c;
                            border-color:rgba(
                              201,168,76,0.4);">
                          👑 Grant
                        </button>
                      ` : `
                        <button
                          class="revoke-btn 
                            action-btn danger"
                          data-id="${user.id}"
                          data-name="${user.full_name 
                            || user.email || 'User'}"
                          style="font-size:0.75rem;
                            padding:0.3rem 0.6rem;">
                          Revoke
                        </button>
                      `}
                    </div>
                  </td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    `

    // Wire up search
    document.getElementById('user-search')
      ?.addEventListener('input', (e) => {
        const q = e.target.value.toLowerCase()
        document.querySelectorAll('.user-row')
          .forEach(row => {
            row.style.display = 
              (row.dataset.search || '')
                .includes(q) ? '' : 'none'
          })
      })

    // Filter tabs
    document.querySelectorAll('.filter-btn')
      .forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.filter-btn')
            .forEach(b => {
              b.style.background = 'transparent'
              b.style.color = 'var(--on-surface)'
            })
          btn.style.background = 'var(--primary)'
          btn.style.color = 'white'
          const f = btn.dataset.filter
          document.querySelectorAll('.user-row')
            .forEach(row => {
              row.style.display = 
                f === 'all' || 
                row.dataset.filter === f 
                  ? '' : 'none'
            })
        })
      })

    // Grant membership
    document.querySelectorAll('.grant-btn')
      .forEach(btn => {
        btn.addEventListener('click', async () => {
          const plan = prompt(
            `Grant membership to:\n${btn.dataset.name}\n\nType: monthly or annual`,
            'monthly'
          )
          if (!plan || 
            !['monthly','annual'].includes(plan)
          ) return

          const now = new Date()
          const expires = new Date(now)
          plan === 'annual'
            ? expires.setFullYear(
                expires.getFullYear() + 1
              )
            : expires.setMonth(
                expires.getMonth() + 1
              )

          const { error } = await supabase
            .from('profiles')
            .update({
              is_member: true,
              membership_plan: plan,
              membership_start: now.toISOString(),
              membership_expires: 
                expires.toISOString(),
              membership_ref: 
                'ADMIN_GRANT_' + Date.now()
            })
            .eq('id', btn.dataset.id)

          if (!error) {
            showToast(
              `✓ Membership granted to ${btn.dataset.name}`
            )
            renderAdminUsers(app)
          } else {
            showToast(
              'Failed: ' + error.message, 
              'error'
            )
          }
        })
      })

    // Revoke membership
    document.querySelectorAll('.revoke-btn')
      .forEach(btn => {
        btn.addEventListener('click', async () => {
          if (!confirm(
            `Revoke membership for ${btn.dataset.name}?`
          )) return

          const { error } = await supabase
            .from('profiles')
            .update({
              is_member: false,
              membership_plan: null,
              membership_expires: null
            })
            .eq('id', btn.dataset.id)

          if (!error) {
            showToast('Membership revoked')
            renderAdminUsers(app)
          }
        })
      })

  } catch (err) {
    console.error('Users page error:', err)
    app.querySelector('.admin-main').innerHTML = `
      <div style="text-align:center;padding:4rem;
        color:var(--outline);">
        <p style="font-size:2rem;margin-bottom:1rem;">
          ⚠️
        </p>
        <p style="margin-bottom:0.5rem;
          color:var(--on-surface);">
          Failed to load users
        </p>
        <p style="font-size:0.85rem;
          margin-bottom:1.5rem;">
          ${err.message}
        </p>
        <button onclick="renderAdminUsers(app)"
          class="btn btn-primary">
          Try Again
        </button>
      </div>
    `
  }
}
