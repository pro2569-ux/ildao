'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
  signInWithPhoneNumber,
  RecaptchaVerifier,
  ConfirmationResult,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserProfile } from '@/types';

/** 인증 컨텍스트 타입 */
interface AuthContextType {
  user: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  sendPhoneVerification: (phoneNumber: string) => Promise<ConfirmationResult>;
  confirmPhoneCode: (confirmationResult: ConfirmationResult, code: string) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/** Google 로그인 프로바이더 */
const googleProvider = new GoogleAuthProvider();

/**
 * 인증 상태 관리 프로바이더
 * - Firebase Auth 상태 추적
 * - Firestore 사용자 프로필 로드
 * - 로그인/로그아웃 메서드 제공
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  /** Firestore에서 사용자 프로필 가져오기 */
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

  /** 프로필 새로고침 */
  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.uid);
    }
  };

  // Firebase Auth 상태 변화 감지
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

  /** Google 로그인 */
  const signInWithGoogle = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
    } catch (error) {
      console.error('Google 로그인 실패:', error);
      throw error;
    }
  };

  /** 전화번호 인증 SMS 발송 */
  const sendPhoneVerification = async (phoneNumber: string): Promise<ConfirmationResult> => {
    try {
      const recaptchaVerifier = new RecaptchaVerifier(auth, 'recaptcha-container', {
        size: 'invisible',
      });
      const confirmationResult = await signInWithPhoneNumber(auth, phoneNumber, recaptchaVerifier);
      return confirmationResult;
    } catch (error) {
      console.error('SMS 발송 실패:', error);
      throw error;
    }
  };

  /** 인증코드 확인 및 로그인 */
  const confirmPhoneCode = async (confirmationResult: ConfirmationResult, code: string): Promise<void> => {
    try {
      await confirmationResult.confirm(code);
    } catch (error) {
      console.error('인증코드 확인 실패:', error);
      throw error;
    }
  };

  /** 로그아웃 */
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUserProfile(null);
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
        signOut,
        refreshProfile,
        sendPhoneVerification,
        confirmPhoneCode,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * 인증 컨텍스트 사용 훅
 * AuthProvider 내부에서만 사용 가능
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth는 AuthProvider 내부에서 사용해야 합니다.');
  }
  return context;
}
