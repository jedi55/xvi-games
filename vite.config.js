import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

  // Paystack public key — safe to hardcode as fallback (public keys are browser-visible by design)
  const paystackPublicKey = env.VITE_PAYSTACK_PUBLIC_KEY || 'pk_test_ea2a396e49ad8875ff1d77445a41a6b4cca54d60';

  return {
    server: {
      port: 5173,
      open: true,
      proxy: {
        '/api/send-email': {
          target: 'https://api.resend.com',
          changeOrigin: true,
          rewrite: (path) => '/emails',
          configure: (proxy) => {
            proxy.on('proxyReq', (proxyReq) => {
              proxyReq.setHeader('Authorization', `Bearer ${env.VITE_RESEND_API_KEY}`);
              proxyReq.setHeader('Content-Type', 'application/json');
            });
          }
        }
      }
    },
    build: {
      outDir: 'dist'
    },
    // Explicitly inject env vars into the bundle so they're never undefined on the live site.
    // Vite's normal VITE_ injection can fail on some hosting platforms if the env var
    // isn't available at build time — define forces the value in regardless.
    define: {
      'import.meta.env.VITE_PAYSTACK_PUBLIC_KEY': JSON.stringify(paystackPublicKey),
      'import.meta.env.VITE_SUPABASE_URL':        JSON.stringify(env.VITE_SUPABASE_URL        || ''),
      'import.meta.env.VITE_SUPABASE_ANON_KEY':   JSON.stringify(env.VITE_SUPABASE_ANON_KEY   || ''),
      'import.meta.env.VITE_RESEND_API_KEY':       JSON.stringify(env.VITE_RESEND_API_KEY      || ''),
      'import.meta.env.VITE_ADMIN_EMAIL':          JSON.stringify(env.VITE_ADMIN_EMAIL         || ''),
      'import.meta.env.VITE_ADMIN_EMAIL_2':        JSON.stringify(env.VITE_ADMIN_EMAIL_2       || ''),
    }
  };
});
