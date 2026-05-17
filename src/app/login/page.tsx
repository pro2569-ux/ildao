'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

/**
 * 로그인 페이지
 * - Google 로그인 지원
 * - 카카오 로그인 지원 (SDK v2 authorize 방식)
 * - 이미 로그인된 경우 홈으로 리다이렉트
 * - 프로필 미설정 시 회원가입 페이지로 이동
 */
export default function LoginPage() {
  const { user, userProfile, loading, signInWithGoogle, signInWithKakao } = useAuth();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState('');

  // 로그인 상태에 따른 리다이렉트
  useEffect(() => {
    if (!loading && user) {
      if (userProfile) {
        // 프로필 있으면 홈으로
        router.replace('/');
      } else {
        // 프로필 없으면 회원가입으로
        router.replace('/register');
      }
    }
  }, [user, userProfile, loading, router]);

  /** Google 로그인 핸들러 */
  const handleGoogleSignIn = async () => {
    setIsSigningIn(true);
    setError('');
    try {
      await signInWithGoogle();
    } catch (err: any) {
      // 팝업 닫기는 에러가 아님
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  /** 카카오 로그인 핸들러 (리다이렉트 방식 - 상태 변경 불필요) */
  const handleKakaoSignIn = () => {
    setError('');
    signInWithKakao();
  };

  // 로딩 중
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  // 이미 로그인된 상태면 빈 화면 (리다이렉트 대기)
  if (user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 pb-20">
      {/* 로고 & 앱 소개 */}
      <div className="text-center mb-12">
        {/* 로고 아이콘 */}
        <div className="w-20 h-20 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">일다오</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          건설현장 · 일용직 구인구직<br />
          일자리를 빠르게 찾아보세요
        </p>
      </div>

      {/* 로그인 버튼 영역 */}
      <div className="w-full max-w-sm space-y-3">
        {/* 카카오 로그인 */}
        <button
          onClick={handleKakaoSignIn}
          disabled={isSigningIn}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-6 rounded-xl font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
          style={{ backgroundColor: '#FEE500', color: '#191919' }}
        >
          {/* 카카오 말풍선 아이콘 */}
          <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.61 1.558 4.908 3.926 6.284L5 21l4.58-2.453A11.2 11.2 0 0012 18c5.523 0 10-3.477 10-7.5S17.523 3 12 3z" />
          </svg>
          <span>카카오로 시작하기</span>
        </button>

        {/* Google 로그인 */}
        <button
          onClick={handleGoogleSignIn}
          disabled={isSigningIn}
          className="w-full flex items-center justify-center gap-3 py-3.5 px-6 bg-white border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
        >
          {isSigningIn ? (
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-gray-400 border-t-transparent" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
          )}
          <span>{isSigningIn ? '로그인 중...' : 'Google로 시작하기'}</span>
        </button>

        {/* 전화번호 로그인 (추후 구현) */}
        <button
          disabled
          className="w-full flex items-center justify-center gap-3 py-3.5 px-6 bg-gray-100 border border-gray-200 rounded-xl font-medium text-gray-400 cursor-not-allowed"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
          </svg>
          <span>전화번호로 시작하기 (준비중)</span>
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center">
          {error}
        </div>
      )}

      {/* 하단 안내 */}
      <p className="mt-8 text-xs text-gray-400 text-center leading-relaxed">
        로그인 시 일다오의{' '}
        <span className="underline">이용약관</span>과{' '}
        <span className="underline">개인정보처리방침</span>에<br />
        동의하는 것으로 간주됩니다.
      </p>
    </div>
  );
}
