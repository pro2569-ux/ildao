'use client';

/**
 * FCM 푸시 알림 클라이언트 헬퍼 (P3-1)
 *
 * - VAPID 키(NEXT_PUBLIC_FIREBASE_VAPID_KEY)가 없으면 모든 기능이 조용히 no-op (콘솔 warn 1회).
 *   키를 발급받아 .env.local 에 넣으면 코드 수정 없이 바로 동작한다.
 * - 토큰은 users/{uid} 문서의 fcmTokens 배열(arrayUnion/arrayRemove)로 관리.
 * - 서비스워커는 next-pwa의 /sw.js(루트 스코프)와 충돌하지 않도록
 *   별도 스코프(/firebase-cloud-messaging-push-scope)로 등록한다.
 */

import { getToken, deleteToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import type { User } from 'firebase/auth';
import { db, getMessagingInstance } from './firebase';

const VAPID_KEY = process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY;

/** FCM 전용 서비스워커 스코프 (next-pwa sw.js 와 공존) */
const FCM_SW_SCOPE = '/firebase-cloud-messaging-push-scope';

let warnedNoVapid = false;

/** VAPID 키 미설정 안내 (1회만) */
function warnNoVapidOnce(): void {
  if (!warnedNoVapid) {
    warnedNoVapid = true;
    console.warn(
      '[FCM] NEXT_PUBLIC_FIREBASE_VAPID_KEY가 설정되지 않아 푸시 알림이 비활성화되었습니다. ' +
        'Firebase 콘솔 > 프로젝트 설정 > 클라우드 메시징 > 웹 푸시 인증서에서 키를 발급받아 .env.local에 넣어주세요.'
    );
  }
}

/** 이 브라우저에서 푸시를 쓸 수 있는 기본 조건 확인 */
function isBrowserSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'Notification' in window &&
    'serviceWorker' in navigator
  );
}

/** FCM 서비스워커 등록 (별도 스코프) */
async function registerFcmServiceWorker(): Promise<ServiceWorkerRegistration> {
  return navigator.serviceWorker.register('/firebase-messaging-sw.js', {
    scope: FCM_SW_SCOPE,
  });
}

/**
 * 푸시 알림 켜기
 * 권한 요청 → FCM 토큰 발급 → users/{uid}.fcmTokens 에 저장
 */
export async function enablePush(
  uid: string
): Promise<'granted' | 'denied' | 'unsupported'> {
  try {
    if (!VAPID_KEY) {
      warnNoVapidOnce();
      return 'unsupported';
    }
    if (!isBrowserSupported()) return 'unsupported';

    const messaging = await getMessagingInstance();
    if (!messaging) return 'unsupported';

    const permission = await Notification.requestPermission();
    if (permission !== 'granted') return 'denied';

    const registration = await registerFcmServiceWorker();
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    });
    if (!token) return 'unsupported';

    // 토큰 저장 — firestore.ts를 거치지 않고 직접 기록 (동시 작업 충돌 방지)
    await updateDoc(doc(db, 'users', uid), { fcmTokens: arrayUnion(token) });

    // 켠 직후부터 포그라운드 알림도 받도록 리스너 등록
    void listenForegroundMessages();

    return 'granted';
  } catch (error) {
    console.error('[FCM] 푸시 알림 켜기 실패:', error);
    return 'unsupported';
  }
}

/**
 * 푸시 알림 끄기
 * 현재 기기 토큰을 삭제하고 users/{uid}.fcmTokens 에서 제거
 */
export async function disablePush(uid: string): Promise<void> {
  try {
    if (!VAPID_KEY) {
      warnNoVapidOnce();
      return;
    }
    if (!isBrowserSupported()) return;

    const messaging = await getMessagingInstance();
    if (!messaging) return;

    const registration = await registerFcmServiceWorker();
    // 현재 기기의 토큰을 알아낸 뒤 제거
    const token = await getToken(messaging, {
      vapidKey: VAPID_KEY,
      serviceWorkerRegistration: registration,
    }).catch(() => null);

    if (token) {
      await updateDoc(doc(db, 'users', uid), {
        fcmTokens: arrayRemove(token),
      }).catch(() => {});
    }
    await deleteToken(messaging).catch(() => {});
  } catch (error) {
    console.error('[FCM] 푸시 알림 끄기 실패:', error);
  }
}

let foregroundListenerBound = false;

/**
 * 포그라운드 메시지 리스너 등록 (중복 등록 방지)
 * 앱을 보고 있는 중에 온 메시지를 Notification API로 표시
 */
export async function listenForegroundMessages(): Promise<void> {
  try {
    if (!VAPID_KEY) {
      warnNoVapidOnce();
      return;
    }
    if (!isBrowserSupported() || foregroundListenerBound) return;
    if (Notification.permission !== 'granted') return;

    const messaging = await getMessagingInstance();
    if (!messaging) return;

    foregroundListenerBound = true;
    onMessage(messaging, (payload) => {
      try {
        const title = payload.notification?.title || payload.data?.title || '일다오';
        const body = payload.notification?.body || payload.data?.body || '';
        const url = payload.data?.url;

        const notification = new Notification(title, {
          body,
          icon: '/icons/icon-192x192.svg',
          data: { url },
        });
        notification.onclick = () => {
          window.focus();
          if (url) window.location.href = url;
          notification.close();
        };
      } catch (error) {
        console.error('[FCM] 포그라운드 알림 표시 실패:', error);
      }
    });
  } catch (error) {
    console.error('[FCM] 포그라운드 리스너 등록 실패:', error);
  }
}

/** 현재 브라우저에서 알림 권한이 허용되어 있는지 (설정 화면 배지용) */
export function isPushPermissionGranted(): boolean {
  return isBrowserSupported() && Notification.permission === 'granted';
}

/**
 * 다른 사용자에게 푸시 발송 요청 (fire-and-forget)
 * /api/notify 를 호출하며, 어떤 실패도 절대 throw 하지 않는다 —
 * 지원/수락 등 본 동작이 알림 실패로 막히면 안 되기 때문.
 */
export async function notifyUser(
  currentUser: User,
  payload: { toUserId: string; title: string; body: string; url: string }
): Promise<void> {
  try {
    const idToken = await currentUser.getIdToken();
    await fetch('/api/notify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(payload),
    });
  } catch (error) {
    // 알림 발송 실패는 본 기능에 영향 없음 — 조용히 기록만
    console.warn('[FCM] 알림 발송 요청 실패(무시):', error);
  }
}
