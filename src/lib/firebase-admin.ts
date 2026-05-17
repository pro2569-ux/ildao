import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

// Firebase Admin SDK 초기화
// 필요한 환경 변수:
//   FIREBASE_PROJECT_ID   - Firebase 프로젝트 ID
//   FIREBASE_CLIENT_EMAIL - 서비스 계정 이메일
//   FIREBASE_PRIVATE_KEY  - 서비스 계정 개인 키 (줄바꿈 \n 포함)

let app: App;
if (!getApps().length) {
  app = initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }),
  });
} else {
  app = getApps()[0];
}

export const adminAuth = getAuth(app);
