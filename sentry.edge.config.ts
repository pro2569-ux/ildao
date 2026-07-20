/**
 * Sentry 엣지(Edge 런타임) 초기화
 * - NEXT_PUBLIC_SENTRY_DSN(또는 SENTRY_DSN)이 설정된 경우에만 활성화 — 미설정 시 완전한 no-op.
 */
import * as Sentry from '@sentry/nextjs';

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN || process.env.SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    debug: false,
  });
}
