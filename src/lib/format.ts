/**
 * 금액·날짜 공용 포맷 유틸 (PHASE 2 공통 — P2-3)
 *
 * 사용 예:
 *   import { formatWon, formatManwon, formatDate, isToday, isTomorrow } from '@/lib/format';
 *
 *   formatWon(250000)            // "250,000원"
 *   formatManwon(250000)         // "25만원"
 *   formatManwon(255000)         // "25만 5,000원"
 *   formatDate('2026-07-08')     // "7월 8일(수)"
 *   formatDate(job.startDate)    // Date 객체도 허용
 *   formatDate('2026-07-08', { withYear: true }) // "2026년 7월 8일(수)"
 *   isToday(job.startDate)       // 오늘이면 true  → "오늘" 강조 표시용
 *   isTomorrow('2026-07-08')     // 내일이면 true → "내일" 강조 표시용
 */

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

export type DateInput = string | number | Date;

/**
 * 다양한 입력을 로컬(KST) 기준 Date로 변환.
 * 'YYYY-MM-DD' 문자열은 반드시 로컬 자정으로 파싱한다 —
 * new Date('YYYY-MM-DD')는 UTC 자정으로 해석돼 타임존에 따라 날짜가 밀릴 수 있음.
 * 파싱 불가 시 null 반환.
 */
export function toLocalDate(input: DateInput): Date | null {
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === 'number') {
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  if (typeof input === 'string') {
    // 'YYYY-MM-DD' 또는 'YYYY-MM-DDTHH:mm...' 앞부분 → 로컬 자정으로 파싱
    const m = input.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (m) {
      return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
    }
    const d = new Date(input);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

/** 250000 → "250,000원" (유효하지 않은 값은 "0원") */
export function formatWon(amount: number): string {
  if (typeof amount !== 'number' || !isFinite(amount)) return '0원';
  return `${Math.round(amount).toLocaleString('ko-KR')}원`;
}

/**
 * 250000 → "25만원", 255000 → "25만 5,000원", 8000 → "8,000원"
 * (만원 단위 딱 떨어지면 "N만원", 아니면 "N만 M원", 1만원 미만은 formatWon과 동일)
 */
export function formatManwon(amount: number): string {
  if (typeof amount !== 'number' || !isFinite(amount)) return '0원';
  const won = Math.round(amount);
  const sign = won < 0 ? '-' : '';
  const abs = Math.abs(won);
  if (abs < 10000) return formatWon(won);
  const man = Math.floor(abs / 10000);
  const rest = abs % 10000;
  if (rest === 0) return `${sign}${man.toLocaleString('ko-KR')}만원`;
  return `${sign}${man.toLocaleString('ko-KR')}만 ${rest.toLocaleString('ko-KR')}원`;
}

/**
 * '2026-07-08' | Date → "7월 8일(수)"
 * withYear 옵션 시 "2026년 7월 8일(수)". 파싱 실패 시 빈 문자열.
 */
export function formatDate(
  input: DateInput,
  options?: { withYear?: boolean }
): string {
  const d = toLocalDate(input);
  if (!d) return '';
  const base = `${d.getMonth() + 1}월 ${d.getDate()}일(${WEEKDAYS_KO[d.getDay()]})`;
  return options?.withYear ? `${d.getFullYear()}년 ${base}` : base;
}

/** 두 Date가 같은 (로컬 기준) 연/월/일인지 */
function isSameLocalDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

/** 오늘(로컬/KST 기준)인지 판별 — "오늘 시작" 강조용 */
export function isToday(input: DateInput): boolean {
  const d = toLocalDate(input);
  if (!d) return false;
  return isSameLocalDay(d, new Date());
}

/** 내일(로컬/KST 기준)인지 판별 — "내일 시작" 강조용 */
export function isTomorrow(input: DateInput): boolean {
  const d = toLocalDate(input);
  if (!d) return false;
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return isSameLocalDay(d, tomorrow);
}
