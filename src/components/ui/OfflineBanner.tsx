'use client';

import { useEffect, useState } from 'react';

/**
 * 전역 오프라인 배너 (P3-2)
 * navigator.onLine 기반으로 연결 상태를 감지해 화면 최상단에 고정 표시.
 * 오프라인에서도 캐시된 데이터 열람과 기록 저장(연결 시 자동 전송)이 가능함을 알린다.
 */
export default function OfflineBanner() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    // 첫 렌더는 SSR과 동일하게 숨김 → 마운트 후 실제 상태 반영 (hydration 불일치 방지)
    setOffline(!navigator.onLine);
    const handleOnline = () => setOffline(false);
    const handleOffline = () => setOffline(true);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (!offline) return null;

  return (
    <div
      role="status"
      className="fixed top-0 left-0 right-0 z-[90] bg-gray-800 text-white text-sm font-medium text-center px-4 py-2"
      style={{ paddingTop: 'max(0.5rem, env(safe-area-inset-top))' }}
    >
      오프라인이에요 — 저장한 내용은 연결되면 자동으로 반영돼요
    </div>
  );
}
