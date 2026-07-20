import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/** 프로필 사진 최대 크기 (5MB) */
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;

/** Firebase Storage 에러 코드 → 사용자 안내 메시지 (원인 추적을 위해 코드도 함께 노출) */
function storageErrorMessage(code: string): string {
  switch (code) {
    case 'storage/unauthorized':
      return '사진을 저장할 권한이 없어요. 다시 로그인한 뒤 시도해주세요.';
    case 'storage/unauthenticated':
      return '로그인이 필요해요. 다시 로그인한 뒤 시도해주세요.';
    case 'storage/retry-limit-exceeded':
    case 'storage/server-file-wrong-size':
      return '네트워크가 불안정해 사진 올리기에 실패했어요. 잠시 후 다시 시도해주세요.';
    case 'storage/quota-exceeded':
      return '저장 공간 한도를 초과했어요. 잠시 후 다시 시도해주세요.';
    case 'storage/canceled':
      return '사진 올리기가 취소됐어요.';
    default:
      return `사진 올리기에 실패했어요. (${code})`;
  }
}

/**
 * 프로필 사진을 Firebase Storage에 업로드하고 다운로드 URL을 반환
 * - 경로: profile-images/{uid} (사용자당 1장, 재업로드 시 덮어씀)
 * - 이미지 파일 타입 / 5MB 크기 검증 포함
 * - 실패 시 사용자에게 보여줄 수 있는 한국어 메시지의 Error를 throw (Firebase 에러 코드 포함)
 */
export async function uploadProfileImage(uid: string, file: File): Promise<string> {
  // 이미지 파일인지 확인
  if (!file.type.startsWith('image/')) {
    throw new Error('이미지 파일만 올릴 수 있습니다.');
  }

  // 파일 크기 확인 (5MB 제한)
  if (file.size > MAX_PROFILE_IMAGE_SIZE) {
    throw new Error('사진 크기가 너무 큽니다. 5MB 이하 사진을 선택해주세요.');
  }

  try {
    const storageRef = ref(storage, `profile-images/${uid}`);
    await uploadBytes(storageRef, file, { contentType: file.type });
    return await getDownloadURL(storageRef);
  } catch (err) {
    console.error('프로필 사진 업로드 실패:', err);
    const code = (err as { code?: string })?.code;
    throw new Error(code ? storageErrorMessage(code) : '사진 올리기에 실패했습니다. 잠시 후 다시 시도해주세요.');
  }
}
