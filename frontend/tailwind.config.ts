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
          navy: '#163A5F',
          blue: '#1F5B78',
          teal: '#2C6E8A',
        },
      },
    },
  },
  plugins: [],
};

export default config;
