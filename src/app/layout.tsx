import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import BottomNav from '@/components/layout/BottomNav';
import KakaoSDK from '@/components/KakaoSDK';
import OfflineBanner from '@/components/ui/OfflineBanner';
import InstallBanner from '@/components/ui/InstallBanner';

export const metadata: Metadata = {
  metadataBase: new URL('https://ildao.vercel.app'),
  title: '일다오 - 건설/일용직 구인구직',
  description: '건설현장, 일용직 일자리를 빠르게 찾아보세요. 구인·구직·공수계산까지 한번에.',
  manifest: '/manifest.json',
  // 파비콘/애플 아이콘은 src/app/icon.png · apple-icon.png (Next 관례)로 자동 처리
  appleWebApp: {
    capable: true,
    title: '일다오',
    statusBarStyle: 'default',
  },
  // 카톡·SNS 공유 미리보기 — og:image는 src/app/opengraph-image.png(Next 관례)로 자동
  openGraph: {
    title: '일다오 - 건설/일용직 구인구직',
    description: '건설현장, 일용직 일자리를 빠르게 찾아보세요. 구인·구직·공수계산까지 한번에.',
    siteName: '일다오',
    locale: 'ko_KR',
    type: 'website',
    url: 'https://ildao.vercel.app',
  },
  twitter: {
    card: 'summary_large_image',
    title: '일다오 - 건설/일용직 구인구직',
    description: '건설현장, 일용직 일자리를 빠르게 찾아보세요.',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#2563eb',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ko">
      <body>
        {/* 카카오 SDK v2 로드 및 초기화 (Client Component) */}
        <KakaoSDK />
        {/* 전역 오프라인 배너 (P3-2) */}
        <OfflineBanner />
        <AuthProvider>
          {/* 메인 콘텐츠 영역 */}
          <main className="main-content min-h-screen max-w-lg mx-auto">
            {children}
          </main>
          {/* 하단 네비게이션 바 */}
          <BottomNav />
          {/* PWA 설치 유도 배너 (P3-3) */}
          <InstallBanner />
        </AuthProvider>
      </body>
    </html>
  );
}
