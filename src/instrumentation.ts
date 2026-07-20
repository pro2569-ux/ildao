/**
 * Next.js instrumentation — 서버/엣지 런타임별 Sentry 초기화 로드.
 * (클라이언트는 sentry.client.config.ts가 별도로 주입됨)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    await import('../sentry.server.config');
  }
  if (process.env.NEXT_RUNTIME === 'edge') {
    await import('../sentry.edge.config');
  }
}
