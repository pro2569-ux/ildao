'use client';

import { Suspense, useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

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
      setTimeout(() => router.replace('/login'), 2000);
      return;
    }

    if (!code) {
      setError('인증 코드를 찾을 수 없습니다.');
      setTimeout(() => router.replace('/login'), 2000);
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
        if (profileDoc.exists()) {
          router.replace('/');
        } else {
          router.replace('/register');
        }
      } catch (err: any) {
        console.error('카카오 콜백 처리 오류:', err);
        setError(err.message || '로그인에 실패했습니다.');
        setTimeout(() => router.replace('/login'), 3000);
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
