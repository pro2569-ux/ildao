'use client';

import { ReactNode, useEffect } from 'react';

/**
 * 확인 바텀시트 (PHASE 2 공통 — P2-5)
 * window.confirm 대체. BottomNav(z-50) 위에 표시: 오버레이 z-[60], 시트 z-[70].
 *
 * 사용 예:
 *   const [showDelete, setShowDelete] = useState(false);
 *   const [deleting, setDeleting] = useState(false);
 *   const [deleteError, setDeleteError] = useState<string | null>(null);
 *
 *   <ConfirmSheet
 *     open={showDelete}
 *     title="공고를 삭제할까요?"
 *     description="삭제한 공고는 되돌릴 수 없어요."
 *     confirmText="삭제"
 *     danger
 *     loading={deleting}
 *     error={deleteError}
 *     onConfirm={handleDelete}
 *     onCancel={() => setShowDelete(false)}
 *   />
 *
 *   children으로 공고 요약 카드 등 추가 내용을 넣을 수 있음.
 */

interface ConfirmSheetProps {
  /** 시트 표시 여부 — false면 아무것도 렌더링하지 않음 */
  open: boolean;
  /** 시트 제목 (예: "공고를 삭제할까요?") */
  title: string;
  /** 제목 아래 보조 설명 (문자열 또는 JSX) */
  description?: ReactNode;
  /** 확인 버튼 라벨 (기본: "확인") */
  confirmText?: string;
  /** 취소 버튼 라벨 (기본: "취소") */
  cancelText?: string;
  /** 파괴적 동작(삭제 등)이면 true → 확인 버튼 빨간색 */
  danger?: boolean;
  /** 처리 중이면 true → 버튼 비활성 + loadingText 표시, 오버레이 닫기 차단 */
  loading?: boolean;
  /** 처리 중 확인 버튼에 표시할 문구 (기본: "처리 중...") */
  loadingText?: string;
  /** 실패 시 인라인 에러 메시지 (버튼 위에 빨간 글씨로 표시) */
  error?: string | null;
  /** 확인 버튼/동작 */
  onConfirm: () => void;
  /** 취소 버튼·오버레이 클릭 시 */
  onCancel: () => void;
  /** 제목/설명 아래 추가 콘텐츠 (공고 요약 카드 등) */
  children?: ReactNode;
}

export default function ConfirmSheet({
  open,
  title,
  description,
  confirmText = '확인',
  cancelText = '취소',
  danger = false,
  loading = false,
  loadingText = '처리 중...',
  error = null,
  onConfirm,
  onCancel,
  children,
}: ConfirmSheetProps) {
  // 시트가 열려 있는 동안 배경 스크롤 잠금
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  if (!open) return null;

  return (
    <>
      {/* 배경 오버레이 — BottomNav(z-50)보다 위 */}
      <div
        className="fixed inset-0 bg-black/40 z-[60]"
        onClick={() => {
          if (!loading) onCancel();
        }}
      />

      {/* 바텀시트 */}
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up"
      >
        <div className="max-w-lg mx-auto px-4 pt-4 pb-8">
          {/* 핸들 바 */}
          <div className="flex justify-center mb-3">
            <div className="w-10 h-1 bg-gray-300 rounded-full" />
          </div>

          <h3 className="text-lg font-bold text-center text-gray-900 mb-2">{title}</h3>

          {description && (
            <p className="text-base text-gray-600 text-center mb-4 whitespace-pre-line">
              {description}
            </p>
          )}

          {/* 추가 콘텐츠 (공고 요약 등) */}
          {children && <div className="mb-4">{children}</div>}

          {/* 실패 안내 (인라인) */}
          {error && (
            <p className="text-sm text-red-500 text-center mb-3">{error}</p>
          )}

          {/* 취소 / 확인 버튼 — 파괴적 버튼과 gap-3 간격 (P2-2) */}
          <div className="flex gap-3 mt-2">
            <button
              type="button"
              onClick={onCancel}
              disabled={loading}
              className="flex-1 min-h-[52px] py-3.5 text-lg font-semibold bg-gray-100 text-gray-700 rounded-xl disabled:opacity-50 active:bg-gray-200 transition-colors"
            >
              {cancelText}
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={loading}
              className={`flex-1 min-h-[52px] py-3.5 text-lg font-bold text-white rounded-xl disabled:opacity-50 transition-colors ${
                danger
                  ? 'bg-red-500 active:bg-red-600'
                  : 'bg-primary-500 active:bg-primary-700'
              }`}
            >
              {loading ? loadingText : confirmText}
            </button>
          </div>
        </div>
      </div>

      {/* 바텀시트 슬라이드업 애니메이션 (기존 페이지들과 동일 패턴) */}
      <style jsx global>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </>
  );
}
