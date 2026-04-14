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
          950: '#080808',
        }
      },
      keyframes: {
        shake: {
          '0%, 100%': { transform: 'translateX(0)' },
          '15%': { transform: 'translateX(-8px)' },
          '30%': { transform: 'translateX(8px)' },
          '45%': { transform: 'translateX(-6px)' },
          '60%': { transform: 'translateX(6px)' },
          '75%': { transform: 'translateX(-4px)' },
          '90%': { transform: 'translateX(4px)' },
        },
      },
      animation: {
        shake: 'shake 0.6s ease-in-out',
      },
    },
  },
  plugins: [],
}