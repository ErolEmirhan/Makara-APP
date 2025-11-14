/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
      },
      backgroundImage: {
        'gradient-main': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient-card': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
        'gradient-success': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'gradient-dark': 'linear-gradient(135deg, #1e1e2e 0%, #2d2d44 100%)',
        'gradient-purple': 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
        'gradient-blue': 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
        'gradient-pink': 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      }
    },
  },
  plugins: [],
}

