'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/** 네비게이션을 숨길 경로 목록 */
const HIDDEN_PATHS = ['/login', '/register'];

/** SVG 아이콘 컴포넌트들 */
const icons = {
  home: (active: boolean) => (
    <svg className={`w-6 h-6 ${active ? 'text-primary-500' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  jobs: (active: boolean) => (
    <svg className={`w-6 h-6 ${active ? 'text-primary-500' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  workers: (active: boolean) => (
    <svg className={`w-6 h-6 ${active ? 'text-primary-500' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  calculator: (active: boolean) => (
    <svg className={`w-6 h-6 ${active ? 'text-primary-500' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  /** 지원내역 (클립보드 체크) */
  applications: (active: boolean) => (
    <svg className={`w-6 h-6 ${active ? 'text-primary-500' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
    </svg>
  ),
  /** 내 공고 (문서 목록) */
  myJobs: (active: boolean) => (
    <svg className={`w-6 h-6 ${active ? 'text-primary-500' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
  ),
  profile: (active: boolean) => (
    <svg className={`w-6 h-6 ${active ? 'text-primary-500' : 'text-gray-500'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
};

/** 네비게이션 항목 타입 */
interface NavItem {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
  /** href 외에 이 탭을 활성화시킬 추가 경로 접두사 */
  match?: string[];
}

/** 구인자용 네비게이션 */
const employerNav: NavItem[] = [
  { href: '/', label: '홈', icon: icons.home },
  { href: '/workers', label: '구직자찾기', icon: icons.workers },
  { href: '/calculator', label: '공수계산', icon: icons.calculator },
  // 공고 작성(/jobs/create)·공고 상세도 내 공고 흐름이므로 함께 활성화
  { href: '/my-jobs', label: '내 공고', icon: icons.myJobs, match: ['/jobs'] },
  { href: '/profile', label: '내 정보', icon: icons.profile },
];

/** 구직자용 네비게이션 */
const workerNav: NavItem[] = [
  { href: '/', label: '홈', icon: icons.home },
  { href: '/jobs', label: '공고', icon: icons.jobs },
  { href: '/calculator', label: '공수계산', icon: icons.calculator },
  { href: '/my-applications', label: '지원내역', icon: icons.applications },
  { href: '/profile', label: '내 정보', icon: icons.profile },
];

/** 기본(비로그인) 네비게이션 */
const defaultNav: NavItem[] = [
  { href: '/', label: '홈', icon: icons.home },
  { href: '/jobs', label: '공고', icon: icons.jobs },
  { href: '/calculator', label: '공수계산', icon: icons.calculator },
  { href: '/profile', label: '내 정보', icon: icons.profile },
];

/**
 * 하단 네비게이션 바
 * - 역할별로 다른 메뉴 표시
 * - 구인자: 홈 / 구직자찾기 / 공수계산 / 내 공고 / 내 정보
 * - 구직자: 홈 / 공고 / 공수계산 / 지원내역 / 내 정보
 * - 즐겨찾기는 내 정보 페이지 메뉴에서 진입
 */
export default function BottomNav() {
  const pathname = usePathname();
  const { userProfile } = useAuth();

  // 로그인/회원가입 페이지에서는 네비게이션 숨김
  if (HIDDEN_PATHS.includes(pathname)) {
    return null;
  }

  // 역할에 따른 네비게이션 선택
  let navItems: NavItem[];
  if (userProfile?.role === 'employer') {
    navItems = employerNav;
  } else if (userProfile?.role === 'worker') {
    navItems = workerNav;
  } else {
    navItems = defaultNav;
  }

  /**
   * 활성 탭 판정
   * - 홈(/)은 정확 일치만 (startsWith('/')는 모든 경로에 참이므로)
   * - 나머지는 하위 경로(/jobs/123, /my-jobs/xx/applicants 등)도 소속 탭으로 활성화
   */
  const isActive = (item: NavItem) => {
    if (item.href === '/') return pathname === '/';
    const prefixes = [item.href, ...(item.match ?? [])];
    return prefixes.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2">
        {navItems.map((item) => {
          const active = isActive(item);
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center justify-center gap-0.5 py-1.5 px-3 min-w-[56px] min-h-[48px]"
            >
              {item.icon(active)}
              <span className={`text-xs font-medium ${active ? 'text-primary-500' : 'text-gray-500'}`}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
      {/* iOS 홈바 영역 safe area */}
      <div className="h-safe-area-bottom" />
    </nav>
  );
}
