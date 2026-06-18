import type { DailyWorkRecord, TeamMember, TeamDailyWork } from '@/types';

/**
 * 공수/급여 계산 순수 함수 (#328 — UI에서 분리해 테스트 가능하게)
 * 급여는 기록별로 저장된 그 날의 일당으로 합산하고, 일당 미입력(0/undefined) 기록만
 * 현재 입력값(dailyWageInput)으로 보정한다.
 */

/** 월간 요약 (개인용) */
export function calculateMonthlySummary(records: DailyWorkRecord[], dailyWageInput: number) {
  let totalManDay = 0;
  let overtimeCount = 0;
  let dayOffCount = 0;
  let extensionCount = 0;
  let totalExpense = 0;
  let estimatedWage = 0;
  for (const record of records) {
    totalManDay += record.manDay;
    if (record.overtime) overtimeCount++;
    if (record.dayOff) dayOffCount++;
    if (record.extension) extensionCount++;
    totalExpense += record.expense || 0;
    estimatedWage += record.manDay * (record.dailyWage || dailyWageInput);
  }
  return { totalManDay, overtimeCount, dayOffCount, extensionCount, totalExpense, estimatedWage };
}

/** 기간 합계 (개인용) */
export function calculatePeriodSummary(records: DailyWorkRecord[], dailyWageInput: number) {
  let totalManDay = 0;
  let totalExpense = 0;
  let estimatedWage = 0;
  for (const r of records) {
    totalManDay += r.manDay;
    totalExpense += r.expense || 0;
    estimatedWage += r.manDay * (r.dailyWage || dailyWageInput);
  }
  return { totalManDay, totalExpense, estimatedWage };
}

/** 팀 전체 요약 (팀장용) — 멤버별 공수 합산 후 멤버 일당으로 급여 계산 */
export function calculateTeamSummary(members: TeamMember[], works: TeamDailyWork[]) {
  let totalManDay = 0;
  let totalWage = 0;
  for (const member of members) {
    const memberTotal = works
      .filter((w) => w.memberId === member.id)
      .reduce((sum, w) => sum + w.manDay, 0);
    totalManDay += memberTotal;
    totalWage += memberTotal * (member.dailyWage || 0);
  }
  return { totalManDay, totalWage };
}
