'use client';

/**
 * 전역 최상위 에러 경계 (루트 레이아웃 렌더 실패 등 error.tsx가 못 잡는 오류)
 * - 자체 <html><body>를 렌더해야 하므로 globals.css/Tailwind에 의존하지 않고 인라인 스타일 사용.
 * - Sentry로 오류 보고(설정 시).
 */
import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error);
    console.error('전역 최상위 에러:', error);
  }, [error]);

  return (
    <html lang="ko">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          background: '#f4f2ee',
          color: '#17191d',
          fontFamily:
            "'Pretendard Variable', 'Pretendard', -apple-system, BlinkMacSystemFont, 'Apple SD Gothic Neo', 'Malgun Gothic', system-ui, sans-serif",
        }}
      >
        <h1 style={{ fontSize: '24px', fontWeight: 800, margin: '0 0 8px', color: '#122a52' }}>
          문제가 생겼어요
        </h1>
        <p style={{ fontSize: '16px', color: '#5c616b', lineHeight: 1.6, margin: '0 0 28px' }}>
          잠시 후 다시 시도해주세요.
          <br />
          계속 안 되면 앱을 껐다 켜주세요.
        </p>
        <button
          type="button"
          onClick={() => reset()}
          style={{
            minHeight: '52px',
            padding: '14px 28px',
            fontSize: '17px',
            fontWeight: 700,
            color: '#ffffff',
            background: '#2563eb',
            border: 'none',
            borderRadius: '12px',
            cursor: 'pointer',
            fontFamily: 'inherit',
          }}
        >
          다시 시도
        </button>
      </body>
    </html>
  );
}
