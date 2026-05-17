'use client';

import Script from 'next/script';

declare global {
  interface Window {
    Kakao: any;
  }
}

const KAKAO_JS_KEY = process.env.NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY || '80b8cae0927e7a3757684435be41eaf8';

export default function KakaoSDK() {
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
