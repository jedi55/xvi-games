import { supabase } from '../lib/supabase.js';
import { router } from '../lib/router.js';
import { getSession } from '../lib/auth.js';

export async function renderSetup2FAPage(app) {
  const session = await getSession();
  if (!session) {
    router.navigate('/login');
    return;
  }

  app.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #0a1f0a; padding: 2rem 1rem; font-family: 'Manrope', sans-serif;">
      <div style="background: white; border-radius: 12px; padding: 3rem 2rem; width: 100%; max-width: 480px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); text-align: center;">
        
        <span class="material-symbols-outlined" style="font-size: 4rem; color: #c9a84c; margin-bottom: 0.5rem;">security</span>
        
        <h2 style="color: #1a1a1a; font-size: 1.75rem; margin: 0 0 0.5rem 0; font-weight: 700;">Two-Factor Authentication</h2>
        <p style="color: #666; margin: 0 0 2rem 0; font-size: 0.95rem;">Add an extra layer of security to your account</p>

        <div id="2fa-loading" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 2rem;">
          <div class="spinner" style="width: 32px; height: 32px; border-top-color: #69df5e; border-right-color: #ddd; border-bottom-color: #ddd; border-left-color: #ddd; margin-bottom: 1rem;"></div>
          <p>Generating secure setup...</p>
        </div>

        <div id="2fa-content" style="display: none; text-align: left;">
          
          <div style="margin-bottom: 2rem;">
            <p style="font-weight: 700; font-size: 0.85rem; color: #c9a84c; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.5rem;">Step 1 — Scan QR Code</p>
            
            <div style="text-align:center;margin:1.5rem 0;">
              <img id="qr-code-img" 
                src="" 
                alt="QR Code" 
                width="200" 
                height="200"
                style="border:8px solid white;border-radius:8px;
                       display:block;margin:0 auto 1rem;"/>
              
              <p style="font-size:0.8rem;color:var(--outline);
                margin-bottom:0.5rem;">
                Can't scan? Enter this code manually in your 
                authenticator app:
              </p>
              
              <div style="background:var(--surface);padding:0.75rem;
                border-radius:6px;border:1px solid var(--outline);
                font-family:monospace;font-size:1rem;
                letter-spacing:3px;word-break:break-all;
                color:var(--primary);font-weight:bold;"
                id="totp-secret">
                Loading...
              </div>
              
              <input type="hidden" id="factor-id" value=""/>
              
              <p style="font-size:0.75rem;color:var(--outline);
                margin-top:0.75rem;">
                Open Google Authenticator or Authy, tap the + button,
                choose "Scan QR code" and point your camera at the 
                image above. If scanning fails, choose 
                "Enter setup key" and type the code shown.
              </p>
            </div>
          </div>

          <div style="margin-bottom: 1rem;">
            <p style="font-weight: 700; font-size: 0.85rem; color: #c9a84c; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 0.5rem;">Step 2 — Verify Code</p>
            <p style="font-size: 0.9rem; color: #666; margin-bottom: 0.5rem;">Enter the 6-digit code from your authenticator app</p>
            <input type="text" id="verify-code-input" placeholder="000000" maxlength="6" style="width: 100%; padding: 0.85rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1.25rem; letter-spacing: 0.5em; text-align: center; font-family: monospace; outline: none; margin-bottom: 1rem;" />
            
            <div id="2fa-error" style="display: none; background: #fff0f0; border-left: 4px solid #ff4444; color: #cc0000; padding: 0.75rem; border-radius: 4px; font-size: 0.85rem; margin-bottom: 1rem;"></div>
            <div id="2fa-success" style="display: none; background: #f0fff0; border-left: 4px solid #69df5e; color: #006600; padding: 0.75rem; border-radius: 4px; font-size: 0.85rem; margin-bottom: 1rem;">2FA enabled successfully! Redirecting...</div>

            <button id="enable-2fa-btn" style="width: 100%; padding: 0.875rem; background: #69df5e; color: #003a03; border: none; border-radius: 6px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s;">
              Enable 2FA
            </button>
          </div>
          
        </div>

        <div style="margin-top: 1.5rem; border-top: 1px solid #eee; padding-top: 1.5rem;">
          <a href="#/" style="color: #999; font-size: 0.9rem; text-decoration: none; font-weight: 600;">Set up later</a>
        </div>

      </div>
    </div>
  `;

  let factorId = null;

  try {
    const { data: enrollData, error: enrollError } = await supabase.auth.mfa.enroll({
      factorType: 'totp',
      friendlyName: 'XVI Snooker Club'
    });

    if (enrollError) throw enrollError;

    document.getElementById('2fa-loading').style.display = 'none';
    document.getElementById('2fa-content').style.display = 'block';

    const totpUri = enrollData.totp.uri;
    const secret = enrollData.totp.secret;
    factorId = enrollData.id;

    // Use QR Server API to generate a real scannable QR image
    const qrImageUrl = 
      'https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' 
      + encodeURIComponent(totpUri);

    // Display the QR code
    document.getElementById('qr-code-img').src = qrImageUrl;
    document.getElementById('totp-secret').textContent = secret;
    document.getElementById('factor-id').value = factorId;

  } catch (err) {
    document.getElementById('2fa-loading').innerHTML = `
      <div style="color: #ff4444; text-align: center;">
        <p>Failed to initialize 2FA setup.</p>
        <p style="font-size: 0.85rem;">${err.message}</p>
      </div>`
    ;
    console.error('MFA Enrollment error:', err);
  }

  const btn = document.getElementById('enable-2fa-btn');
  const codeInput = document.getElementById('verify-code-input');
  const errBox = document.getElementById('2fa-error');
  const succBox = document.getElementById('2fa-success');

  btn.addEventListener('click', async () => {
    const code = codeInput.value.trim();
    if (code.length !== 6) {
      errBox.textContent = 'Please enter a valid 6-digit code';
      errBox.style.display = 'block';
      return;
    }

    errBox.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = 'Verifying...';

    try {
      const challengeResponse = await supabase.auth.mfa.challenge({ factorId });
      if (challengeResponse.error) throw challengeResponse.error;

      const challengeId = challengeResponse.data.id;

      const verifyResponse = await supabase.auth.mfa.verify({
        factorId,
        challengeId,
        code
      });

      if (verifyResponse.error) throw verifyResponse.error;

      succBox.style.display = 'block';
      btn.style.display = 'none';

      setTimeout(() => {
        router.navigate('/account');
      }, 1500);

    } catch (err) {
      errBox.textContent = err.message || 'Verification failed. Please check the code and try again.';
      errBox.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = 'Enable 2FA';
      codeInput.value = '';
      codeInput.focus();
    }
  });

  // Automatically trigger button if user types 6 characters and hits Enter
  codeInput.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      btn.click();
    }
  });
}
