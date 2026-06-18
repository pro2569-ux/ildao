'use client';

import { ReactNode, useEffect, useRef } from 'react';

/** 공용 바텀시트 모달 (배경 오버레이 + 슬라이드업 컨테이너 + 핸들 바)
 *  - 열릴 때만 마운트되는 전제로, Escape 닫기 / 배경 스크롤 잠금 / 초기 포커스 / dialog 시맨틱을 제공 (CALC-04)
 */
export function BottomSheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  // onClose 최신값을 ref로 유지해 keydown 리스너를 마운트당 1회만 등록(재구독 방지)
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCloseRef.current();
    };
    document.addEventListener('keydown', onKeyDown);
    // 열려 있는 동안 배경(body) 스크롤 잠금
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    // 최초 포커스를 모달 패널로 이동 (스크린리더·키보드 진입점)
    panelRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevOverflow;
    };
  }, []);

  return (
    <>
      {/* 배경 오버레이 */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      {/* 바텀시트 */}
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        tabIndex={-1}
        className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up focus:outline-none"
      >
        <div className="max-w-lg mx-auto px-4 pt-4 pb-8">
          {/* 핸들 바 */}
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>
          {children}
        </div>
      </div>
    </>
  );
}
