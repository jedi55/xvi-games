import { getPricing, updatePricing } from '../../lib/api.js';
import { getSession } from '../../lib/auth.js';
import { renderAdminSidebar, showToast, formatCurrency } from '../../components/layout.js';

export async function renderAdminPricing(app) {
  try {
  // Password-based admin auth check
  if (sessionStorage.getItem('adminAuth') !== 'true') {
    location.hash = '/admin';
    return;
  }
  const session = await getSession();
  let pricing = [];

  try {
    pricing = await getPricing();
  } catch (e) {
    pricing = [
      { id: 1, type: 'hourly', amount: 2000, currency: 'NGN', label: '1 Hour Session' },
      { id: 2, type: 'hourly', amount: 3500, currency: 'NGN', label: '2 Hour Session' },
      { id: 3, type: 'hourly', amount: 5000, currency: 'NGN', label: '3 Hour Session' },
      { id: 4, type: 'per_game', amount: 1500, currency: 'NGN', label: 'Single Game' },
      { id: 5, type: 'per_game', amount: 2500, currency: 'NGN', label: '2 Games' },
      { id: 6, type: 'per_game', amount: 3500, currency: 'NGN', label: '3 Games' }
    ];
  }

  // Fetch membership settings
  const { supabase } = await import('/src/lib/supabase.js')
  let ms = {
    membership_monthly_price: '5000',
    membership_annual_price: '50000',
    membership_discount_percent: '15',
    membership_free_games: '1',
    membership_annual_badge: 'BEST VALUE — SAVE ₦10,000'
  }
  try {
    const { data: sd } = await supabase.from('app_settings').select('key, value')
    if (sd) sd.forEach(r => { ms[r.key] = r.value })
  } catch(e) { console.warn('Settings fetch failed, using defaults') }

  const hourlyPricing = pricing.filter(p => p.type === 'hourly');
  const gamePricing = pricing.filter(p => p.type === 'per_game');

  app.innerHTML = `
    <div class="admin-layout">
      ${renderAdminSidebar('pricing')}
      <main class="admin-main">
        <header style="margin-bottom: 3rem;">
          <p class="label-xs text-primary" style="margin-bottom: 0.5rem; letter-spacing: 0.2em;">MANAGE</p>
          <h1 class="headline-md" style="font-size: 2.25rem;">Pricing Management</h1>
          <p class="body-lg text-on-surface-variant" style="margin-top: 0.5rem;">Set rates for time-based and game-based bookings.</p>
        </header>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 2rem;">
          <!-- Hourly Pricing -->
          <div style="background: var(--surface-container-low); border-radius: var(--radius-xl); overflow: hidden; border: 1px solid rgba(64,73,66,0.1);">
            <div style="padding: 1.5rem; border-bottom: 1px solid rgba(64,73,66,0.1); display: flex; align-items: center; gap: 0.75rem;">
              <span class="material-symbols-outlined text-primary">schedule</span>
              <h2 class="title-lg">Time-Based Pricing</h2>
            </div>
            <div style="padding: 1.5rem;">
              ${hourlyPricing.map(p => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem 0; border-bottom: 1px solid rgba(64,73,66,0.05);">
                  <div>
                    <span style="font-weight: 600;">${p.label}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="position: relative; display: flex; align-items: center;">
                      <span style="position: absolute; left: 0.75rem; color: var(--outline); font-size: 0.85rem;">₦</span>
                      <input type="number" class="pricing-input" data-id="${p.id}"
                        value="${p.amount}"
                        style="width: 8rem; padding: 0.5rem 0.75rem 0.5rem 1.75rem; background: var(--surface-container); border: 1px solid rgba(64,73,66,0.2); color: var(--on-surface); font-family: var(--font-headline); font-weight: 700; font-size: 0.9rem; outline: none; border-radius: var(--radius-md);"
                      />
                    </div>
                    <button class="btn btn-primary btn-sm save-price-btn" data-id="${p.id}">Save</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>

          <!-- Game Pricing -->
          <div style="background: var(--surface-container-low); border-radius: var(--radius-xl); overflow: hidden; border: 1px solid rgba(64,73,66,0.1);">
            <div style="padding: 1.5rem; border-bottom: 1px solid rgba(64,73,66,0.1); display: flex; align-items: center; gap: 0.75rem;">
              <span class="material-symbols-outlined text-primary">sports_score</span>
              <h2 class="title-lg">Game-Based Pricing</h2>
            </div>
            <div style="padding: 1.5rem;">
              ${gamePricing.map(p => `
                <div style="display: flex; align-items: center; justify-content: space-between; padding: 1rem 0; border-bottom: 1px solid rgba(64,73,66,0.05);">
                  <div>
                    <span style="font-weight: 600;">${p.label}</span>
                  </div>
                  <div style="display: flex; align-items: center; gap: 0.75rem;">
                    <div style="position: relative; display: flex; align-items: center;">
                      <span style="position: absolute; left: 0.75rem; color: var(--outline); font-size: 0.85rem;">₦</span>
                      <input type="number" class="pricing-input" data-id="${p.id}"
                        value="${p.amount}"
                        style="width: 8rem; padding: 0.5rem 0.75rem 0.5rem 1.75rem; background: var(--surface-container); border: 1px solid rgba(64,73,66,0.2); color: var(--on-surface); font-family: var(--font-headline); font-weight: 700; font-size: 0.9rem; outline: none; border-radius: var(--radius-md);"
                      />
                    </div>
                    <button class="btn btn-primary btn-sm save-price-btn" data-id="${p.id}">Save</button>
                  </div>
                </div>
              `).join('')}
            </div>
          </div>
        </div>

        <!-- Membership Pricing Section -->
        <div style="margin-top:2rem;padding-top:2rem;border-top:1px solid var(--outline-variant);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1.5rem;">
            <div>
              <h2 style="margin:0;font-size:1.25rem;color:var(--on-surface);">👑 Membership Pricing</h2>
              <p style="color:var(--outline);font-size:0.85rem;margin:0.25rem 0 0;">Changes apply immediately to the membership page</p>
            </div>
          </div>

          <form id="membership-pricing-form">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:1.5rem;margin-bottom:1.5rem;">

              <div style="background:var(--surface);border:1px solid var(--outline-variant);border-radius:12px;padding:1.5rem;">
                <p style="color:#c9a84c;font-size:0.75rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 1rem;">Monthly Plan</p>
                <div style="margin-bottom:1rem;">
                  <label style="display:block;color:var(--outline);font-size:0.8rem;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:1px;">Price (₦)</label>
                  <input type="number" id="monthly-price" value="${ms.membership_monthly_price}" min="100"
                    style="width:100%;padding:0.75rem;background:var(--background);border:1px solid var(--outline-variant);border-radius:8px;color:var(--on-surface);font-size:1.1rem;font-weight:600;box-sizing:border-box;outline:none;"/>
                </div>
                <div>
                  <label style="display:block;color:var(--outline);font-size:0.8rem;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:1px;">Duration Label</label>
                  <input type="text" id="monthly-label" value="per month"
                    style="width:100%;padding:0.75rem;background:var(--background);border:1px solid var(--outline-variant);border-radius:8px;color:var(--on-surface);font-size:0.9rem;box-sizing:border-box;outline:none;"/>
                </div>
              </div>

              <div style="background:var(--surface);border:2px solid rgba(201,168,76,0.3);border-radius:12px;padding:1.5rem;">
                <p style="color:#c9a84c;font-size:0.75rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 1rem;">Annual Plan</p>
                <div style="margin-bottom:1rem;">
                  <label style="display:block;color:var(--outline);font-size:0.8rem;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:1px;">Price (₦)</label>
                  <input type="number" id="annual-price" value="${ms.membership_annual_price}" min="100"
                    style="width:100%;padding:0.75rem;background:var(--background);border:1px solid var(--outline-variant);border-radius:8px;color:var(--on-surface);font-size:1.1rem;font-weight:600;box-sizing:border-box;outline:none;"/>
                </div>
                <div>
                  <label style="display:block;color:var(--outline);font-size:0.8rem;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:1px;">Savings Badge Text</label>
                  <input type="text" id="annual-badge" value="${ms.membership_annual_badge}"
                    style="width:100%;padding:0.75rem;background:var(--background);border:1px solid var(--outline-variant);border-radius:8px;color:var(--on-surface);font-size:0.85rem;box-sizing:border-box;outline:none;"/>
                </div>
              </div>
            </div>

            <div style="background:var(--surface);border:1px solid var(--outline-variant);border-radius:12px;padding:1.5rem;margin-bottom:1.5rem;">
              <p style="color:#c9a84c;font-size:0.75rem;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin:0 0 1rem;">Member Discount Settings</p>
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;">
                <div>
                  <label style="display:block;color:var(--outline);font-size:0.8rem;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:1px;">Booking Discount (%)</label>
                  <input type="number" id="member-discount" value="${ms.membership_discount_percent}" min="1" max="100"
                    style="width:100%;padding:0.75rem;background:var(--background);border:1px solid var(--outline-variant);border-radius:8px;color:var(--on-surface);font-size:1.1rem;font-weight:600;box-sizing:border-box;outline:none;"/>
                  <p style="color:var(--outline);font-size:0.75rem;margin:0.3rem 0 0;">Applied to every member booking</p>
                </div>
                <div>
                  <label style="display:block;color:var(--outline);font-size:0.8rem;margin-bottom:0.4rem;text-transform:uppercase;letter-spacing:1px;">Free Games Per Month</label>
                  <input type="number" id="free-games" value="${ms.membership_free_games}" min="0" max="10"
                    style="width:100%;padding:0.75rem;background:var(--background);border:1px solid var(--outline-variant);border-radius:8px;color:var(--on-surface);font-size:1.1rem;font-weight:600;box-sizing:border-box;outline:none;"/>
                  <p style="color:var(--outline);font-size:0.75rem;margin:0.3rem 0 0;">Complimentary games for members</p>
                </div>
              </div>
            </div>

            <button type="submit" id="save-membership-pricing-btn" class="btn btn-primary" style="padding:0.875rem 2rem;">
              Save Membership Pricing
            </button>
          </form>
        </div>

      </main>
    </div>
  `;

  const logoutBtn = document.getElementById('admin-logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', (e) => {
      e.preventDefault();
      sessionStorage.removeItem('adminAuth');
      location.hash = '/admin';
    });
  }

  // Save pricing
  document.querySelectorAll('.save-price-btn').forEach(btn => {
    btn.addEventListener('click', async () => {
      const id = parseInt(btn.dataset.id);
      const input = document.querySelector(`.pricing-input[data-id="${id}"]`);
      const amount = parseFloat(input.value);

      if (isNaN(amount) || amount <= 0) {
        showToast('Please enter a valid amount', 'error');
        return;
      }

      btn.disabled = true;
      btn.textContent = '...';

      try {
        await updatePricing(id, { amount });
        showToast('Pricing updated!');
      } catch (e) {
        showToast('Updated (demo mode)');
      }

      btn.disabled = false;
      btn.textContent = 'Save';
    });
  });

  // Membership pricing form save
  document.getElementById('membership-pricing-form')?.addEventListener('submit', async (e) => {
    e.preventDefault()
    const btn = document.getElementById('save-membership-pricing-btn')
    btn.textContent = 'Saving...'
    btn.disabled = true

    const settings = [
      { key: 'membership_monthly_price', value: document.getElementById('monthly-price').value },
      { key: 'membership_annual_price',  value: document.getElementById('annual-price').value },
      { key: 'membership_discount_percent', value: document.getElementById('member-discount').value },
      { key: 'membership_free_games',    value: document.getElementById('free-games').value },
      { key: 'membership_annual_badge',  value: document.getElementById('annual-badge').value }
    ]

    for (const s of settings) {
      await supabase.from('app_settings').upsert({
        key: s.key,
        value: s.value,
        updated_at: new Date().toISOString()
      })
    }

    showToast('Membership pricing saved ✓')
    btn.textContent = 'Save Membership Pricing'
    btn.disabled = false
  })

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

