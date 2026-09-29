/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['JYHPHS', 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', 'Arial', 'sans-serif'],
        jyhphs: ['JYHPHS', 'KaiTi', 'serif'],
      },
    },
  },
  plugins: [],
};
