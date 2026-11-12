/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        kid: {
          primary: '#EF4444',
          secondary: '#3B82F6',
          tertiary: '#FACC15',
          base: '#FFFFFF',
          raised: '#F9FAFB',
          highlight: '#FEF3C7',
          success: '#22C55E',
          warning: '#F59E0B',
          error: '#EF4444',
          info: '#3B82F6',
        },
      },
      fontFamily: {
        headline: ['Fredoka', 'Nunito', 'PingFang SC', 'Hiragino Maru Gothic ProN', 'Microsoft YaHei', 'sans-serif'],
        body: ['Nunito', 'PingFang SC', 'Hiragino Sans GB', 'Microsoft YaHei', 'sans-serif'],
        mono: ['Roboto Mono', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      borderRadius: {
        'kid-sm': '12px',
        'kid-md': '20px',
        'kid-lg': '28px',
        'kid-pill': '9999px',
      },
      boxShadow: {
        'kid-sm': '0 2px 4px rgba(0, 0, 0, 0.08)',
        'kid-md': '0 4px 12px rgba(0, 0, 0, 0.12)',
        'kid-lg': '0 8px 24px rgba(0, 0, 0, 0.16)',
        'kid-playful': '0 6px 0 #D1D5DB',
        'kid-focus': '0 0 0 4px rgba(59, 130, 246, 0.35)',
      },
    },
  },
  plugins: [],
};
