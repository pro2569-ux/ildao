import { ApplicationStatus, JobStatus } from '@/types';

/**
 * 상태 뱃지 (PHASE 2 공통 — P2-5)
 * 공고 상태와 지원 상태를 통일된 색/문구로 표시.
 * - 공고: open=초록 "모집중" / in_progress=파랑 "진행중" / closed=회색 "마감" / completed=회색 "완료"
 * - 지원: pending=노랑 "대기중" / accepted=초록 "수락됨" / rejected=회색 "거절됨"
 *
 * 사용 예:
 *   <StatusBadge status={job.status} />            // "모집중" 등
 *   <StatusBadge status={application.status} />    // "대기중" 등
 *   <StatusBadge status="accepted" size="md" />    // 큰 뱃지 (text-base)
 */

export type BadgeStatus = JobStatus | ApplicationStatus;

interface StatusBadgeProps {
  /** 공고(JobStatus) 또는 지원(ApplicationStatus) 상태 값 */
  status: BadgeStatus;
  /** sm=text-sm(기본) / md=text-base */
  size?: 'sm' | 'md';
  /** 추가 클래스 (마진 등) */
  className?: string;
}

const STATUS_MAP: Record<BadgeStatus, { label: string; color: string }> = {
  // 공고 상태
  open: { label: '모집중', color: 'bg-ok-50 text-ok-700' },
  in_progress: { label: '진행중', color: 'bg-primary-50 text-primary-700' },
  closed: { label: '마감', color: 'bg-paper text-ink-soft' },
  completed: { label: '완료', color: 'bg-paper text-ink-soft' },
  // 지원 상태
  pending: { label: '대기중', color: 'bg-warn-50 text-warn' },
  accepted: { label: '수락됨', color: 'bg-ok-50 text-ok-700' },
  rejected: { label: '거절됨', color: 'bg-paper text-ink-soft' },
};

export default function StatusBadge({
  status,
  size = 'sm',
  className = '',
}: StatusBadgeProps) {
  const info = STATUS_MAP[status] ?? {
    label: String(status),
    color: 'bg-gray-100 text-gray-600',
  };
  const sizeClass =
    size === 'md' ? 'text-base px-3 py-1.5' : 'text-sm px-2.5 py-1';

  return (
    <span
      className={`inline-flex items-center rounded-full font-semibold whitespace-nowrap ${sizeClass} ${info.color} ${className}`}
    >
      {info.label}
    </span>
  );
}
