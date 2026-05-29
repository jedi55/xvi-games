import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), '');

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
    }
  };
});
