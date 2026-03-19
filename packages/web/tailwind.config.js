export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: { 400: '#60a5fa', 500: '#3b82f6', 600: '#2563eb' },
        anthropic: { light: '#e8f4ff', DEFAULT: '#d97706', dark: '#92400e' },
        openai: { light: '#f0fdf4', DEFAULT: '#16a34a', dark: '#14532d' }
      },
      boxShadow: {
        card: '0 1px 3px 0 rgb(0 0 0 / 0.06), 0 1px 2px -1px rgb(0 0 0 / 0.06)',
        'card-hover': '0 4px 6px -1px rgb(0 0 0 / 0.08), 0 2px 4px -2px rgb(0 0 0 / 0.06)'
      }
    }
  },
  plugins: []
};
