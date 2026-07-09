'use client';

import { useRouter } from 'next/navigation';

/**
 * 뒤로가기 버튼 (PHASE 2 공통 — P2-2)
 * 44×44px 터치 타겟 보장. 기존 p-1 버튼 대체용.
 *
 * 사용 예:
 *   <div className="flex items-center gap-2 mb-4">
 *     <BackButton />                      // router.back()
 *     <h1 className="text-xl font-bold">내 지원 내역</h1>
 *   </div>
 *
 *   <BackButton href="/jobs" />           // 특정 경로로 이동 (히스토리 없을 때 안전)
 *   <BackButton className="-ml-2" />      // 헤더 왼쪽 끝 정렬 시
 */

interface BackButtonProps {
  /** 지정하면 router.back() 대신 이 경로로 이동 */
  href?: string;
  /** 클릭 동작 전체를 직접 지정 (href보다 우선) */
  onClick?: () => void;
  /** 접근성 라벨 (기본: "뒤로가기") */
  ariaLabel?: string;
  /** 추가 클래스 (예: "-ml-2"로 헤더 좌측 정렬) */
  className?: string;
}

export default function BackButton({
  href,
  onClick,
  ariaLabel = '뒤로가기',
  className = '',
}: BackButtonProps) {
  const router = useRouter();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else if (href) {
      router.push(href);
    } else {
      router.back();
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-label={ariaLabel}
      className={`w-11 h-11 flex items-center justify-center flex-shrink-0 rounded-lg hover:bg-gray-100 active:bg-gray-100 transition-colors ${className}`}
    >
      <svg
        className="w-6 h-6 text-gray-700"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M15 19l-7-7 7-7" />
      </svg>
    </button>
  );
}
