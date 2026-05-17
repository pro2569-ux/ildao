interface KakaoAuth {
  authorize: (options: { redirectUri: string; scope?: string }) => void;
}
interface KakaoSDK {
  init: (appKey: string) => void;
  isInitialized: () => boolean;
  Auth: KakaoAuth;
}
interface Window {
  Kakao: KakaoSDK;
}
