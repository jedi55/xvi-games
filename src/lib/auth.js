import { supabase } from './supabase.js';

// ─── Sign Up ───
export async function signUp(email, password, fullName) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { full_name: fullName }
    }
  });
  if (error) throw error;
  return data;
}

// ─── Sign In ───
export async function signInWithEmail(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password
  })
  if (error) throw error
  return data
}
// Alias to support legacy calls in the codebase
export async function signIn(email, password) {
  return signInWithEmail(email, password);
}

// ─── Sign In with Google ───
export async function signInWithGoogle() {
  // Redirect to /#/auth/callback so the callback page handles admin vs user routing
  const redirectTo = window.location.origin + '/#/auth/callback';
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent'
      }
    }
  })
  if (error) throw error
  return data
}

// ─── Resend Verification Email ───
export async function resendVerification(email) {
  const redirectTo = window.location.origin + '/#/auth/callback';
  const { error } = await supabase.auth.resend({
    type: 'signup',
    email,
    options: {
      emailRedirectTo: redirectTo
    }
  });
  if (error) throw error;
}

// ─── Reset Password ───
export async function resetPasswordForEmail(email) {
  const redirectTo = window.location.origin + '/#/reset-password';
  const { error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo,
  });
  if (error) throw error;
}

// ─── Update Password ───
export async function updatePassword(newPassword) {
  const { error } = await supabase.auth.updateUser({ password: newPassword });
  if (error) throw error;
}

// ─── Sign Out ───
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

// ─── Get Session (cached to prevent lock contention) ───
let _sessionCache = undefined
let _sessionCacheTime = 0
let _sessionPromise = null

export async function getSession() {
  const now = Date.now()
  // Return cached session if fresh (within 2 seconds)
  if (_sessionCache !== undefined && (now - _sessionCacheTime) < 2000) {
    return _sessionCache
  }
  // If a request is already in flight, wait for it instead of making a new one
  if (_sessionPromise) {
    return _sessionPromise
  }
  const fetchSession = supabase.auth.getSession();
  const timeout = new Promise((_, reject) => 
    setTimeout(() => reject(new Error('Supabase getSession timeout (lock deadlocked)')), 2500)
  );

  _sessionPromise = Promise.race([fetchSession, timeout])
    .then(({ data: { session }, error }) => {
      if (error) console.error('getSession error:', error)
      _sessionCache = session
      _sessionCacheTime = Date.now()
      _sessionPromise = null
      return session
    }).catch(err => {
      _sessionPromise = null
      console.warn('getSession warning:', err.message)
      // If it deadlocks, clearing local storage sometimes helps reset the state
      if (err.message.includes('timeout')) {
         console.warn('Session deadlocked. Try refreshing or clearing local storage.');
      }
      return null
    })
  return _sessionPromise
}

export function clearSessionCache() {
  _sessionCache = null
  _sessionCacheTime = 0
  _sessionPromise = null
}

// ─── Get Current User ───
export async function getCurrentUser() {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error) console.error('getUser error:', error)
  return user
}
export async function getUser() { return getCurrentUser() }

// ─── Get User Profile ───
export async function getProfile(userId) {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error) throw error;
  return data;
}

// ─── Update Profile ───
export async function updateProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

// ─── Check if Admin ───
export async function isAdmin() {
  const user = await getCurrentUser()
  if (!user) return false
  return user.user_metadata?.role === 'admin' || 
         user.email === import.meta.env.VITE_ADMIN_EMAIL
}

// ─── Auth State Change Listener ───
export function onAuthStateChange(callback) {
  return supabase.auth.onAuthStateChange(
    (event, session) => {
      callback(event, session)
    }
  )
}
