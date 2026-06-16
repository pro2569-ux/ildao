'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import EmployerHome from '@/components/home/EmployerHome';
import WorkerHome from '@/components/home/WorkerHome';
import GuestHome from '@/components/home/GuestHome';
import { PageLoader } from '@/components/ui/Spinner';

/** 홈 페이지 - 역할별 분기 */
export default function HomePage() {
  const { user, userProfile, loading, profileError, refreshProfile } = useAuth();
  const router = useRouter();

  // 로그인했지만 프로필 미등록 → 가입 마무리로 유도
  // (게스트 홈을 보여주면 가입이 끝나지 않았다는 사실을 알 수 없음)
  useEffect(() => {
    if (!loading && user && !userProfile && !profileError) {
      router.replace('/register');
    }
  }, [loading, user, userProfile, profileError, router]);

  // 로딩 중이거나 register로 이동 대기 중
  if (loading || (user && !userProfile && !profileError)) {
    return (
      <PageLoader />
    );
  }

  // 비로그인 → 게스트 홈
  if (!user) {
    return <GuestHome />;
  }

  // 프로필 로드 실패 → 재시도 안내 ('프로필 없음'과 구분해 재가입 유도를 막음)
  if (profileError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <p className="text-sm text-gray-600 mb-4">
          프로필 정보를 불러오지 못했습니다.
          <br />
          네트워크 상태를 확인한 뒤 다시 시도해주세요.
        </p>
        <button
          onClick={() => refreshProfile()}
          className="py-2.5 px-6 bg-primary-500 text-white text-sm font-semibold rounded-xl"
        >
          다시 시도
        </button>
      </div>
    );
  }

  // 구인자 홈
  if (userProfile!.role === 'employer') {
    return <EmployerHome />;
  }

  // 구직자 홈
  return <WorkerHome />;
}
