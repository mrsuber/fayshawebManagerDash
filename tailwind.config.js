/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx}', './public/index.html'],
  // MUI's CssBaseline + src/styles.css provide the base reset; Tailwind's preflight would fight both.
  corePlugins: { preflight: false },
  theme: {
    extend: {
      // Mirrors the CSS variables in src/styles.css, e.g. `bg-surface text-gold border-line`.
      colors: {
        bg: 'var(--bg)',
        sidebar: 'var(--bg-sidebar)',
        surface: { DEFAULT: 'var(--surface)', 2: 'var(--surface-2)', 3: 'var(--surface-3)' },
        line: { DEFAULT: 'var(--border)', soft: 'var(--border-soft)', strong: 'var(--border-strong)' },
        ink: { DEFAULT: 'var(--text)', 2: 'var(--text-2)', 3: 'var(--text-3)' },
        muted: 'var(--muted)',
        dim: 'var(--dim)',
        faint: 'var(--faint)',
        gold: { DEFAULT: 'var(--gold)', hover: 'var(--gold-hover)', on: 'var(--on-gold)' },
        fgreen: { DEFAULT: 'var(--green)', bright: 'var(--green-bright)' },
        fblue: { DEFAULT: 'var(--blue)', soft: 'var(--blue-soft)' },
        fpurple: 'var(--purple)',
        fred: { DEFAULT: 'var(--red)', soft: 'var(--red-soft)' },
      },
      fontFamily: {
        serif: ['"Cormorant Garamond"', 'serif'],
        sans: ['Jost', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
