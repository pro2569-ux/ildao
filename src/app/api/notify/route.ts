import { NextRequest, NextResponse } from 'next/server';
import { FieldValue } from 'firebase-admin/firestore';
import { adminAuth, adminDb, adminMessaging } from '@/lib/firebase-admin';

// POST /api/notify — FCM 푸시 알림 발송 (P3-1)
//
// body: { toUserId: string, title: string, body: string, url: string }
// 인증: Authorization: Bearer <Firebase ID token>
//
// 설계 원칙: 알림 발송 실패가 지원/수락 등 본 기능을 절대 막지 않는다.
// - Admin 환경 변수 미설정 / 대상 토큰 없음 → 200 + skipped
// - 발송 중 서버 오류 → 200 + skipped (클라이언트는 fire-and-forget)
// - 무효 토큰(unregistered 등)은 users 문서의 fcmTokens에서 제거

/** 발송 실패 응답에서 토큰을 제거해야 하는 오류 코드 */
const INVALID_TOKEN_CODES = new Set([
  'messaging/registration-token-not-registered',
  'messaging/invalid-registration-token',
  'messaging/invalid-argument',
]);

export async function POST(request: NextRequest) {
  try {
    // Admin 미설정 — 푸시 기능만 조용히 건너뜀 (카카오 로그인 비활성 동작과 일관)
    if (!adminAuth || !adminDb || !adminMessaging) {
      return NextResponse.json({ skipped: true, reason: 'admin-not-configured' });
    }

    // 인증: Firebase ID 토큰 검증
    const authHeader = request.headers.get('authorization') || '';
    const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
    if (!idToken) {
      return NextResponse.json({ error: '인증 토큰이 없습니다.' }, { status: 401 });
    }
    let senderUid = '';
    try {
      const decoded = await adminAuth.verifyIdToken(idToken);
      senderUid = decoded.uid;
    } catch {
      return NextResponse.json({ error: '인증에 실패했습니다.' }, { status: 401 });
    }

    const { toUserId, title, body, url } = await request.json();
    if (!toUserId || typeof toUserId !== 'string' || !title || typeof title !== 'string') {
      return NextResponse.json({ error: 'toUserId와 title이 필요합니다.' }, { status: 400 });
    }

    // 남용 추적용 — 누가 누구에게 보냈는지 기록(발신자 uid 확보)
    console.log(`[notify] from=${senderUid} to=${toUserId}`);

    // 제목/본문 길이 제한 (스팸·과다 payload 방지)
    const safeTitle = title.slice(0, 100);
    const safeBody = (typeof body === 'string' ? body : '').slice(0, 300);

    // 대상 사용자의 FCM 토큰 조회
    const userRef = adminDb.collection('users').doc(toUserId);
    const userSnap = await userRef.get();
    const tokens: string[] = (userSnap.get('fcmTokens') || []).filter(
      (t: unknown): t is string => typeof t === 'string' && t.length > 0
    );
    if (tokens.length === 0) {
      return NextResponse.json({ skipped: true, reason: 'no-tokens' });
    }

    // 링크는 내부 경로('/'로 시작, '//' 제외)만 허용 — 외부 http URL 주입(피싱) 차단
    const path =
      typeof url === 'string' && url.startsWith('/') && !url.startsWith('//') ? url : '/';
    const link = new URL(path, request.nextUrl.origin).toString();

    const result = await adminMessaging.sendEachForMulticast({
      tokens,
      notification: {
        title: safeTitle,
        body: safeBody,
      },
      data: { url: path },
      webpush: {
        fcmOptions: { link },
      },
    });

    // 무효 토큰 정리
    const invalidTokens = result.responses
      .map((res, i) =>
        !res.success && res.error && INVALID_TOKEN_CODES.has(res.error.code)
          ? tokens[i]
          : null
      )
      .filter((t): t is string => t !== null);

    if (invalidTokens.length > 0) {
      await userRef
        .update({ fcmTokens: FieldValue.arrayRemove(...invalidTokens) })
        .catch((error) => console.warn('무효 FCM 토큰 정리 실패:', error));
    }

    return NextResponse.json({
      successCount: result.successCount,
      failureCount: result.failureCount,
      removedTokens: invalidTokens.length,
    });
  } catch (error) {
    // 발송 실패가 본 기능(지원/수락)을 막지 않도록 200 + skipped
    console.error('푸시 알림 발송 API 오류:', error);
    return NextResponse.json({ skipped: true, reason: 'send-error' });
  }
}
