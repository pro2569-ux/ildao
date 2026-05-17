import type { Metadata, Viewport } from 'next';
import './globals.css';
import { AuthProvider } from '@/contexts/AuthContext';
import BottomNav from '@/components/layout/BottomNav';
import KakaoSDK from '@/components/KakaoSDK';

export const metadata: Metadata = {
  title: '일다오 - 건설/일용직 구인구직',
  description: '건설현장, 일용직 일자리를 빠르게 찾아보세요. 구인·구직·공수계산까지 한번에.',
  manifest: '/manifest.json',
  icons: {
    icon: '/icons/icon-192x192.png',
    apple: '/icons/icon-192x192.png',
  },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
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
        <AuthProvider>
          {/* 카카오 SDK 로드 */}
          <KakaoSDK />
          {/* 메인 콘텐츠 영역 */}
          <main className="main-content min-h-screen max-w-lg mx-auto">
            {children}
          </main>
          {/* 하단 네비게이션 바 */}
          <BottomNav />
        </AuthProvider>
      </body>
    </html>
  );
}
