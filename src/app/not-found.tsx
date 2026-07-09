import Link from 'next/link';

/**
 * 404 페이지 (P3-4)
 * - 잘못된 주소 접근 시 표시 (Server Component)
 * - 페르소나(40~60대) 기준: 큰 글씨, 큰 버튼(52px+), 쉬운 한국어 안내
 */
export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 pb-24 text-center">
      {/* 물음표 아이콘 */}
      <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center mb-6">
        <svg className="w-10 h-10 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
        </svg>
      </div>

      <h1 className="text-2xl font-bold text-gray-900 mb-2">페이지를 찾을 수 없어요</h1>
      <p className="text-base text-gray-600 mb-8 leading-relaxed">
        주소가 잘못되었거나
        <br />
        삭제된 페이지예요.
      </p>

      <Link
        href="/"
        className="block w-full max-w-xs min-h-[52px] py-3.5 text-lg font-bold text-white bg-primary-500 rounded-xl active:bg-primary-700 transition-colors"
      >
        홈으로
      </Link>
    </div>
  );
}
