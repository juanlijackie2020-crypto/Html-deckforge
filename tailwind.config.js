/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // MBODS semantic tokens (values live in globals.css :root / html.dark)
        canvas: 'var(--background)',
        surface: 'var(--surface)',
        'surface-elev': 'var(--surface-elevated)',
        'surface-hover': 'var(--surface-hover)',
        ink: 'var(--on-surface)',
        'ink-2': 'var(--on-surface-2)',
        'ink-3': 'var(--on-surface-3)',
        hairline: 'var(--border)',
        'hairline-hover': 'var(--border-hover)',
        brand: 'var(--brand)',
        'brand-strong': 'var(--brand-strong)',
        'brand-amber': 'var(--brand-amber)',
        'brand-soft': 'var(--brand-soft)',
        'brand-subtle': 'var(--brand-subtle)',
        ai: 'var(--ai)',
        'ai-soft': 'var(--ai-soft)',
        success: 'var(--success)',
        warning: 'var(--warning)',
        destructive: 'var(--destructive)',
      },
      fontFamily: {
        title: ['MB Corpo A Title Cond', 'Georgia', 'serif'],
        body: ['MB Corpo S Text', 'PingFang SC', 'Microsoft YaHei', 'sans-serif'],
      },
      boxShadow: {
        sm: 'var(--shadow-sm)',
        md: 'var(--shadow-md)',
        lg: 'var(--shadow-lg)',
      },
      borderRadius: {
        DEFAULT: 'var(--radius)',
        lg: 'var(--radius-lg)',
        xl: 'var(--radius-xl)',
      },
    },
  },
  plugins: [],
}
