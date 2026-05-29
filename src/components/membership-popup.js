// ═══════════════════════════════════════
// MEMBERSHIP POPUP — shows 3s after login
// ═══════════════════════════════════════

const ADMIN_EMAILS = [
  'xviigames101@gmail.com',
  'riveramoses555@gmail.com',
  import.meta.env.VITE_ADMIN_EMAIL,
  import.meta.env.VITE_ADMIN_EMAIL_2
].filter(Boolean)

async function fetchPopupPrices() {
  try {
    const { supabase } = await import('/src/lib/supabase.js')
    const { data } = await supabase.from('app_settings').select('key, value')
    if (!data) throw new Error('no data')
    const s = Object.fromEntries(data.map(r => [r.key, r.value]))
    return {
      monthly:  parseInt(s.membership_monthly_price    || '5000'),
      annual:   parseInt(s.membership_annual_price     || '50000'),
      discount: parseInt(s.membership_discount_percent || '15')
    }
  } catch {
    return { monthly: 5000, annual: 50000, discount: 15 }
  }
}

export async function showMembershipPopup(user) {
  // Don't show for admins
  if (user?.email && ADMIN_EMAILS.includes(user.email)) return

  // Check if already shown recently (7-day cooldown)
  const dismissed = localStorage.getItem('membershipDismissed')
  if (dismissed) {
    const dismissedTime = parseInt(dismissed)
    const sevenDays = 7 * 24 * 60 * 60 * 1000
    if (Date.now() - dismissedTime < sevenDays) return
  }

  // Don't show if already a member
  const isActiveMember = localStorage.getItem('xvi_member') === 'true'
  if (isActiveMember) return

  // Load live prices
  const prices = await fetchPopupPrices()
  const annualSaving = (prices.monthly * 12) - prices.annual

  const popup = document.createElement('div')
  popup.id = 'membership-popup'
  popup.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,0.8);z-index:9000;
    display:flex;align-items:center;justify-content:center;
    animation:memberFadeIn 0.4s ease;
  `
  popup.innerHTML = `
    <style>
      @keyframes memberFadeIn { from{opacity:0} to{opacity:1} }
      @keyframes memberSlideUp {
        from{transform:translateY(30px);opacity:0}
        to{transform:translateY(0);opacity:1}
      }
    </style>
    <div style="background:#0a1f0a;border-radius:16px;
      width:90%;max-width:480px;overflow:hidden;
      border:1px solid #c9a84c;
      box-shadow:0 0 60px rgba(201,168,76,0.2);
      animation:memberSlideUp 0.4s ease;">

      <!-- Header -->
      <div style="background:linear-gradient(135deg,#0d2b0d,#1a3a0a);
        padding:1.5rem 1.5rem 1rem;
        border-bottom:1px solid rgba(201,168,76,0.3);
        position:relative;">

        <button id="popup-close-btn" style="position:absolute;
          top:1rem;right:1rem;background:transparent;
          border:none;color:#999;font-size:1.25rem;
          cursor:pointer;line-height:1;padding:0.25rem;
          border-radius:4px;" title="Not now">✕</button>

        <div style="text-align:center;">
          <div style="font-size:2.5rem;margin-bottom:0.5rem;">👑</div>
          <h2 style="color:#c9a84c;font-size:1.4rem;
            font-weight:700;margin:0 0 0.25rem;
            letter-spacing:1px;">XVI MEMBERSHIP</h2>
          <p style="color:#9fc99f;font-size:0.85rem;margin:0;">
            Elevate your game. Join the inner circle.
          </p>
        </div>
      </div>

      <!-- Body -->
      <div style="padding:1.5rem;">

        <!-- Benefits -->
        <div style="margin-bottom:1.5rem;">
          <p style="color:#c9a84c;font-size:0.75rem;
            font-weight:600;letter-spacing:2px;
            text-transform:uppercase;margin:0 0 1rem;">
            Member Benefits
          </p>
          <div style="display:flex;flex-direction:column;gap:0.75rem;">
            <div style="display:flex;align-items:center;gap:0.75rem;">
              <span style="color:#c9a84c;font-size:1.1rem;">💰</span>
              <div>
                <span style="color:white;font-size:0.9rem;font-weight:600;">${prices.discount}% discount</span>
                <span style="color:#9fc99f;font-size:0.85rem;">&nbsp;on every reservation</span>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:0.75rem;">
              <span style="color:#c9a84c;font-size:1.1rem;">⚡</span>
              <div>
                <span style="color:white;font-size:0.9rem;font-weight:600;">Priority booking</span>
                <span style="color:#9fc99f;font-size:0.85rem;">&nbsp;— reserve before non-members</span>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:0.75rem;">
              <span style="color:#c9a84c;font-size:1.1rem;">🎱</span>
              <div>
                <span style="color:white;font-size:0.9rem;font-weight:600;">1 free game/month</span>
                <span style="color:#9fc99f;font-size:0.85rem;">&nbsp;on any standard table</span>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:0.75rem;">
              <span style="color:#c9a84c;font-size:1.1rem;">🏆</span>
              <div>
                <span style="color:white;font-size:0.9rem;font-weight:600;">Exclusive member events</span>
                <span style="color:#9fc99f;font-size:0.85rem;">&nbsp;tournaments and competitions</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Pricing -->
        <div style="background:rgba(201,168,76,0.1);
          border:1px solid rgba(201,168,76,0.3);
          border-radius:10px;padding:1rem;
          margin-bottom:1.5rem;text-align:center;">
          <p style="color:#9fc99f;font-size:0.8rem;margin:0 0 0.25rem;">
            Membership starts from
          </p>
          <p style="color:#c9a84c;font-size:2rem;font-weight:700;
            margin:0;font-family:serif;">
            ₦${prices.monthly.toLocaleString()}
            <span style="font-size:0.9rem;font-weight:400;color:#9fc99f;">/month</span>
          </p>
          <p style="color:#9fc99f;font-size:0.75rem;margin:0.25rem 0 0;">
            or ₦${prices.annual.toLocaleString()}/year
            ${annualSaving > 0 ? `(save ₦${annualSaving.toLocaleString()})` : ''}
          </p>
        </div>

        <!-- Buttons -->
        <button id="popup-join-btn" style="width:100%;
          padding:1rem;background:#c9a84c;color:#0a1f0a;
          border:none;border-radius:8px;font-size:1rem;
          font-weight:700;cursor:pointer;
          margin-bottom:0.75rem;letter-spacing:0.5px;
          transition:opacity 0.2s;">
          Join Now — Get ${prices.discount}% Off Bookings
        </button>

        <button id="popup-skip-btn" style="width:100%;
          padding:0.75rem;background:transparent;
          color:#9fc99f;border:none;
          border-radius:8px;font-size:0.85rem;
          cursor:pointer;text-decoration:underline;">
          Not now — pay full price
        </button>
      </div>
    </div>
  `
  document.body.appendChild(popup)

  function dismiss() {
    localStorage.setItem('membershipDismissed', Date.now())
    popup.style.opacity = '0'
    popup.style.transition = 'opacity 0.3s'
    setTimeout(() => popup.remove(), 300)
  }

  document.getElementById('popup-close-btn')?.addEventListener('click', dismiss)
  document.getElementById('popup-skip-btn')?.addEventListener('click', dismiss)

  // Close on backdrop click
  popup.addEventListener('click', (e) => {
    if (e.target === popup) dismiss()
  })

  document.getElementById('popup-join-btn')?.addEventListener('click', () => {
    popup.remove()
    window.location.href = '/#/membership'
  })
}
