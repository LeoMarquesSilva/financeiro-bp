/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: { DEFAULT: '#14324f', dark: '#101f2e' },
        sales: { DEFAULT: '#d5b170', light: '#e8d4a8' },
      },
    },
  },
  plugins: [],
}
