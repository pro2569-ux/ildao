import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore } from 'firebase/firestore';
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

// Firebase 환경변수 누락 시 명확한 진단 메시지 — 미설정 키로 인한 모호한 런타임 에러('auth/invalid-api-key' 등)의
// 원인 추적을 돕는다 (개발 환경에서만, 카카오맵 fallback과 동일한 DX 보강 — CFG-02)
if (process.env.NODE_ENV !== 'production') {
  const missing = Object.entries({
    NEXT_PUBLIC_FIREBASE_API_KEY: firebaseConfig.apiKey,
    NEXT_PUBLIC_FIREBASE_PROJECT_ID: firebaseConfig.projectId,
    NEXT_PUBLIC_FIREBASE_APP_ID: firebaseConfig.appId,
  })
    .filter(([, value]) => !value)
    .map(([key]) => key);
  if (missing.length > 0) {
    console.error(`[Firebase] 환경변수가 설정되지 않았습니다: ${missing.join(', ')}. .env.local을 확인하세요.`);
  }
}

// Firebase 앱 초기화 (이미 초기화된 경우 기존 앱 사용)
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Firebase 서비스 인스턴스
export const auth = getAuth(app);
// ignoreUndefinedProperties: 선택 필드(endDate, phone, dailyWage 등)가 undefined일 때
// 필드 자체를 생략해 저장 — undefined가 포함된 쓰기는 Firestore가 통째로 거부하므로 필수
export const db = initializeFirestore(app, { ignoreUndefinedProperties: true });
export const storage = getStorage(app);

// FCM은 브라우저 환경에서만 사용 가능
export const getMessagingInstance = async () => {
  if (typeof window !== 'undefined' && (await isSupported())) {
    return getMessaging(app);
  }
  return null;
};

export default app;
