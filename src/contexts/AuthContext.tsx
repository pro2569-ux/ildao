'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  RecaptchaVerifier,
  signInWithPhoneNumber,
  ConfirmationResult,
} from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserProfile } from '@/types';

/** 인증 컨텍스트 타입 */
interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  sendPhoneVerification: (phoneNumber: string) => Promise<void>;
  confirmPhoneCode: (code: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const googleProvider = new GoogleAuthProvider();

/**
 * 전화번호 포맷 변환
 * 010-1234-5678 또는 01012345678 → +821012345678
 * 한국 번호에서 앞의 0을 제거하고 +82를 붙임
 */
function formatPhoneNumber(phone: string): string {
  // 숫자만 추출
  const digits = phone.replace(/[^0-9]/g, '');

  // 이미 국제번호 형식이면 그대로
  if (phone.startsWith('+82')) {
    return '+82' + phone.replace(/[^0-9]/g, '').substring(2);
  }

  // 0으로 시작하면 0을 제거하고 +82 붙이기
  if (digits.startsWith('0')) {
    return `+82${digits.substring(1)}`;
  }

  // 그 외
  return `+82${digits}`;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmationResult, setConfirmationResult] = useState<ConfirmationResult | null>(null);
  const [recaptchaVerifier, setRecaptchaVerifier] = useState<RecaptchaVerifier | null>(null);

  const fetchUserProfile = async (uid: string) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        setUserProfile({
          ...data,
          createdAt: data.createdAt?.toDate?.() || new Date(),
          updatedAt: data.updatedAt?.toDate?.() || new Date(),
        } as UserProfile);
      } else {
        setUserProfile(null);
      }
    } catch (error) {
      console.error('프로필 로드 실패:', error);
      setUserProfile(null);
    }
  };

  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.uid);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchUserProfile(firebaseUser.uid);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  /** reCAPTCHA 초기화 */
  const setupRecaptcha = (): RecaptchaVerifier => {
    if (recaptchaVerifier) {
      return recaptchaVerifier;
    }

    const verifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
      size: 'invisible',
      callback: () => {
        console.log('[Phone Auth] reCAPTCHA 인증 성공');
      },
      'expired-callback': () => {
        console.warn('[Phone Auth] reCAPTCHA 만료 - 재시도 필요');
      },
    });

    setRecaptchaVerifier(verifier);
    return verifier;
  };

  /** 전화번호 인증 SMS 발송 */
  const sendPhoneVerification = async (phoneNumber: string) => {
    try {
      const formattedPhone = formatPhoneNumber(phoneNumber);
      console.log('[Phone Auth] 원본 입력:', phoneNumber);
      console.log('[Phone Auth] 변환된 번호:', formattedPhone);

      const verifier = setupRecaptcha();
      const result = await signInWithPhoneNumber(auth, formattedPhone, verifier);
      setConfirmationResult(result);
      console.log('[Phone Auth] SMS 발송 성공');
    } catch (error: any) {
      console.error('[Phone Auth] SMS 발송 실패:', {
        code: error?.code,
        message: error?.message,
        fullError: error,
      });

      // reCAPTCHA 리셋 (실패 시 재사용 불가)
      if (recaptchaVerifier) {
        try {
          recaptchaVerifier.clear();
        } catch (e) {
          // ignore
        }
        setRecaptchaVerifier(null);
      }

      // 사용자 친화적 에러 메시지
      const errorCode = error?.code || 'unknown';
      const errorMessages: Record<string, string> = {
        'auth/invalid-phone-number': '유효하지 않은 전화번호입니다. (예: 01012345678)',
        'auth/too-many-requests': 'SMS 발송 한도 초과. 잠시 후 다시 시도해주세요.',
        'auth/quota-exceeded': 'SMS 일일 발송 한도(10건) 초과. 내일 다시 시도해주세요.',
        'auth/captcha-check-failed': 'reCAPTCHA 인증 실패. 페이지를 새로고침해주세요.',
        'auth/missing-phone-number': '전화번호를 입력해주세요.',
        'auth/user-disabled': '비활성화된 계정입니다.',
        'auth/operation-not-allowed': 'Phone Auth가 활성화되지 않았습니다. (Firebase Console 확인 필요)',
        'auth/billing-not-enabled': 'Firebase Blaze 플랜이 필요합니다.',
        'auth/network-request-failed': '네트워크 오류. 인터넷 연결을 확인해주세요.',
        'auth/internal-error': '서버 내부 오류. 잠시 후 다시 시도해주세요.',
      };

      const userMessage = errorMessages[errorCode]
        || `SMS 발송 실패 [${errorCode}]: ${error?.message || '알 수 없는 에러'}`;
      throw new Error(userMessage);
    }
  };

  /** 인증번호 확인 */
  const confirmPhoneCode = async (code: string) => {
    if (!confirmationResult) {
      throw new Error('인증번호 발송을 먼저 진행해주세요.');
    }

    try {
      await confirmationResult.confirm(code);
      console.log('[Phone Auth] 인증 성공');
      setConfirmationResult(null);
    } catch (error: any) {
      console.error('[Phone Auth] 인증 코드 확인 실패:', {
        code: error?.code,
        message: error?.message,
      });

      const errorCode = error?.code || 'unknown';
      const errorMessages: Record<string, string> = {
        'auth/invalid-verification-code': '인증번호가 올바르지 않습니다.',
        'auth/code-expired': '인증번호가 만료되었습니다. 다시 요청해주세요.',
        'auth/session-expired': '인증 세션 만료. SMS를 다시 요청해주세요.',
      };

      const userMessage = errorMessages[errorCode] || `인증 실패 [${errorCode}]`;
      throw new Error(userMessage);
    }
  };

  /** Google 로그인 */
  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google 로그인 실패:', error);
      throw error;
    }
  };

  /** 로그아웃 */
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUserProfile(null);
      setConfirmationResult(null);
    } catch (error) {
      console.error('로그아웃 실패:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        userProfile,
        loading,
        signInWithGoogle,
        sendPhoneVerification,
        confirmPhoneCode,
        signOut,
        refreshProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth는 AuthProvider 내부에서 사용해야 합니다.');
  }
  return context;
}
