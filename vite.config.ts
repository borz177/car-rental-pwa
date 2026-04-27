import { defineConfig, loadEnv } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';  // ✅ Вместо path

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '.', '');

  return {
    server: {
      port: 3000,
      host: '0.0.0.0',
    },
    plugins: [react()],

    // ✅ Определяем переменные окружения для браузера
    define: {
      'process.env.API_KEY': JSON.stringify(env.GEMINI_API_KEY),
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY)
    },

    // ✅ Правильный alias для ESM
    resolve: {
      alias: {
        '@': fileURLToPath(new URL('.', import.meta.url)),
      }
    },

    // ✅ Исключаем типы из бандла (они не нужны в runtime)
    build: {
      rollupOptions: {
        external: ['types.ts', './types.ts', 'types.js', './types.js']
      }
    }
  };
});