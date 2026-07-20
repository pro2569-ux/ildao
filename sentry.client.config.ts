/**
 * Sentry 클라이언트(브라우저) 초기화
 * - NEXT_PUBLIC_SENTRY_DSN이 설정된 경우에만 활성화 — 미설정 시 완전한 no-op.
 * - 세션 리플레이는 비용/개인정보(전화번호 등 화면 노출) 고려해 기본 비활성.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,
    debug: false,
  });
}
