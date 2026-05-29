import { renderHeader, renderFooter } from '../components/layout.js';
import { getSession } from '../lib/auth.js';

// Fetch membership prices from app_settings (falls back to defaults)
async function getMembershipSettings() {
  try {
    const { supabase } = await import('/src/lib/supabase.js')
    const { data } = await supabase.from('app_settings').select('key, value')
    if (!data) throw new Error('no data')
    const s = Object.fromEntries(data.map(r => [r.key, r.value]))
    return {
      monthly:    parseInt(s.membership_monthly_price    || '5000'),
      annual:     parseInt(s.membership_annual_price     || '50000'),
      discount:   parseInt(s.membership_discount_percent || '15'),
      freeGames:  parseInt(s.membership_free_games       || '1'),
      annualBadge: s.membership_annual_badge || 'BEST VALUE — SAVE ₦10,000'
    }
  } catch {
    return { monthly: 5000, annual: 50000, discount: 15, freeGames: 1, annualBadge: 'BEST VALUE — SAVE ₦10,000' }
  }
}

// Show congratulations popup
function showMembershipSuccessPopup(plan, reference, discountPercent = 15, freeGames = 1) {
  // Remove any existing popup
  const existing = document.getElementById('success-popup')
  if (existing) existing.remove()

  const popup = document.createElement('div')
  popup.id = 'success-popup'
  popup.style.cssText = `
    position:fixed;top:0;left:0;
    width:100%;height:100%;
    background:rgba(0,0,0,0.85);
    z-index:99999;
    display:flex;align-items:center;
    justify-content:center;
    animation:fadeIn 0.4s ease;
  `
  popup.innerHTML = `
    <style>
      @keyframes fadeIn {
        from{opacity:0} to{opacity:1}
      }
      @keyframes popIn {
        0%{transform:scale(0.7);opacity:0}
        70%{transform:scale(1.05)}
        100%{transform:scale(1);opacity:1}
      }
      @keyframes float {
        0%,100%{transform:translateY(0)}
        50%{transform:translateY(-10px)}
      }
      @keyframes shimmer {
        0%{background-position:200% center}
        100%{background-position:-200% center}
      }
    </style>

    <div style="background:linear-gradient(135deg,#0a1f0a,#0d2b0d);
      border-radius:20px;width:90%;max-width:460px;
      padding:2.5rem 2rem;text-align:center;
      border:1px solid #c9a84c;
      box-shadow:0 0 80px rgba(201,168,76,0.3),
                 0 0 30px rgba(0,0,0,0.5);
      animation:popIn 0.5s cubic-bezier(0.34,1.56,0.64,1);">

      <!-- Crown emoji floating -->
      <div style="font-size:4rem;margin-bottom:0.5rem;
        animation:float 2s ease-in-out infinite;">
        👑
      </div>

      <!-- Congratulations heading -->
      <h1 style="
        background:linear-gradient(135deg,#c9a84c,#f0d080,#c9a84c);
        background-size:200% auto;
        -webkit-background-clip:text;
        -webkit-text-fill-color:transparent;
        background-clip:text;
        animation:shimmer 3s linear infinite;
        font-size:1.75rem;font-weight:800;
        margin:0 0 0.5rem;letter-spacing:1px;">
        Congratulations!
      </h1>

      <h2 style="color:white;font-size:1.1rem;
        font-weight:600;margin:0 0 0.5rem;">
        You are now an XVI Member 🎱
      </h2>

      <p style="color:#9fc99f;font-size:0.875rem;
        margin:0 0 1.75rem;line-height:1.5;">
        Your ${plan === 'annual' ? 'Annual' : 'Monthly'} 
        membership is active. Your ${discountPercent}% discount 
        will be applied automatically on every booking.
      </p>

      <!-- Benefits recap -->
      <div style="background:rgba(201,168,76,0.08);
        border:1px solid rgba(201,168,76,0.2);
        border-radius:12px;padding:1rem 1.25rem;
        margin-bottom:1.75rem;text-align:left;">

        <div style="display:flex;flex-direction:column;
          gap:0.5rem;">
          <div style="display:flex;align-items:center;
            gap:0.6rem;">
            <span style="color:#4caf50;font-weight:700;">✓</span>
              <span style="color:white;font-size:0.85rem;">
                ${discountPercent}% discount on every reservation
              </span>
          </div>
          <div style="display:flex;align-items:center;
            gap:0.6rem;">
            <span style="color:#4caf50;font-weight:700;">✓</span>
            <span style="color:white;font-size:0.85rem;">
              Priority table booking access
            </span>
          </div>
          <div style="display:flex;align-items:center;
            gap:0.6rem;">
            <span style="color:#4caf50;font-weight:700;">✓</span>
              <span style="color:white;font-size:0.85rem;">
                ${plan === 'annual' ? freeGames + 1 : freeGames} free game(s) 
                per month unlocked
              </span>
          </div>
          <div style="display:flex;align-items:center;
            gap:0.6rem;">
            <span style="color:#c9a84c;font-weight:700;">
              👑
            </span>
            <span style="color:white;font-size:0.85rem;">
              Member badge added to your account
            </span>
          </div>
        </div>
      </div>

      <!-- Ref number -->
      <p style="color:rgba(255,255,255,0.3);
        font-size:0.7rem;margin:0 0 1.5rem;">
        Ref: ${reference}
      </p>

      <!-- CTA Button -->
      <button id="goto-tables-btn" style="
        width:100%;padding:1rem;
        background:linear-gradient(135deg,#c9a84c,#d4a030);
        color:#0a1f0a;border:none;border-radius:10px;
        font-size:1rem;font-weight:800;cursor:pointer;
        letter-spacing:0.5px;
        box-shadow:0 4px 20px rgba(201,168,76,0.3);
        transition:transform 0.2s,box-shadow 0.2s;">
        Reserve a Table Now — 15% Off Applied →
      </button>

      <!-- Auto redirect notice -->
      <p id="redirect-countdown" 
        style="color:rgba(255,255,255,0.3);
          font-size:0.75rem;margin:1rem 0 0;">
        Redirecting to tables in 5 seconds...
      </p>
    </div>
  `
  document.body.appendChild(popup)

  // Button click → go to tables immediately
  document.getElementById('goto-tables-btn')
    .addEventListener('click', () => {
      popup.remove()
      window.location.href = '/#/tables'
    })

  // Auto countdown and redirect after 5 seconds
  let seconds = 5
  const countdownEl = document.getElementById(
    'redirect-countdown'
  )
  const interval = setInterval(() => {
    seconds--
    if (countdownEl) {
      countdownEl.textContent = 
        `Redirecting to tables in ${seconds} seconds...`
    }
    if (seconds <= 0) {
      clearInterval(interval)
      popup.remove()
      window.location.href = '/#/tables'
    }
  }, 1000)
}
async function handlePlanPayment(plan, amount, app, btnElement, originalText, prices = { discount: 15, freeGames: 1 }) {
  const publicKey = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY
  if (!publicKey) {
    alert('Payment coming soon! Contact us to subscribe:\n+234 808 794 8773')
    if (btnElement) {
      btnElement.innerHTML = originalText
      btnElement.disabled = false
    }
    return
  }

  // Get current logged in user
  const { supabase } = await import('/src/lib/supabase.js')
  const { data: { session } } = await supabase.auth.getSession()

  // If not logged in redirect to login first
  if (!session?.user) {
    localStorage.setItem('pendingMembership', plan)
    window.location.href = '/#/login'
    return
  }

  const userEmail = session.user.email
  const userName = 
    session.user.user_metadata?.full_name ||
    session.user.user_metadata?.name ||
    session.user.email.split('@')[0]

  // Check if Paystack is loaded
  if (typeof PaystackPop === 'undefined') {
    alert('Payment system loading. Please try again.')
    if (btnElement) {
      btnElement.innerHTML = originalText
      btnElement.disabled = false
    }
    return
  }

  const handler = PaystackPop.setup({
    key: publicKey,
    email: userEmail,
    amount: amount * 100,
    currency: 'NGN',
    ref: 'XVI_MEM_' + plan.toUpperCase() + '_' + Date.now(),
    label: userName,
    metadata: {
      custom_fields: [
        {
          display_name: 'Membership Plan',
          variable_name: 'plan',
          value: plan
        },
        {
          display_name: 'Customer Name',
          variable_name: 'name',
          value: userName
        },
        {
          display_name: 'User ID',
          variable_name: 'user_id',
          value: session.user.id
        }
      ]
    },
    onSuccess: async (transaction) => {
      try {
        // Calculate expiry date
        const now = new Date()
        const expires = new Date(now)
        if (plan === 'annual') {
          expires.setFullYear(expires.getFullYear() + 1)
        } else {
          expires.setMonth(expires.getMonth() + 1)
        }

        // Update profiles table in Supabase
        const { error } = await supabase
          .from('profiles')
          .update({
            is_member: true,
            membership_plan: plan,
            membership_start: now.toISOString(),
            membership_expires: expires.toISOString(),
            membership_ref: transaction.reference
          })
          .eq('id', session.user.id)

        if (error) {
          console.error('Profile update error:', error)
        }

        // Save to localStorage — discount applied immediately to next booking
        localStorage.setItem('xvi_member', 'true')
        localStorage.setItem('xvi_member_plan', plan)
        localStorage.setItem('xvi_member_discount', prices.discount.toString())
        localStorage.setItem('xvi_member_expires', expires.toISOString())
        localStorage.removeItem('membershipDismissed')
        localStorage.removeItem('pendingMembership')

        // Show popup
        showMembershipSuccessPopup(plan, transaction.reference, prices.discount, prices.freeGames)
      } catch (err) {
        console.error('Membership activation error:', err)
        alert(
          'Payment successful! Reference: ' + 
          transaction.reference + 
          '\nYour membership will be activated shortly.'
        )
        window.location.href = '/#/'
      }
    },

    onCancel: () => {
      console.log('Payment cancelled')
      if (btnElement) {
        btnElement.innerHTML = originalText
        btnElement.disabled = false
      }
    }
  })

  handler.openIframe()
}


export async function renderMembershipPage(app) {
  try {
    // Load dynamic prices first
    const prices = await getMembershipSettings()

    // Check if user came back from login with a pending membership selection
    const pendingPlan = localStorage.getItem('pendingMembership');
    if (pendingPlan) {
      const { supabase } = await import('/src/lib/supabase.js');
      const { data: { session: pendingSession } } = await supabase.auth.getSession();
      if (pendingSession?.user) {
        const amount = pendingPlan === 'annual' ? prices.annual : prices.monthly;
        setTimeout(() => {
          handlePlanPayment(pendingPlan, amount, app, null, null, prices);
        }, 800);
      }
    }

    const session = await getSession();
    const isMember = localStorage.getItem('xvi_member') === 'true';
    const memberPlan = localStorage.getItem('xvi_member_plan');

    app.innerHTML = `
      <style>
        @keyframes spin { 100% { transform: rotate(360deg); } }
        @keyframes bounce { 0%, 100% { transform: translateY(0); } 50% { transform: translateY(-10px); } }
      </style>
      ${renderHeader(session, 'membership')}
      <main style="min-height:100vh;background:var(--background,#0a1f0a);">
        
        <!-- Hero -->
        <div style="background:linear-gradient(135deg,#0a1f0a 0%,#0d2b0d 50%,#112b11 100%);
          padding:5rem 1.5rem 4rem;text-align:center;
          border-bottom:1px solid rgba(201,168,76,0.3);
          position:relative;overflow:hidden;">
          
          <!-- Decorative rings -->
          <div style="position:absolute;top:-80px;left:50%;transform:translateX(-50%);
            width:400px;height:400px;border-radius:50%;
            border:1px solid rgba(201,168,76,0.05);pointer-events:none;"></div>
          <div style="position:absolute;top:-40px;left:50%;transform:translateX(-50%);
            width:280px;height:280px;border-radius:50%;
            border:1px solid rgba(201,168,76,0.08);pointer-events:none;"></div>

          ${isMember ? `
            <!-- Already a member banner -->
            <div style="display:inline-flex;align-items:center;gap:0.5rem;
              background:rgba(105,223,94,0.15);
              border:1px solid rgba(105,223,94,0.4);
              padding:0.5rem 1.25rem;border-radius:20px;
              margin-bottom:1.5rem;">
              <span style="color:#69df5e;font-size:0.9rem;font-weight:600;">
                ✓ You're an active XVI Member — ${memberPlan || 'monthly'} plan
              </span>
            </div>
          ` : `
            <div style="display:inline-flex;align-items:center;gap:0.5rem;
              background:rgba(201,168,76,0.15);
              border:1px solid rgba(201,168,76,0.4);
              padding:0.5rem 1.25rem;border-radius:20px;
              margin-bottom:1.5rem;">
              <span style="color:#c9a84c;font-size:0.9rem;font-weight:600;">
                👑 Members save ${prices.discount}% on every booking
              </span>
            </div>
          `}

          <p style="color:#c9a84c;font-size:0.75rem;font-weight:600;
            letter-spacing:3px;text-transform:uppercase;
            margin:0 0 1rem;position:relative;z-index:1;">XVI Exclusive</p>
          <h1 style="color:white;font-size:clamp(2rem,5vw,3rem);font-weight:700;
            margin:0 0 1rem;letter-spacing:1px;line-height:1.2;position:relative;z-index:1;">
            ${isMember ? 'Your XVI Membership' : 'Join XVI Membership'}
          </h1>
          <p style="color:#9fc99f;font-size:1rem;max-width:520px;
            margin:0 auto;line-height:1.7;position:relative;z-index:1;">
            Become part of the inner circle. Get exclusive discounts, 
            priority access, and member-only privileges every time 
            you visit XVI Snooker Club.
          </p>
        </div>

        <div style="max-width:960px;margin:0 auto;padding:3rem 1.5rem 4rem;">
          
          <!-- Benefits Grid -->
          <div style="margin-bottom:4rem;">
            <p style="color:#c9a84c;font-size:0.75rem;font-weight:600;
              letter-spacing:3px;text-transform:uppercase;
              text-align:center;margin:0 0 2rem;">What You Get</p>
            
            <div style="display:grid;grid-template-columns:
              repeat(auto-fit,minmax(200px,1fr));gap:1.25rem;">
              
              <div class="benefit-card" style="background:#0d2b0d;
                border:1px solid rgba(201,168,76,0.2);border-radius:12px;
                padding:1.75rem;text-align:center;
                transition:border-color 0.3s,transform 0.2s;"
                onmouseover="this.style.borderColor='rgba(201,168,76,0.5)';this.style.transform='translateY(-4px)'"
                onmouseout="this.style.borderColor='rgba(201,168,76,0.2)';this.style.transform='translateY(0)'">
                <div style="font-size:2.25rem;margin-bottom:0.75rem;">💰</div>
                <h3 style="color:white;font-size:1rem;font-weight:600;
                  margin:0 0 0.5rem;">${prices.discount}% Discount</h3>
                <p style="color:#9fc99f;font-size:0.85rem;margin:0;line-height:1.5;">
                  On every table reservation — time or games based
                </p>
              </div>

              <div class="benefit-card" style="background:#0d2b0d;
                border:1px solid rgba(201,168,76,0.2);border-radius:12px;
                padding:1.75rem;text-align:center;
                transition:border-color 0.3s,transform 0.2s;"
                onmouseover="this.style.borderColor='rgba(201,168,76,0.5)';this.style.transform='translateY(-4px)'"
                onmouseout="this.style.borderColor='rgba(201,168,76,0.2)';this.style.transform='translateY(0)'">
                <div style="font-size:2.25rem;margin-bottom:0.75rem;">⚡</div>
                <h3 style="color:white;font-size:1rem;font-weight:600;
                  margin:0 0 0.5rem;">Priority Booking</h3>
                <p style="color:#9fc99f;font-size:0.85rem;margin:0;line-height:1.5;">
                  Reserve tables before they open to the public
                </p>
              </div>

              <div class="benefit-card" style="background:#0d2b0d;
                border:1px solid rgba(201,168,76,0.2);border-radius:12px;
                padding:1.75rem;text-align:center;
                transition:border-color 0.3s,transform 0.2s;"
                onmouseover="this.style.borderColor='rgba(201,168,76,0.5)';this.style.transform='translateY(-4px)'"
                onmouseout="this.style.borderColor='rgba(201,168,76,0.2)';this.style.transform='translateY(0)'">
                <div style="font-size:2.25rem;margin-bottom:0.75rem;">🎱</div>
                <h3 style="color:white;font-size:1rem;font-weight:600;
                  margin:0 0 0.5rem;">${prices.freeGames} Free Game/Month</h3>
                <p style="color:#9fc99f;font-size:0.85rem;margin:0;line-height:1.5;">
                  Complimentary game on any standard table monthly
                </p>
              </div>

              <div class="benefit-card" style="background:#0d2b0d;
                border:1px solid rgba(201,168,76,0.2);border-radius:12px;
                padding:1.75rem;text-align:center;
                transition:border-color 0.3s,transform 0.2s;"
                onmouseover="this.style.borderColor='rgba(201,168,76,0.5)';this.style.transform='translateY(-4px)'"
                onmouseout="this.style.borderColor='rgba(201,168,76,0.2)';this.style.transform='translateY(0)'">
                <div style="font-size:2.25rem;margin-bottom:0.75rem;">🏆</div>
                <h3 style="color:white;font-size:1rem;font-weight:600;
                  margin:0 0 0.5rem;">Member Events</h3>
                <p style="color:#9fc99f;font-size:0.85rem;margin:0;line-height:1.5;">
                  Exclusive tournaments, competitions & social nights
                </p>
              </div>
            </div>
          </div>

          ${isMember ? `
            <!-- Active Member View -->
            <div style="background:linear-gradient(135deg,#0d2b0d,#132e13);
              border:2px solid rgba(105,223,94,0.4);border-radius:16px;
              padding:2.5rem;text-align:center;margin-bottom:2rem;">
              <div style="font-size:3rem;margin-bottom:1rem;">✅</div>
              <h2 style="color:#69df5e;font-size:1.5rem;font-weight:700;
                margin:0 0 0.5rem;">You're already a member!</h2>
              <p style="color:#9fc99f;font-size:0.95rem;margin:0 0 1.5rem;line-height:1.6;">
                Your ${prices.discount}% discount is automatically applied to all your bookings.
                Enjoy priority access and all member benefits.
              </p>
              <a href="/#/booking" style="display:inline-block;
                padding:0.875rem 2rem;background:#c9a84c;color:#0a1f0a;
                border-radius:8px;font-size:1rem;font-weight:700;
                text-decoration:none;">
                Book a Table Now
              </a>
            </div>
          ` : `
            <!-- Pricing Plans -->
            <div style="margin-bottom:3rem;">
              <p style="color:#c9a84c;font-size:0.75rem;font-weight:600;
                letter-spacing:3px;text-transform:uppercase;
                text-align:center;margin:0 0 2rem;">Choose Your Plan</p>
              
              <div style="display:grid;
                grid-template-columns:repeat(auto-fit,minmax(240px,1fr));
                gap:1.5rem;max-width:600px;margin:0 auto;">

                <!-- Monthly -->
                <div style="background:#0d2b0d;border:1px solid 
                  rgba(201,168,76,0.3);border-radius:16px;
                  padding:2rem;text-align:center;
                  transition:border-color 0.3s;">
                  <p style="color:#9fc99f;font-size:0.8rem;
                    text-transform:uppercase;letter-spacing:1px;
                    margin:0 0 1rem;font-weight:600;">Monthly</p>
                  <p style="color:#c9a84c;font-size:2.75rem;
                    font-weight:700;margin:0;line-height:1;">
                    ₦${prices.monthly.toLocaleString()}
                  </p>
                  <p style="color:#9fc99f;font-size:0.8rem;
                    margin:0.25rem 0 1.5rem;">per month</p>
                  <ul style="list-style:none;padding:0;margin:0 0 1.5rem;
                    text-align:left;">
                    <li style="color:#9fc99f;font-size:0.85rem;
                      padding:0.35rem 0;display:flex;align-items:center;gap:0.5rem;">
                      <span style="color:#69df5e;">✓</span> ${prices.discount}% off all bookings
                    </li>
                    <li style="color:#9fc99f;font-size:0.85rem;
                      padding:0.35rem 0;display:flex;align-items:center;gap:0.5rem;">
                      <span style="color:#69df5e;">✓</span> Priority booking access
                    </li>
                    <li style="color:#9fc99f;font-size:0.85rem;
                      padding:0.35rem 0;display:flex;align-items:center;gap:0.5rem;">
                      <span style="color:#69df5e;">✓</span> ${prices.freeGames} free game(s) per month
                    </li>
                    <li style="color:#9fc99f;font-size:0.85rem;
                      padding:0.35rem 0;display:flex;align-items:center;gap:0.5rem;">
                      <span style="color:#69df5e;">✓</span> Cancel anytime
                    </li>
                  </ul>
                  <button class="plan-btn" data-plan="monthly" data-amount="5000"
                    id="plan-monthly"
                    style="width:100%;padding:0.875rem;
                      background:transparent;color:#c9a84c;
                      border:2px solid #c9a84c;border-radius:8px;
                      font-size:0.95rem;font-weight:700;cursor:pointer;
                      transition:all 0.2s;"
                    onmouseover="this.style.background='#c9a84c';this.style.color='#0a1f0a'"
                    onmouseout="this.style.background='transparent';this.style.color='#c9a84c'">
                    Choose Monthly
                  </button>
                </div>

                <!-- Annual -->
                <div style="background:#0d2b0d;border:2px solid #c9a84c;
                  border-radius:16px;padding:2rem;text-align:center;
                  position:relative;">
                  <div style="position:absolute;top:-14px;left:50%;
                    transform:translateX(-50%);
                    background:#c9a84c;color:#0a1f0a;
                    padding:0.3rem 1rem;border-radius:20px;
                    font-size:0.7rem;font-weight:800;
                    white-space:nowrap;letter-spacing:0.5px;">
                    ${prices.annualBadge}
                  </div>
                  <p style="color:#c9a84c;font-size:0.8rem;
                    text-transform:uppercase;letter-spacing:1px;
                    margin:0 0 1rem;font-weight:600;">Annual</p>
                  <p style="color:#c9a84c;font-size:2.75rem;
                    font-weight:700;margin:0;line-height:1;">
                    ₦${prices.annual.toLocaleString()}
                  </p>
                  <p style="color:#9fc99f;font-size:0.8rem;
                    margin:0.25rem 0 1.5rem;">per year (₦4,167/mo)</p>
                  <ul style="list-style:none;padding:0;margin:0 0 1.5rem;
                    text-align:left;">
                    <li style="color:#9fc99f;font-size:0.85rem;
                      padding:0.35rem 0;display:flex;align-items:center;gap:0.5rem;">
                      <span style="color:#69df5e;">✓</span> Everything in Monthly
                    </li>
                    <li style="color:#9fc99f;font-size:0.85rem;
                      padding:0.35rem 0;display:flex;align-items:center;gap:0.5rem;">
                      <span style="color:#69df5e;">✓</span> Save ₦10,000 vs monthly
                    </li>
                    <li style="color:#9fc99f;font-size:0.85rem;
                      padding:0.35rem 0;display:flex;align-items:center;gap:0.5rem;">
                      <span style="color:#69df5e;">✓</span> 2 free games per month
                    </li>
                    <li style="color:#9fc99f;font-size:0.85rem;
                      padding:0.35rem 0;display:flex;align-items:center;gap:0.5rem;">
                      <span style="color:#c9a84c;">👑</span> VIP event invitations
                    </li>
                  </ul>
                  <button class="plan-btn" data-plan="annual" data-amount="50000"
                    id="plan-annual"
                    style="width:100%;padding:0.875rem;
                      background:#c9a84c;color:#0a1f0a;
                      border:2px solid #c9a84c;border-radius:8px;
                      font-size:0.95rem;font-weight:700;cursor:pointer;
                      transition:opacity 0.2s;"
                    onmouseover="this.style.opacity='0.85'"
                    onmouseout="this.style.opacity='1'">
                    Choose Annual — Best Value
                  </button>
                </div>
              </div>
            </div>

            <!-- Pay full price option -->
            <div style="background:rgba(255,255,255,0.03);
              border:1px solid rgba(255,255,255,0.08);
              border-radius:12px;padding:2rem;text-align:center;
              margin-bottom:2rem;">
              <p style="color:#9fc99f;font-size:0.95rem;margin:0 0 0.5rem;">
                Not ready to commit?
              </p>
              <p style="color:#666;font-size:0.85rem;margin:0 0 1rem;line-height:1.6;">
                You can still book tables at full price anytime. 
                This page is always available if you change your mind.
              </p>
              <a href="/#/booking" style="color:#9fc99f;
                font-size:0.9rem;text-decoration:underline;cursor:pointer;">
                Continue without membership — pay full price →
              </a>
            </div>
          `}

          <!-- FAQ Section -->
          <div style="border-top:1px solid rgba(201,168,76,0.15);padding-top:2.5rem;">
            <p style="color:#c9a84c;font-size:0.75rem;font-weight:600;
              letter-spacing:3px;text-transform:uppercase;
              margin:0 0 1.5rem;">Common Questions</p>
            
            <div style="display:flex;flex-direction:column;gap:1rem;">
              <div style="background:#0d2b0d;border-radius:10px;padding:1.25rem;">
                <p style="color:white;font-weight:600;font-size:0.9rem;margin:0 0 0.4rem;">
                  When does the discount apply?
                </p>
                <p style="color:#9fc99f;font-size:0.85rem;margin:0;line-height:1.5;">
                  Automatically on every booking — the 15% is deducted from your total before you confirm.
                </p>
              </div>
              <div style="background:#0d2b0d;border-radius:10px;padding:1.25rem;">
                <p style="color:white;font-weight:600;font-size:0.9rem;margin:0 0 0.4rem;">
                  Can I cancel my membership?
                </p>
                <p style="color:#9fc99f;font-size:0.85rem;margin:0;line-height:1.5;">
                  Monthly members can cancel anytime. Annual members receive a prorated refund within the first 30 days.
                </p>
              </div>
              <div style="background:#0d2b0d;border-radius:10px;padding:1.25rem;">
                <p style="color:white;font-weight:600;font-size:0.9rem;margin:0 0 0.4rem;">
                  How do I claim my free monthly game?
                </p>
                <p style="color:#9fc99f;font-size:0.85rem;margin:0;line-height:1.5;">
                  Show your membership at the reception desk. Our staff will verify and apply it to your booking.
                </p>
              </div>
            </div>
          </div>

        </div>
      </main>
      ${renderFooter()}
    `

    // Find the monthly button and attach handler
    const monthlyBtn = document.querySelector('.plan-btn[data-plan="monthly"]')
    if (monthlyBtn) {
      monthlyBtn.addEventListener('click', () => {
        const originalText = monthlyBtn.innerHTML
        monthlyBtn.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin 0.75s linear infinite;margin-right:8px;vertical-align:middle;"></span> Opening payment...'
        monthlyBtn.disabled = true
        handlePlanPayment('monthly', prices.monthly, app, monthlyBtn, originalText, prices)
      })
    }

    // Find the annual button and attach handler
    const annualBtn = document.querySelector('.plan-btn[data-plan="annual"]')
    if (annualBtn) {
      annualBtn.addEventListener('click', () => {
        const originalText = annualBtn.innerHTML
        annualBtn.innerHTML = '<span style="display:inline-block;width:12px;height:12px;border:2px solid currentColor;border-right-color:transparent;border-radius:50%;animation:spin 0.75s linear infinite;margin-right:8px;vertical-align:middle;"></span> Opening payment...'
        annualBtn.disabled = true
        handlePlanPayment('annual', prices.annual, app, annualBtn, originalText, prices)
      })
    }
  } catch (err) {
    console.error('Membership page error:', err)
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
    `
  }
}


