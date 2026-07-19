import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getAuth, Auth } from 'firebase-admin/auth';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getMessaging, Messaging } from 'firebase-admin/messaging';

// Firebase Admin SDK 초기화
// 필요한 환경 변수:
//   FIREBASE_PROJECT_ID   - Firebase 프로젝트 ID
//   FIREBASE_CLIENT_EMAIL - 서비스 계정 이메일
//   FIREBASE_PRIVATE_KEY  - 서비스 계정 개인 키 (줄바꿈 \n 포함)

let adminAuth: Auth | null = null;
let adminDb: Firestore | null = null;
let adminMessaging: Messaging | null = null;

try {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = process.env.FIREBASE_PRIVATE_KEY;

  if (projectId && clientEmail && privateKey) {
    let app: App;
    if (!getApps().length) {
      app = initializeApp({
        credential: cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      app = getApps()[0];
    }
    adminAuth = getAuth(app);
    adminDb = getFirestore(app);
    adminMessaging = getMessaging(app);
  } else {
    console.warn('Firebase Admin: 환경 변수 미설정 - 카카오 로그인/푸시 알림 비활성화');
  }
} catch (error) {
  console.error('Firebase Admin 초기화 실패:', error);
}

export { adminAuth, adminDb, adminMessaging };
