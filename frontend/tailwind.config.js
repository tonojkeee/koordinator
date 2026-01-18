/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Кастомные цвета уже доступны через стандартную палитру Tailwind
        // indigo, slate, green, amber, rose, blue
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.07)',
      },
      backdropBlur: {
        'xl': '20px',
      },
      animation: {
        'in': 'fadeIn 0.3s ease-out',
        'slide-in-from-bottom-4': 'slideInFromBottom 0.5s ease-out',
        'zoom-in-95': 'zoomIn 0.3s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideInFromBottom: {
          '0%': { 
            opacity: '0', 
            transform: 'translateY(1rem)' 
          },
          '100%': { 
            opacity: '1', 
            transform: 'translateY(0)' 
          },
        },
        zoomIn: {
          '0%': { 
            opacity: '0', 
            transform: 'scale(0.95)' 
          },
          '100%': { 
            opacity: '1', 
            transform: 'scale(1)' 
          },
        },
      },
    },
  },
  plugins: [],
}
