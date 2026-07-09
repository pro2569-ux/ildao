import type { JobPost } from '@/types';

// ===== 지역 (P2-6) =====

/**
 * 지역(시/도) 목록 — 공고 작성 폼(시/도 select)과 목록 필터 칩에서 공용 사용.
 * '전국'은 필터 전용 값(작성 폼에서는 실제 시/도만 저장 권장).
 */
export const REGIONS = [
  '전국',
  '서울',
  '경기',
  '인천',
  '부산',
  '대구',
  '광주',
  '대전',
  '울산',
  '세종',
  '강원',
  '충북',
  '충남',
  '전북',
  '전남',
  '경북',
  '경남',
  '제주',
] as const;

/** REGIONS의 원소 타입 */
export type Region = (typeof REGIONS)[number];

/**
 * 지역 prefix 매칭 (P2-6) — 클라이언트 필터 전용.
 * - job.region이 있으면: region이 필터값으로 시작하는지 확인 (예: '서울' 칩 == '서울' 저장값)
 * - region이 없는 옛 공고는: location.address가 필터값으로 시작하는지로 대체 판별
 * - 필터가 없거나 '전국'이면 항상 true
 * ※ Firestore 쿼리에 region where를 추가하지 말 것 (복합 인덱스 방지 — 반드시 클라이언트에서 사용).
 */
export function matchesRegion(
  job: Pick<JobPost, 'region' | 'location'>,
  region?: string
): boolean {
  if (!region || region === '전국') return true;
  if (job.region) return job.region.startsWith(region);
  return job.location?.address?.startsWith(region) ?? false;
}
