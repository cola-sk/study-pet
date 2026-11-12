/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
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
}
