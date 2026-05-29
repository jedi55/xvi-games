// ═══════════════════════════════════════
// THEME TOGGLE — Light / Dark Mode
// ═══════════════════════════════════════

const STORAGE_KEY = 'xvi-theme';

export function initTheme() {
  const saved = localStorage.getItem(STORAGE_KEY);
  const theme = saved || 'dark';
  applyTheme(theme);
}

export function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  applyTheme(next);
  localStorage.setItem(STORAGE_KEY, next);
}

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
}

export function getCurrentTheme() {
  return document.documentElement.getAttribute('data-theme') || 'dark';
}

export function setupThemeToggle() {
  const btn = document.getElementById('theme-toggle-btn');
  if (!btn) return;

  const update = () => {
    const theme = getCurrentTheme();
    const icon = btn.querySelector('.theme-icon');
    const tooltip = btn.querySelector('.theme-tooltip');
    if (icon) icon.textContent = theme === 'dark' ? 'dark_mode' : 'light_mode';
    if (tooltip) tooltip.textContent = theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode';
  };

  btn.addEventListener('click', () => {
    toggleTheme();
    update();
  });

  update();
}
