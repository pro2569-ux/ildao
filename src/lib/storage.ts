import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from './firebase';

/** 프로필 사진 최대 크기 (5MB) */
const MAX_PROFILE_IMAGE_SIZE = 5 * 1024 * 1024;
/** 리사이즈 목표 최대 변 길이(px) */
const MAX_DIMENSION = 512;
/** JPEG 품질 */
const JPEG_QUALITY = 0.82;

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
 * 사진을 캔버스로 리사이즈해 JPEG Blob으로 반환
 * - 최대 변 512px로 축소(작으면 원본 크기 유지), image/jpeg 0.82
 * - EXIF 회전 대응: createImageBitmap({imageOrientation:'from-image'}) 우선, 미지원 시 <img> 폴백
 * - 실패 시 예외를 던지며, 호출부는 원본 업로드로 폴백
 */
async function resizeImage(file: File): Promise<Blob> {
  let width: number;
  let height: number;
  let source: CanvasImageSource;

  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
    width = bitmap.width;
    height = bitmap.height;
    source = bitmap;
  } else {
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const fr = new FileReader();
      fr.onload = () => resolve(fr.result as string);
      fr.onerror = () => reject(fr.error);
      fr.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const im = new Image();
      im.onload = () => resolve(im);
      im.onerror = () => reject(new Error('이미지 로드 실패'));
      im.src = dataUrl;
    });
    width = img.naturalWidth;
    height = img.naturalHeight;
    source = img;
  }

  const scale = Math.min(1, MAX_DIMENSION / Math.max(width, height));
  const w = Math.max(1, Math.round(width * scale));
  const h = Math.max(1, Math.round(height * scale));

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('캔버스 컨텍스트를 만들 수 없어요.');
  ctx.drawImage(source, 0, 0, w, h);

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY)
  );
  if (!blob) throw new Error('이미지 변환에 실패했어요.');
  return blob;
}

/**
 * 프로필 사진을 Firebase Storage에 업로드하고 다운로드 URL을 반환
 * - 경로: profile-images/{uid} (사용자당 1장, 재업로드 시 덮어씀)
 * - 업로드 전 512px·JPEG로 리사이즈(폰 카메라 원본 수 MB → 보통 30~80KB)해 목록 로딩·과금 절감
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

  // 업로드 대상: 가능하면 리사이즈본, 실패하면 원본
  let uploadTarget: Blob = file;
  let contentType = file.type;
  try {
    const resized = await resizeImage(file);
    if (resized.size > 0 && resized.size < file.size) {
      uploadTarget = resized;
      contentType = 'image/jpeg';
    }
  } catch (err) {
    console.warn('사진 리사이즈 실패 — 원본으로 업로드합니다:', err);
  }

  try {
    const storageRef = ref(storage, `profile-images/${uid}`);
    await uploadBytes(storageRef, uploadTarget, { contentType });
    return await getDownloadURL(storageRef);
  } catch (err) {
    console.error('프로필 사진 업로드 실패:', err);
    const code = (err as { code?: string })?.code;
    throw new Error(code ? storageErrorMessage(code) : '사진 올리기에 실패했습니다. 잠시 후 다시 시도해주세요.');
  }
}
