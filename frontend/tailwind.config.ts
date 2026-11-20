import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './features/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        asoudeh: {
          navy: 'var(--brand-900)',
          blue: 'var(--brand-800)',
          teal: 'var(--brand-700)',
        },
      },
      spacing: {
        'space-1': 'var(--space-1)',
        'space-2': 'var(--space-2)',
        'space-3': 'var(--space-3)',
        'space-4': 'var(--space-4)',
        'space-5': 'var(--space-5)',
        'space-6': 'var(--space-6)',
        'space-8': 'var(--space-8)',
        'space-10': 'var(--space-10)',
        'space-12': 'var(--space-12)',
        'space-16': 'var(--space-16)',
      },
      fontSize: {
        body: 'var(--font-size-base)',
        'heading-2': 'var(--font-size-2xl)',
        'heading-3': 'var(--font-size-3xl)',
        display: 'var(--font-size-4xl)',
      },
      fontWeight: {
        regular: 'var(--font-weight-regular)',
        medium: 'var(--font-weight-medium)',
        semibold: 'var(--font-weight-semibold)',
        bold: 'var(--font-weight-bold)',
        extrabold: 'var(--font-weight-extrabold)',
      },
      borderRadius: {
        'brand-sm': 'var(--radius-sm)',
        'brand-md': 'var(--radius-md)',
        'brand-lg': 'var(--radius-lg)',
        'brand-xl': 'var(--radius-xl)',
      },
      boxShadow: {
        'brand-soft': 'var(--shadow-soft)',
        'brand-card': 'var(--shadow-card)',
        'brand-float': 'var(--shadow-float)',
      },
    },
  },
  screens: {
    sm: '481px',
    md: '769px',
    lg: '1025px',
    xl: '1280px',
    '2xl': '1536px',
  },
  plugins: [],
};

export default config;
