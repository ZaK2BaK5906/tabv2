export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        base: {
          950: '#090c12',
          900: '#0f141e',
          800: '#141a25',
          700: '#1b2230'
        },
        surface: {
          900: 'rgba(18, 24, 36, 0.9)',
          800: 'rgba(21, 29, 42, 0.75)',
          700: 'rgba(26, 35, 50, 0.6)'
        },
        accent: {
          500: '#55e2ff',
          600: '#3bd1f0'
        },
        brand: {
          500: '#8a7bff'
        },
        success: '#2fd083',
        warning: '#ffb545',
        danger: '#ff5d73'
      },
      fontFamily: {
        display: ['"Space Grotesk"', 'system-ui', 'sans-serif'],
        body: ['"Inter"', 'system-ui', 'sans-serif']
      },
      boxShadow: {
        soft: '0 18px 60px rgba(8, 12, 22, 0.45)',
        card: '0 12px 40px rgba(7, 10, 20, 0.35)'
      },
      borderRadius: {
        xl: '1.25rem',
        '2xl': '1.75rem'
      },
      backdropBlur: {
        xs: '3px'
      }
    }
  },
  plugins: []
};
