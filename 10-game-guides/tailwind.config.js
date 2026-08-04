/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        guide: {
          bg: '#0f1419',
          surface: '#161b22',
          border: '#2a3340',
          text: '#e7ecf1',
          muted: '#8b9cb3',
          accent: '#6cb6ff',
        },
      },
    },
  },
  plugins: [],
}
