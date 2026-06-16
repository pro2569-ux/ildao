'use client';

import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
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
  profileError: boolean;          // 프로필 로드 실패 (네트워크/권한 오류 — '프로필 없음'과 구분)
  signInWithGoogle: () => Promise<void>;  // Google 로그인
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
  const [profileError, setProfileError] = useState(false);
  // 인증 이벤트가 연속 발생(로그인 직후 로그아웃/계정 전환)할 때, 뒤늦게 끝난 이전 fetch가
  // 최신 상태를 덮어쓰지 않도록 세대 카운터로 최신 요청 결과만 반영한다 (#42)
  const fetchGenerationRef = useRef(0);

  /** Firestore에서 사용자 프로필 가져오기 */
  const fetchUserProfile = async (uid: string, generation: number) => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (generation !== fetchGenerationRef.current) return; // stale 응답 무시
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
      setProfileError(false);
    } catch (error) {
      if (generation !== fetchGenerationRef.current) return; // stale 응답 무시
      // 로드 실패를 '프로필 없음'과 동일 취급하면 기존 회원이 재가입 폼으로
      // 유도되어 프로필이 덮어써질 수 있으므로 반드시 구분한다
      console.error('프로필 로드 실패:', error);
      setUserProfile(null);
      setProfileError(true);
    }
  };

  /** 프로필 새로고침 */
  const refreshProfile = async () => {
    if (user) {
      await fetchUserProfile(user.uid, ++fetchGenerationRef.current);
    }
  };

  // Firebase Auth 상태 변화 감지
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      const generation = ++fetchGenerationRef.current;
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchUserProfile(firebaseUser.uid, generation);
      } else {
        setUserProfile(null);
        setProfileError(false);
      }
      if (generation === fetchGenerationRef.current) setLoading(false);
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

  /** 로그아웃 */
  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
      setUserProfile(null);
      setProfileError(false);
    } catch (error) {
      console.error('로그아웃 실패:', error);
      throw error;
    }
  };

  return (
    <AuthContext.Provider
      value={{ user, userProfile, loading, profileError, signInWithGoogle, signOut, refreshProfile }}
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
