'use client';

import Script from 'next/script';

// 하드코딩 폴백 없음 — env 미설정을 조용히 가리면 배포 설정 오류를 영영 발견하지 못함 (LAUNCH-PLAN B6)
const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JS_KEY;

export default function KakaoSDK() {
  if (!KAKAO_JS_KEY) {
    if (typeof window !== 'undefined') {
      console.error('[Kakao] NEXT_PUBLIC_KAKAO_JS_KEY가 설정되지 않아 카카오 SDK를 로드하지 않습니다.');
    }
    return null;
  }
  return (
    <Script
      src="https://t1.kakaocdn.net/kakao_js_sdk/2.7.4/kakao.min.js"
      strategy="afterInteractive"
      onLoad={() => {
        if (window.Kakao && !window.Kakao.isInitialized()) {
          window.Kakao.init(KAKAO_JS_KEY);
          console.log('Kakao SDK initialized:', window.Kakao.isInitialized());
        }
      }}
    />
  );
}
