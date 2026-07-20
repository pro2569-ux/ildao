const { withSentryConfig } = require('@sentry/nextjs');

const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // 개발 중엔 PWA 비활성화
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  experimental: {
    // instrumentation.ts 활성화 (Next 14) — 서버/엣지 Sentry 초기화용
    instrumentationHook: true,
  },
};

/**
 * Sentry 빌드 옵션
 * - SENTRY_AUTH_TOKEN/ORG/PROJECT가 있으면 소스맵 업로드, 없으면 자동 skip(빌드는 정상 진행).
 * - DSN 미설정 시 런타임 SDK는 no-op이므로 배포는 항상 안전.
 */
const sentryBuildOptions = {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT,
  authToken: process.env.SENTRY_AUTH_TOKEN,
  silent: !process.env.CI,
  widenClientFileUpload: true,
  disableLogger: true,
  sourcemaps: {
    // auth 토큰이 없으면 업로드 불가 → 소스맵 생성 자체를 꺼 공개 노출 방지
    disable: !process.env.SENTRY_AUTH_TOKEN,
    deleteSourcemapsAfterUpload: true,
  },
};

module.exports = withSentryConfig(withPWA(nextConfig), sentryBuildOptions);
