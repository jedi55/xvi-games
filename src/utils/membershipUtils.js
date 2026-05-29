// ─── Membership Utility Functions ───
// Source of truth: xvi_member + xvi_member_discount keys in localStorage
// Written at membership sign-up by membership.js / granted by admin in users.js

// ── Old membership_status key (legacy) ──
const STORAGE_KEY = 'membership_status';

export function getMembershipStatus() {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    return data ? JSON.parse(data) : null;
  } catch {
    return null;
  }
}

/** Returns true when the user holds an active XVI membership */
export function isMember() {
  // New key set by Paystack onSuccess / admin grant
  if (localStorage.getItem('xvi_member') === 'true') return true;
  // Legacy key (kept for backward-compat)
  const membership = getMembershipStatus();
  return !!(membership && membership.active);
}

/**
 * Returns the current member discount as a decimal (0–1).
 * Reads the dynamic percent stored at sign-up (xvi_member_discount).
 * Falls back to 15% for sessions set before dynamic pricing was added.
 */
export function getMemberDiscount() {
  if (!isMember()) return 0;
  const pct = parseInt(localStorage.getItem('xvi_member_discount') || '15');
  return pct / 100;
}

/** Returns a price with the member discount applied (rounds to integer) */
export function calculatePrice(basePrice) {
  const discount = getMemberDiscount();
  return Math.round(basePrice * (1 - discount));
}

/** Returns the discount percent as an integer (e.g. 15) */
export function getMemberDiscountPercent() {
  if (!isMember()) return 0;
  return parseInt(localStorage.getItem('xvi_member_discount') || '15');
}

export function saveMembership(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}

export function clearMembership() {
  localStorage.removeItem(STORAGE_KEY);
}
