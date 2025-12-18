import path from 'path';
import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');
  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      }
    },
    build: {
      chunkSizeWarningLimit: 1600,
      rollupOptions: {
        output: {
          manualChunks: (id) => {
            if (id.includes('node_modules')) {
              if (id.includes('@tensorflow') || id.includes('tfjs')) {
                return 'tensorflow';
              }
              if (id.includes('@mediapipe') || id.includes('pose-detection') || id.includes('coco-ssd')) {
                return 'vision';
              }
              // CRITICAL: Return undefined for everything else to let Vite/Rollup handle it automatically.
              // This avoids creating a monolithic 'vendor' chunk that causes circular dependencies.
            }
          }
        }
      }
    }
  };
});
