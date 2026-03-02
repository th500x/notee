/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}"
  ],
  theme: {
    extend: {
      colors: {
        'san-storm': {
          from: '#FF6B6B',
          to: '#4ECDC4'
        }
      }
    },
  },
  plugins: [],
}
