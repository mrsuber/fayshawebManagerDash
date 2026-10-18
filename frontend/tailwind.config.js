/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html",
  ],
  theme: {
    extend: {
      colors: {
        // Faysha Brand Color Palette - Property by Result
        primary: {
          50: '#FAF8F3',
          100: '#F3EFE5',
          200: '#E7DFC9',
          300: '#DBCFAD',
          400: '#D5C28F',  // Lighter gold from brand guide
          500: '#C7AE6A',  // Main brand gold
          600: '#B99A45',  // Darker gold from brand guide
          700: '#9A7F2E',
          800: '#6B591F',
          900: '#3C3311',
        },
        secondary: {
          50: '#FAF8F3',
          100: '#F3EFE5',
          200: '#E7DFC9',
          300: '#DBCFAD',
          400: '#D5C28F',
          500: '#C7AE6A',  // Gold for secondary elements
          600: '#B99A45',
          700: '#9A7F2E',
          800: '#6B591F',
          900: '#3C3311',
        },
        accent: {
          50: '#F8F8F8',
          100: '#E8E8E8',
          200: '#D0D0D0',
          300: '#B8B8B8',
          400: '#808080',
          500: '#262626',  // Dark grey from brand guide
          600: '#1F1F1F',
          700: '#171717',
          800: '#0D0D0D',  // Brand black
          900: '#000000',  // Pure black
        },
        dark: {
          50: '#F5F5F5',
          100: '#E8E8E8',
          200: '#D0D0D0',
          300: '#A8A8A8',
          400: '#808080',
          500: '#505050',
          600: '#383838',
          700: '#262626',  // Dark grey from brand guide
          800: '#0D0D0D',  // Brand black
          900: '#000000',  // Pure black
        },
        gold: {
          light: '#D5C28F',
          DEFAULT: '#C7AE6A',
          dark: '#B99A45',
        },
        faysha: {
          gold: '#C7AE6A',
          black: '#0D0D0D',
          grey: '#262626',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
        display: ['Alice', 'Georgia', 'serif'],
        heading: ['Alice', 'Georgia', 'serif'],
      },
      boxShadow: {
        'soft': '0 2px 15px -3px rgba(199, 174, 106, 0.1), 0 10px 20px -2px rgba(199, 174, 106, 0.04)',
        'medium': '0 4px 25px -5px rgba(199, 174, 106, 0.15), 0 10px 30px -5px rgba(199, 174, 106, 0.08)',
        'large': '0 10px 40px -10px rgba(199, 174, 106, 0.2), 0 20px 50px -10px rgba(199, 174, 106, 0.1)',
        'gold': '0 4px 20px -2px rgba(199, 174, 106, 0.3)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.5rem',
        '3xl': '2rem',
      },
    },
  },
  plugins: [],
}
