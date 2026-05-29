// ═══════════════════════════════════════
// 101 GAMES — Main Entry Point
// ═══════════════════════════════════════

import './styles/design-system.css';
import './styles/app.css';

import { router } from './lib/router.js';
import { getSession, isAdmin, onAuthStateChange, signOut, clearSessionCache } from './lib/auth.js';
import { initTheme, setupThemeToggle } from './lib/theme.js';
import { supabase } from './lib/supabase.js';

import { updateNavbar } from './components/layout.js';

// ─── Import Page Renderers ───
import { renderHomePage } from './pages/home.js';
import { renderAboutPage } from './pages/about.js';
import { renderMembershipPage } from './pages/membership.js';
import { renderLoginPage, renderSignupPage, renderVerifyEmailPage, renderForgotPasswordPage, renderResetPasswordPage, renderAuthCallbackPage } from './pages/auth.js';
import { renderTablesPage } from './pages/tables.js';
import { renderBookingPage } from './pages/booking.js';
import { renderPaymentPage } from './pages/payment.js';
import { renderConfirmedPage } from './pages/confirmed.js';
import { renderHistoryPage } from './pages/history.js';
import { renderAdminOverview } from './pages/admin/overview.js';
import { renderAdminBookings } from './pages/admin/bookings.js';
import { renderAdminTables } from './pages/admin/tables-mgmt.js';
import { renderAdminPricing } from './pages/admin/pricing.js';
import { renderAdminUsers } from './pages/admin/users.js';
import { renderAdminPayments } from './pages/admin/payments.js';
import { renderAdminMemberships } from './pages/admin/memberships.js';
import { renderAccountPage } from './pages/account.js';
import { renderSetup2FAPage } from './pages/setup-2fa.js';

window.addEventListener('unhandledrejection', (event) => {
  const msg = event.reason?.message || ''
  // Ignore wallet extension errors
  if (msg.includes('WebAssembly') || 
      msg.includes('secp256k1') ||
      msg.includes('CompileError') ||
      msg.includes('injector') ||
      msg.includes('lockdown')) {
    event.preventDefault()
    return
  }
  console.error('Unhandled promise rejection:', event.reason)
})

window.addEventListener('error', (event) => {
  const msg = event.message || ''
  if (msg.includes('WebAssembly') ||
      msg.includes('secp256k1') ||
      msg.includes('injector')) {
    event.preventDefault()
    return
  }
  console.error('Global error:', event.error)
})

async function getSessionSafe() {
  return new Promise(async (resolve) => {
    const timeout = setTimeout(() => {
      console.warn('Session check timed out')
      resolve(null)
    }, 5000)
    
    try {
      const { data: { session } } = await supabase.auth.getSession()
      clearTimeout(timeout)
      resolve(session)
    } catch (err) {
      clearTimeout(timeout)
      console.warn('Session error:', err.message)
      resolve(null)
    }
  })
}

try {
  initTheme()
  
  // Handle OAuth / email-link redirect — if Supabase returns with access_token in the hash,
  // delegate to the auth callback page which handles admin vs user routing.
  if (window.location.hash.includes('access_token') || window.location.hash.includes('type=recovery')) {
    // Replace the current hash with the auth callback route so the router renders it.
    // The renderAuthCallbackPage function will read the session and redirect appropriately.
    window.location.hash = '#/auth/callback';
  }
  // Routes registered below — router.start() called after all registrations
} catch (err) {
  console.error('App init error:', err)
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#0a1f0a;display:flex;align-items:center;justify-content:center;text-align:center;padding:2rem;">
      <div>
        <p style="color:#c9a84c;font-size:1.5rem;margin-bottom:1rem;">XVI — Loading Error</p>
        <p style="color:#9fc99f;font-size:0.9rem;margin-bottom:1.5rem;">${err.message}</p>
        <button onclick="window.location.reload()" style="background:#1a5c1a;color:white;border:none;padding:0.75rem 2rem;border-radius:8px;cursor:pointer;font-size:0.9rem;">Reload App</button>
      </div>
    </div>
  `
}

supabase.auth.onAuthStateChange(async (event, session) => {
  // Clear session cache on any auth change
  clearSessionCache()

  if (event === 'SIGNED_IN' && session) {
    // Check if 2FA is required
    const { checkMFARequired, show2FAModal } = await import('./lib/mfa.js')
    const mfaRequired = await checkMFARequired()
    
    if (mfaRequired) {
      // Show 2FA modal before allowing access
      show2FAModal(
        () => {
          // Success — proceed to appropriate page
          const hash = window.location.hash
          if (hash.includes('access_token')) {
            window.location.href = '/#/'
          } else {
            router.resolve()
          }
        },
        () => {
          // Cancelled — go to login
          router.navigate('/login')
        }
      )
      return
    }
    
    await updateNavbar()

    // Show membership popup 3s after login for non-admin users
    const ADMIN_EMAILS_CHECK = [
      'xviigames101@gmail.com',
      'riveramoses555@gmail.com',
      import.meta.env.VITE_ADMIN_EMAIL,
      import.meta.env.VITE_ADMIN_EMAIL_2
    ].filter(Boolean)
    const isAdminUser = ADMIN_EMAILS_CHECK.includes(session.user.email)
    if (!isAdminUser) {
      setTimeout(async () => {
        const { showMembershipPopup } = await import('./components/membership-popup.js')
        await showMembershipPopup(session.user)
      }, 3000)
    }
  }
  
  if (event === 'SIGNED_OUT') {
    await updateNavbar()
    
    // Protection fallback: if logging out on a user-protected route, go to login
    // NOTE: /admin is excluded — it uses its own sessionStorage password guard
    const hash = window.location.hash.slice(1) || '/';
    if (['/history', '/payment', '/my-bookings', '/setup-2fa'].some(p => hash.startsWith(p))) {
      router.navigate('/login');
    }
  }
  
  if (event === 'TOKEN_REFRESHED') {
    await updateNavbar()
  }
})

// Update navbar on every page load
document.addEventListener('DOMContentLoaded', async () => {
  await updateNavbar()
})

// Theme is initialized at the top now

// ─── Register Routes ───

// Public routes
router.on('/', renderHomePage);
router.on('/about', renderAboutPage);
router.on('/membership', renderMembershipPage);
router.on('/login', renderLoginPage);
router.on('/signup', renderSignupPage);
router.on('/verify-email', renderVerifyEmailPage);
router.on('/forgot-password', renderForgotPasswordPage);
router.on('/reset-password', renderResetPasswordPage);
router.on('/auth/callback', renderAuthCallbackPage);
router.on('/tables', renderTablesPage);

// Auth-required routes
router.on('/booking', renderBookingPage, { auth: true });
router.on('/booking/:tableId', renderBookingPage, { auth: true });
router.on('/payment', renderPaymentPage, { auth: true });
router.on('/confirmed', renderConfirmedPage, { auth: true });
router.on('/history', renderHistoryPage, { auth: true });
router.on('/my-bookings', renderHistoryPage, { auth: true });
router.on('/account', renderAccountPage, { auth: true });
// Setup 2FA requires 'setup2FA' component, let's map it for now
router.on('/setup-2fa', renderSetup2FAPage, { auth: true });

// Admin routes
router.on('/admin', renderAdminOverview); // Custom password protected
router.on('/admin/bookings', renderAdminBookings);
router.on('/admin/tables', renderAdminTables);
router.on('/admin/pricing', renderAdminPricing);
router.on('/admin/users', renderAdminUsers);
router.on('/admin/payments', renderAdminPayments);
router.on('/admin/memberships', renderAdminMemberships);

// ─── Demo Mode Detection ───
const isDemoMode = () => {
  const url = import.meta.env.VITE_SUPABASE_URL;
  return !url || url === 'https://your-project.supabase.co';
};

// ─── Auth Guard ───
router.before(async (route) => {
  // In demo mode, skip all auth checks so admin and all pages are accessible
  if (isDemoMode()) return true;

  if (route.admin) {
    const session = await getSessionSafe()
    
    const adminEmails = [
      import.meta.env.VITE_ADMIN_EMAIL,
      import.meta.env.VITE_ADMIN_EMAIL_2,
      'xviigames101@gmail.com',
      'riveramoses555@gmail.com'  
    ].filter(Boolean)
    
    const isSupabaseAdmin = session?.user && 
      adminEmails.includes(session.user.email)
    const isSessionAdmin = 
      sessionStorage.getItem('adminAuth') === 'true'
    
    if (!isSupabaseAdmin && !isSessionAdmin) {
      router.navigate('/admin') // go to admin login
      return false
    }
  } else if (route.auth) {
    const session = await getSession();
    if (!session) {
      router.navigate('/login');
      return false;
    }
  }
  return true;
});

// ─── Native Auth Flow Protection ───
// Session handling is managed at the top-level now.

// ─── Global Click Handler (for logout, dropdown + theme toggle) ───
document.addEventListener('click', async (e) => {
  const logoutBtn = e.target.closest('#header-logout-btn')
  const userMenuBtn = e.target.closest('#user-menu-btn')
  const userDropdown = document.getElementById('user-dropdown')

  // Toggle dropdown
  if (userMenuBtn && userDropdown) {
    const isHidden = userDropdown.style.display === 'none' || userDropdown.style.display === ''
    userDropdown.style.display = isHidden ? 'block' : 'none'
    return
  }

  // Close dropdown when clicking outside
  if (userDropdown && !e.target.closest('#user-menu-container')) {
    userDropdown.style.display = 'none'
  }

  // Handle logout
  if (logoutBtn) {
    e.preventDefault()
    e.stopPropagation()
    
    try {
      // Close dropdown first
      if (userDropdown) userDropdown.style.display = 'none'
      
      // Sign out from Supabase
      const { supabase } = await import('./lib/supabase.js')
      await supabase.auth.signOut()
      
      // Clear any local session storage
      sessionStorage.clear()
      localStorage.removeItem('supabase.auth.token')
      
      // Force navigate to home
      window.location.href = '/#/'
      
    } catch (err) {
      console.error('Logout error:', err)
      // Force redirect even if signOut fails
      window.location.href = '/#/'
    }
  }
});

// ─── Setup theme toggle and navbar after each render ───
router.afterEach(async () => {
  setTimeout(async () => {
    setupThemeToggle()
    await updateNavbar()
  }, 50)
})

// ─── Catch-All Route ───
// Catch unknown routes (like bad hashes from OAuth) and send them home instead of "Page not found"
router.notFound(() => {
  router.navigate('/');
});

// ─── Start Router (after all routes registered) ───
try {
  router.start()
} catch (err) {
  console.error('Router start error:', err)
  document.body.innerHTML = `
    <div style="min-height:100vh;background:#0a1f0a;display:flex;align-items:center;justify-content:center;text-align:center;padding:2rem;">
      <div>
        <p style="color:#c9a84c;font-size:1.5rem;margin-bottom:1rem;">XVI — Loading Error</p>
        <p style="color:#9fc99f;font-size:0.9rem;margin-bottom:1.5rem;">${err.message}</p>
        <button onclick="window.location.reload()" style="background:#1a5c1a;color:white;border:none;padding:0.75rem 2rem;border-radius:8px;cursor:pointer;font-size:0.9rem;">Reload App</button>
      </div>
    </div>
  `
}

console.log(`
🎱 101 GAMES — Snooker Table Reservation System
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Routes:
  #/           → Home
  #/tables     → Tables Overview
  #/about      → About Us
  #/membership → Membership Info
  #/login      → Login
  #/signup     → Sign Up
  #/account    → Account Settings
  #/my-bookings→ User History
  #/setup-2fa  → 2FA Setup
  #/booking/:id→ Book a Table
  #/admin      → Admin Dashboard
  #/admin/bookings   → Manage Bookings
  #/admin/users      → Manage Users
  #/admin/tables     → Manage Tables
  #/admin/pricing    → Manage Pricing
  #/admin/payments   → Manage Payments
  #/admin/memberships→ Manage Memberships
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
`);
