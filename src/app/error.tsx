'use client';

import { useEffect } from 'react';
import Link from 'next/link';

/**
 * 전역 에러 페이지 (P3-4)
 * - 예상치 못한 렌더링/데이터 오류 발생 시 표시되는 Error Boundary
 * - 페르소나(40~60대) 기준: 큰 글씨, 큰 버튼(52px+), 쉬운 한국어 안내
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  // 에러 로깅 (추후 Sentry 등 모니터링 도구 연동 지점)
  useEffect(() => {
    console.error('전역 에러 발생:', error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 pb-24 text-center">
      {/* 경고 아이콘 */}
      <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">문제가 생겼어요</h1>
      <p className="text-base text-gray-600 mb-8 leading-relaxed">
        잠시 후 다시 시도해주세요.
        <br />
        계속 안 되면 앱을 껐다 켜주세요.
      </p>

      <div className="w-full max-w-xs space-y-3">
        {/* 다시 시도 — 에러 경계 리셋 */}
        <button
          type="button"
          onClick={reset}
          className="w-full min-h-[52px] py-3.5 text-lg font-bold text-white bg-primary-500 rounded-xl active:bg-primary-700 transition-colors"
        >
          다시 시도
        </button>

        {/* 홈으로 이동 */}
        <Link
          href="/"
          className="block w-full min-h-[52px] py-3.5 text-lg font-semibold text-gray-700 bg-gray-100 rounded-xl active:bg-gray-200 transition-colors"
        >
          홈으로
        </Link>
      </div>
    </div>
  );
}
