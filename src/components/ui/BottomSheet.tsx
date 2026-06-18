import { ReactNode } from 'react';

/** 공용 바텀시트 모달 (배경 오버레이 + 슬라이드업 컨테이너 + 핸들 바) */
export function BottomSheet({
  onClose,
  children,
}: {
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <>
      {/* 배경 오버레이 */}
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      {/* 바텀시트 */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
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
