import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#135bec',
          dark: '#0f4bc4',
          light: '#eef4ff',
          50: '#eef4ff',
          100: '#dbeafe',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#135bec',
          600: '#135bec',
          700: '#0f4bc4',
          800: '#1e40af',
          900: '#1e3a8a',
          950: '#172554',
        },
        background: {
          light: '#f6f6f8',
          dark: '#101622',
        },
        sidebar: {
          DEFAULT: '#ffffff',
          dark: '#1a2234',
        },
        teranga: {
          green: '#00853F',
          yellow: '#FDEF42',
          red: '#E31B23',
        },
      },
      fontFamily: {
        display: ['Public Sans', 'sans-serif'],
        sans: ['Public Sans', 'sans-serif'],
      },
    },
  },
  plugins: [],
};

export default config;
