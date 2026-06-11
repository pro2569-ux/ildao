'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types';

/**
 * 페이지 접근 가드 훅 (UX용 — 실제 데이터 접근 통제는 Firestore 보안 규칙이 담당)
 * - 비로그인 → /login
 * - 프로필 로드 실패 → 홈 (재시도 UI 제공)
 * - 프로필 미등록 → /register
 * - 역할 불일치 → 홈
 *
 * 반환된 ready가 true일 때만 페이지 본문을 렌더링하고 데이터를 로드할 것.
 */
export function useRequireAuth(requiredRole?: UserRole) {
  const auth = useAuth();
  const { user, userProfile, loading, profileError } = auth;
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!user) {
      router.replace('/login');
      return;
    }
    if (profileError) {
      router.replace('/');
      return;
    }
    if (!userProfile) {
      router.replace('/register');
      return;
    }
    if (requiredRole && userProfile.role !== requiredRole) {
      router.replace('/');
    }
  }, [user, userProfile, loading, profileError, requiredRole, router]);

  const ready =
    !loading &&
    !profileError &&
    !!user &&
    !!userProfile &&
    (!requiredRole || userProfile.role === requiredRole);

  return { ...auth, ready };
}
