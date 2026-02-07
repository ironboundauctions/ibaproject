/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'ironbound-orange': {
          50: '#fef7f0',
          100: '#fdeee0',
          200: '#fbd9c1',
          300: '#f8c197',
          400: '#f4a06b',
          500: '#e77204',
          600: '#d05a03',
          700: '#b04803',
          800: '#8f3a02',
          900: '#742f02',
        },
        'ironbound-grey': {
          50: '#f9fafb',
          100: '#f3f4f6',
          200: '#e5e7eb',
          300: '#d1d5db',
          400: '#9ca3af',
          500: '#323232',
          600: '#2a2a2a',
          700: '#222222',
          800: '#1a1a1a',
          900: '#111111',
        }
      }
    },
  },
  plugins: [],
}