/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // 稀有度颜色
        legendary: '#FFD700',  // 传说-金色
        epic: '#9C27B0',       // 史诗-紫色
        rare: '#2196F3',       // 稀有-蓝色
        common: '#4CAF50',     // 普通-绿色
        
        // 属性颜色
        luck: '#FFD700',       // 运气-金色
        courage: '#FF4444',    // 勇气-红色
        command: '#9C27B0',    // 统率-紫色
        combat: '#F44336',     // 武力-红色
        intelligence: '#2196F3', // 智力-蓝色
        politics: '#4CAF50',   // 政治-绿色
        charisma: '#E91E63',   // 魅力-粉色
        morale: '#FF9800',     // 奋战-橙色
        
        // 势力颜色
        'faction-liubei': '#FF6B6B',
        'faction-caocao': '#4ECDC4',
        'faction-sunquan': '#95E1D3',
        'faction-yuanshao': '#F38181',
        'faction-dongzhuo': '#AA96DA',
        'faction-hanshi': '#FCBAD3',
        'faction-huangjin': '#FFFFD2',
        
        // 服务器状态颜色
        'server-idle': '#4CAF50',      // 空闲-绿色
        'server-popular': '#FFC107',   // 热门-黄色
        'server-crowded': '#FF9800',   // 拥挤-橙色
        'server-full': '#F44336',      // 满编-红色
      },
      fontFamily: {
        sans: ['JYHPHS', 'Microsoft YaHei', 'PingFang SC', 'Helvetica Neue', 'Arial', 'sans-serif'],
        jyhphs: ['JYHPHS', 'KaiTi', 'serif'],
      },
    },
  },
  plugins: [],
}
