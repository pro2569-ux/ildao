'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * 토스트 알림 (PHASE 2 공통 — P2-5)
 * window.alert 대체. 성공/실패 피드백을 하단(BottomNav 위)에 잠시 표시.
 *
 * 사용 예 (useToast 훅 — 권장, Provider 불필요):
 *   const { showToast, toastElement } = useToast();
 *
 *   showToast('저장했어요');                    // 성공(기본)
 *   showToast('삭제에 실패했어요', 'error');    // 실패
 *   showToast('준비 중인 기능이에요', 'info');  // 안내
 *
 *   return (
 *     <div>
 *       ...페이지 내용...
 *       {toastElement}   // JSX 맨 아래에 한 번 렌더링
 *     </div>
 *   );
 */

export type ToastType = 'success' | 'error' | 'info';

export interface ToastItem {
  id: number;
  message: string;
  type: ToastType;
}

/** 단일 토스트 (프레젠테이션 전용 — 직접 쓸 일은 드물고 보통 useToast 사용) */
export default function Toast({
  message,
  type = 'success',
}: {
  message: string;
  type?: ToastType;
}) {
  const icon =
    type === 'success' ? (
      <svg className="w-5 h-5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
      </svg>
    ) : type === 'error' ? (
      <svg className="w-5 h-5 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" />
      </svg>
    ) : null;

  return (
    <div className="flex items-center gap-2 bg-gray-900/90 text-white text-base font-medium px-5 py-3.5 rounded-xl shadow-lg max-w-[calc(100vw-2rem)]">
      {icon}
      <span className="break-keep">{message}</span>
    </div>
  );
}

/**
 * 토스트 상태 관리 훅.
 * @param options.duration 자동 사라짐 시간(ms, 기본 2500)
 * @returns showToast(message, type?) 호출 함수 + toastElement(페이지 JSX에 렌더링)
 */
export function useToast(options?: { duration?: number }) {
  const duration = options?.duration ?? 2500;
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const idRef = useRef(0);
  const timersRef = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());

  const showToast = useCallback(
    (message: string, type: ToastType = 'success') => {
      const id = ++idRef.current;
      setToasts((prev) => [...prev, { id, message, type }]);
      const timer = setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
        timersRef.current.delete(id);
      }, duration);
      timersRef.current.set(id, timer);
    },
    [duration]
  );

  // 언마운트 시 타이머 정리
  useEffect(() => {
    const timers = timersRef.current;
    return () => {
      timers.forEach((timer) => clearTimeout(timer));
      timers.clear();
    };
  }, []);

  // BottomNav(z-50)·바텀시트(z-[70])보다 위에 표시
  const toastElement =
    toasts.length > 0 ? (
      <div
        aria-live="polite"
        className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[80] flex flex-col items-center gap-2 pointer-events-none"
      >
        {toasts.map((t) => (
          <Toast key={t.id} message={t.message} type={t.type} />
        ))}
      </div>
    ) : null;

  return { showToast, toastElement, toasts };
}
