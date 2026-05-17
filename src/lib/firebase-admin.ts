import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

let adminApp: App;

if (!getApps().length) {
  // 서비스 계정 키가 있으면 사용, 없으면 프로젝트 ID만으로 초기화
  if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY);
    adminApp = initializeApp({
      credential: cert(serviceAccount),
    });
  } else {
    // Cloud Run/Vercel 등에서는 GOOGLE_APPLICATION_CREDENTIALS 또는 프로젝트 기본 인증 사용
    adminApp = initializeApp({
      projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    });
  }
} else {
  adminApp = getApps()[0];
}

export const adminAuth = getAuth(adminApp);
