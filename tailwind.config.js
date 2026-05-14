/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#00FF88',
        'bg-primary': '#0A0A0F',
        'bg-secondary': '#1A1A2E',
        'border-primary': '#1A1A2E',
      },
    },
  },
  plugins: [],
}
