'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/** 네비게이션을 숨길 경로 목록 */
const HIDDEN_PATHS = ['/login', '/register'];

/** SVG 아이콘 컴포넌트들 */
const icons = {
  home: (active: boolean) => (
    <svg className={`w-6 h-6 ${active ? 'text-primary-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
  ),
  jobs: (active: boolean) => (
    <svg className={`w-6 h-6 ${active ? 'text-primary-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
    </svg>
  ),
  workers: (active: boolean) => (
    <svg className={`w-6 h-6 ${active ? 'text-primary-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
  calculator: (active: boolean) => (
    <svg className={`w-6 h-6 ${active ? 'text-primary-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
    </svg>
  ),
  favorites: (active: boolean) => (
    <svg className={`w-6 h-6 ${active ? 'text-primary-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
    </svg>
  ),
  profile: (active: boolean) => (
    <svg className={`w-6 h-6 ${active ? 'text-primary-500' : 'text-gray-400'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
    </svg>
  ),
};

/** 네비게이션 항목 타입 */
interface NavItem {
  href: string;
  label: string;
  icon: (active: boolean) => React.ReactNode;
}

/** 구인자용 네비게이션 */
const employerNav: NavItem[] = [
  { href: '/', label: '홈', icon: icons.home },
  { href: '/workers', label: '구직자찾기', icon: icons.workers },
  { href: '/calculator', label: '공수계산', icon: icons.calculator },
  { href: '/favorites', label: '즐겨찾기', icon: icons.favorites },
  { href: '/profile', label: '나의페이지', icon: icons.profile },
];

/** 구직자용 네비게이션 */
const workerNav: NavItem[] = [
  { href: '/', label: '홈', icon: icons.home },
  { href: '/jobs', label: '구인공고', icon: icons.jobs },
  { href: '/calculator', label: '공수계산', icon: icons.calculator },
  { href: '/favorites', label: '즐겨찾기', icon: icons.favorites },
  { href: '/profile', label: '나의페이지', icon: icons.profile },
];

/** 기본(비로그인) 네비게이션 */
const defaultNav: NavItem[] = [
  { href: '/', label: '홈', icon: icons.home },
  { href: '/jobs', label: '구인구직', icon: icons.jobs },
  { href: '/calculator', label: '공수계산', icon: icons.calculator },
  { href: '/favorites', label: '즐겨찾기', icon: icons.favorites },
  { href: '/profile', label: '내정보', icon: icons.profile },
];

/**
 * 하단 네비게이션 바
 * - 역할별로 다른 메뉴 표시
 * - 구인자: 홈 / 구직자찾기 / 공수계산 / 즐겨찾기 / 나의페이지
 * - 구직자: 홈 / 구인공고 / 공수계산 / 즐겨찾기 / 나의페이지
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

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200 z-50">
      <div className="max-w-lg mx-auto flex items-center justify-around py-2">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 py-1 px-3"
            >
              {item.icon(isActive)}
              <span className={`text-[10px] font-medium ${isActive ? 'text-primary-500' : 'text-gray-400'}`}>
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
