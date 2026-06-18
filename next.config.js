const withPWA = require('next-pwa')({
  dest: 'public',
  register: true,
  skipWaiting: true,
  disable: process.env.NODE_ENV === 'development', // 개발 중엔 PWA 비활성화
});

/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  images: {
    // Firebase/Google 프로필 사진 최적화 허용 (사용자 임의 URL은 컴포넌트에서 unoptimized 처리)
    remotePatterns: [
      { protocol: 'https', hostname: 'lh3.googleusercontent.com' },
    ],
  },
};

module.exports = withPWA(nextConfig);
