import type { MetadataRoute } from 'next';

/**
 * robots.txt (#246)
 * - 공개 경로(/, /jobs, /jobs/[id])는 크롤링 허용 — SEO 유입 채널
 * - 개인화/인증/개인정보 경로는 차단
 * - sitemap은 배포 도메인 확정 후 추가 (metadataBase 또는 절대 URL 필요)
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: '*',
      allow: '/',
      disallow: [
        '/profile',
        '/my-jobs',
        '/my-applications',
        '/calculator',
        '/favorites',
        '/workers',
        '/login',
        '/register',
      ],
    },
  };
}
