import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  getFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, isSupported } from 'firebase/messaging';

// Firebase 설정 - 환경변수에서 가져옴
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Firebase 앱 초기화 (이미 초기화된 경우 기존 앱 사용)
const isNewApp = getApps().length === 0;
const app = isNewApp ? initializeApp(firebaseConfig) : getApp();

// Firebase 서비스 인스턴스
// ignoreUndefinedProperties: undefined 필드가 섞여도 저장이 실패하지 않도록 함
export const auth = getAuth(app);
export const db = isNewApp
  ? initializeFirestore(app, {
      ignoreUndefinedProperties: true,
      // 오프라인 캐시 (P3-2): 지하/산간 현장에서 이전 조회 데이터 열람 + 오프라인 쓰기 큐잉.
      // IndexedDB는 브라우저 전용이므로 SSR/빌드에서는 기본(메모리) 캐시 사용.
      ...(typeof window !== 'undefined'
        ? { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) }
        : {}),
    })
  : getFirestore(app);
export const storage = getStorage(app);

// FCM은 브라우저 환경에서만 사용 가능
export const getMessagingInstance = async () => {
  if (typeof window !== 'undefined' && (await isSupported())) {
    return getMessaging(app);
  }
  return null;
};

export default app;
