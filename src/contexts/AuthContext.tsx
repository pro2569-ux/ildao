'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import {
  User,
  onAuthStateChanged,
  signInWithPopup,
  GoogleAuthProvider,
  signOut as firebaseSignOut,
} from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { UserProfile } from '@/types';

/** 인증 컨텍스트 타입 */
interface AuthContextType {
  user: User | null;              // Firebase Auth 사용자
  userProfile: UserProfile | null; // Firestore 프로필
  loading: boolean;               // 인증 상태 확인 중
  signInWithGoogle: () => Promise<void>;  // Google 로그인
  signInWithKakao: () => void;           // 카카오 로그인 (리다이렉트)
  signOut: () => Promise<void>;          // 로그아웃
  refreshProfile: () => Promise<void>;   // 프로필 새로고침
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
        // 프로필이 없으면 null (회원가입 필요)
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

  /**
   * 카카오 로그인 (SDK v2 authorize 리다이렉트 방식)
   * - Kakao.Auth.authorize() 로 카카오 인증 페이지로 이동
   * - 콜백은 /auth/kakao/callback 에서 처리
   *
   * 사전 조건:
   *   - NEXT_PUBLIC_KAKAO_JS_KEY 환경 변수 설정
   *   - 카카오 개발자 콘솔에 리다이렉트 URI 등록:
   *     https://ildao.vercel.app/auth/kakao/callback
   */
  const signInWithKakao = () => {
    if (typeof window === 'undefined') return;

    const clientId = process.env.NEXT_PUBLIC_KAKAO_JS_KEY || '80b8cae0927e7a3757684435be41eaf8';
    const redirectUri = window.location.origin + '/auth/kakao/callback';
    /** SDK 없이도 동작하는 직접 인증 URL (authorize()와 동일 엔드포인트) */
    const goAuthorizeUrl = () => {
      window.location.href = `https://kauth.kakao.com/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code`;
    };

    // SDK 미로드여도 버튼이 조용히 죽지 않도록 직접 인증 URL로 이동 (P2-18)
    if (!window.Kakao) {
      console.warn('카카오 SDK 미로드 — 인증 URL로 직접 이동합니다.');
      goAuthorizeUrl();
      return;
    }

    if (!window.Kakao.isInitialized()) {
      window.Kakao.init(clientId);
    }

    // SDK v2는 Kakao.Auth.authorize() 사용 (login()은 deprecated)
    if (typeof window.Kakao.Auth?.authorize === 'function') {
      window.Kakao.Auth.authorize({ redirectUri });
    } else {
      goAuthorizeUrl();
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
      value={{ user, userProfile, loading, signInWithGoogle, signInWithKakao, signOut, refreshProfile }}
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
