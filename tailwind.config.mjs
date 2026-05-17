import tailwindAnimate from 'tailwindcss-animate';
import containerQuery from '@tailwindcss/container-queries';

export default {
  darkMode: ['class'],
  content: [
    './index.html',
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
    './node_modules/streamdown/dist/**/*.js'
  ],
  safelist: ['border', 'border-border'],
  prefix: '',
  theme: {
    container: {
      center: true,
      padding: '2rem',
      screens: {
        '2xl': '1400px',
      },
    },
    extend: {
      fontFamily: {
        serif: ['Noto Serif SC', 'Georgia', 'Songti SC', 'serif'],
        body: ['LXGW WenKai', '-apple-system', 'BlinkMacSystemFont', 'PingFang SC', 'sans-serif'],
        mono: ['SF Mono', 'Consolas', 'monospace'],
      },
      colors: {
        /* === 设计系统：暖色学术风 === */
        /* 主强调色（陶土色） */
        ac: 'var(--ac)',
        'ac-light': 'var(--acl)',
        'ac-dark': 'var(--acd)',
        /* 次强调色（青绿色） */
        tl: 'var(--tl)',
        'tl-light': 'var(--tll)',
        /* 第三强调色（琥珀金色） */
        am: 'var(--am)',
        'am-light': 'var(--aml)',
        /* 紫色辅助 */
        pp: 'var(--pp)',
        'pp-light': 'var(--ppl)',
        /* 背景色 */
        bg: 'var(--bg)',
        'bg-warm': 'var(--bgs)',
        'bg-card': 'var(--bc)',
        /* 文本色 */
        tx: 'var(--tx)',
        'tx-secondary': 'var(--txs)',
        'tx-tertiary': 'var(--txt)',
        /* 边框色 */
        bd: 'var(--bd)',
        'bd-light': 'var(--bdl)',

        /* === Tailwind 语义色（兼容现有组件） === */
        border: 'var(--bd)',
        borderColor: {
          border: 'var(--bd)',
        },
        input: 'var(--bd)',
        ring: 'var(--ac)',
        background: 'var(--bg)',
        foreground: 'var(--tx)',
        primary: {
          DEFAULT: 'var(--ac)',
          foreground: '#ffffff',
        },
        secondary: {
          DEFAULT: 'var(--bgs)',
          foreground: 'var(--tx)',
        },
        destructive: {
          DEFAULT: '#e74c3c',
          foreground: '#ffffff',
        },
        muted: {
          DEFAULT: 'var(--bgs)',
          foreground: 'var(--txs)',
        },
        accent: {
          DEFAULT: 'var(--tl)',
          foreground: 'var(--tx)',
        },
        popover: {
          DEFAULT: 'var(--bc)',
          foreground: 'var(--tx)',
        },
        card: {
          DEFAULT: 'var(--bc)',
          foreground: 'var(--tx)',
        },
        sidebar: {
          DEFAULT: 'var(--bg)',
          foreground: 'var(--tx)',
          primary: 'var(--ac)',
          'primary-foreground': '#ffffff',
          accent: 'var(--bgs)',
          'accent-foreground': 'var(--tx)',
          border: 'var(--bd)',
          ring: 'var(--ac)',
        },
      },
      fontSize: {
        'ds-xs': ['0.72rem', { lineHeight: '1.5' }],
        'ds-sm': ['0.82rem', { lineHeight: '1.6' }],
        'ds-base': ['0.88rem', { lineHeight: '1.7' }],
        'ds-md': ['0.95rem', { lineHeight: '1.75' }],
        'ds-lg': ['1rem', { lineHeight: '1.8' }],
        'ds-xl': ['1.125rem', { lineHeight: '1.7' }],
        'ds-2xl': ['1.25rem', { lineHeight: '1.6' }],
        'ds-3xl': ['1.5rem', { lineHeight: '1.5' }],
        'ds-4xl': ['2rem', { lineHeight: '1.4' }],
        'ds-hero': ['clamp(2.4rem, 5.5vw, 3.6rem)', { lineHeight: '1.3' }],
      },
      fontWeight: {
        'ds-light': '300',
        'ds-regular': '400',
        'ds-medium': '500',
        'ds-semibold': '600',
        'ds-bold': '700',
        'ds-black': '900',
      },
      borderRadius: {
        'ds-sm': '6px',
        'ds-md': '12px',
        'ds-lg': '16px',
        'ds-xl': '20px',
        'ds-pill': '100px',
        'ds-full': '50%',
      },
      spacing: {
        'ds-1': '4px',
        'ds-2': '8px',
        'ds-3': '12px',
        'ds-4': '16px',
        'ds-5': '20px',
        'ds-6': '24px',
        'ds-7': '28px',
        'ds-8': '32px',
        'ds-9': '40px',
        'ds-10': '48px',
        'ds-11': '64px',
        'ds-12': '80px',
      },
      boxShadow: {
        'ds-xs': '0 1px 3px rgba(44,36,32,0.06)',
        'ds-sm': '0 2px 8px rgba(44,36,32,0.06)',
        'ds-md': '0 4px 16px rgba(44,36,32,0.08)',
        'ds-lg': '0 8px 32px rgba(44,36,32,0.1)',
        'ds-xl': '0 20px 60px rgba(44,36,32,0.12)',
        'ds-accent': '0 4px 16px rgba(196,93,62,0.25)',
        card: 'var(--shadow-card)',
        hover: 'var(--shadow-hover)',
      },
      backgroundImage: {
        'gradient-primary': 'linear-gradient(135deg, var(--ac), #d4724e)',
        'gradient-progress': 'linear-gradient(90deg, var(--ac), var(--tl))',
        'gradient-card': 'var(--gradient-card)',
        'gradient-background': 'var(--gradient-background)',
      },
      keyframes: {
        'accordion-down': {
          from: { height: '0' },
          to: { height: 'var(--radix-accordion-content-height)' },
        },
        'accordion-up': {
          from: { height: 'var(--radix-accordion-content-height)' },
          to: { height: '0' },
        },
        'fade-in': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in': {
          from: { opacity: '0', transform: 'translateX(-20px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        'fade-in-up': {
          from: { opacity: '0', transform: 'translateY(30px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '200% center' },
          '100%': { backgroundPosition: '-200% center' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'fade-in': 'fade-in 0.5s ease-out',
        'slide-in': 'slide-in 0.5s ease-out',
        'fade-in-up': 'fade-in-up 0.6s ease-out',
        'shimmer-text': 'shimmer 4s linear infinite',
        'float': 'float 3s ease-in-out infinite',
      },
      transitionTimingFunction: {
        'ds': 'cubic-bezier(0.4, 0, 0.2, 1)',
      },
    },
  },
  plugins: [
    tailwindAnimate,
    containerQuery,
    function ({ addUtilities }) {
      addUtilities(
        {
          '.border-t-solid': { 'border-top-style': 'solid' },
          '.border-r-solid': { 'border-right-style': 'solid' },
          '.border-b-solid': { 'border-bottom-style': 'solid' },
          '.border-l-solid': { 'border-left-style': 'solid' },
          '.border-t-dashed': { 'border-top-style': 'dashed' },
          '.border-r-dashed': { 'border-right-style': 'dashed' },
          '.border-b-dashed': { 'border-bottom-style': 'dashed' },
          '.border-l-dashed': { 'border-left-style': 'dashed' },
          '.border-t-dotted': { 'border-top-style': 'dotted' },
          '.border-r-dotted': { 'border-right-style': 'dotted' },
          '.border-b-dotted': { 'border-bottom-style': 'dotted' },
          '.border-l-dotted': { 'border-left-style': 'dotted' },
        },
        ['responsive']
      );
    },
  ],
};
