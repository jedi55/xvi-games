import { createClient } from '@supabase/supabase-js'

// NOTE: This app uses hash-based routing (/#/path), which requires the implicit OAuth flow.
// In the Supabase Dashboard → Authentication → URL Configuration, make sure to add:
//   Site URL:        https://xvigames.com
//   Redirect URLs:   https://xvigames.com/**
//                    http://localhost:5173/**   (for local dev)
export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY,
  {
    auth: {
      detectSessionInUrl: true,   // parses access_token from URL hash after OAuth
      persistSession: true,
      autoRefreshToken: true,
      storage: window.localStorage,
      flowType: 'implicit',       // required for hash-router SPAs
      debug: false
    },
    global: {
      headers: {
        'x-application-name': 'xvi-snooker'
      }
    }
  }
)
