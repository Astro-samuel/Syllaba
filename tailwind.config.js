/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        caplen: {
          bg: '#EEF2F9',
          sidebar: '#F3F6FC',
          card: '#FFFFFF',
          navy: '#151928',
          navyHover: '#1F253B',
          text: '#1E2336',
          muted: '#64748B',
          border: '#DCE4F0',
        },
        vibrant: {
          purple: '#EDE9FE',
          purpleText: '#6D28D9',
          purpleBorder: '#C4B5FD',
          purpleAccent: '#8B5CF6',

          peach: '#FEF3C7',
          peachText: '#B45309',
          peachBorder: '#FDE68A',
          peachAccent: '#F59E0B',

          lime: '#F7FEE7',
          limeText: '#3F6212',
          limeBorder: '#D9F99D',
          limeAccent: '#84CC16',

          cyan: '#CFFAFE',
          cyanText: '#0E7490',
          cyanBorder: '#A5F3FC',
          cyanAccent: '#06B6D4',

          pink: '#FFE4E6',
          pinkText: '#BE123C',
          pinkBorder: '#FECDD3',
          pinkAccent: '#F43F5E',
        }
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
        display: ['Syne', 'sans-serif'],
        grotesk: ['Space Grotesk', 'sans-serif'],
      },
      boxShadow: {
        'caplen': '0 8px 30px rgba(0, 0, 0, 0.04), 0 2px 6px rgba(0, 0, 0, 0.02)',
        'caplen-lg': '0 16px 40px -8px rgba(0, 0, 0, 0.08), 0 4px 12px rgba(0, 0, 0, 0.03)',
        'card-hover': '0 12px 32px -4px rgba(29, 31, 45, 0.08)',
      }
    },
  },
  plugins: [],
};
