'use client';

import { useAuth } from '@/contexts/AuthContext';
import EmployerHome from '@/components/home/EmployerHome';
import WorkerHome from '@/components/home/WorkerHome';
import GuestHome from '@/components/home/GuestHome';

/** 홈 페이지 - 역할별 분기 */
export default function HomePage() {
  const { user, userProfile, loading } = useAuth();

  // 로딩 중
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  // 비로그인 → 게스트 홈
  if (!user || !userProfile) {
    return <GuestHome />;
  }

  // 구인자 홈
  if (userProfile.role === 'employer') {
    return <EmployerHome />;
  }

  // 구직자 홈
  return <WorkerHome />;
}
