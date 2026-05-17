import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

// POST /api/auth/kakao
// 카카오 인증 코드를 받아 Firebase Custom Token 반환
//
// 필요한 환경 변수:
//   KAKAO_REST_API_KEY          - 카카오 REST API 키
//   NEXT_PUBLIC_KAKAO_REDIRECT_URI (선택) - 리다이렉트 URI (기본값: /auth/kakao/callback)

export async function POST(request: NextRequest) {
  try {
    const { code } = await request.json();

    if (!code) {
      return NextResponse.json({ error: '인증 코드가 없습니다.' }, { status: 400 });
    }

    if (!adminAuth) {
      return NextResponse.json({ error: 'Firebase Admin이 초기화되지 않았습니다. 환경 변수를 확인하세요.' }, { status: 500 });
    }

    const redirectUri =
      process.env.NEXT_PUBLIC_KAKAO_REDIRECT_URI ||
      `${request.nextUrl.origin}/auth/kakao/callback`;

    // 1. 인증 코드 → 액세스 토큰 교환
    const tokenResponse = await fetch('https://kauth.kakao.com/oauth/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: process.env.KAKAO_REST_API_KEY || '',
        redirect_uri: redirectUri,
        code,
      }),
    });

    if (!tokenResponse.ok) {
      const errorData = await tokenResponse.text();
      console.error('카카오 토큰 교환 실패:', errorData);
      return NextResponse.json({ error: '카카오 토큰 교환에 실패했습니다.' }, { status: 400 });
    }

    const tokenData = await tokenResponse.json();
    const accessToken: string = tokenData.access_token;

    // 2. 액세스 토큰 → 카카오 사용자 정보 조회
    const userResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    if (!userResponse.ok) {
      console.error('카카오 사용자 정보 조회 실패');
      return NextResponse.json({ error: '카카오 사용자 정보 조회에 실패했습니다.' }, { status: 400 });
    }

    const kakaoUser = await userResponse.json();
    const kakaoId: string = String(kakaoUser.id);
    const kakaoAccount = kakaoUser.kakao_account || {};
    const profile = kakaoAccount.profile || {};

    const email: string | undefined = kakaoAccount.email;
    const displayName: string = profile.nickname || '카카오 사용자';
    const photoURL: string | undefined = profile.profile_image_url;

    // 3. Firebase UID 생성 (카카오 ID 기반)
    const uid = `kakao:${kakaoId}`;

    // 4. Firebase 사용자 생성 또는 업데이트
    try {
      await adminAuth.updateUser(uid, {
        displayName,
        ...(email && { email }),
        ...(photoURL && { photoURL }),
      });
    } catch (updateError: any) {
      if (updateError.code === 'auth/user-not-found') {
        // 신규 사용자 생성
        await adminAuth.createUser({
          uid,
          displayName,
          ...(email && { email }),
          ...(photoURL && { photoURL }),
        });
      } else {
        throw updateError;
      }
    }

    // 5. Firebase Custom Token 생성
    const customToken = await adminAuth.createCustomToken(uid, {
      provider: 'kakao',
      kakaoId,
    });

    return NextResponse.json({ customToken });
  } catch (error) {
    console.error('카카오 로그인 API 오류:', error);
    return NextResponse.json({ error: '서버 오류가 발생했습니다.' }, { status: 500 });
  }
}
