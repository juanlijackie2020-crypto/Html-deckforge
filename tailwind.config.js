/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        mb: {
          red: '#FF0000',
          'orange-dark': '#FF7500',
          orange: '#FF9102',
          amber: '#FFA101',
          gold: '#FFC767',
          black: '#0a0a0a',
          charcoal: '#262626',
          gray: '#7D7D7D',
          'light-gray': '#D9D9D9',
          blue: '#0078D6',
          cyan: '#00B0F0',
        },
      },
      fontFamily: {
        title: ['MB Corpo A Title Cond', 'Georgia', 'serif'],
        body: ['MB Corpo S Text', 'Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
