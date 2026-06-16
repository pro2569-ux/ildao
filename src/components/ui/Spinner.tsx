/** 공용 로딩 스피너 — 인라인 스피너 중복(23곳)과 스타일 분기(border-2/border-b-2) 통합 */

const SIZES = {
  xs: 'h-4 w-4',
  sm: 'h-6 w-6',
  md: 'h-8 w-8',
} as const;

/**
 * 스피너. 색상은 text-* 클래스로 제어(기본 primary).
 * 버튼 등 어두운 배경에서는 className="text-white"처럼 전달.
 */
export function Spinner({
  size = 'md',
  className = '',
}: {
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <div
      role="status"
      aria-label="로딩 중"
      className={`animate-spin rounded-full border-2 border-current border-t-transparent text-primary-500 ${SIZES[size]} ${className}`}
    />
  );
}

/** 전체 화면 중앙 로더 (페이지 인증/로딩 대기 공통) */
export function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-screen">
      <Spinner size="md" />
    </div>
  );
}
