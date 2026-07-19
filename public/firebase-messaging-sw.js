/* eslint-disable no-undef */
/**
 * FCM 백그라운드 메시지 서비스워커 (P3-1)
 *
 * ⚠️ 배포 전 아래 firebaseConfig를 Firebase 콘솔 설정값으로 교체하세요.
 *    서비스워커는 Next.js 환경변수(process.env)를 읽을 수 없어서 값을 직접 적어야 합니다.
 *    각 값은 .env.local 의 다음 키와 같은 값입니다:
 *      apiKey            ← NEXT_PUBLIC_FIREBASE_API_KEY
 *      authDomain        ← NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *      projectId         ← NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *      storageBucket     ← NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 *      messagingSenderId ← NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *      appId             ← NEXT_PUBLIC_FIREBASE_APP_ID
 *    (NEXT_PUBLIC_* 값은 어차피 브라우저에 노출되는 공개 설정이라 여기 적어도 안전합니다)
 *
 * 이 파일은 next-pwa가 만드는 /sw.js 와 별개 스코프로 등록되어 공존합니다.
 * (src/lib/fcm.ts 에서 scope: '/firebase-cloud-messaging-push-scope' 로 등록)
 */

importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.14.1/firebase-messaging-compat.js');

// ⚠️ 배포 전 Firebase 콘솔 설정값으로 교체
const firebaseConfig = {
  apiKey: 'your_api_key_here',
  authDomain: 'your_project.firebaseapp.com',
  projectId: 'your_project_id',
  storageBucket: 'your_project.appspot.com',
  messagingSenderId: 'your_sender_id',
  appId: 'your_app_id',
};

/** 알림 클릭 → 해당 페이지로 이동 (기존 탭이 있으면 focus, 없으면 새로 열기) */
self.addEventListener('notificationclick', (event) => {
  const data = (event.notification && event.notification.data) || {};

  // FCM SDK가 자동 표시한 알림(FCM_MSG)은 SDK의 클릭 핸들러(fcmOptions.link)가 처리
  if (data.FCM_MSG) return;

  event.notification.close();
  const url = data.url || '/';
  const targetUrl = new URL(url, self.location.origin).href;

  event.waitUntil(
    self.clients
      .matchAll({ type: 'window', includeUncontrolled: true })
      .then((clientList) => {
        for (const client of clientList) {
          if ('focus' in client) {
            if ('navigate' in client) client.navigate(targetUrl);
            return client.focus();
          }
        }
        return self.clients.openWindow(targetUrl);
      })
  );
});

// firebaseConfig가 placeholder인 상태에서도 서비스워커 자체는 죽지 않도록 방어
try {
  firebase.initializeApp(firebaseConfig);
  const messaging = firebase.messaging();

  // 백그라운드 메시지 수신
  // notification 페이로드가 있으면 SDK가 자동으로 알림을 표시하므로(중복 방지),
  // 여기서는 data-only 메시지만 직접 표시한다.
  messaging.onBackgroundMessage((payload) => {
    if (payload.notification) return;

    const data = payload.data || {};
    const title = data.title || '일다오';
    self.registration.showNotification(title, {
      body: data.body || '',
      icon: '/icons/icon-192x192.svg',
      data: { url: data.url || '/' },
    });
  });
} catch (error) {
  // 설정값 미교체 등 초기화 실패 — 푸시만 비활성, 앱 동작에는 영향 없음
  console.warn('[firebase-messaging-sw] 초기화 실패 (설정값을 확인하세요):', error);
}
