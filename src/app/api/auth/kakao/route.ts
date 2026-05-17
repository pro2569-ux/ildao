import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';

/**
 * 카카오 로그인 API 라우트
 * 카카오 액세스 토큰을 받아 사용자 정보를 확인하고
 * Firebase Custom Token을 발급합니다.
 */
export async function POST(request: NextRequest) {
  try {
    const { accessToken } = await request.json();

    if (!accessToken) {
      return NextResponse.json(
        { error: '카카오 액세스 토큰이 필요합니다.' },
        { status: 400 }
      );
    }

    // 카카오 API로 사용자 정보 조회
    const kakaoUserResponse = await fetch('https://kapi.kakao.com/v2/user/me', {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/x-www-form-urlencoded;charset=utf-8',
      },
    });

    if (!kakaoUserResponse.ok) {
      return NextResponse.json(
        { error: '카카오 사용자 정보를 가져올 수 없습니다.' },
        { status: 401 }
      );
    }

    const kakaoUser = await kakaoUserResponse.json();
    const kakaoId = kakaoUser.id;
    const kakaoAccount = kakaoUser.kakao_account || {};
    const profile = kakaoAccount.profile || {};

    // Firebase UID: kakao: prefix로 고유하게 생성
    const firebaseUid = `kakao:${kakaoId}`;

    // Firebase Custom Token 생성
    const customToken = await adminAuth.createCustomToken(firebaseUid, {
      provider: 'kakao',
      kakaoId: String(kakaoId),
      displayName: profile.nickname || '',
      photoURL: profile.profile_image_url || '',
      email: kakaoAccount.email || '',
    });

    return NextResponse.json({
      customToken,
      user: {
        uid: firebaseUid,
        displayName: profile.nickname || '',
        photoURL: profile.profile_image_url || '',
        email: kakaoAccount.email || '',
      },
    });
  } catch (error: any) {
    console.error('[Kakao Auth] 오류:', error);
    return NextResponse.json(
      { error: error.message || '서버 오류가 발생했습니다.' },
      { status: 500 }
    );
  }
}
