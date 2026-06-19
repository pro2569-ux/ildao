/** 날짜·통화 포맷 유틸 (화면별 중복 정의 통합) */

/** Date → "M/D" (목록·피드용 짧은 형식). 값이 없으면 빈 문자열. */
export function formatDate(date?: Date | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return ''; // Invalid Date → 'NaN/NaN' 출력 방지 (FORMAT-01)
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

/** Date → "YYYY.M.D" (상세·관리 화면용 긴 형식). 값이 없으면 빈 문자열. */
export function formatDateFull(date?: Date | null): string {
  if (!date) return '';
  const d = new Date(date);
  if (isNaN(d.getTime())) return ''; // Invalid Date → 'NaN.NaN.NaN' 출력 방지 (FORMAT-01)
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
}

/** 숫자 → "N원" (한국 원화). 값이 없으면 '-'. */
export function formatWon(amount?: number | null): string {
  if (amount == null) return '-';
  return `${amount.toLocaleString('ko-KR')}원`;
}
