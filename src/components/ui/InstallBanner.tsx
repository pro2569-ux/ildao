'use client';

import { useEffect, useState } from 'react';

/**
 * PWA 설치 유도 배너 (P3-3)
 * - Android/Chrome: beforeinstallprompt 이벤트를 가로채 [설치하기] 원탭 설치
 * - iOS Safari: 이벤트 미지원 → 공유 버튼 → '홈 화면에 추가' 수동 안내
 * - 이미 설치(standalone)됐거나 최근에 닫았으면(14일) 표시하지 않음
 * 매일 새벽 접속하는 사용자층의 재방문 경로를 홈 화면 아이콘으로 만드는 것이 목적.
 */

const DISMISS_KEY = 'ildao_install_banner_dismissed_at';
const DISMISS_DAYS = 14;

/** beforeinstallprompt 이벤트 타입 (표준 타입 정의에 없음) */
interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export default function InstallBanner() {
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null);
  const [isIosGuide, setIsIosGuide] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // 이미 홈 화면 앱으로 실행 중이면 표시 안 함
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as { standalone?: boolean }).standalone === true;
    if (standalone) return;

    // 최근에 닫았으면 표시 안 함
    try {
      const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
      if (dismissedAt && Date.now() - dismissedAt < DISMISS_DAYS * 86400000) return;
    } catch {
      // localStorage 접근 실패 시 그냥 표시
    }

    // Android/Chrome: 설치 프롬프트 이벤트 가로채기
    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setInstallEvent(e as BeforeInstallPromptEvent);
      setVisible(true);
    };
    // 설치 완료되면 배너 제거
    const handleInstalled = () => setVisible(false);

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleInstalled);

    // iOS(Safari 포함 모든 브라우저): beforeinstallprompt 미지원 → 수동 안내
    const ua = window.navigator.userAgent;
    const isIos =
      /iPhone|iPad|iPod/i.test(ua) ||
      // iPadOS 13+는 Macintosh로 표기됨 → 터치 지원 여부로 구분
      (/Macintosh/i.test(ua) && 'ontouchend' in document);
    if (isIos) {
      setIsIosGuide(true);
      setVisible(true);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  const dismiss = () => {
    setVisible(false);
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {}
  };

  const handleInstall = async () => {
    if (!installEvent) return;
    await installEvent.prompt();
    await installEvent.userChoice;
    // 수락/거절 무관하게 닫고 재노출 유예 (거절했는데 계속 뜨면 성가심)
    dismiss();
  };

  if (!visible) return null;

  return (
    <div
      className="fixed left-3 right-3 z-40 max-w-lg mx-auto"
      style={{ bottom: 'calc(84px + env(safe-area-inset-bottom))' }}
    >
      <div className="bg-gray-900 text-white rounded-2xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          {/* 앱 아이콘 모양 */}
          <div className="w-11 h-11 bg-primary-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-base font-bold">홈 화면에 일다오 추가</p>
            {isIosGuide && !installEvent ? (
              <p className="text-sm text-gray-300 mt-1 leading-relaxed">
                하단의 공유 버튼{' '}
                <svg className="w-4 h-4 inline -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2M12 4v12m0-12l-4 4m4-4l4 4" />
                </svg>
                {' '}을 누른 뒤{' '}
                <span className="font-semibold text-white">&lsquo;홈 화면에 추가&rsquo;</span>를
                선택하세요
              </p>
            ) : (
              <p className="text-sm text-gray-300 mt-1">
                앱처럼 바로 열어서 새벽 일자리를 놓치지 마세요
              </p>
            )}
          </div>

          <button
            onClick={dismiss}
            aria-label="설치 안내 닫기"
            className="w-11 h-11 -m-2 flex items-center justify-center flex-shrink-0 text-gray-400 hover:text-white"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Android/Chrome 원탭 설치 버튼 */}
        {installEvent && (
          <button
            onClick={handleInstall}
            className="w-full mt-3 min-h-[48px] bg-primary-500 hover:bg-primary-600 active:bg-primary-600 text-white text-base font-bold rounded-xl transition-colors"
          >
            설치하기
          </button>
        )}
      </div>
    </div>
  );
}
