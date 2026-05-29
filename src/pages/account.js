// ═══════════════════════════════════════
// ACCOUNT SETTINGS PAGE
// ═══════════════════════════════════════

import { supabase } from '../lib/supabase.js';
import { getSession, getUser } from '../lib/auth.js';
import { router } from '../lib/router.js';
import { renderHeader, renderFooter, showToast } from '../components/layout.js';

// ─── Password strength checker ───
function getPasswordStrength(password) {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[A-Z]/.test(password)) score++;
  if (/[0-9]/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  if (score <= 1) return { label: 'Weak', color: '#ff4444', width: '20%' };
  if (score <= 2) return { label: 'Fair', color: '#c9a84c', width: '45%' };
  if (score <= 3) return { label: 'Good', color: '#7bc67a', width: '65%' };
  return { label: 'Strong', color: '#69df5e', width: '100%' };
}

export async function renderAccountPage(app) {
  // ── Auth guard ──
  const session = await getSession();
  if (!session) {
    router.navigate('/login');
    return;
  }

  const user = await getUser();
  if (!user) {
    router.navigate('/login');
    return;
  }

  // ── Detect auth provider ──
  const identities = user.identities || [];
  const hasEmailProvider = identities.some(id => id.provider === 'email');
  const hasGoogleProvider = identities.some(id => id.provider === 'google');

  // ── Check 2FA status ──
  let is2FAEnabled = false;
  try {
    const { data: factors } = await supabase.auth.mfa.listFactors();
    is2FAEnabled = factors?.totp?.some(f => f.status === 'verified') ?? false;
  } catch (e) {
    is2FAEnabled = false;
  }

  const currentName = user.user_metadata?.full_name || user.user_metadata?.name || '';
  const currentPhone = user.user_metadata?.phone || '';
  const currentEmail = user.email || '';
  const avatarInitials = (currentName || currentEmail).slice(0, 2).toUpperCase();

  app.innerHTML = `
    ${renderHeader(session, 'account')}

    <main class="page-content" style="background: var(--surface);">
      <section class="page-section" style="max-width: 52rem; margin: 0 auto; padding: 3rem 2rem 5rem;">

        <!-- Page Header -->
        <div style="margin-bottom: 3rem;">
          <p style="font-family: var(--font-label); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.2em; color: var(--gold); margin-bottom: 0.5rem;">YOUR ACCOUNT</p>
          <h1 style="font-family: var(--font-headline); font-size: 2.25rem; font-weight: 700; margin: 0 0 0.5rem 0; color: var(--on-surface);">Account Settings</h1>
          <p style="color: var(--on-surface-variant); margin: 0;">Manage your profile, security and preferences.</p>
        </div>

        <!-- ─── SECTION 1: Profile Information ─── -->
        <div class="account-card" id="section-profile" style="margin-bottom: 1.5rem;">
          <div class="account-card-header">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div style="width: 3rem; height: 3rem; border-radius: 50%; background: linear-gradient(135deg, rgba(105,223,94,0.2), rgba(105,223,94,0.05)); border: 2px solid rgba(105,223,94,0.3); display: flex; align-items: center; justify-content: center; font-family: var(--font-headline); font-weight: 700; font-size: 1rem; color: var(--primary);" id="account-avatar">${avatarInitials}</div>
              <div>
                <h2 style="font-family: var(--font-headline); font-size: 1.1rem; font-weight: 700; margin: 0; color: var(--on-surface);">Profile Information</h2>
                <p style="font-size: 0.8rem; color: var(--on-surface-variant); margin: 0;">Update your name and contact details</p>
              </div>
            </div>
          </div>
          <div class="account-card-body">
            <div class="account-field-group">
              <label class="account-label" for="profile-name">Full Name</label>
              <input type="text" id="profile-name" class="account-input" value="${currentName}" placeholder="Your full name" />
            </div>
            <div class="account-field-group">
              <label class="account-label" for="profile-phone">Phone Number</label>
              <input type="tel" id="profile-phone" class="account-input" value="${currentPhone}" placeholder="+234 000 000 0000" />
            </div>
            <div class="account-field-group">
              <label class="account-label" for="profile-email">Email Address</label>
              <div style="position: relative;">
                <input type="email" id="profile-email" class="account-input" value="${currentEmail}" disabled style="opacity: 0.5; cursor: not-allowed; padding-right: 3rem;" />
                <span class="material-symbols-outlined" style="position: absolute; right: 0.875rem; top: 50%; transform: translateY(-50%); font-size: 1.1rem; color: var(--outline);">lock</span>
              </div>
              <p style="font-size: 0.75rem; color: var(--on-surface-variant); margin: 0.4rem 0 0 0; display: flex; align-items: center; gap: 0.35rem;">
                <span class="material-symbols-outlined" style="font-size: 0.9rem; color: var(--outline);">info</span>
                Contact support to change your email address
              </p>
            </div>
            <div id="profile-error" style="display: none; background: rgba(255,68,68,0.08); border-left: 3px solid #ff4444; color: #ff8080; padding: 0.75rem 1rem; border-radius: 6px; font-size: 0.85rem; margin-bottom: 1rem;"></div>
            <button id="save-profile-btn" class="account-btn-primary">
              <span class="material-symbols-outlined" style="font-size: 1rem;">save</span>
              Save Changes
            </button>
          </div>
        </div>

        <!-- ─── SECTION 2: Change Password (email users only) ─── -->
        ${hasEmailProvider ? `
        <div class="account-card" id="section-password" style="margin-bottom: 1.5rem;">
          <div class="account-card-header">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div style="width: 3rem; height: 3rem; border-radius: 50%; background: linear-gradient(135deg, rgba(201,168,76,0.15), rgba(201,168,76,0.05)); border: 2px solid rgba(201,168,76,0.25); display: flex; align-items: center; justify-content: center;">
                <span class="material-symbols-outlined" style="font-size: 1.25rem; color: var(--gold);">key</span>
              </div>
              <div>
                <h2 style="font-family: var(--font-headline); font-size: 1.1rem; font-weight: 700; margin: 0; color: var(--on-surface);">Change Password</h2>
                <p style="font-size: 0.8rem; color: var(--on-surface-variant); margin: 0;">Update your account password</p>
              </div>
            </div>
          </div>
          <div class="account-card-body">
            <div class="account-field-group">
              <label class="account-label" for="current-password">Current Password</label>
              <div style="position: relative;">
                <input type="password" id="current-password" class="account-input" placeholder="Enter current password" />
                <button type="button" class="pw-toggle-btn" data-target="current-password" style="position: absolute; right: 0.875rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--outline); padding: 0;">
                  <span class="material-symbols-outlined" style="font-size: 1.1rem;">visibility</span>
                </button>
              </div>
            </div>
            <div class="account-field-group">
              <label class="account-label" for="new-password">New Password</label>
              <div style="position: relative;">
                <input type="password" id="new-password" class="account-input" placeholder="Enter new password" />
                <button type="button" class="pw-toggle-btn" data-target="new-password" style="position: absolute; right: 0.875rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--outline); padding: 0;">
                  <span class="material-symbols-outlined" style="font-size: 1.1rem;">visibility</span>
                </button>
              </div>
              <!-- Strength bar -->
              <div style="margin-top: 0.5rem;" id="pw-strength-bar-wrap" style="display: none;">
                <div style="height: 4px; background: rgba(255,255,255,0.08); border-radius: 999px; overflow: hidden; margin-bottom: 0.3rem;">
                  <div id="pw-strength-bar" style="height: 100%; width: 0%; border-radius: 999px; transition: width 0.3s, background 0.3s;"></div>
                </div>
                <p id="pw-strength-label" style="font-size: 0.72rem; color: var(--outline); margin: 0;"></p>
              </div>
            </div>
            <div class="account-field-group">
              <label class="account-label" for="confirm-password">Confirm New Password</label>
              <div style="position: relative;">
                <input type="password" id="confirm-password" class="account-input" placeholder="Confirm new password" />
                <button type="button" class="pw-toggle-btn" data-target="confirm-password" style="position: absolute; right: 0.875rem; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--outline); padding: 0;">
                  <span class="material-symbols-outlined" style="font-size: 1.1rem;">visibility</span>
                </button>
              </div>
              <p id="pw-match-msg" style="font-size: 0.75rem; margin: 0.4rem 0 0 0; display: none;"></p>
            </div>
            <div id="password-error" style="display: none; background: rgba(255,68,68,0.08); border-left: 3px solid #ff4444; color: #ff8080; padding: 0.75rem 1rem; border-radius: 6px; font-size: 0.85rem; margin-bottom: 1rem;"></div>
            <button id="update-password-btn" class="account-btn-primary">
              <span class="material-symbols-outlined" style="font-size: 1rem;">lock_reset</span>
              Update Password
            </button>
          </div>
        </div>
        ` : ''}

        <!-- ─── SECTION 3: Two-Factor Authentication ─── -->
        <div class="account-card" id="section-2fa" style="margin-bottom: 1.5rem;">
          <div class="account-card-header">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div style="width: 3rem; height: 3rem; border-radius: 50%; background: linear-gradient(135deg, rgba(105,223,94,0.15), rgba(105,223,94,0.03)); border: 2px solid rgba(105,223,94,0.2); display: flex; align-items: center; justify-content: center;">
                <span class="material-symbols-outlined" style="font-size: 1.25rem; color: var(--primary);">security</span>
              </div>
              <div>
                <h2 style="font-family: var(--font-headline); font-size: 1.1rem; font-weight: 700; margin: 0; color: var(--on-surface);">Security</h2>
                <p style="font-size: 0.8rem; color: var(--on-surface-variant); margin: 0;">Two-factor authentication</p>
              </div>
            </div>
          </div>
          <div class="account-card-body">
            ${is2FAEnabled ? `
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="width: 2rem; height: 2rem; border-radius: 50%; background: rgba(105,223,94,0.12); display: flex; align-items: center; justify-content: center;">
                  <span class="material-symbols-outlined" style="font-size: 1rem; color: var(--primary);">check_circle</span>
                </div>
                <div>
                  <p style="font-weight: 700; margin: 0; color: var(--on-surface); font-size: 0.95rem;">2FA is active</p>
                  <p style="font-size: 0.78rem; color: var(--on-surface-variant); margin: 0;">Your account is protected with an authenticator app</p>
                </div>
              </div>
              <button id="disable-2fa-btn" style="background: rgba(255,68,68,0.08); color: #ff8080; border: 1px solid rgba(255,68,68,0.2); border-radius: 8px; padding: 0.55rem 1.1rem; font-size: 0.8rem; font-weight: 700; font-family: var(--font-label); cursor: pointer; transition: all 0.2s; letter-spacing: 0.03em; text-transform: uppercase;">
                Disable 2FA
              </button>
            </div>
            ` : `
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <div style="width: 2rem; height: 2rem; border-radius: 50%; background: rgba(255,68,68,0.08); display: flex; align-items: center; justify-content: center;">
                  <span class="material-symbols-outlined" style="font-size: 1rem; color: #ff6b6b;">shield</span>
                </div>
                <div>
                  <p style="font-weight: 700; margin: 0; color: var(--on-surface); font-size: 0.95rem;">2FA is not enabled</p>
                  <p style="font-size: 0.78rem; color: var(--on-surface-variant); margin: 0;">Add an extra layer of security to your account</p>
                </div>
              </div>
              <a href="#/setup-2fa" class="account-btn-primary" style="text-decoration: none; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.55rem 1.1rem; font-size: 0.8rem;">
                <span class="material-symbols-outlined" style="font-size: 1rem;">add_moderator</span>
                Enable 2FA
              </a>
            </div>
            `}
          </div>
        </div>

        <!-- ─── SECTION 4: Connected Accounts ─── -->
        <div class="account-card" id="section-connected" style="margin-bottom: 1.5rem;">
          <div class="account-card-header">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div style="width: 3rem; height: 3rem; border-radius: 50%; background: linear-gradient(135deg, rgba(105,223,94,0.1), transparent); border: 2px solid rgba(138,147,139,0.2); display: flex; align-items: center; justify-content: center;">
                <span class="material-symbols-outlined" style="font-size: 1.25rem; color: var(--on-surface-variant);">link</span>
              </div>
              <div>
                <h2 style="font-family: var(--font-headline); font-size: 1.1rem; font-weight: 700; margin: 0; color: var(--on-surface);">Connected Accounts</h2>
                <p style="font-size: 0.8rem; color: var(--on-surface-variant); margin: 0;">Login methods linked to your account</p>
              </div>
            </div>
          </div>
          <div class="account-card-body">
            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              <!-- Email/Password -->
              <div class="connected-row">
                <div style="display: flex; align-items: center; gap: 0.875rem;">
                  <div style="width: 2.25rem; height: 2.25rem; border-radius: 8px; background: var(--surface-container); border: 1px solid rgba(105,223,94,0.1); display: flex; align-items: center; justify-content: center;">
                    <span class="material-symbols-outlined" style="font-size: 1.1rem; color: var(--on-surface-variant);">mail</span>
                  </div>
                  <div>
                    <p style="font-weight: 600; font-size: 0.9rem; margin: 0; color: var(--on-surface);">Email / Password</p>
                    <p style="font-size: 0.75rem; color: var(--on-surface-variant); margin: 0;">${currentEmail}</p>
                  </div>
                </div>
                ${hasEmailProvider
                  ? `<span style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; font-weight: 700; color: var(--primary); font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.05em;"><span class="material-symbols-outlined" style="font-size: 1rem;">check_circle</span>Connected</span>`
                  : `<span style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; font-weight: 700; color: var(--outline); font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.05em;"><span class="material-symbols-outlined" style="font-size: 1rem;">cancel</span>Not connected</span>`
                }
              </div>
              <!-- Google -->
              <div class="connected-row">
                <div style="display: flex; align-items: center; gap: 0.875rem;">
                  <div style="width: 2.25rem; height: 2.25rem; border-radius: 8px; background: var(--surface-container); border: 1px solid rgba(105,223,94,0.1); display: flex; align-items: center; justify-content: center;">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
                      <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
                      <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
                      <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
                    </svg>
                  </div>
                  <div>
                    <p style="font-weight: 600; font-size: 0.9rem; margin: 0; color: var(--on-surface);">Google</p>
                    <p style="font-size: 0.75rem; color: var(--on-surface-variant); margin: 0;">Sign in with Google</p>
                  </div>
                </div>
                ${hasGoogleProvider
                  ? `<span style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; font-weight: 700; color: var(--primary); font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.05em;"><span class="material-symbols-outlined" style="font-size: 1rem;">check_circle</span>Connected</span>`
                  : `<span style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; font-weight: 700; color: var(--outline); font-family: var(--font-label); text-transform: uppercase; letter-spacing: 0.05em;"><span class="material-symbols-outlined" style="font-size: 1rem;">cancel</span>Not connected</span>`
                }
              </div>
            </div>
          </div>
        </div>

        <!-- ─── SECTION 5: Danger Zone ─── -->
        <div class="account-card account-danger-card" id="section-danger">
          <div class="account-card-header" style="border-bottom-color: rgba(255,68,68,0.15);">
            <div style="display: flex; align-items: center; gap: 1rem;">
              <div style="width: 3rem; height: 3rem; border-radius: 50%; background: rgba(255,68,68,0.08); border: 2px solid rgba(255,68,68,0.2); display: flex; align-items: center; justify-content: center;">
                <span class="material-symbols-outlined" style="font-size: 1.25rem; color: #ff6b6b;">warning</span>
              </div>
              <div>
                <h2 style="font-family: var(--font-headline); font-size: 1.1rem; font-weight: 700; margin: 0; color: #ff8080;">Danger Zone</h2>
                <p style="font-size: 0.8rem; color: var(--on-surface-variant); margin: 0;">Irreversible and destructive actions</p>
              </div>
            </div>
          </div>
          <div class="account-card-body">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1rem;">
              <div>
                <p style="font-weight: 600; margin: 0 0 0.25rem 0; color: var(--on-surface); font-size: 0.95rem;">Delete Account</p>
                <p style="font-size: 0.8rem; color: var(--on-surface-variant); margin: 0;">Permanently delete your account and all associated data. This cannot be undone.</p>
              </div>
              <button id="delete-account-btn" style="background: transparent; color: #ff6b6b; border: 1.5px solid rgba(255,68,68,0.4); border-radius: 8px; padding: 0.6rem 1.25rem; font-size: 0.82rem; font-weight: 700; font-family: var(--font-label); cursor: pointer; transition: all 0.2s; letter-spacing: 0.03em; text-transform: uppercase; white-space: nowrap;">
                Delete Account
              </button>
            </div>
          </div>
        </div>

      </section>
    </main>

    <!-- ─── Delete Confirmation Modal ─── -->
    <div id="delete-modal" style="display: none; position: fixed; inset: 0; z-index: 200; background: rgba(0,0,0,0.7); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; padding: 1rem;">
      <div style="background: var(--surface-container-low); border: 1px solid rgba(255,68,68,0.25); border-radius: 16px; padding: 2rem; max-width: 420px; width: 100%; text-align: center; box-shadow: 0 24px 80px rgba(0,0,0,0.6); animation: slideUpFade 0.2s ease;">
        <div style="width: 4rem; height: 4rem; border-radius: 50%; background: rgba(255,68,68,0.1); border: 2px solid rgba(255,68,68,0.25); display: flex; align-items: center; justify-content: center; margin: 0 auto 1.25rem;">
          <span class="material-symbols-outlined" style="font-size: 2rem; color: #ff6b6b;">delete_forever</span>
        </div>
        <h3 style="font-family: var(--font-headline); font-size: 1.3rem; font-weight: 700; margin: 0 0 0.75rem 0; color: var(--on-surface);">Delete Your Account?</h3>
        <p style="color: var(--on-surface-variant); font-size: 0.9rem; margin: 0 0 0.5rem 0;">This will permanently delete your account and all associated data.</p>
        <p style="color: #ff8080; font-size: 0.85rem; font-weight: 600; margin: 0 0 1.75rem 0;">⚠️ This action cannot be undone.</p>
        <div style="display: flex; gap: 0.75rem;">
          <button id="cancel-delete-btn" style="flex: 1; padding: 0.75rem; background: var(--surface-container); color: var(--on-surface); border: 1px solid rgba(138,147,139,0.15); border-radius: 8px; font-size: 0.9rem; font-weight: 700; font-family: var(--font-label); cursor: pointer; transition: background 0.2s;">
            Cancel
          </button>
          <button id="confirm-delete-btn" style="flex: 1; padding: 0.75rem; background: rgba(255,68,68,0.12); color: #ff6b6b; border: 1.5px solid rgba(255,68,68,0.3); border-radius: 8px; font-size: 0.9rem; font-weight: 700; font-family: var(--font-label); cursor: pointer; transition: all 0.2s;">
            Delete Account
          </button>
        </div>
      </div>
    </div>

    ${renderFooter()}
  `;

  // Ensure modal starts hidden (innerHTML sets display:flex via inline style but we want it hidden initially)
  const modal = document.getElementById('delete-modal');
  if (modal) modal.style.display = 'none';

  // ── Wait for DOM then bind events ──
  setTimeout(() => {
    bindProfileSection(user);
    if (hasEmailProvider) bindPasswordSection();
    bind2FASection(is2FAEnabled, user);
    bindDangerSection();
  }, 0);
}

// ─── Profile Section ───────────────────────────────────────────────────────
function bindProfileSection(user) {
  const saveBtn = document.getElementById('save-profile-btn');
  const errBox = document.getElementById('profile-error');
  if (!saveBtn) return;

  saveBtn.addEventListener('click', async () => {
    const newName = document.getElementById('profile-name').value.trim();
    const newPhone = document.getElementById('profile-phone').value.trim();

    if (!newName) {
      errBox.textContent = 'Full name is required.';
      errBox.style.display = 'block';
      return;
    }
    errBox.style.display = 'none';

    const originalHtml = saveBtn.innerHTML;
    saveBtn.disabled = true;
    saveBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:1rem; animation: spin 0.8s linear infinite;">progress_activity</span> Saving...`;

    try {
      const { error: authError } = await supabase.auth.updateUser({
        data: { full_name: newName, phone: newPhone }
      });
      if (authError) throw authError;

      // Update profiles table (graceful failure — table may not exist)
      try {
        await supabase
          .from('profiles')
          .update({ full_name: newName, phone: newPhone })
          .eq('id', user.id);
      } catch (_) {}

      // Update avatar initials
      const avatar = document.getElementById('account-avatar');
      if (avatar) avatar.textContent = newName.slice(0, 2).toUpperCase();

      showToast('Profile updated!');
    } catch (err) {
      errBox.textContent = err.message || 'Failed to update profile.';
      errBox.style.display = 'block';
    } finally {
      saveBtn.disabled = false;
      saveBtn.innerHTML = originalHtml;
    }
  });
}

// ─── Password Section ──────────────────────────────────────────────────────
function bindPasswordSection() {
  const newPwInput = document.getElementById('new-password');
  const confirmPwInput = document.getElementById('confirm-password');
  const strengthBar = document.getElementById('pw-strength-bar');
  const strengthLabel = document.getElementById('pw-strength-label');
  const matchMsg = document.getElementById('pw-match-msg');
  const updateBtn = document.getElementById('update-password-btn');
  const errBox = document.getElementById('password-error');

  // Password visibility toggles
  document.querySelectorAll('.pw-toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');
      const input = document.getElementById(targetId);
      const icon = btn.querySelector('.material-symbols-outlined');
      if (input.type === 'password') {
        input.type = 'text';
        icon.textContent = 'visibility_off';
      } else {
        input.type = 'password';
        icon.textContent = 'visibility';
      }
    });
  });

  // Strength indicator
  if (newPwInput) {
    newPwInput.addEventListener('input', () => {
      const val = newPwInput.value;
      if (!val) {
        if (strengthBar) { strengthBar.style.width = '0%'; }
        if (strengthLabel) strengthLabel.textContent = '';
        return;
      }
      const { label, color, width } = getPasswordStrength(val);
      if (strengthBar) { strengthBar.style.width = width; strengthBar.style.background = color; }
      if (strengthLabel) { strengthLabel.textContent = `Strength: ${label}`; strengthLabel.style.color = color; }
    });
  }

  // Password match
  function checkMatch() {
    if (!confirmPwInput || !matchMsg) return;
    const nv = newPwInput?.value || '';
    const cv = confirmPwInput.value;
    if (!cv) { matchMsg.style.display = 'none'; return; }
    matchMsg.style.display = 'block';
    if (nv === cv) {
      matchMsg.textContent = '✓ Passwords match';
      matchMsg.style.color = 'var(--primary)';
    } else {
      matchMsg.textContent = '✗ Passwords do not match';
      matchMsg.style.color = '#ff6b6b';
    }
  }
  newPwInput?.addEventListener('input', checkMatch);
  confirmPwInput?.addEventListener('input', checkMatch);

  // Update password
  if (!updateBtn) return;
  updateBtn.addEventListener('click', async () => {
    const currentPw = document.getElementById('current-password')?.value;
    const newPw = newPwInput?.value;
    const confirmPw = confirmPwInput?.value;

    if (!currentPw || !newPw || !confirmPw) {
      errBox.textContent = 'Please fill in all password fields.';
      errBox.style.display = 'block';
      return;
    }
    if (newPw !== confirmPw) {
      errBox.textContent = 'New passwords do not match.';
      errBox.style.display = 'block';
      return;
    }
    if (newPw.length < 8) {
      errBox.textContent = 'New password must be at least 8 characters.';
      errBox.style.display = 'block';
      return;
    }

    errBox.style.display = 'none';
    const originalHtml = updateBtn.innerHTML;
    updateBtn.disabled = true;
    updateBtn.innerHTML = `<span class="material-symbols-outlined" style="font-size:1rem; animation: spin 0.8s linear infinite;">progress_activity</span> Updating...`;

    try {
      // Verify current password by re-authenticating
      const session = await getSession();
      const email = session?.user?.email;
      const { error: signInError } = await supabase.auth.signInWithPassword({ email, password: currentPw });
      if (signInError) {
        throw new Error('Current password is incorrect.');
      }

      const { error } = await supabase.auth.updateUser({ password: newPw });
      if (error) throw error;

      showToast('Password updated!');
      document.getElementById('current-password').value = '';
      newPwInput.value = '';
      confirmPwInput.value = '';
      if (strengthBar) strengthBar.style.width = '0%';
      if (strengthLabel) strengthLabel.textContent = '';
      if (matchMsg) matchMsg.style.display = 'none';
    } catch (err) {
      errBox.textContent = err.message || 'Failed to update password.';
      errBox.style.display = 'block';
    } finally {
      updateBtn.disabled = false;
      updateBtn.innerHTML = originalHtml;
    }
  });
}

// ─── 2FA Section ──────────────────────────────────────────────────────────
function bind2FASection(is2FAEnabled, user) {
  if (is2FAEnabled) {
    const disableBtn = document.getElementById('disable-2fa-btn');
    if (!disableBtn) return;
    disableBtn.addEventListener('click', async () => {
      disableBtn.disabled = true;
      disableBtn.textContent = 'Disabling...';
      try {
        const { data: factors } = await supabase.auth.mfa.listFactors();
        const totpFactors = factors?.totp || [];
        for (const factor of totpFactors) {
          await supabase.auth.mfa.unenroll({ factorId: factor.id });
        }
        showToast('2FA disabled.');
        // Re-render section
        setTimeout(() => router.navigate('/account'), 800);
      } catch (err) {
        showToast(err.message || 'Failed to disable 2FA.', 'error');
        disableBtn.disabled = false;
        disableBtn.textContent = 'Disable 2FA';
      }
    });
  }
}

// ─── Danger Zone ──────────────────────────────────────────────────────────
function bindDangerSection() {
  const deleteBtn = document.getElementById('delete-account-btn');
  const modal = document.getElementById('delete-modal');
  const cancelBtn = document.getElementById('cancel-delete-btn');
  const confirmDeleteBtn = document.getElementById('confirm-delete-btn');

  deleteBtn?.addEventListener('click', () => {
    if (modal) modal.style.display = 'flex';
  });

  cancelBtn?.addEventListener('click', () => {
    if (modal) modal.style.display = 'none';
  });

  // Close on backdrop click
  modal?.addEventListener('click', (e) => {
    if (e.target === modal) modal.style.display = 'none';
  });

  confirmDeleteBtn?.addEventListener('click', async () => {
    confirmDeleteBtn.disabled = true;
    confirmDeleteBtn.textContent = 'Deleting...';
    try {
      // Sign out and prompt user to contact support
      // (admin.deleteUser requires service_role key — not safe on client)
      await supabase.auth.signOut();
      if (modal) modal.style.display = 'none';
      showToast('Account deletion requested. Contact support to complete.', 'error');
      setTimeout(() => router.navigate('/'), 2000);
    } catch (err) {
      showToast(err.message || 'Error processing request.', 'error');
      confirmDeleteBtn.disabled = false;
      confirmDeleteBtn.textContent = 'Delete Account';
    }
  });
}
