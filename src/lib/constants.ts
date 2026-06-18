/** 공용 상수 */

// 타입 전용 import — 런타임에 소거되므로 types↔constants 순환 의존을 만들지 않음
import type { WeatherType } from '@/types';

/** 직종 카테고리 (단일 소스 — types의 JobCategory 타입이 여기서 파생됨) */
export const JOB_CATEGORIES = [
  '철근', '목공', '설비', '전기', '도장', '용접', '타일', '미장', '방수', '조적', '비계', '잡역', '기타',
] as const;

/** 시/도 지역 목록 (구인글 지역, 구직자 선호 지역 공통) */
export const REGIONS = [
  '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
] as const;

// 약칭이 전체명의 접두사와 다른 시/도 (충청/전라/경상 → 북/남)
const REGION_ALIASES: Record<string, (typeof REGIONS)[number]> = {
  충청북도: '충북', 충청남도: '충남',
  전라북도: '전북', 전라남도: '전남',
  경상북도: '경북', 경상남도: '경남',
};

/**
 * 카카오 지오코딩이 반환하는 시/도 전체 명칭('서울특별시'·'충청북도'·'강원특별자치도' 등)을
 * REGIONS의 표준 약칭('서울'·'충북'·'강원')으로 정규화한다. 매칭 실패 시 null.
 * 지역 필터가 where('region','==',...) 정확일치라 저장값이 REGIONS와 동일해야 누락되지 않음 (DATA-01).
 */
export function normalizeRegion(raw: string): (typeof REGIONS)[number] | null {
  const token = (raw || '').trim();
  if (!token) return null;
  const exact = REGIONS.find((r) => r === token);
  if (exact) return exact;
  if (REGION_ALIASES[token]) return REGION_ALIASES[token];
  // 접두사 일치: '서울특별시'→'서울', '경기도'→'경기', '전북특별자치도'→'전북'
  return REGIONS.find((r) => token.startsWith(r)) ?? null;
}

/** 날씨 옵션 (공수 계산기) */
export const WEATHER_OPTIONS: { type: WeatherType; icon: string; label: string }[] = [
  { type: 'sunny', icon: '☀️', label: '맑음' },
  { type: 'cloudy', icon: '☁️', label: '흐림' },
  { type: 'rainy', icon: '🌧️', label: '비' },
  { type: 'snowy', icon: '❄️', label: '눈' },
  { type: 'windy', icon: '💨', label: '바람' },
  { type: 'none', icon: '➖', label: '없음' },
];

/** 공고 상태 → 뱃지 표시(텍스트/색상) 매핑 */
export function jobStatusBadge(status: string): { text: string; className: string } {
  switch (status) {
    case 'open':
      return { text: '모집중', className: 'bg-green-100 text-green-600' };
    case 'closed':
      return { text: '마감', className: 'bg-gray-100 text-gray-500' };
    case 'in_progress':
      return { text: '진행중', className: 'bg-blue-100 text-blue-600' };
    case 'completed':
      return { text: '완료', className: 'bg-gray-100 text-gray-400' };
    default:
      return { text: status, className: 'bg-gray-100 text-gray-500' };
  }
}
