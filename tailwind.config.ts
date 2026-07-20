import type { Config } from 'tailwindcss';

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // 일다오 브랜드 — 청사진 네이비 + 액션 블루 + 안전 오렌지 (현장에서 온 색)
        primary: {
          50: '#e9f0ff',
          100: '#d3e0ff',
          200: '#bfdbfe',
          300: '#93c5fd',
          400: '#60a5fa',
          500: '#2563eb', // 액션 블루 (메인)
          600: '#1d4ed8',
          700: '#1e40af',
          800: '#1e3a8a',
          900: '#122a52', // 청사진 네이비
        },
        // 청사진 네이비 — 헤더/워드마크/강조 텍스트
        navy: {
          DEFAULT: '#122a52',
          600: '#1b3a68',
        },
        // 안전 오렌지 — 일당/핵심 CTA
        accent: {
          50: '#fdeede',
          100: '#fbdcc0',
          500: '#e8620a',
          600: '#c9540a',
          700: '#a5440a',
        },
        // 모집중 그린 (의미색)
        ok: {
          DEFAULT: '#14824f',
          50: '#e2f4ea',
          100: '#c4e7d3',
          700: '#0f6a40',
        },
        // 시작일 지남 앰버 (의미색)
        warn: {
          DEFAULT: '#b5761a',
          50: '#f8efd9',
        },
        // 따뜻한 종이빛 바탕 / 잉크 / 경계선
        paper: '#f4f2ee',
        ink: {
          DEFAULT: '#17191d',
          soft: '#5c616b',
        },
        line: '#e6e2da',
      },
      fontFamily: {
        sans: [
          'Pretendard Variable',
          'Pretendard',
          '-apple-system',
          'BlinkMacSystemFont',
          'Apple SD Gothic Neo',
          'Malgun Gothic',
          'system-ui',
          'sans-serif',
        ],
      },
      boxShadow: {
        card: '0 1px 2px rgba(18,42,82,.05), 0 4px 14px -6px rgba(18,42,82,.10)',
        'card-lg': '0 8px 30px -12px rgba(18,42,82,.20)',
      },
      borderRadius: {
        '2xl': '1.125rem', // 18px — 카드 기본
      },
    },
  },
  plugins: [],
};

export default config;
