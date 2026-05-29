import { getSession } from '../lib/auth.js';
import { renderHeader, renderFooter } from '../components/layout.js';
import { calculatePrice } from '../utils/membershipUtils.js';

export async function renderAboutPage(app) {
  try {
  const session = await getSession();

  const tables = [
    { id: 1, name: 'Table 1', hourly: 1500, game: 800, vip: false },
    { id: 2, name: 'Table 2', hourly: 1500, game: 800, vip: false },
    { id: 3, name: 'Table 3', hourly: 1500, game: 800, vip: false },
    { id: 4, name: 'VIP Table', hourly: 2500, game: 1200, vip: true }
  ];

  app.innerHTML = `
    ${renderHeader(session, 'about')}
    <main class="page-content">

      <!-- 1. HERO -->
      <section class="hero-sovereign" style="min-height: 50vh;">
        <div class="hero-overlay"></div>
        <div class="hero-content" style="text-align: center; margin-top: 4rem;">
          <h1 class="hero-title" style="font-size: 3.5rem;">About XVI</h1>
          <p class="hero-tagline">Where Precision Meets Passion</p>
        </div>
        <div class="hero-fade-bottom"></div>
      </section>

      <!-- 2. OUR STORY -->
      <section class="page-section" style="padding-top: 4rem; padding-bottom: 4rem;">
        <div class="about-story-grid">
          <div class="story-content">
            <h2 class="section-title" style="margin-bottom: 2rem;">Our Story</h2>
            <p class="body-lg" style="margin-bottom: 1.5rem; color: var(--on-surface-variant); line-height: 1.8;">
              XVI was founded with one vision — to create a premium snooker experience unlike anything in the city. We believe every frame deserves the perfect setting.
            </p>
            <p class="body-lg" style="color: var(--on-surface-variant); line-height: 1.8;">
              From our tournament-grade tables to our VIP room, every detail has been carefully considered to give you the best game of your life.
            </p>
          </div>
          <div class="story-stats-card">
            <div class="story-icon"><span class="material-symbols-outlined" style="font-size: 3rem; color: var(--gold);">sports</span></div>
            <h3 style="font-family: var(--font-headline); font-size: 1.75rem; margin-top: 1rem; color: #fff;">4 Premium Tables<br/><span style="font-size: 1.125rem; color: var(--outline); font-family: var(--font-body); font-weight: 400;">Est. 2024</span></h3>
          </div>
        </div>
      </section>

      <!-- 3. WHY CHOOSE US -->
      <section class="section-how" style="background: var(--surface-container);">
        <div class="section-inner">
          <div class="section-header" style="text-align: center;">
            <span class="gold-dash" style="margin: 0 auto;"></span>
            <h2 class="section-title">Why Choose Us</h2>
          </div>
          <div class="steps-row">
            <div class="step-card">
              <div class="step-icon"><span class="material-symbols-outlined">emoji_events</span></div>
              <h3 class="step-title">Tournament Grade</h3>
              <p class="step-desc">Our tables use professional-grade cloth and are maintained to the highest standards</p>
            </div>
            <div class="step-card">
              <div class="step-icon"><span class="material-symbols-outlined">schedule</span></div>
              <h3 class="step-title">Flexible Booking</h3>
              <p class="step-desc">Book by the hour or by number of frames — whatever suits your game</p>
            </div>
            <div class="step-card">
              <div class="step-icon"><span class="material-symbols-outlined">shield</span></div>
              <h3 class="step-title">Secure Payment</h3>
              <p class="step-desc">Pay safely online with Paystack before your session is confirmed</p>
            </div>
          </div>
        </div>
      </section>

      <!-- 4. OUR TABLES -->
      <section class="section-tables-list">
        <div class="section-inner">
          <div class="section-header">
            <span class="gold-dash"></span>
            <h2 class="section-title">Our Tables</h2>
          </div>
          <div class="table-rows">
            ${tables.map(t => `
              <div class="table-row ${t.vip ? 'vip' : ''}">
                <div class="tr-left">
                  <div class="tr-icon">
                    <span class="material-symbols-outlined">${t.vip ? 'stars' : 'sports'}</span>
                  </div>
                  <div>
                    <h3 class="tr-name">${t.name}</h3>
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
                  <a href="#/booking" class="tr-reserve-btn">
                    Reserve
                    <span class="material-symbols-outlined" style="font-size: 0.875rem;">arrow_forward</span>
                  </a>
                </div>
              </div>
            `).join('')}
          </div>
        </div>
      </section>

      <!-- 5. VISIT US -->
      <section class="page-section" style="background: rgba(10, 31, 10, 0.4); border-top: 1px solid rgba(255,255,255,0.05); border-bottom: 1px solid rgba(255,255,255,0.05);">
        <div class="section-header" style="text-align: center;">
          <span class="gold-dash" style="margin: 0 auto;"></span>
          <h2 class="section-title">Visit Us</h2>
        </div>
        <div class="visit-us-grid">
          <div class="visit-col">
            <div class="visit-icon-wrapper"><span class="material-symbols-outlined visit-icon">location_on</span></div>
            <h4 class="visit-col-title">Locations</h4>
            <p style="font-weight: 700; color: var(--gold); margin-bottom: 0.25rem;">Ekiti Office:</p>
            <p style="margin-bottom: 0.75rem; font-size: 0.85rem; max-width: 280px; text-align: center;">Onala Area, Opposite JOTAD Specialist Hospital, Balemo Street, Ado Ekiti 360102, Ekiti State, Nigeria.</p>
            <p style="font-weight: 700; color: var(--gold); margin-bottom: 0.25rem;">Lagos Office:</p>
            <p style="font-size: 0.85rem; max-width: 280px; text-align: center;">17, Solo Ogun Street, Aguda, Lagos State, Nigeria.</p>
          </div>
          <div class="visit-col">
            <div class="visit-icon-wrapper"><span class="material-symbols-outlined visit-icon">schedule</span></div>
            <h4 class="visit-col-title">Opening Hours</h4>
            <p>Monday to Sunday</p>
            <p style="font-family: var(--font-headline);">10:00 AM — 11:00 PM</p>
            <p class="label-xs" style="color: var(--outline); margin-top: 0.5rem;">Last booking at 9:00 PM</p>
          </div>
          <div class="visit-col">
            <div class="visit-icon-wrapper"><span class="material-symbols-outlined visit-icon">contact_support</span></div>
            <h4 class="visit-col-title">Contact</h4>
            <p>Phone: <span class="serif-numbers">+234 808 794 8773</span></p>
            <p>Email: info@xvi.com</p>
            <p>Instagram: @thebrandxvi</p>
          </div>
        </div>
      </section>

      <!-- 6. CALL TO ACTION -->
      <section class="section-cta hero-sovereign" style="min-height: 45vh; display: flex; align-items: center; justify-content: center; text-align: center;">
        <div class="hero-overlay" style="background: linear-gradient(180deg, rgba(10,31,10,0) 0%, rgba(10,31,10,0.8) 100%), var(--surface);"></div>
        <div style="position: relative; z-index: 2; padding: 2rem;">
          <h2 class="hero-title" style="font-size: 3rem; margin-bottom: 1rem;">Ready to Play?</h2>
          <p class="hero-tagline" style="margin-bottom: 2.5rem; text-transform: none; letter-spacing: 0.05em; color: var(--on-surface-variant);">Book your table in under 2 minutes</p>
          <a href="#/booking" class="btn-hero-cta">
             <span class="material-symbols-outlined" style="font-size: 1.25rem;">event</span>
             Book a Table Now
          </a>
        </div>
      </section>

    </main>
    ${renderFooter()}
  `;

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

