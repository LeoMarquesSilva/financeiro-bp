/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './src/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#14324f', dark: '#101f2e' },
        sales: { DEFAULT: '#d5b170', light: '#e8d4a8' },
        sidebar: {
          DEFAULT: '#101f2e',
          dark: '#0a1420',
          darker: '#070d14',
          accent: '#1e3a5f',
          muted: '#1a2d3d',
          ring: '#d5b170',
        },
      },
    },
  },
  plugins: [],
}
