// ═══════════════════════════════════════
// SHARED LAYOUT COMPONENTS
// ═══════════════════════════════════════

import { getSession } from '../lib/auth.js';

export function renderHeader(session, activePage = '') {
  return `
    <header class="header">
      <nav class="header-inner">
        <a href="#/" class="header-logo">XVI</a>
        <div class="header-nav">
          <a href="#/" class="${activePage === 'home' ? 'active' : ''}">Home</a>
          <a href="#/tables" class="${activePage === 'tables' ? 'active' : ''}">Tables</a>
          <a href="#/about" class="${activePage === 'about' ? 'active' : ''}">About</a>
          <a href="#/membership" id="membership-nav-link"
            class="${activePage === 'membership' ? 'active' : ''}"
            style="display:none;color:#c9a84c;font-weight:600;">
            👑 Membership
          </a>
        </div>
        <div class="header-actions">
          <button class="theme-toggle" id="theme-toggle-btn" aria-label="Toggle theme">
            <span class="material-symbols-outlined theme-icon">dark_mode</span>
            <span class="theme-tooltip">Switch to Light Mode</span>
          </button>
          
          <a href="#/login" id="login-btn" style="display: none; color: #e2e3df; font-size: 0.85rem; font-weight: 600; text-decoration: none; margin-right: 1rem; transition: color 0.2s;" onmouseover="this.style.color='#c9a84c'" onmouseout="this.style.color='#e2e3df'">Login</a>
          <a href="#/signup" id="signup-btn" style="display: none; background: #69df5e; color: #003a03; padding: 0.5rem 1.25rem; border-radius: 6px; font-size: 0.85rem; font-weight: 700; text-decoration: none; transition: opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">Sign Up</a>

          <div style="position: relative; display: none;" id="user-menu-container">
            <button id="user-menu-btn" style="background: none; border: none; color: #c9a84c; font-size: 0.95rem; font-weight: 700; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;">
              <span id="user-name">Hi User</span>
              <span class="material-symbols-outlined" style="font-size: 1.1rem; pointer-events: none;">expand_more</span>
            </button>
            <div id="user-dropdown" style="display: none; position: absolute; right: 0; top: 120%; background: #0a1f0a; border: 1px solid #1a3a1a; border-radius: 8px; width: 180px; box-shadow: 0 4px 20px rgba(0,0,0,0.5); z-index: 100; overflow: hidden;">
              <a href="#/my-bookings" style="display: block; padding: 0.75rem 1rem; color: #e2e3df; font-size: 0.85rem; text-decoration: none; transition: background 0.2s;" onmouseover="this.style.background='#132e13'" onmouseout="this.style.background='transparent'">My Bookings</a>
              <a href="#/account" style="display: block; padding: 0.75rem 1rem; color: #e2e3df; font-size: 0.85rem; text-decoration: none; transition: background 0.2s;" onmouseover="this.style.background='#132e13'" onmouseout="this.style.background='transparent'">Account Settings</a>
              <a href="#/membership" id="dropdown-membership-link" style="display: none; padding: 0.75rem 1rem; color: #c9a84c; font-size: 0.85rem; text-decoration: none; transition: background 0.2s; font-weight: 600;" onmouseover="this.style.background='#132e13'" onmouseout="this.style.background='transparent'">👑 Get Membership</a>
              <div style="height: 1px; background: #1a3a1a; margin: 0.25rem 0;"></div>
              <button id="header-logout-btn" style="display: block; width: 100%; text-align: left; padding: 0.75rem 1rem; background: none; border: none; color: #ffb4ab; font-size: 0.85rem; cursor: pointer; transition: background 0.2s;" onmouseover="this.style.background='#132e13'" onmouseout="this.style.background='transparent'">Sign Out</button>
            </div>
          </div>
        </div>
      </nav>
      <div class="header-divider"></div>
    </header>
  `;
}

export async function updateNavbar() {
  const session = await getSession()
  const user = session?.user
  
  const loginBtn = document.getElementById('login-btn')
  const signupBtn = document.getElementById('signup-btn')
  const userMenu = document.getElementById('user-menu-container')
  const userName = document.getElementById('user-name')

  if (user) {
    // User is logged in
    if (loginBtn) loginBtn.style.display = 'none'
    if (signupBtn) signupBtn.style.display = 'none'
    if (userMenu) userMenu.style.display = 'block'
    if (userName) {
      const name = user.user_metadata?.full_name || 
                   user.user_metadata?.name ||
                   user.email?.split('@')[0] || 
                   'User'
      userName.textContent = 'Hi ' + name.split(' ')[0]
    }

    // Show membership link only for non-members
    const isMember = localStorage.getItem('xvi_member') === 'true'
    const membershipNavLink = document.getElementById('membership-nav-link')
    const dropdownMembershipLink = document.getElementById('dropdown-membership-link')
    if (membershipNavLink) membershipNavLink.style.display = isMember ? 'none' : 'inline'
    if (dropdownMembershipLink) dropdownMembershipLink.style.display = isMember ? 'none' : 'block'
  } else {
    // User is logged out
    if (loginBtn) loginBtn.style.display = 'block'
    if (signupBtn) signupBtn.style.display = 'block'
    if (userMenu) userMenu.style.display = 'none'
    const membershipNavLink = document.getElementById('membership-nav-link')
    const dropdownMembershipLink = document.getElementById('dropdown-membership-link')
    if (membershipNavLink) membershipNavLink.style.display = 'none'
    if (dropdownMembershipLink) dropdownMembershipLink.style.display = 'none'
  }
}

export function renderFooter() {
  return `
    <footer id="site-footer" style="background:#0a1f0a;font-family:inherit;">

      <!-- ── MAIN FOOTER ── -->
      <div style="
        max-width:1200px;margin:0 auto;
        padding:4rem 2rem 2.5rem;
        display:grid;
        grid-template-columns:1.6fr 1fr 1fr 1fr 1.4fr;
        gap:2.5rem;
        border-bottom:1px solid rgba(255,255,255,0.08);
      " class="footer-main-grid">

        <!-- COL 1: Brand + Social -->
        <div>
          <div style="color:#c9a84c;font-size:2rem;font-weight:800;
            letter-spacing:2px;margin-bottom:0.25rem;">XVI</div>
          <div style="color:rgba(255,255,255,0.4);font-size:0.65rem;
            letter-spacing:3px;text-transform:uppercase;
            margin-bottom:1rem;">Elevated Reservations</div>
          <p style="color:rgba(255,255,255,0.55);font-size:0.82rem;
            line-height:1.65;margin:0 0 1.5rem;max-width:220px;">
            Premium snooker experience in Lagos, Nigeria.
          </p>

          <!-- Social Icons -->
          <div style="display:flex;gap:10px;align-items:center;">
            <a href="https://tiktok.com/@thebrandxvi" target="_blank" rel="noopener"
              title="TikTok @thebrandxvi"
              style="
                width:36px;height:36px;border-radius:50%;
                background:rgba(255,255,255,0.08);
                display:inline-flex;align-items:center;justify-content:center;
                color:rgba(255,255,255,0.7);font-size:0.9rem;
                text-decoration:none;border:1px solid transparent;
                transition:all 0.2s ease;flex-shrink:0;
              "
              onmouseover="this.style.background='rgba(201,168,76,0.18)';this.style.borderColor='#c9a84c';this.style.color='#c9a84c'"
              onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.borderColor='transparent';this.style.color='rgba(255,255,255,0.7)'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.89-2.89 2.89 2.89 0 012.89-2.89c.28 0 .54.04.79.1V9.01a6.32 6.32 0 00-.79-.05 6.34 6.34 0 00-6.34 6.34 6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.33-6.34V8.69a8.18 8.18 0 004.78 1.52V6.79a4.85 4.85 0 01-1.01-.1z"/>
              </svg>
            </a>

            <a href="https://whatsapp.com/dl/" target="_blank" rel="noopener"
              title="WhatsApp Chat"
              style="
                width:36px;height:36px;border-radius:50%;
                background:rgba(255,255,255,0.08);
                display:inline-flex;align-items:center;justify-content:center;
                color:rgba(255,255,255,0.7);font-size:0.9rem;
                text-decoration:none;border:1px solid transparent;
                transition:all 0.2s ease;flex-shrink:0;
              "
              onmouseover="this.style.background='rgba(201,168,76,0.18)';this.style.borderColor='#c9a84c';this.style.color='#c9a84c'"
              onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.borderColor='transparent';this.style.color='rgba(255,255,255,0.7)'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
            </a>

            <a href="https://www.instagram.com/thebrandxvi?utm_source=ig_web_button_share_sheet&igsh=ZDNlZDc0MzIxNw==" target="_blank" rel="noopener"
              title="Instagram @thebrandxvi"
              style="
                width:36px;height:36px;border-radius:50%;
                background:rgba(255,255,255,0.08);
                display:inline-flex;align-items:center;justify-content:center;
                color:rgba(255,255,255,0.7);font-size:0.9rem;
                text-decoration:none;border:1px solid transparent;
                transition:all 0.2s ease;flex-shrink:0;
              "
              onmouseover="this.style.background='rgba(201,168,76,0.18)';this.style.borderColor='#c9a84c';this.style.color='#c9a84c'"
              onmouseout="this.style.background='rgba(255,255,255,0.08)';this.style.borderColor='transparent';this.style.color='rgba(255,255,255,0.7)'">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z"/>
              </svg>
            </a>
          </div>
        </div>

        <!-- COL 2: Quick Links -->
        <div>
          <h4 style="color:#c9a84c;font-size:0.7rem;letter-spacing:2px;
            text-transform:uppercase;margin:0 0 1.25rem;font-weight:600;">
            Quick Links
          </h4>
          <ul style="list-style:none;padding:0;margin:0;display:flex;
            flex-direction:column;gap:0.65rem;">
            ${[
              ['Home', '/#/'],
              ['Tables', '/#/tables'],
              ['Book a Table', '/#/booking'],
              ['About Us', '/#/about'],
              ['Membership', '/#/membership'],
            ].map(([label, href]) => `
              <li>
                <a href="${href}" style="color:rgba(255,255,255,0.65);
                  font-size:0.85rem;text-decoration:none;
                  transition:color 0.2s ease;"
                  onmouseover="this.style.color='#c9a84c'"
                  onmouseout="this.style.color='rgba(255,255,255,0.65)'">${label}</a>
              </li>
            `).join('')}
          </ul>
        </div>

        <!-- COL 3: Services -->
        <div>
          <h4 style="color:#c9a84c;font-size:0.7rem;letter-spacing:2px;
            text-transform:uppercase;margin:0 0 1.25rem;font-weight:600;">
            Services
          </h4>
          <ul style="list-style:none;padding:0;margin:0;display:flex;
            flex-direction:column;gap:0.65rem;">
            ${[
              'Standard Tables',
              'VIP Suite',
              'Hourly Booking',
              'Game Booking',
              'Group Reservations',
            ].map(label => `
              <li>
                <span style="color:rgba(255,255,255,0.65);
                  font-size:0.85rem;">${label}</span>
              </li>
            `).join('')}
          </ul>
        </div>

        <!-- COL 4: Policies -->
        <div>
          <h4 style="color:#c9a84c;font-size:0.7rem;letter-spacing:2px;
            text-transform:uppercase;margin:0 0 1.25rem;font-weight:600;">
            Policies
          </h4>
          <ul style="list-style:none;padding:0;margin:0;display:flex;
            flex-direction:column;gap:0.65rem;">
            ${[
              ['Privacy Policy', '/#/privacy'],
              ['Terms of Service', '/#/terms'],
              ['Cancellation Policy', '/#/cancellation'],
              ['Refund Policy', '/#/refund'],
            ].map(([label, href]) => `
              <li>
                <a href="${href}" style="color:rgba(255,255,255,0.65);
                  font-size:0.85rem;text-decoration:none;
                  transition:color 0.2s ease;"
                  onmouseover="this.style.color='#c9a84c'"
                  onmouseout="this.style.color='rgba(255,255,255,0.65)'">${label}</a>
              </li>
            `).join('')}
          </ul>
        </div>

        <!-- COL 5: Newsletter -->
        <div>
          <h4 style="color:#c9a84c;font-size:0.7rem;letter-spacing:2px;
            text-transform:uppercase;margin:0 0 1.25rem;font-weight:600;">
            Stay Updated
          </h4>
          <p style="color:rgba(255,255,255,0.55);font-size:0.82rem;
            line-height:1.65;margin:0 0 1rem;">
            Get exclusive member offers, tournament news and booking updates.
          </p>

          <!-- Email subscribe -->
          <div id="footer-subscribe-wrap" style="position:relative;margin-bottom:0.6rem;">
            <input type="email" id="footer-email-input"
              placeholder="Enter your email"
              style="
                width:100%;padding:0.75rem 3rem 0.75rem 0.9rem;
                background:rgba(255,255,255,0.07);
                border:1px solid rgba(255,255,255,0.15);
                border-radius:8px;color:white;
                font-size:0.85rem;box-sizing:border-box;
                outline:none;transition:border-color 0.2s;
              "
              onfocus="this.style.borderColor='#c9a84c'"
              onblur="this.style.borderColor='rgba(255,255,255,0.15)'"
            />
            <button id="footer-subscribe-btn"
              style="
                position:absolute;right:6px;top:50%;
                transform:translateY(-50%);
                background:#c9a84c;border:none;
                border-radius:5px;width:32px;height:32px;
                cursor:pointer;display:flex;align-items:center;
                justify-content:center;transition:opacity 0.2s;
              "
              onmouseover="this.style.opacity='0.85'"
              onmouseout="this.style.opacity='1'"
              title="Subscribe">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="#0a1f0a">
                <path d="M2 12l20-9-9 20-2-8-9-3z"/>
              </svg>
            </button>
          </div>
          <div id="footer-subscribe-success" style="display:none;
            color:#69df5e;font-size:0.8rem;margin-bottom:0.5rem;
            font-weight:600;">
            Thanks! You're subscribed ✓
          </div>
          <p style="color:rgba(255,255,255,0.35);font-size:0.75rem;margin:0;">
            No spam. Unsubscribe anytime.
          </p>
        </div>

      </div><!-- /footer-main-grid -->

      <!-- ── BOTTOM BAR ── -->
      <div style="
        background:#061406;
        padding:1rem 2rem;
        display:flex;
        align-items:center;
        justify-content:space-between;
        flex-wrap:wrap;
        gap:0.75rem;
        max-width:none;
      " class="footer-bottom-bar">
        <span style="color:rgba(255,255,255,0.35);font-size:0.8rem;">
          © ${new Date().getFullYear()} XVI Snooker Club. All Rights Reserved.
        </span>

        <!-- Payment Badges -->
        <div style="display:flex;gap:0.5rem;align-items:center;flex-wrap:wrap;">
          ${['Paystack','Visa','Mastercard','Bank Transfer'].map(p => `
            <span style="
              background:rgba(255,255,255,0.07);
              border:1px solid rgba(255,255,255,0.12);
              border-radius:5px;
              padding:0.2rem 0.55rem;
              font-size:0.65rem;
              color:rgba(255,255,255,0.5);
              font-weight:600;
              letter-spacing:0.5px;
              white-space:nowrap;
            ">${p}</span>
          `).join('')}
        </div>
      </div>

      <!-- Responsive CSS -->
      <style>
        @media (max-width: 900px) {
          .footer-main-grid {
            grid-template-columns: 1fr 1fr 1fr !important;
          }
        }
        @media (max-width: 640px) {
          .footer-main-grid {
            grid-template-columns: 1fr !important;
            padding: 2.5rem 1.25rem 2rem !important;
          }
          .footer-bottom-bar {
            flex-direction: column !important;
            align-items: flex-start !important;
            padding: 1rem 1.25rem !important;
          }
        }
      </style>

    </footer>
    <script>
      (function() {
        var btn = document.getElementById('footer-subscribe-btn');
        if (!btn) return;
        btn.addEventListener('click', function() {
          var input = document.getElementById('footer-email-input');
          var success = document.getElementById('footer-subscribe-success');
          if (!input || !input.value.trim() || !input.value.includes('@')) {
            input.style.borderColor = '#ef4444';
            setTimeout(function() { input.style.borderColor = 'rgba(255,255,255,0.15)'; }, 1500);
            return;
          }
          input.style.display = 'none';
          btn.style.display = 'none';
          if (success) success.style.display = 'block';
        });
      })();
    </script>
  `;
}

export function renderAdminSidebar(activePage = 'overview') {
  return `
    <aside class="admin-sidebar">
      <div class="admin-sidebar-logo">XVI</div>
      <div class="admin-sidebar-profile">
        <div class="avatar">AD</div>
        <div>
          <p class="name">Club Admin</p>
          <p class="role">XVI</p>
        </div>
      </div>
      <nav class="admin-nav">
        ${[
          { id: 'overview', label: 'Overview', icon: 'dashboard', href: '/#/admin' },
          { id: 'bookings', label: 'Bookings', icon: 'calendar_month', href: '/#/admin/bookings' },
          { id: 'users', label: 'Users', icon: 'group', href: '/#/admin/users' },
          { id: 'tables', label: 'Tables', icon: 'grid_view', href: '/#/admin/tables' },
          { id: 'payments', label: 'Payments', icon: 'payments', href: '/#/admin/payments' },
          { id: 'memberships', label: 'Memberships', icon: 'workspace_premium', href: '/#/admin/memberships' },
          { id: 'pricing', label: 'Pricing', icon: 'sell', href: '/#/admin/pricing' }
        ].map(link => `
          <a href="${link.href}" class="${activePage === link.id ? 'active' : ''}">
            <span class="material-symbols-outlined">${link.icon}</span>
            <span>${link.label}</span>
          </a>
          ${link.id === 'pricing' ? '' : '' /* Add divider if needed, skipping for now */}
        `).join('')}
        <div class="nav-cta">
          <a href="#/admin/bookings" class="btn btn-primary" style="width: 100%; text-align: center;">New Booking</a>
        </div>
        <div class="nav-logout">
          <a href="#" id="admin-logout-btn">
            <span class="material-symbols-outlined">logout</span>
            <span>Logout</span>
          </a>
        </div>
      </nav>
    </aside>
  `;
}

// ─── Toast notification ───
export function showToast(message, type = 'success') {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'fadeOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}

// ─── Format currency ───
export function formatCurrency(amount, currency = 'NGN') {
  return new Intl.NumberFormat('en-NG', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0
  }).format(amount);
}

// ─── Format date ───
export function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

// ─── Format time ───
export function formatTime(timeStr) {
  const [h, m] = timeStr.split(':');
  return `${h}:${m}`;
}

// ─── Get status chip class ───
export function getStatusChipClass(status) {
  const map = {
    confirmed: 'chip-active',
    pending: 'chip-pending',
    cancelled: 'chip-cancelled',
    completed: 'chip-completed',
    active: 'chip-active',
    upcoming: 'chip-upcoming'
  };
  return map[status] || 'chip-pending';
}
