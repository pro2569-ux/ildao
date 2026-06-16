/** 공용 에러 상태 컴포넌트 (메시지 + 선택적 재시도) */
export function ErrorState({
  message,
  onRetry,
  retryLabel = '다시 시도',
}: {
  message: string;
  onRetry?: () => void;
  retryLabel?: string;
}) {
  return (
    <div className="text-center py-8">
      <svg className="w-12 h-12 mx-auto text-red-300 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p className="text-gray-500 text-sm mb-3">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="py-2 px-4 bg-primary-500 text-white text-sm font-medium rounded-lg"
        >
          {retryLabel}
        </button>
      )}
    </div>
  );
}
