/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: ['./src/**/*.{astro,html,js,jsx,ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: [
          '"Avenir Next"',
          '"Hiragino Sans"',
          '"Yu Gothic"',
          '"Noto Sans JP"',
          'ui-sans-serif',
          'system-ui',
          'Noto Sans',
          'Apple Color Emoji',
          'Segoe UI Emoji',
          'Segoe UI Symbol',
        ],
        serif: [
          '"Iowan Old Style"',
          '"Palatino Linotype"',
          '"Yu Mincho"',
          '"Hiragino Mincho ProN"',
          'ui-serif',
          'Georgia',
          'serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'Monaco', 'Consolas', 'monospace'],
      },
      colors: {
        brand: {
          50: '#eef8f6',
          100: '#d7efe8',
          200: '#afddd0',
          300: '#7bc5b2',
          400: '#4aa58e',
          500: '#2f8672',
          600: '#256a5b',
          700: '#1f5649',
          800: '#1d463d',
          900: '#1b3a33',
        },
      },
      boxShadow: {
        soft: '0 1px 2px rgba(15, 23, 42, 0.05), 0 10px 30px rgba(15, 23, 42, 0.08)',
        panel: '0 18px 50px rgba(15, 23, 42, 0.10)',
      },
    },
  },
  plugins: [],
};
