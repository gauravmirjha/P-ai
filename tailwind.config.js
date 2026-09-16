/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./app/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        base: '#0B0F12',
        surface: '#131A1D',
        surfaceAlt: '#182125',
        brass: '#C9A24D',
        brassDim: '#8C7133',
        paper: '#ECE6D8',
        muted: '#8E9A99',
        faint: '#5C6A69',
        spend: '#C2685F',
        save: '#5E9070',
      },
      // One rule, three roles. Fields and buttons share a radius so they read
      // as the same family; cards are softer; only the nav is a pill.
      borderRadius: {
        field: '0.75rem',
        card: '1.25rem',
        pill: '999px',
      },
      fontFamily: {
        serif: ['var(--font-fraunces)', 'Georgia', 'serif'],
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        rise: {
          '0%': { opacity: '0', transform: 'translateY(6px)' },
          '100%': { opacity: '1', transform: 'none' },
        },
      },
      animation: {
        shimmer: 'shimmer 1.8s linear infinite',
        rise: 'rise 260ms cubic-bezier(0.2, 0.8, 0.2, 1) both',
      },
    },
  },
  plugins: [],
};
