/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: '#0B1F1C',
        'ink-soft': '#14302B',
        'ink-muted': '#1F433C',
        mist: '#F3F6F4',
        'mist-card': '#FFFFFF',
        'mist-line': '#D7E2DC',
        mint: '#0F766E',
        'mint-bright': '#14B8A6',
        'mint-soft': '#CCFBF1',
        income: '#059669',
        'income-soft': '#D1FAE5',
        expense: '#E11D48',
        'expense-soft': '#FFE4E6',
        warn: '#B45309',
        'warn-soft': '#FEF3C7',
      },
      fontFamily: {
        display: ['Fraunces', 'Georgia', 'serif'],
        sans: ['"Plus Jakarta Sans"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        panel: '0 1px 2px rgba(11, 31, 28, 0.04), 0 12px 32px rgba(11, 31, 28, 0.06)',
        lift: '0 8px 24px rgba(11, 31, 28, 0.10)',
      },
      backgroundImage: {
        'app-glow':
          'radial-gradient(1200px 500px at 10% -10%, rgba(20, 184, 166, 0.12), transparent 55%), radial-gradient(900px 400px at 90% 0%, rgba(5, 150, 105, 0.08), transparent 50%), linear-gradient(180deg, #F7FAF8 0%, #EEF3F0 100%)',
        'login-glow':
          'radial-gradient(800px 400px at 20% 20%, rgba(94, 234, 212, 0.18), transparent 50%), radial-gradient(700px 500px at 80% 80%, rgba(52, 211, 153, 0.12), transparent 45%), linear-gradient(145deg, #0B1F1C 0%, #14302B 55%, #0F766E 140%)',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(8px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        softPulse: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.55' },
        },
      },
      animation: {
        fadeUp: 'fadeUp 0.45s ease-out both',
        softPulse: 'softPulse 1.4s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
