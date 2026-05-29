import { getSession } from '../lib/auth.js';
import { renderHeader, renderFooter } from '../components/layout.js';
import { calculatePrice } from '../utils/membershipUtils.js';

export async function renderHomePage(app) {
  try {
  const session = await getSession();

  async function fetchLiveTables() {
    try {
      const { supabase } = await import('../lib/supabase.js')
      const { data, error } = await supabase
        .from('snooker_tables')
        .select('*')
        .eq('is_active', true)
        .order('table_number', { ascending: true })
      
      if (error) throw error
      return data || []
    } catch (e) {
      console.error('Failed to fetch tables:', e)
      return []
    }
  }

  let tables = await fetchLiveTables();

  function render() {
    app.innerHTML = `
      ${renderHeader(session, 'home')}
      <main class="page-content">

      <!-- ═══ HERO ═══ -->
      <section class="hero-sovereign" id="hero-section">
        <div class="hero-overlay"></div>
        <div class="hero-content">
          <div class="hero-gold-line"></div>
          <h1 class="hero-title">XVI</h1>
          <p class="hero-tagline">ELEVATED RESERVATIONS</p>
          <a href="#/booking" class="btn-hero-cta" id="hero-book-btn">
            <span class="material-symbols-outlined" style="font-size: 1.25rem;">sports</span>
            Book a Table
          </a>
        </div>
        <div class="hero-fade-bottom"></div>
      </section>

      <!-- ═══ OUR TABLES ═══ -->
      <section class="section-tables-list" id="tables-section">
        <div class="section-inner">
          <div class="section-header">
            <span class="gold-dash"></span>
            <h2 class="section-title">Our Tables</h2>
          </div>
          <div class="table-rows">
            ${tables.map(t => `
              <div class="table-row ${t.label?.includes('VIP') ? 'vip' : ''}" id="table-row-${t.id}">
                <div class="tr-left">
                  <div class="tr-icon">
                    <span class="material-symbols-outlined">${t.label?.includes('VIP') ? 'stars' : 'sports'}</span>
                  </div>
                  <div>
                    <h3 class="tr-name">${t.label}</h3>
                    <p class="tr-desc">Table #${t.table_number}</p>
                  </div>
                </div>
                <div class="tr-pricing">
                  <div class="tr-price-col">
                    <span class="tr-price-label">Per Hour</span>
                    <span class="tr-price-value">₦${calculatePrice(t.hourly_rate / 100).toLocaleString()}</span>
                  </div>
                  <div class="tr-price-divider"></div>
                  <div class="tr-price-col">
                    <span class="tr-price-label">Per Game</span>
                    <span class="tr-price-value">₦${calculatePrice(t.per_game_rate / 100).toLocaleString()}</span>
                  </div>
                </div>
                <div class="tr-right">
                  <div class="tr-badge" data-table-status="${t.id}">
                    <span class="tr-badge-dot"></span>
                    Available
                  </div>
                  <a href="#/booking" class="tr-reserve-btn" id="reserve-btn-${t.id}">
                    Reserve
                    <span class="material-symbols-outlined" style="font-size: 0.875rem;">arrow_forward</span>
                  </a>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <!-- ═══ HOW IT WORKS ═══ -->
      <section class="section-how" id="how-it-works-section">
        <div class="section-inner">
          <div class="section-header" style="text-align: center;">
            <span class="gold-dash" style="margin: 0 auto;"></span>
            <h2 class="section-title">How It Works</h2>
          </div>
          <div class="steps-row">
            ${[
              { num: '1', icon: 'table_restaurant', title: 'Choose Your Table', desc: 'Browse our available tables including the exclusive VIP suite.' },
              { num: '2', icon: 'schedule', title: 'Pick Time or Games', desc: 'Book by the hour or by number of frames — complete flexibility.' },
              { num: '3', icon: 'verified', title: 'Pay & Confirm', desc: 'Secure payment via Paystack with instant booking confirmation.' }
            ].map(step => `
              <div class="step-card" id="step-card-${step.num}">
                <span class="step-num">${step.num}</span>
                <div class="step-icon">
                  <span class="material-symbols-outlined">${step.icon}</span>
                </div>
                <h3 class="step-title">${step.title}</h3>
                <p class="step-desc">${step.desc}</p>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

    </main>
    ${renderFooter()}
  `;
  }

  render();

  // Realtime subscription for tables
  const { supabase } = await import('../lib/supabase.js');
  supabase
    .channel('table-changes-home')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'snooker_tables'
      },
      async () => {
        tables = await fetchLiveTables()
        const tablesSection = document.querySelector('.table-rows')
        if (tablesSection) {
          tablesSection.innerHTML = tables.map(t => `
            <div class="table-row ${t.label?.includes('VIP') ? 'vip' : ''}" id="table-row-${t.id}">
              <div class="tr-left">
                <div class="tr-icon">
                  <span class="material-symbols-outlined">${t.label?.includes('VIP') ? 'stars' : 'sports'}</span>
                </div>
                <div>
                  <h3 class="tr-name">${t.label}</h3>
                  <p class="tr-desc">Table #${t.table_number}</p>
                </div>
              </div>
              <div class="tr-pricing">
                <div class="tr-price-col">
                  <span class="tr-price-label">Per Hour</span>
                  <span class="tr-price-value">₦${calculatePrice(t.hourly_rate / 100).toLocaleString()}</span>
                </div>
                <div class="tr-price-divider"></div>
                <div class="tr-price-col">
                  <span class="tr-price-label">Per Game</span>
                  <span class="tr-price-value">₦${calculatePrice(t.per_game_rate / 100).toLocaleString()}</span>
                </div>
              </div>
              <div class="tr-right">
                <div class="tr-badge" data-table-status="${t.id}">
                  <span class="tr-badge-dot"></span>
                  Available
                </div>
                <a href="#/booking" class="tr-reserve-btn" id="reserve-btn-${t.id}">
                  Reserve
                  <span class="material-symbols-outlined" style="font-size: 0.875rem;">arrow_forward</span>
                </a>
              </div>
            </div>
          `).join('');
          updateTableStatusBadges();
        }
      }
    )
    .subscribe();

  async function updateTableStatusBadges() {
    try {
      const today = new Date().toISOString().split('T')[0];
      const nowDate = new Date();
      const currentHour = nowDate.getHours().toString().padStart(2, '0');
      const currentMin = nowDate.getMinutes().toString().padStart(2, '0');
      const currentTimeStr = `${currentHour}:${currentMin}:00`;
      
      nowDate.setHours(nowDate.getHours() + 1);
      const nextHour = nowDate.getHours().toString().padStart(2, '0');
      const nextMin = nowDate.getMinutes().toString().padStart(2, '0');
      const nextTimeStr = `${nextHour}:${nextMin}:00`;

      const { data: currentBookings } = await supabase
        .from('reservations')
        .select('table_id, start_time, end_time')
        .in('status', ['confirmed'])
        .eq('date', today);

      const occupiedIds = new Set();
      if (currentBookings) {
        currentBookings.forEach(b => {
          if (!b.start_time) return;
          const bStart = b.start_time;
          let bEnd = b.end_time;
          if (!bEnd) {
             const h = parseInt(bStart.split(':')[0]) + 2;
             bEnd = `${h.toString().padStart(2, '0')}:${bStart.split(':')[1]}:00`;
          }
          if (bStart < nextTimeStr && bEnd > currentTimeStr) {
            occupiedIds.add(b.table_id);
          }
        });
      }

      document.querySelectorAll('[data-table-status]').forEach(badge => {
        const tableId = parseInt(badge.dataset.tableStatus);
        if (occupiedIds.has(tableId)) {
          badge.innerHTML = '<span class="tr-badge-dot" style="background:#ef4444;"></span> Occupied';
          badge.style.color = '#ef4444';
          badge.style.background = 'rgba(239,68,68,0.15)';
          
          const btn = document.getElementById(`reserve-btn-${tableId}`);
          if (btn) {
            btn.style.opacity = '0.5';
            btn.style.pointerEvents = 'none';
            btn.textContent = 'Unavailable';
          }
        } else {
          badge.innerHTML = '<span class="tr-badge-dot" style="background:#4caf50;"></span> Available';
          badge.style.color = '#4caf50';
          badge.style.background = 'rgba(76,175,80,0.15)';
          
          const btn = document.getElementById(`reserve-btn-${tableId}`);
          if (btn) {
            btn.style.opacity = '1';
            btn.style.pointerEvents = 'auto';
            btn.innerHTML = `Reserve <span class="material-symbols-outlined" style="font-size: 0.875rem;">arrow_forward</span>`;
          }
        }
      });
    } catch (err) {
      console.error('Failed to update table statuses', err);
    }
  }

  updateTableStatusBadges();
  setInterval(updateTableStatusBadges, 60000);

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

