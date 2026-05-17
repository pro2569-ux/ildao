'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithCustomToken } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

/**
 * 카카오 OAuth 콜백 페이지
 * - URL의 code 파라미터를 /api/auth/kakao 로 전송
 * - 반환된 customToken으로 Firebase 로그인
 * - 프로필 유무에 따라 / 또는 /register 로 이동
 */
export default function KakaoCallbackPage() {
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
        // 1. 인증 코드를 API 서버로 전송하여 커스텀 토큰 수신
        const response = await fetch('/api/auth/kakao', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const data = await response.json();
          throw new Error(data.error || '로그인 처리에 실패했습니다.');
        }

        const { customToken } = await response.json();

        // 2. Firebase Custom Token으로 로그인
        const userCredential = await signInWithCustomToken(auth, customToken);
        const user = userCredential.user;

        // 3. Firestore 프로필 확인 후 라우팅
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
