/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#1677FF',
          hover: '#4096FF',
          active: '#0958D9',
          light: '#E6F4FF',
        },
      },
    },
  },
  plugins: [],
};
