import { signIn, signInWithGoogle, updatePassword, getSession } from '../lib/auth.js';
import { supabase } from '../lib/supabase.js';
import { router } from '../lib/router.js';

export async function renderLoginPage(app) {
  // Use a dedicated dark green background with a centered white card
  app.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #0a1f0a; padding: 1rem; font-family: 'Manrope', sans-serif;">
      <div style="background: white; border-radius: 12px; padding: 2.5rem 2rem; width: 100%; max-width: 420px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
        
        <!-- Logo / Name -->
        <div style="text-align: center; margin-bottom: 2rem;">
          <h1 style="font-family: 'Noto Serif', serif; color: #c9a84c; font-size: 2.5rem; margin: 0; line-height: 1;">XVI</h1>
        </div>
        
        <!-- Headers -->
        <div style="text-align: center; margin-bottom: 2rem;">
          <h2 style="color: #1a1a1a; font-size: 1.5rem; margin: 0 0 0.5rem 0; font-weight: 700;">Welcome Back</h2>
          <p style="color: #666; margin: 0; font-size: 0.95rem;">Sign in to your account</p>
        </div>

        <form id="login-form" style="display: flex; flex-direction: column; gap: 1.25rem;">
          
          <!-- Error Alert (hidden by default) -->
          <div id="login-error" style="display: none; background: #fff0f0; border-left: 4px solid #ff4444; color: #cc0000; padding: 0.75rem; border-radius: 4px; font-size: 0.85rem;"></div>

          <!-- Email Input -->
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label for="login-email" style="color: #333; font-size: 0.85rem; font-weight: 600;">Email Address</label>
            <input type="email" id="login-email" placeholder="you@example.com" required
                   style="width: 100%; padding: 0.85rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; color: #333; outline: none; transition: border-color 0.2s;" />
          </div>

          <!-- Password Input -->
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label for="login-password" style="color: #333; font-size: 0.85rem; font-weight: 600;">Password</label>
            <div style="position: relative;">
              <input type="password" id="login-password" placeholder="Enter your password" required
                     style="width: 100%; padding: 0.85rem; padding-right: 2.5rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; color: #333; outline: none; transition: border-color 0.2s;" />
              <button type="button" id="toggle-password" style="position: absolute; right: 0.75rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #999;">
                <span class="material-symbols-outlined" style="font-size: 1.25rem;" id="eye-icon">visibility_off</span>
              </button>
            </div>
          </div>

          <!-- Forgot Password Link -->
          <div style="text-align: right; margin-top: -0.5rem;">
            <a href="#/forgot-password" style="color: #69df5e; font-size: 0.85rem; font-weight: 600; text-decoration: none;">Forgot your password?</a>
          </div>

          <!-- Sign In Button -->
          <button type="submit" id="login-submit-btn" 
                  style="width: 100%; padding: 0.875rem; background: #69df5e; color: #003a03; border: none; border-radius: 6px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-top: 0.5rem;">
            Sign In
          </button>
        </form>

        <!-- Divider -->
        <div style="display: flex; align-items: center; margin: 1.5rem 0; color: #999;">
          <div style="flex: 1; height: 1px; background: #eee;"></div>
          <span style="padding: 0 1rem; font-size: 0.8rem; text-transform: uppercase;">or continue with</span>
          <div style="flex: 1; height: 1px; background: #eee;"></div>
        </div>

        <!-- Google Button -->
        <button id="google-signin-btn" 
                style="width: 100%; padding: 0.875rem; background: white; color: #333; border: 1px solid #ddd; border-radius: 6px; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: background 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <!-- Bottom Link -->
        <div style="text-align: center; margin-top: 2rem;">
          <p style="margin: 0; color: #666; font-size: 0.9rem;">
            Don't have an account? 
            <a href="#/signup" style="color: #69df5e; font-weight: 700; text-decoration: none;">Sign up</a>
          </p>
        </div>

      </div>
    </div>
  `;

  setupLoginHandlers();
}

function setupLoginHandlers() {
  const form = document.getElementById('login-form');
  const errorAlert = document.getElementById('login-error');
  const submitBtn = document.getElementById('login-submit-btn');
  const googleBtn = document.getElementById('google-signin-btn');
  const togglePassword = document.getElementById('toggle-password');
  const passwordInput = document.getElementById('login-password');
  const eyeIcon = document.getElementById('eye-icon');

  // Input focus styles (simulated via JS since styles are inline)
  const inputs = document.querySelectorAll('#login-form input');
  inputs.forEach(input => {
    input.addEventListener('focus', () => {
      input.style.borderColor = '#69df5e';
    });
    input.addEventListener('blur', () => {
      input.style.borderColor = '#ddd';
    });
  });

  // Toggle Password
  togglePassword.addEventListener('click', () => {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      eyeIcon.textContent = 'visibility';
    } else {
      passwordInput.type = 'password';
      eyeIcon.textContent = 'visibility_off';
    }
  });

  // Google Sign In
  googleBtn.addEventListener('click', async () => {
    try {
      googleBtn.disabled = true;
      googleBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;border-top-color:#333;border-right-color:#ccc;border-bottom-color:#ccc;border-left-color:#ccc;"></span> Redirecting...';
      await signInWithGoogle();
    } catch (err) {
      errorAlert.textContent = err.message || 'Google sign in failed';
      errorAlert.style.display = 'block';
      googleBtn.disabled = false;
      googleBtn.innerHTML = 'Continue with Google';
    }
  });

  // Email Sign In
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorAlert.style.display = 'none';
    
    const email = document.getElementById('login-email').value;
    const password = passwordInput.value;

    if (!email || !password) {
      errorAlert.textContent = 'Please fill in all fields.';
      errorAlert.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;border-top-color:#003a03;border-right-color:rgba(0,58,3,0.3);border-bottom-color:rgba(0,58,3,0.3);border-left-color:rgba(0,58,3,0.3);"></span> Signing In...';

    try {
      await signIn(email, password);

      // One-time membership prompt (only if not already a member)
      const { isMember: checkMember } = await import('../utils/membershipUtils.js');
      if (!checkMember() && !sessionStorage.getItem('mbr_prompt_dismissed')) {
        const banner = document.createElement('div');
        banner.id = 'mbr-login-banner';
        banner.style.cssText = 'position:fixed;bottom:1.5rem;left:50%;transform:translateX(-50%);background:#1a1a1a;border:1px solid #d4af37;border-radius:10px;padding:1rem 1.5rem;display:flex;align-items:center;gap:1rem;z-index:9999;max-width:480px;width:90%;box-shadow:0 8px 32px rgba(0,0,0,0.5);font-family:Manrope,sans-serif;';
        banner.innerHTML = '<span style="color:#d4af37;font-size:0.9rem;flex:1;">🎱 <strong>Save on every booking</strong> — subscribe to a membership plan</span><a href="#/membership" style="color:#d4af37;font-weight:700;font-size:0.8rem;text-decoration:none;white-space:nowrap;border:1px solid #d4af37;padding:0.375rem 0.75rem;border-radius:6px;">View Plans</a><button onclick="document.getElementById(\'mbr-login-banner\').remove();sessionStorage.setItem(\'mbr_prompt_dismissed\',\'1\')" style="background:none;border:none;color:#666;cursor:pointer;font-size:1.1rem;line-height:1;padding:0;">&times;</button>';
        document.body.appendChild(banner);
        setTimeout(() => banner?.remove(), 8000);
      }

      router.navigate('/');
    } catch (err) {
      errorAlert.textContent = err.message || 'Invalid email or password';
      errorAlert.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Sign In';
    }
  });
}

// ══════════════════════════════════════════════════════════
// SIGNUP PAGE
// ══════════════════════════════════════════════════════════
import { signUp } from '../lib/auth.js';

export async function renderSignupPage(app) {
  app.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #0a1f0a; padding: 2rem 1rem; font-family: 'Manrope', sans-serif;">
      <div style="background: white; border-radius: 12px; padding: 2.5rem 2rem; width: 100%; max-width: 420px; box-shadow: 0 10px 40px rgba(0,0,0,0.5);">
        
        <div style="text-align: center; margin-bottom: 2rem;">
          <h1 style="font-family: 'Noto Serif', serif; color: #c9a84c; font-size: 2.5rem; margin: 0; line-height: 1;">XVI</h1>
        </div>
        
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <h2 style="color: #1a1a1a; font-size: 1.5rem; margin: 0 0 0.5rem 0; font-weight: 700;">Create Account</h2>
          <p style="color: #666; margin: 0; font-size: 0.95rem;">Join XVI and start booking</p>
        </div>

        <form id="signup-form" style="display: flex; flex-direction: column; gap: 1rem;">
          <div id="signup-error" style="display: none; background: #fff0f0; border-left: 4px solid #ff4444; color: #cc0000; padding: 0.75rem; border-radius: 4px; font-size: 0.85rem;"></div>
          <div id="signup-success" style="display: none; background: #f0fff0; border-left: 4px solid #69df5e; color: #006600; padding: 0.75rem; border-radius: 4px; font-size: 0.85rem;">
            Account created! Please check your email to verify your account.
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <label for="reg-name" style="color: #333; font-size: 0.8rem; font-weight: 600;">Full Name</label>
            <input type="text" id="reg-name" placeholder="John Doe" required style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.95rem; outline: none;"/>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <label for="reg-email" style="color: #333; font-size: 0.8rem; font-weight: 600;">Email Address</label>
            <input type="email" id="reg-email" placeholder="you@example.com" required style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.95rem; outline: none;"/>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <label for="reg-phone" style="color: #333; font-size: 0.8rem; font-weight: 600;">Phone Number</label>
            <input type="tel" id="reg-phone" placeholder="+234 808 794 8773" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.95rem; outline: none;"/>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <label for="reg-password" style="color: #333; font-size: 0.8rem; font-weight: 600;">Password</label>
            <div style="position: relative;">
              <input type="password" id="reg-password" placeholder="Min 6 characters" required minlength="6" style="width: 100%; padding: 0.75rem; padding-right: 2.5rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.95rem; outline: none;"/>
              <button type="button" id="toggle-reg-password" style="position: absolute; right: 0.5rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #999;">
                <span class="material-symbols-outlined" style="font-size: 1.1rem;" id="reg-eye-icon">visibility_off</span>
              </button>
            </div>
            <!-- Strength Indicator -->
            <div style="display: flex; gap: 4px; margin-top: 4px;">
              <div id="strength-1" style="height: 4px; flex: 1; background: #eee; border-radius: 2px; transition: background 0.3s;"></div>
              <div id="strength-2" style="height: 4px; flex: 1; background: #eee; border-radius: 2px; transition: background 0.3s;"></div>
              <div id="strength-3" style="height: 4px; flex: 1; background: #eee; border-radius: 2px; transition: background 0.3s;"></div>
            </div>
            <div id="strength-text" style="font-size: 0.7rem; color: #999; text-align: right;"></div>
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.25rem;">
            <label for="reg-confirm" style="color: #333; font-size: 0.8rem; font-weight: 600;">Confirm Password</label>
            <input type="password" id="reg-confirm" placeholder="Repeat password" required style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.95rem; outline: none;"/>
          </div>

          <button type="submit" id="signup-submit-btn" style="width: 100%; padding: 0.875rem; background: #69df5e; color: #003a03; border: none; border-radius: 6px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-top: 0.5rem;">
            Create Account
          </button>
        </form>

        <div style="display: flex; align-items: center; margin: 1.25rem 0; color: #999;">
          <div style="flex: 1; height: 1px; background: #eee;"></div>
          <span style="padding: 0 1rem; font-size: 0.8rem; text-transform: uppercase;">or continue with</span>
          <div style="flex: 1; height: 1px; background: #eee;"></div>
        </div>

        <button id="google-signup-btn" style="width: 100%; padding: 0.875rem; background: white; color: #333; border: 1px solid #ddd; border-radius: 6px; font-size: 0.95rem; font-weight: 600; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.75rem;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Sign up with Google
        </button>

        <div style="text-align: center; margin-top: 1.5rem;">
          <p style="margin: 0; color: #666; font-size: 0.9rem;">
            Already have an account? 
            <a href="#/login" style="color: #69df5e; font-weight: 700; text-decoration: none;">Sign in</a>
          </p>
        </div>

      </div>
    </div>
  `;

  setupSignupHandlers();
}

function setupSignupHandlers() {
  const form = document.getElementById('signup-form');
  const errorAlert = document.getElementById('signup-error');
  const successAlert = document.getElementById('signup-success');
  const submitBtn = document.getElementById('signup-submit-btn');
  const googleBtn = document.getElementById('google-signup-btn');
  const togglePassword = document.getElementById('toggle-reg-password');
  const passwordInput = document.getElementById('reg-password');
  const eyeIcon = document.getElementById('reg-eye-icon');
  
  const s1 = document.getElementById('strength-1');
  const s2 = document.getElementById('strength-2');
  const s3 = document.getElementById('strength-3');
  const sText = document.getElementById('strength-text');

  passwordInput.addEventListener('input', (e) => {
    const val = e.target.value;
    if (val.length === 0) {
      s1.style.background = '#eee'; s2.style.background = '#eee'; s3.style.background = '#eee'; sText.textContent = '';
    } else if (val.length < 6) {
      s1.style.background = '#ff4444'; s2.style.background = '#eee'; s3.style.background = '#eee'; sText.textContent = 'Weak'; sText.style.color = '#ff4444';
    } else if (val.length < 10) {
      s1.style.background = '#ffbb33'; s2.style.background = '#ffbb33'; s3.style.background = '#eee'; sText.textContent = 'Fair'; sText.style.color = '#ffbb33';
    } else {
      s1.style.background = '#00C851'; s2.style.background = '#00C851'; s3.style.background = '#00C851'; sText.textContent = 'Strong'; sText.style.color = '#00C851';
    }
  });

  togglePassword.addEventListener('click', () => {
    if (passwordInput.type === 'password') {
      passwordInput.type = 'text';
      eyeIcon.textContent = 'visibility';
    } else {
      passwordInput.type = 'password';
      eyeIcon.textContent = 'visibility_off';
    }
  });

  googleBtn.addEventListener('click', async () => {
    try {
      googleBtn.disabled = true;
      await signInWithGoogle();
    } catch (err) {
      errorAlert.textContent = err.message;
      errorAlert.style.display = 'block';
      googleBtn.disabled = false;
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    errorAlert.style.display = 'none';
    successAlert.style.display = 'none';
    
    const name = document.getElementById('reg-name').value;
    const email = document.getElementById('reg-email').value;
    const phone = document.getElementById('reg-phone').value;
    const password = passwordInput.value;
    const confirm = document.getElementById('reg-confirm').value;

    if (password !== confirm) {
      errorAlert.textContent = 'Passwords do not match.';
      errorAlert.style.display = 'block';
      return;
    }

    submitBtn.disabled = true;
    submitBtn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;border-top-color:#003a03;border-right-color:rgba(0,58,3,0.3);border-bottom-color:rgba(0,58,3,0.3);border-left-color:rgba(0,58,3,0.3);"></span> Creating...';

    try {
      // Pass the name and phone via metadata
      const emailRedirectTo = window.location.origin + '/#/auth/callback';
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: name, phone: phone },
          emailRedirectTo
        }
      });
      if (error) throw error;
      
      // Show success
      successAlert.style.display = 'block';
      form.reset();
      submitBtn.style.display = 'none';
      setTimeout(() => {
        router.navigate('/verify-email');
      }, 2000);
      
    } catch (err) {
      errorAlert.textContent = err.message || 'Registration failed';
      errorAlert.style.display = 'block';
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Create Account';
    }
  });
}

// ══════════════════════════════════════════════════════════
// VERIFY EMAIL PAGE
// ══════════════════════════════════════════════════════════
import { resendVerification } from '../lib/auth.js';

export async function renderVerifyEmailPage(app) {
  app.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #0a1f0a; padding: 1rem; font-family: 'Manrope', sans-serif;">
      <div style="background: white; border-radius: 12px; padding: 3rem 2rem; width: 100%; max-width: 420px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); text-align: center;">
        
        <span class="material-symbols-outlined" style="font-size: 4rem; color: #c9a84c; margin-bottom: 1rem;">mark_email_read</span>
        
        <h2 style="color: #1a1a1a; font-size: 1.75rem; margin: 0 0 1rem 0; font-weight: 700;">Check Your Email</h2>
        
        <p style="color: #666; font-size: 0.95rem; margin-bottom: 1rem; line-height: 1.5;">
          We sent a verification link to your email address. Click the link in the email to activate your account.
        </p>

        <p style="color: #999; font-size: 0.8rem; margin-bottom: 2rem;">
          Didn't receive it? Check your spam folder.
        </p>

        <div id="resend-success" style="display: none; color: #00C851; font-weight: 600; font-size: 0.9rem; margin-bottom: 1rem;">
          Email sent!
        </div>
        
        <div id="resend-error" style="display: none; color: #ff4444; font-weight: 600; font-size: 0.9rem; margin-bottom: 1rem;"></div>

        <div style="display: flex; flex-direction: column; gap: 0.5rem; align-items: center;">
            <input type="email" id="verify-email" placeholder="Enter your email" style="width: 100%; padding: 0.75rem; border: 1px solid #ddd; border-radius: 6px; font-size: 0.9rem; outline: none; margin-bottom: 0.5rem;" />
            <button id="resend-btn" style="width: 100%; padding: 0.75rem; background: transparent; color: #69df5e; border: 1px solid #69df5e; border-radius: 6px; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: background 0.2s;">
              Resend Verification Email
            </button>
        </div>

        <div style="margin-top: 2rem;">
          <a href="#/login" style="color: #666; font-size: 0.9rem; text-decoration: none; font-weight: 600;">← Back to login</a>
        </div>

      </div>
    </div>
  `;

  document.getElementById('resend-btn')?.addEventListener('click', async (e) => {
    const btn = e.target;
    const email = document.getElementById('verify-email').value;
    const err = document.getElementById('resend-error');
    const succ = document.getElementById('resend-success');
    
    err.style.display = 'none';
    succ.style.display = 'none';

    if (!email) {
      err.textContent = 'Please enter your email';
      err.style.display = 'block';
      return;
    }

    btn.disabled = true;
    btn.innerHTML = 'Sending...';

    try {
      await resendVerification(email);
      succ.style.display = 'block';
    } catch (error) {
      err.textContent = error.message;
      err.style.display = 'block';
    }
    
    btn.disabled = false;
    btn.innerHTML = 'Resend Verification Email';
  });
}

// ══════════════════════════════════════════════════════════
// FORGOT PASSWORD PAGE
// ══════════════════════════════════════════════════════════
import { resetPasswordForEmail } from '../lib/auth.js';

export async function renderForgotPasswordPage(app) {
  app.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #0a1f0a; padding: 1rem; font-family: 'Manrope', sans-serif;">
      <div style="background: white; border-radius: 12px; padding: 3rem 2rem; width: 100%; max-width: 420px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); text-align: center;">
        
        <span class="material-symbols-outlined" style="font-size: 4rem; color: #c9a84c; margin-bottom: 1rem;">lock_reset</span>
        
        <h2 style="color: #1a1a1a; font-size: 1.75rem; margin: 0 0 1rem 0; font-weight: 700;">Reset Password</h2>
        
        <p style="color: #666; font-size: 0.95rem; margin-bottom: 2rem; line-height: 1.5;">
          Enter your email and we'll send you a reset link.
        </p>

        <form id="forgot-form" style="display: flex; flex-direction: column; gap: 1rem;">
          <div id="forgot-error" style="display: none; background: #fff0f0; border-left: 4px solid #ff4444; color: #cc0000; padding: 0.75rem; border-radius: 4px; font-size: 0.85rem; text-align: left;"></div>
          <div id="forgot-success" style="display: none; background: #f0fff0; border-left: 4px solid #69df5e; color: #006600; padding: 0.75rem; border-radius: 4px; font-size: 0.85rem; text-align: left;">
            Reset link sent! Check your email.
          </div>

          <input type="email" id="forgot-email" placeholder="you@example.com" required style="width: 100%; padding: 0.85rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; outline: none;" />

          <button type="submit" id="forgot-btn" style="width: 100%; padding: 0.875rem; background: #69df5e; color: #003a03; border: none; border-radius: 6px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s;">
            Send Reset Link
          </button>
        </form>

        <div style="margin-top: 2rem;">
          <a href="#/login" style="color: #666; font-size: 0.9rem; text-decoration: none; font-weight: 600;">← Back to login</a>
        </div>

      </div>
    </div>
  `;

  document.getElementById('forgot-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('forgot-btn');
    const email = document.getElementById('forgot-email').value;
    const err = document.getElementById('forgot-error');
    const succ = document.getElementById('forgot-success');
    
    err.style.display = 'none';
    succ.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = 'Sending...';

    try {
      await resetPasswordForEmail(email);
      succ.style.display = 'block';
    } catch (error) {
      err.textContent = error.message;
      err.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = 'Send Reset Link';
    }
  });
}

// ══════════════════════════════════════════════════════════
// RESET PASSWORD PAGE
// ══════════════════════════════════════════════════════════
export async function renderResetPasswordPage(app) {
  app.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #0a1f0a; padding: 1rem; font-family: 'Manrope', sans-serif;">
      <div style="background: white; border-radius: 12px; padding: 3rem 2rem; width: 100%; max-width: 420px; box-shadow: 0 10px 40px rgba(0,0,0,0.5); text-align: center;">
        
        <span class="material-symbols-outlined" style="font-size: 4rem; color: #c9a84c; margin-bottom: 1rem;">password</span>
        
        <h2 style="color: #1a1a1a; font-size: 1.75rem; margin: 0 0 1rem 0; font-weight: 700;">Set New Password</h2>
        
        <p style="color: #666; font-size: 0.95rem; margin-bottom: 2rem; line-height: 1.5;">
          Please enter your new password below.
        </p>

        <form id="reset-form" style="display: flex; flex-direction: column; gap: 1rem;">
          <div id="reset-error" style="display: none; background: #fff0f0; border-left: 4px solid #ff4444; color: #cc0000; padding: 0.75rem; border-radius: 4px; font-size: 0.85rem; text-align: left;"></div>
          <div id="reset-success" style="display: none; background: #f0fff0; border-left: 4px solid #69df5e; color: #006600; padding: 0.75rem; border-radius: 4px; font-size: 0.85rem; text-align: left;">
            Password successfully updated! Redirecting to login...
          </div>

          <div style="display: flex; flex-direction: column; gap: 0.25rem; text-align: left;">
            <label for="new-password" style="color: #333; font-size: 0.8rem; font-weight: 600;">New Password</label>
            <input type="password" id="new-password" placeholder="Min 6 characters" required minlength="6" style="width: 100%; padding: 0.85rem; border: 1px solid #ddd; border-radius: 6px; font-size: 1rem; outline: none;" />
          </div>

          <button type="submit" id="reset-btn" style="width: 100%; padding: 0.875rem; background: #69df5e; color: #003a03; border: none; border-radius: 6px; font-size: 1rem; font-weight: 700; cursor: pointer; transition: opacity 0.2s; margin-top: 0.5rem;">
            Update Password
          </button>
        </form>
      </div>
    </div>
  `;

  document.getElementById('reset-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = document.getElementById('reset-btn');
    const newPassword = document.getElementById('new-password').value;
    const err = document.getElementById('reset-error');
    const succ = document.getElementById('reset-success');
    
    err.style.display = 'none';
    succ.style.display = 'none';
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner" style="width:16px;height:16px;border-width:2px;border-top-color:#003a03;border-right-color:rgba(0,58,3,0.3);border-bottom-color:rgba(0,58,3,0.3);border-left-color:rgba(0,58,3,0.3);"></span> Updating...';

    try {
      await updatePassword(newPassword);
      succ.style.display = 'block';
      setTimeout(() => {
        router.navigate('/login');
      }, 2500);
    } catch (error) {
      err.textContent = error.message;
      err.style.display = 'block';
      btn.disabled = false;
      btn.innerHTML = 'Update Password';
    }
  });
}

// ══════════════════════════════════════════════════════════
// AUTH CALLBACK PAGE
// ══════════════════════════════════════════════════════════
export async function renderAuthCallbackPage(app) {
  app.innerHTML = `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #0a1f0a; padding: 1rem; font-family: 'Manrope', sans-serif;">
      <div style="text-align: center; color: white;">
        <span class="spinner" style="width:32px;height:32px;border-width:3px;border-top-color:#c9a84c;border-right-color:rgba(201,168,76,0.3);border-bottom-color:rgba(201,168,76,0.3);border-left-color:rgba(201,168,76,0.3);margin:0 auto 1rem;"></span>
        <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem; color: #c9a84c;">Authenticating</h2>
        <p style="color: #9fc99f;">Please wait while we verify your session...</p>
      </div>
    </div>
  `;

  const ADMIN_EMAILS = [
    'xviigames101@gmail.com',
    'riveramoses555@gmail.com',
    import.meta.env.VITE_ADMIN_EMAIL,
    import.meta.env.VITE_ADMIN_EMAIL_2
  ].filter(Boolean);

  function redirectAfterAuth(session) {
    if (!session) {
      router.navigate('/login');
      return;
    }
    const isAdmin = ADMIN_EMAILS.includes(session.user.email);
    if (isAdmin) {
      sessionStorage.setItem('adminAuth', 'true');
      router.navigate('/admin');
    } else {
      router.navigate('/');
    }
  }

  // Strategy 1: listen for the auth state change event (catches async token exchange)
  let handled = false;
  const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
    if (handled) return;
    if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED' || event === 'PASSWORD_RECOVERY') {
      handled = true;
      subscription.unsubscribe();
      redirectAfterAuth(session);
    }
  });

  // Strategy 2: check if session already exists right now (covers cases where
  // SIGNED_IN already fired before this page rendered)
  try {
    const { data: { session } } = await supabase.auth.getSession();
    if (session && !handled) {
      handled = true;
      subscription.unsubscribe();
      redirectAfterAuth(session);
      return;
    }
  } catch (e) {
    console.warn('getSession check failed:', e.message);
  }

  // Strategy 3: safety timeout — if nothing fires in 5s, go to login
  setTimeout(() => {
    if (!handled) {
      handled = true;
      subscription.unsubscribe();
      console.warn('Auth callback timed out — no session detected');
      router.navigate('/login');
    }
  }, 5000);
}
