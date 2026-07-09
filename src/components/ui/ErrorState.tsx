'use client';

/**
 * 네트워크/로딩 실패 상태 (PHASE 2 공통 — P2-3)
 * 실패를 "데이터 없음"으로 위장하지 않기 위한 전용 에러 화면.
 * 큰 [다시 시도] 버튼(52px)으로 장갑 낀 손에서도 재시도 가능.
 *
 * 사용 예:
 *   const [error, setError] = useState(false);
 *   // fetch 실패 시 setError(true) — 빈 배열로 두지 말 것
 *
 *   if (error) return <ErrorState onRetry={loadJobs} />;
 *
 *   // 문구 커스텀:
 *   <ErrorState
 *     title="공고를 불러오지 못했어요"
 *     description="네트워크 상태를 확인한 뒤 다시 시도해 주세요"
 *     onRetry={loadJobs}
 *   />
 */

interface ErrorStateProps {
  /** 큰 제목 (기본: "연결이 불안정해요") */
  title?: string;
  /** 보조 설명 (기본: "네트워크 상태를 확인한 뒤 다시 시도해 주세요") */
  description?: string;
  /** 다시 시도 콜백 — 없으면 버튼 미표시 */
  onRetry?: () => void;
  /** 버튼 라벨 (기본: "다시 시도") */
  retryText?: string;
  /** 바깥 컨테이너에 추가할 클래스 */
  className?: string;
}

export default function ErrorState({
  title = '연결이 불안정해요',
  description = '네트워크 상태를 확인한 뒤 다시 시도해 주세요',
  onRetry,
  retryText = '다시 시도',
  className = '',
}: ErrorStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center px-4 py-16 ${className}`}
    >
      {/* 연결 끊김 아이콘 */}
      <svg
        className="w-14 h-14 text-gray-300 mb-4"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={1.8}
          d="M8.288 15.038a5.25 5.25 0 017.424 0M5.106 11.856c3.807-3.808 9.98-3.808 13.788 0M1.924 8.674c5.565-5.565 14.587-5.565 20.152 0M12.53 18.22l-.53.53-.53-.53a.75.75 0 011.06 0z"
        />
        <path strokeLinecap="round" strokeWidth={1.8} d="M3 3l18 18" />
      </svg>

      <p className="text-lg font-bold text-gray-900 mb-1.5">{title}</p>
      <p className="text-base text-gray-600 mb-6 whitespace-pre-line break-keep">
        {description}
      </p>

      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="w-full max-w-xs min-h-[52px] py-3.5 px-8 bg-primary-500 text-white text-lg font-bold rounded-xl active:bg-primary-700 transition-colors"
        >
          {retryText}
        </button>
      )}
    </div>
  );
}
