'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * 로그인 후 복귀 경로 sessionStorage 키
 * - src/app/login/page.tsx 에서 카카오 로그인 시작 시 저장한 값
 * - 두 파일이 반드시 같은 키를 사용해야 함
 */
const RETURN_URL_STORAGE_KEY = 'loginReturnUrl';

/**
 * sessionStorage에서 복귀 경로를 꺼내고 제거
 * - 내부 경로('/'로 시작, '//' 제외)만 허용 (open redirect 방지)
 */
function consumeReturnUrl(): string | null {
  try {
    const stored = sessionStorage.getItem(RETURN_URL_STORAGE_KEY);
    sessionStorage.removeItem(RETURN_URL_STORAGE_KEY);
    if (stored && stored.startsWith('/') && !stored.startsWith('//')) {
      return stored;
    }
  } catch (err) {
    console.error('복귀 경로 읽기 실패:', err);
  }
  return null;
}

/**
 * 로그인 실패/취소 시 돌아갈 로그인 페이지 경로
 * - 저장된 복귀 경로가 있으면 returnUrl 쿼리로 붙여 재시도 시에도 유지
 */
function getLoginPath(): string {
  try {
    const stored = sessionStorage.getItem(RETURN_URL_STORAGE_KEY);
    if (stored && stored.startsWith('/') && !stored.startsWith('//')) {
      return `/login?returnUrl=${encodeURIComponent(stored)}`;
    }
  } catch (err) {
    console.error('복귀 경로 읽기 실패:', err);
  }
  return '/login';
}

/**
 * 카카오 OAuth 콜백 - 내부 컴포넌트
 * useSearchParams()는 Suspense 경계 내에서 사용해야 함
 */
function KakaoCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [error, setError] = useState('');

  useEffect(() => {
    const code = searchParams.get('code');
    const errorParam = searchParams.get('error');

    if (errorParam) {
      setError('카카오 로그인이 취소되었습니다.');
      setTimeout(() => router.replace(getLoginPath()), 2000);
      return;
    }

    if (!code) {
      setError('인증 코드를 찾을 수 없습니다.');
      setTimeout(() => router.replace(getLoginPath()), 2000);
      return;
    }

    const handleKakaoCallback = async () => {
      try {
        const response = await fetch('/api/auth/kakao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const data = await response.json();
          console.error('카카오 API 에러 상세:', JSON.stringify(data));
          throw new Error(
            `${data.error || '로그인 처리에 실패했습니다.'} ${data.detail ? `(${data.detail})` : ''}`
          );
        }

        const { customToken } = await response.json();
        const userCredential = await signInWithCustomToken(auth, customToken);
        const user = userCredential.user;

        const profileDoc = await getDoc(doc(db, 'users', user.uid));
        // 로그인 시작 시 저장해둔 복귀 경로 (사용 후 제거)
        const returnUrl = consumeReturnUrl();
        if (profileDoc.exists()) {
          router.replace(returnUrl || '/');
        } else {
          router.replace('/register');
        }
      } catch (err: any) {
        console.error('카카오 콜백 처리 오류:', err);
        setError(err.message || '로그인에 실패했습니다.');
        setTimeout(() => router.replace(getLoginPath()), 3000);
      }
    };

    handleKakaoCallback();
  }, [searchParams, router]);

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        <div className="p-4 bg-red-50 text-red-600 text-sm rounded-lg text-center max-w-sm">
          {error}
          <p className="mt-2 text-gray-500">로그인 페이지로 이동합니다...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen">
      <div className="animate-spin rounded-full h-10 w-10 border-2 border-yellow-400 border-t-transparent mb-4" />
      <p className="text-gray-500 text-sm">카카오 로그인 처리 중...</p>
    </div>
  );
}

/**
 * 카카오 OAuth 콜백 페이지
 * Suspense로 감싸서 useSearchParams() 사용 가능하게 함
 */
export default function KakaoCallbackPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-col items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-10 w-10 border-2 border-yellow-400 border-t-transparent mb-4" />
          <p className="text-gray-500 text-sm">로딩 중...</p>
        </div>
      }
    >
      <KakaoCallbackContent />
    </Suspense>
  );
}
