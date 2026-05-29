import { supabase } from './supabase.js'

export async function checkMFARequired() {
  try {
    const { data, error } = await 
      supabase.auth.mfa.getAuthenticatorAssuranceLevel()
    if (error) return false
    
    // If current level is aal1 but next level is aal2
    // then user has 2FA set up and needs to verify
    return data.currentLevel === 'aal1' && 
           data.nextLevel === 'aal2'
  } catch (err) {
    console.warn('MFA check failed:', err.message)
    return false
  }
}

export async function getMFAFactors() {
  const { data, error } = await supabase.auth.mfa.listFactors()
  if (error) return []
  return data.totp || []
}

export async function verifyMFACode(factorId, code) {
  // Step 1: Create challenge
  const { data: challengeData, error: challengeError } = 
    await supabase.auth.mfa.challenge({ factorId })
  if (challengeError) throw challengeError

  // Step 2: Verify the code
  const { data, error } = await supabase.auth.mfa.verify({
    factorId,
    challengeId: challengeData.id,
    code: code.replace(/\s/g, '')
  })
  if (error) throw error
  return data
}

export async function unenrollMFAFactor(factorId) {
  const { error } = await supabase.auth.mfa.unenroll({ factorId })
  if (error) throw error
}

export function show2FAModal(onSuccess, onCancel) {
  // Remove existing modal if any
  const existing = document.getElementById('mfa-modal')
  if (existing) existing.remove()

  const modal = document.createElement('div')
  modal.id = 'mfa-modal'
  modal.style.cssText = `
    position:fixed;top:0;left:0;width:100%;height:100%;
    background:rgba(0,0,0,0.85);z-index:9999;
    display:flex;align-items:center;justify-content:center;
  `
  modal.innerHTML = `
    <div id="mfa-card" style="background:var(--surface, #0d2b0d);
      padding:2rem;border-radius:12px;width:90%;max-width:400px;
      border:1px solid var(--primary, #2E7D32);
      box-shadow:0 0 40px rgba(0,0,0,0.5);">
      
      <div style="text-align:center;margin-bottom:1.5rem;">
        <div style="font-size:2.5rem;margin-bottom:0.5rem;">🔐</div>
        <h2 style="color:var(--on-surface,white);font-size:1.25rem;
          font-weight:600;margin-bottom:0.5rem;">
          Two-Factor Verification
        </h2>
        <p style="color:var(--outline,#999);font-size:0.85rem;">
          Open your authenticator app and enter the 
          6-digit code to continue
        </p>
      </div>

      <div id="mfa-verify-view">
        <div style="margin-bottom:1.5rem;">
          <input 
            type="text" 
            id="mfa-code-input"
            placeholder="000 000"
            maxlength="7"
            autocomplete="one-time-code"
            inputmode="numeric"
            style="width:100%;padding:1rem;text-align:center;
              font-size:1.75rem;letter-spacing:8px;
              background:var(--background,#0a1f0a);
              color:var(--on-surface,white);
              border:2px solid var(--primary,#2E7D32);
              border-radius:8px;outline:none;
              font-family:monospace;box-sizing:border-box;"/>
        </div>

        <p id="mfa-error" style="color:#ef4444;font-size:0.8rem;
          text-align:center;margin-bottom:1rem;display:none;">
          Invalid code. Please try again.
        </p>

        <button id="mfa-verify-btn" style="width:100%;
          padding:0.875rem;background:#1a5c1a;color:white;
          border:none;border-radius:8px;font-size:1rem;
          font-weight:600;cursor:pointer;margin-bottom:0.75rem;">
          Verify &amp; Continue
        </button>
        
        <button id="mfa-cancel-btn" style="width:100%;
          padding:0.75rem;background:transparent;
          color:var(--outline,#999);border:1px solid var(--outline,#999);
          border-radius:8px;font-size:0.9rem;cursor:pointer;
          margin-bottom:1rem;">
          Cancel Login
        </button>

        <div style="text-align:center;">
          <button id="mfa-trouble-btn" style="background:none;border:none;
            color:#c9a84c;font-size:0.78rem;cursor:pointer;
            text-decoration:underline;padding:0;">
            Can't access your authenticator app?
          </button>
        </div>

        <p style="color:var(--outline,#999);font-size:0.75rem;
          text-align:center;margin-top:1rem;">
          🔒 This protects your account from unauthorized access
        </p>
      </div>

      <!-- Unenroll view (shown when user clicks trouble link) -->
      <div id="mfa-unenroll-view" style="display:none;">
        <div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);
          border-radius:8px;padding:1rem;margin-bottom:1.25rem;">
          <p style="color:#fca5a5;font-size:0.85rem;margin:0 0 0.5rem;font-weight:600;">
            ⚠️ Remove Two-Factor Authentication
          </p>
          <p style="color:#fca5a5;font-size:0.8rem;margin:0;">
            This will remove 2FA from your account. You can re-enable it later from Account Settings.
          </p>
        </div>
        <button id="mfa-confirm-unenroll-btn" style="width:100%;
          padding:0.875rem;background:#7f1d1d;color:white;
          border:1px solid #ef4444;border-radius:8px;font-size:0.9rem;
          font-weight:600;cursor:pointer;margin-bottom:0.75rem;">
          Yes, Remove 2FA &amp; Continue
        </button>
        <button id="mfa-back-btn" style="width:100%;
          padding:0.75rem;background:transparent;
          color:var(--outline,#999);border:1px solid var(--outline,#999);
          border-radius:8px;font-size:0.9rem;cursor:pointer;">
          ← Back to Code Entry
        </button>
      </div>
    </div>
  `
  document.body.appendChild(modal)

  // ── Verify view logic ──
  const input = document.getElementById('mfa-code-input')
  
  // Auto-format as user types
  input.addEventListener('input', (e) => {
    let val = e.target.value.replace(/\D/g, '')
    if (val.length > 3) val = val.slice(0,3) + ' ' + val.slice(3,6)
    e.target.value = val
  })
  input.focus()

  // Verify button
  document.getElementById('mfa-verify-btn')
    .addEventListener('click', async () => {
      const code = input.value.replace(/\s/g, '')
      const errEl = document.getElementById('mfa-error')
      
      if (code.length !== 6) {
        errEl.style.display = 'block'
        errEl.textContent = 'Please enter a complete 6-digit code'
        return
      }
      
      const btn = document.getElementById('mfa-verify-btn')
      btn.textContent = 'Verifying...'
      btn.disabled = true
      errEl.style.display = 'none'

      try {
        const factors = await getMFAFactors()
        if (factors.length === 0) {
          // No factors enrolled — just proceed
          modal.remove()
          onSuccess()
          return
        }
        
        await verifyMFACode(factors[0].id, code)
        modal.remove()
        onSuccess()
      } catch (err) {
        console.error('MFA verify error:', err)
        errEl.style.display = 'block'
        errEl.textContent = 'Invalid code. Check your authenticator app and try again.'
        btn.textContent = 'Verify & Continue'
        btn.disabled = false
        input.value = ''
        input.focus()
      }
    })

  // Enter key support
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      document.getElementById('mfa-verify-btn').click()
    }
  })

  // Cancel button — sign out and redirect
  document.getElementById('mfa-cancel-btn')
    .addEventListener('click', async () => {
      await supabase.auth.signOut()
      modal.remove()
      if (onCancel) onCancel()
    })

  // "Can't access authenticator?" toggle
  document.getElementById('mfa-trouble-btn')
    .addEventListener('click', () => {
      document.getElementById('mfa-verify-view').style.display = 'none'
      document.getElementById('mfa-unenroll-view').style.display = 'block'
    })

  // Back button
  document.getElementById('mfa-back-btn')
    .addEventListener('click', () => {
      document.getElementById('mfa-unenroll-view').style.display = 'none'
      document.getElementById('mfa-verify-view').style.display = 'block'
    })

  // Confirm unenroll button
  document.getElementById('mfa-confirm-unenroll-btn')
    .addEventListener('click', async () => {
      const btn = document.getElementById('mfa-confirm-unenroll-btn')
      btn.textContent = 'Removing 2FA...'
      btn.disabled = true

      try {
        const factors = await getMFAFactors()
        for (const factor of factors) {
          await unenrollMFAFactor(factor.id)
        }
        modal.remove()
        onSuccess()
      } catch (err) {
        console.error('MFA unenroll error:', err)
        btn.textContent = 'Failed: ' + err.message
        btn.style.background = '#7f1d1d'
        setTimeout(() => {
          btn.textContent = 'Yes, Remove 2FA & Continue'
          btn.disabled = false
        }, 2500)
      }
    })
}
