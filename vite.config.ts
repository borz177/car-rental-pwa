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

    // Раньше здесь GEMINI_API_KEY вшивался прямо в браузерный бандл — ключ
    // мог достать любой, открыв исходник страницы. ИИ-советник удалён,
    // секретам в клиентской сборке не место.

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