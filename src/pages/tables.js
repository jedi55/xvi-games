import { getTables } from '../lib/api.js';
import { getSession } from '../lib/auth.js';
import { renderHeader, renderFooter } from '../components/layout.js';
import { isMember, calculatePrice, getMemberDiscountPercent } from '../utils/membershipUtils.js';

export async function renderTablesPage(app) {
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

  const dbTables = await fetchLiveTables();

  // Enrich with pricing and formatting to match homepage exactly
  const tables = dbTables.map(t => ({
    ...t,
    id: t.id,
    name: t.label,
    desc: `Table #${t.table_number}`,
    hourly: t.hourly_rate / 100,
    game: t.per_game_rate / 100,
    vip: t.label?.includes('VIP'),
    status: 'available' // Mocked available status for now until availability checking is built
  }));

  app.innerHTML = `
    ${renderHeader(session, 'tables')}
    <main class="page-content">
      <section class="page-section">
        <div style="margin-bottom: 3rem;">
          <p class="label-md text-primary" style="margin-bottom: 0.5rem; letter-spacing: 0.2em;">SELECT A TABLE</p>
          <h1 class="headline-md" style="font-size: 2.5rem;">Our Snooker Tables</h1>
          <p class="body-lg text-on-surface-variant" style="margin-top: 0.75rem; max-width: 36rem;">
            Choose from our premium tables. Each is maintained to the highest standards for your enjoyment.
          </p>
        </div>

        <!-- Table Status Overview -->
        <div style="display: flex; gap: 1rem; margin-bottom: 3rem; flex-wrap: wrap;">
          ${tables.map(table => `
            <div class="table-status-card ${table.status}" style="min-width: 160px; flex: 1;">
              <span class="status-dot ${table.status}" style="position: absolute; top: 0.75rem; right: 0.75rem;"></span>
              <p class="label-xs text-outline" style="margin-bottom: 0.25rem;">${table.name.toUpperCase()}</p>
              <p style="font-size: 0.8rem; font-weight: 700; color: ${table.status === 'maintenance' ? 'var(--error)' : table.status === 'occupied' ? 'var(--on-surface)' : 'var(--outline)'};">
                ${table.status === 'available' ? 'Available' : table.status === 'occupied' ? 'In Use' : 'Maintenance'}
              </p>
            </div>
          `).join('')}
        </div>

        <!-- Consistent Homepage List Layout -->
        <div class="table-rows">
          ${tables.map(t => `
            <div class="table-row ${t.vip ? 'vip' : ''}" id="table-row-${t.id}">
              <div class="tr-left">
                <div class="tr-icon">
                  <span class="material-symbols-outlined">${t.vip ? 'stars' : 'sports'}</span>
                </div>
                <div>
                  <h3 class="tr-name">${t.name}</h3>
                  <p class="tr-desc">${t.desc}</p>
                </div>
              </div>
              <div class="tr-pricing">
                <div class="tr-price-col">
                  <span class="tr-price-label">Per Hour</span>
                  <span class="tr-price-value">₦${calculatePrice(t.hourly).toLocaleString()}</span>
                </div>
                <div class="tr-price-divider"></div>
                <div class="tr-price-col">
                  <span class="tr-price-label">Per Game</span>
                  <span class="tr-price-value">₦${calculatePrice(t.game).toLocaleString()}</span>
                </div>
              </div>
              <div class="tr-right">
                <div class="tr-badge">
                  <span class="tr-badge-dot" style="background: ${t.status === 'available' ? '#69df5e' : (t.status === 'maintenance' ? '#ff6b6b' : '#3d443e')}"></span>
                  ${t.status === 'available' ? 'Available' : t.status === 'occupied' ? 'In Use' : 'Maintenance'}
                </div>
                ${t.status === 'available' ? `
                  <a href="#/booking" class="tr-reserve-btn" id="reserve-btn-${t.id}">
                    Reserve
                    <span class="material-symbols-outlined" style="font-size: 0.875rem;">arrow_forward</span>
                  </a>
                ` : `
                  <span class="tr-reserve-btn" style="opacity: 0.4; pointer-events: none; border-color: rgba(61, 68, 62, 0.4);">
                    Unavailable
                  </span>
                `}
              </div>
            </div>
          `).join('')}
        </div>

        <!-- Membership note -->
        <div style="margin-top: 1.5rem; padding: 0.875rem 1.25rem; background: var(--surface-container-low); border-radius: var(--radius-lg); border-left: 3px solid var(--gold); display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
          ${isMember() ? `
            <span style="font-size: 0.85rem; color: var(--gold); font-weight: 600;"><span class="material-symbols-outlined" style="font-size: 1rem; vertical-align: middle; margin-right: 0.25rem;">verified</span>Member price — ${getMemberDiscountPercent()}% off applied</span>
          ` : `
            <span style="font-size: 0.85rem; color: var(--on-surface-variant);">Become a member to save on every reservation</span>
            <a href="#/membership" style="font-size: 0.8rem; font-weight: 700; color: var(--gold); text-decoration: none; white-space: nowrap;">View Membership Plans →</a>
          `}
        </div>
      </section>
    </main>
    ${renderFooter()}
  `;
}
