import type { Config } from 'tailwindcss'

/**
 * Tailwind is configuration only — every colour lives in `src/styles/tokens.css`.
 * Do not add raw hex values here; add a token there and reference it.
 *
 * Note: token colours are referenced with plain `var(...)`, so Tailwind's
 * opacity modifiers (e.g. `bg-surface-1/50`) are not available for them.
 * Use the dedicated `*-soft` tokens instead.
 */
export default {
  content: ['./index.html', './dev-gallery.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: 'var(--color-bg)',
        surface: {
          1: 'var(--color-surface-1)',
          2: 'var(--color-surface-2)',
          3: 'var(--color-surface-3)',
        },
        border: {
          DEFAULT: 'var(--color-border)',
          strong: 'var(--color-border-strong)',
        },
        text: {
          DEFAULT: 'var(--color-text)',
          muted: 'var(--color-text-muted)',
          faint: 'var(--color-text-faint)',
        },
        accent: {
          DEFAULT: 'var(--color-accent)',
          hover: 'var(--color-accent-hover)',
          soft: 'var(--color-accent-soft)',
          wash: 'var(--color-accent-wash)',
          ring: 'var(--color-accent-ring)',
          foreground: 'var(--color-on-accent)',
        },
        danger: {
          DEFAULT: 'var(--color-danger)',
          hover: 'var(--color-danger-hover)',
          soft: 'var(--color-danger-soft)',
          ring: 'var(--color-danger-ring)',
        },
        warning: {
          DEFAULT: 'var(--color-warning)',
          soft: 'var(--color-warning-soft)',
        },
        info: {
          DEFAULT: 'var(--color-info)',
          soft: 'var(--color-info-soft)',
        },
        gold: {
          DEFAULT: 'var(--color-gold)',
          soft: 'var(--color-gold-soft)',
        },
        silver: {
          DEFAULT: 'var(--color-silver)',
          soft: 'var(--color-silver-soft)',
        },
        bronze: {
          DEFAULT: 'var(--color-bronze)',
          soft: 'var(--color-bronze-soft)',
        },
        neutral: {
          soft: 'var(--color-neutral-soft)',
        },
        overlay: 'var(--color-overlay)',
      },
      fontFamily: {
        sans: ['Inter Variable', 'Inter', 'system-ui', '-apple-system', 'Segoe UI', 'sans-serif'],
        mono: [
          'ui-monospace',
          'SFMono-Regular',
          'JetBrains Mono',
          'Menlo',
          'Consolas',
          'monospace',
        ],
      },
      borderRadius: {
        DEFAULT: 'var(--radius-md)',
        sm: 'var(--radius-sm)',
        md: 'var(--radius-md)',
        lg: 'var(--radius-lg)',
        pill: 'var(--radius-pill)',
      },
      boxShadow: {
        panel: 'var(--shadow-panel)',
        elevated: 'var(--shadow-elevated)',
        accent: 'var(--shadow-accent)',
      },
      transitionDuration: {
        DEFAULT: 'var(--duration-base)',
        fast: 'var(--duration-fast)',
        slow: 'var(--duration-slow)',
      },
      transitionTimingFunction: {
        arena: 'var(--ease-arena)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'fade-out': {
          from: { opacity: '1' },
          to: { opacity: '0' },
        },
        'pop-in': {
          from: { opacity: '0', transform: 'scale(0.98)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        'pop-out': {
          from: { opacity: '1', transform: 'scale(1)' },
          to: { opacity: '0', transform: 'scale(0.98)' },
        },
        'dialog-in': {
          from: { opacity: '0', transform: 'translate(-50%, -50%) scale(0.97)' },
          to: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
        },
        'dialog-out': {
          from: { opacity: '1', transform: 'translate(-50%, -50%) scale(1)' },
          to: { opacity: '0', transform: 'translate(-50%, -50%) scale(0.97)' },
        },
        'slide-down': {
          from: { opacity: '0', transform: 'translateY(-4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(4px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        /* Page and section entrance: short, low-amplitude, never bouncy. */
        rise: {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        /* A number landing on the board. */
        'score-pop': {
          from: { opacity: '0', transform: 'translateY(6px) scale(0.96)' },
          to: { opacity: '1', transform: 'translateY(0) scale(1)' },
        },
        /* Leading edge of a progress track. */
        'edge-pulse': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.45' },
        },
        /* Slow ambient drift for the hero court lines. */
        drift: {
          from: { transform: 'translate3d(0, 0, 0)' },
          to: { transform: 'translate3d(-24px, 12px, 0)' },
        },
      },
      animation: {
        'fade-in': 'fade-in var(--duration-base) ease-out',
        'fade-out': 'fade-out var(--duration-fast) ease-in',
        'pop-in': 'pop-in var(--duration-base) ease-out',
        'pop-out': 'pop-out var(--duration-fast) ease-in',
        'slide-down': 'slide-down var(--duration-base) ease-out',
        'slide-up': 'slide-up var(--duration-base) ease-out',
        'dialog-in': 'dialog-in var(--duration-base) ease-out',
        'dialog-out': 'dialog-out var(--duration-fast) ease-in',
        rise: 'rise var(--duration-slow) var(--ease-arena) both',
        'score-pop': 'score-pop var(--duration-slow) var(--ease-arena) both',
        'edge-pulse': 'edge-pulse 2.6s ease-in-out infinite',
        drift: 'drift 24s ease-in-out infinite alternate',
      },
    },
  },
  plugins: [],
} satisfies Config
