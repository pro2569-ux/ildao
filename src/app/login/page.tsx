'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Script from 'next/script';
import { useAuth } from '@/contexts/AuthContext';

type LoginStep = 'select' | 'phone-input' | 'code-input';

export default function LoginPage() {
  const { user, userProfile, loading, signInWithGoogle, signInWithKakao, sendPhoneVerification, confirmPhoneCode } = useAuth();
  const router = useRouter();
  const [isSigningIn, setIsSigningIn] = useState(false);
  const [isKakaoSigningIn, setIsKakaoSigningIn] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState<LoginStep>('select');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [verificationCode, setVerificationCode] = useState('');
  const [isSendingSMS, setIsSendingSMS] = useState(false);
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

  /** Google 로그인 */
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

  /** 카카오 로그인 */
  const handleKakaoSignIn = async () => {
    setIsKakaoSigningIn(true);
    setError('');
    try {
      await signInWithKakao();
    } catch (err: any) {
      // 사용자가 팝업을 닫은 경우는 무시
      if (err?.message?.includes('popup') || err?.message?.includes('cancelled')) {
        // ignore
      } else {
        setError(err?.message || '카카오 로그인에 실패했습니다. 다시 시도해주세요.');
      }
    } finally {
      setIsKakaoSigningIn(false);
    }
  };

  /** SMS 발송 */
  const handleSendSMS = async () => {
    if (!phoneNumber.trim()) {
      setError('전화번호를 입력해주세요.');
      return;
    }

    setIsSendingSMS(true);
    setError('');
    try {
      await sendPhoneVerification(phoneNumber);
      setSmsSent(true);
      setStep('code-input');
    } catch (err: any) {
      setError(err.message || 'SMS 발송에 실패했습니다.');
    } finally {
      setIsSendingSMS(false);
    }
  };

  /** 인증번호 확인 */
  const handleVerifyCode = async () => {
    if (!verificationCode.trim()) {
      setError('인증번호를 입력해주세요.');
      return;
    }

    setIsVerifying(true);
    setError('');
    try {
      await confirmPhoneCode(verificationCode);
    } catch (err: any) {
      setError(err.message || '인증에 실패했습니다.');
    } finally {
      setIsVerifying(false);
    }
  };

  /** SMS 재발송 */
  const handleResendSMS = async () => {
    setError('');
    setVerificationCode('');
    setIsSendingSMS(true);
    try {
      await sendPhoneVerification(phoneNumber);
      setError('');
    } catch (err: any) {
      setError(err.message || 'SMS 재발송에 실패했습니다.');
    } finally {
      setIsSendingSMS(false);
    }
  };

  if (loading || user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-screen px-6 pb-20">
      {/* 카카오 SDK 로드 */}
      <Script
        src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
        integrity="sha384-DKYJZ8NLiK8MN4/C5P2ezmFnkl8h0EB5jS3RNcUHa3P6e2nJjMEYXbmdMRyLkM"
        crossOrigin="anonymous"
        strategy="afterInteractive"
      />

      {/* reCAPTCHA 컨테이너 (invisible) */}
      <div id="recaptcha-container"></div>

      {/* 로고 */}
      <div className="text-center mb-12">
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

      {/* 로그인 영역 */}
      <div className="w-full max-w-sm space-y-3">
        {step === 'select' && (
          <>
            {/* 카카오 로그인 */}
            <button
              onClick={handleKakaoSignIn}
              disabled={isKakaoSigningIn}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-6 bg-[#FEE500] border border-[#FEE500] rounded-xl font-medium text-[#191919] hover:bg-[#FDD835] active:bg-[#FBC02D] transition-colors disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
            >
              {isKakaoSigningIn ? (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-[#191919] border-t-transparent" />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path
                    fillRule="evenodd"
                    clipRule="evenodd"
                    d="M12 4C7.029 4 3 7.13 3 10.95c0 2.41 1.6 4.54 4.013 5.76-.177.66-.64 2.39-.733 2.76-.114.46.17.454.357.33.147-.097 2.346-1.594 3.302-2.24.348.05.702.076 1.061.076 4.971 0 9-3.13 9-6.95S16.971 4 12 4z"
                    fill="#191919"
                  />
                </svg>
              )}
              <span>{isKakaoSigningIn ? '로그인 중...' : '카카오로 시작하기'}</span>
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

            {/* 전화번호 로그인 */}
            <button
              onClick={() => { setStep('phone-input'); setError(''); }}
              className="w-full flex items-center justify-center gap-3 py-3.5 px-6 bg-blue-50 border border-blue-200 rounded-xl font-medium text-blue-700 hover:bg-blue-100 active:bg-blue-150 transition-colors shadow-sm"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
              </svg>
              <span>전화번호로 시작하기</span>
            </button>
          </>
        )}

        {step === 'phone-input' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                전화번호 입력
              </label>
              <div className="flex gap-2">
                <span className="flex items-center px-3 bg-gray-100 border border-gray-300 rounded-lg text-sm text-gray-600">
                  +82
                </span>
                <input
                  type="tel"
                  value={phoneNumber}
                  onChange={(e) => setPhoneNumber(e.target.value)}
                  placeholder="01012345678"
                  className="flex-1 px-4 py-3 border border-gray-300 rounded-xl text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  autoFocus
                />
              </div>
              <p className="mt-1.5 text-xs text-gray-400">
                하이픈(-) 없이 숫자만 입력해주세요
              </p>
            </div>

            <button
              onClick={handleSendSMS}
              disabled={isSendingSMS || !phoneNumber.trim()}
              className="w-full py-3.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSendingSMS ? '발송 중...' : '인증번호 받기'}
            </button>

            <button
              onClick={() => { setStep('select'); setError(''); setPhoneNumber(''); }}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              ← 다른 방법으로 로그인
            </button>
          </div>
        )}

        {step === 'code-input' && (
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                인증번호 입력
              </label>
              <input
                type="text"
                inputMode="numeric"
                value={verificationCode}
                onChange={(e) => setVerificationCode(e.target.value.replace(/[^0-9]/g, ''))}
                placeholder="6자리 인증번호"
                maxLength={6}
                className="w-full px-4 py-3 border border-gray-300 rounded-xl text-gray-900 text-center text-lg tracking-widest placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                autoFocus
              />
              <p className="mt-1.5 text-xs text-gray-400">
                {phoneNumber}로 전송된 6자리 코드를 입력해주세요
              </p>
            </div>

            <button
              onClick={handleVerifyCode}
              disabled={isVerifying || verificationCode.length < 6}
              className="w-full py-3.5 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 active:bg-blue-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isVerifying ? '확인 중...' : '인증하기'}
            </button>

            <div className="flex justify-between">
              <button
                onClick={handleResendSMS}
                disabled={isSendingSMS}
                className="text-sm text-blue-600 hover:text-blue-800 disabled:opacity-50"
              >
                {isSendingSMS ? '발송 중...' : '인증번호 재발송'}
              </button>
              <button
                onClick={() => { setStep('phone-input'); setError(''); setVerificationCode(''); }}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                번호 변경
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg text-center max-w-sm w-full">
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
