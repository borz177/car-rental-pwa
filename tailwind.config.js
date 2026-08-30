/** @type {import('tailwindcss').Config} */
// Версия пакета жёстко закреплена на 3.4.17 — ровно та, что раздавал Play-CDN
// (cdn.tailwindcss.com редиректит на /3.4.17). Так собранные стили совпадают
// с тем, что работало в браузере до перехода на сборку.
export default {
  darkMode: 'class',
  future: {
    // hover: заворачивается в @media (hover: hover). На тач-экранах :hover иначе
    // применяется при касании и «залипает» — при прокрутке пальцем по списку
    // кнопки под пальцем подсвечивались и такими оставались.
    hoverOnlyWhenSupported: true,
  },
  content: [
    './index.html',
    './index.tsx',
    './App.tsx',
    './constants.tsx',
    './components/**/*.{ts,tsx}',
    './services/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        // Совпадает с прежним inline-стилем body в index.html
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
