/**
 * src/lib/payment.js
 * Reusable Paystack inline payment helper.
 *
 * Uses Paystack v1 inline.js API (loaded via index.html <script> tag).
 * Correct callback names for v1: `callback` (success) and `onClose` (dismissed).
 * NOTE: onSuccess / onCancel are NOT valid Paystack v1 API names — never use them.
 */

// Public key — safe to hardcode (Paystack public keys are browser-visible by design).
// The env var takes priority; fallback ensures the live site always works even if
// the hosting platform doesn't pass the env var at build time.
const PAYSTACK_PUBLIC_KEY =
  import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ||
  'pk_test_ea2a396e49ad8875ff1d77445a41a6b4cca54d6';

/**
 * Initiate a Paystack inline payment.
 *
 * @param {object}   options
 * @param {string}   options.email      - Customer email address
 * @param {number}   options.amount     - Amount in NAIRA (function converts to kobo ×100)
 * @param {string}  [options.ref]       - Payment reference (defaults to 'XVI-<timestamp>')
 * @param {string}  [options.label]     - Customer display name shown on Paystack modal
 * @param {object[]}[options.metadata]  - Array of custom_fields for Paystack dashboard
 * @param {function} options.onSuccess  - Called with Paystack response on successful payment
 * @param {function} options.onClose    - Called when user closes the payment modal
 */
export function initiatePaystackPayment({
  email,
  amount,
  ref,
  label,
  metadata,
  onSuccess,
  onClose
}) {
  // ── DIAGNOSTIC: shows exact key on every payment attempt ──
  alert('Key being used: ' + PAYSTACK_PUBLIC_KEY);

  // Log key source for debugging (first 12 chars only — rest is masked)
  console.log(
    '[Paystack] Key source:',
    import.meta.env.VITE_PAYSTACK_PUBLIC_KEY ? 'env var ✓' : 'fallback hardcoded'
  );
  console.log('[Paystack] Key prefix:', PAYSTACK_PUBLIC_KEY.substring(0, 12) + '...');

  // Guard: Paystack script must be loaded in index.html
  if (typeof window.PaystackPop === 'undefined') {
    console.error('[Paystack] window.PaystackPop is undefined — is inline.js loaded in index.html?');
    alert('Payment system not loaded. Please refresh and try again.');
    if (onClose) onClose(); // reset button state on caller side
    return;
  }

  const handler = window.PaystackPop.setup({
    key:      PAYSTACK_PUBLIC_KEY,
    email:    email,
    amount:   Math.round(amount * 100), // Paystack expects kobo (naira × 100)
    currency: 'NGN',
    ref:      ref || 'XVI-' + Date.now(),
    label:    label || email,
    metadata: metadata ? { custom_fields: metadata } : undefined,

    // ── v1 API: 'callback' fires on successful payment ──
    callback: function (response) {
      console.log('[Paystack] Payment success:', response.reference);
      if (onSuccess) onSuccess(response);
    },

    // ── v1 API: 'onClose' fires when user dismisses the modal ──
    onClose: function () {
      console.log('[Paystack] Payment modal closed by user');
      if (onClose) onClose();
    }
  });

  handler.openIframe();
}
