import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function toPort(value: string | undefined, fallback: number) {
  const port = Number(value);
  return Number.isInteger(port) && port > 0 && port < 65536 ? port : fallback;
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, path.resolve(__dirname, '..'), '');
  const frontendPort = toPort(env.VITE_DEV_PORT || env.FRONTEND_PORT, 5180);
  const backendPort = toPort(env.PORT, 8080);
  const backendTarget = env.VITE_API_PROXY_TARGET || `http://127.0.0.1:${backendPort}`;

  return {
    plugins: [react()],
    server: {
      host: env.VITE_DEV_HOST || '127.0.0.1',
      port: frontendPort,
      strictPort: true,
      proxy: {
        '/api': {
          target: backendTarget,
          changeOrigin: true
        },
        '/uploads': {
          target: backendTarget,
          changeOrigin: true
        }
      }
    },
    preview: {
      host: env.VITE_DEV_HOST || '127.0.0.1',
      port: toPort(env.VITE_PREVIEW_PORT, 4180),
      strictPort: true
    }
  };
});
