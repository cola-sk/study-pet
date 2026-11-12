/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        zen: {
          bg: '#F7F5F0',          // 亚麻暖米色画布
          card: '#FFFFFF',        // 象牙暖白卡片
          border: '#EAE5DC',      // 柔和木米细边框
          text: '#2D2621',        // 沉稳炭褐主文字
          muted: '#7D7267',       // 陶土暖灰次级文字
          subtle: '#A89F95',      // 浅木灰
          
          terracotta: {
            DEFAULT: '#D96B43',   // 暖陶橙 (主交互/活力)
            hover: '#C75B34',
            light: '#FDF3EE',
            border: '#F8D8CB',
          },
          matcha: {
            DEFAULT: '#4F7757',   // 抹茶木绿 (在线/成功/通过)
            hover: '#426649',
            light: '#EEF4EF',
            border: '#D0E3D4',
          },
          amber: {
            DEFAULT: '#D49439',   // 琥珀蜂蜜金 (金币/奖励)
            light: '#FEF8ED',
            border: '#FCE7C2',
          },
          clay: {
            DEFAULT: '#C85A5A',   // 陶土灰红 (驳回/注意)
            light: '#FDF2F2',
          },
          mist: {
            DEFAULT: '#5C829B',   // 雾蓝 (设备/标签)
            light: '#EFF5F8',
          }
        }
      },
      boxShadow: {
        'zen-sm': '0 1px 3px rgba(60, 48, 36, 0.04)',
        'zen-card': '0 2px 10px rgba(60, 48, 36, 0.04)',
        'zen-float': '0 8px 24px rgba(60, 48, 36, 0.08)',
      }
    },
  },
  plugins: [],
};
