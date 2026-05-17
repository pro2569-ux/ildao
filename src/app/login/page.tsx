'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { ConfirmationResult } from 'firebase/auth';

/**
 * 로그인 페이지
 * - Google 로그인 지원
 * - 전화번호 로그인 지원 (Firebase Phone Auth)
 * - 이미 로그인된 경우 홈으로 리다이렉트
 * - 프로필 미설정 시 회원가입 페이지로 이동
 */
export default function LoginPage() {
  const { user, userProfile, loading, signInWithGoogle, sendPhoneVerification, confirmPhoneCode } = useAuth();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [error, setError] = useState('');

  // 전화번호 로그인 상태
  const [showPhoneLogin, setShowPhoneLogin] = useState(false);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [isSmsSending, setIsSmsSending] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [smsSent, setSmsSent] = useState(false);

  // 로그인 상태에 따른 리다이렉트
  useEffect(() => {
    if (!loading && user) {
      if (userProfile) {
        router.replace('/');
      } else {
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
      if (err?.code !== 'auth/popup-closed-by-user') {
        setError('로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsSigningIn(false);
    }
  };

  /** 전화번호 포맷 변환 (한국 번호 자동 처리) */
  const formatPhoneNumber = (phone: string): string => {
    const digits = phone.replace(/[^0-9]/g, '');
    if (digits.startsWith('010')) {
      return '+82' + digits.substring(1);
    }
    if (digits.startsWith('82')) {
      return '+' + digits;
    }
    if (phone.startsWith('+82')) {
      return phone;
    }
    return '+82' + digits;
  };

  /** SMS 인증코드 발송 */
  const handleSendSms = async () => {
    if (!phoneNumber.trim()) {
      setError('전화번호를 입력해주세요.');
      return;
    }

    setIsSmsSending(true);
    setError('');

    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      const result = await sendPhoneVerification(formattedPhone);
      setConfirmationResult(result);
      setSmsSent(true);
    } catch (err: any) {
      if (err?.code === 'auth/invalid-phone-number') {
        setError('유효하지 않은 전화번호입니다.');
      } else if (err?.code === 'auth/too-many-requests') {
        setError('요청이 너무 많습니다. 잠시 후 다시 시도해주세요.');
      } else {
        setError('SMS 발송에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsSmsSending(false);
    }
  };

  /** 인증코드 확인 */
  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setError('인증코드를 입력해주세요.');
      return;
    }
    if (!confirmationResult) {
      setError('인증 세션이 만료되었습니다. 다시 시도해주세요.');
      return;
    }

    setIsVerifying(true);
    setError('');

    try {
      await confirmPhoneCode(confirmationResult, verificationCode);
    } catch (err: any) {
      if (err?.code === 'auth/invalid-verification-code') {
        setError('인증코드가 올바르지 않습니다.');
      } else if (err?.code === 'auth/code-expired') {
        setError('인증코드가 만료되었습니다. 다시 발송해주세요.');
      } else {
        setError('인증에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  /** 전화번호 로그인 초기화 */
  const handlePhoneLoginBack = () => {
    setShowPhoneLogin(false);
    setPhoneNumber('');
    setVerificationCode('');
    setConfirmationResult(null);
    setSmsSent(false);
    setError('');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 pb-20">
      {/* reCAPTCHA 컨테이너 (invisible) */}
      <div id="recaptcha-container"></div>

      {/* 로고 & 앱 소개 */}
      <div className="text-center mb-12">
        <div className="w-20 h-20 bg-primary-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
          <svg className="w-10 h-10 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        </div>

        <h1 className="text-3xl font-bold text-gray-900 mb-2">일다오</h1>
        <p className="text-gray-500 text-sm leading-relaxed">
          건설현장 &middot; 일용직 구인구직<br />
          일자리를 빠르게 찾아보세요
        </p>
      </div>

      {/* 로그인 영역 */}
      <div className="w-full max-w-sm space-y-3">
        {!showPhoneLogin ? (
          <>
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

            {/* 전화번호 로그인 */}
            <button
              onClick={() => setShowPhoneLogin(true)}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-6 bg-white border border-gray-300 rounded-xl font-medium text-gray-700 hover:bg-gray-50 active:bg-gray-100 transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>전화번호로 시작하기</span>
            </button>
          </>
        ) : (
          <>
            {/* 전화번호 로그인 폼 */}
            {!smsSent ? (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    전화번호
                  </label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                      +82
                    </span>
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="01012345678"
                      className="w-full py-3.5 pl-14 pr-4 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      disabled={isSmsSending}
                    />
                  </div>
                  <p className="mt-1.5 text-xs text-gray-400">
                    &#39;-&#39; 없이 숫자만 입력해주세요
                  </p>
                </div>

                <button
                  onClick={handleSendSms}
                  disabled={isSmsSending || !phoneNumber.trim()}
                  className="w-full py-3.5 px-6 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 active:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSmsSending ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      <span>발송 중...</span>
                    </div>
                  ) : (
                    '인증코드 받기'
                  )}
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">
                    인증코드
                  </label>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={verificationCode}
                    onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                    placeholder="6자리 인증코드 입력"
                    maxLength={6}
                    className="w-full py-3.5 px-4 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 text-center text-lg tracking-widest focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    disabled={isVerifying}
                  />
                  <p className="mt-1.5 text-xs text-gray-400">
                    SMS로 전송된 6자리 코드를 입력해주세요
                  </p>
                </div>

                <button
                  onClick={handleVerifyCode}
                  disabled={isVerifying || verificationCode.length < 6}
                  className="w-full py-3.5 px-6 bg-primary-500 text-white rounded-xl font-medium hover:bg-primary-600 active:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isVerifying ? (
                    <div className="flex items-center justify-center gap-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
                      <span>확인 중...</span>
                    </div>
                  ) : (
                    '로그인'
                  )}
                </button>

                <button
                  onClick={handleSendSms}
                  disabled={isSmsSending}
                  className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
                >
                  인증코드 재발송
                </button>
              </div>
            )}

            {/* 뒤로가기 */}
            <button
              onClick={handlePhoneLoginBack}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
            >
              다른 방법으로 로그인
            </button>
          </>
        )}
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
