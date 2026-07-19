'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getJobs, updateJob, deleteJob, getApplicantCounts } from '@/lib/firestore';
import { JobPost } from '@/types';
import ConfirmSheet from '@/components/ui/ConfirmSheet';
import ErrorState from '@/components/ui/ErrorState';
import LoadingSpinner from '@/components/ui/LoadingSpinner';
import StatusBadge from '@/components/ui/StatusBadge';
import BackButton from '@/components/ui/BackButton';
import { useToast } from '@/components/ui/Toast';
import { formatWon } from '@/lib/format';

/** 확인 바텀시트 대상 (마감 또는 삭제) */
type ConfirmTarget = { type: 'close' | 'delete'; job: JobPost };

/**
 * 내 공고 관리 페이지
 * - 올린 공고 목록
 * - 지원자 수 표시
 * - 수정/삭제/마감 기능
 */
export default function MyJobsPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast, toastElement } = useToast();
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [appCounts, setAppCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  // 마감/삭제 확인 바텀시트 상태
  const [confirmTarget, setConfirmTarget] = useState<ConfirmTarget | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (user) loadJobs();
  }, [user, authLoading]);

  const loadJobs = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const jobsData = await getJobs({ employerId: user!.uid });
      setJobs(jobsData);

      // 각 공고의 지원자 수 — getCountFromServer 병렬 집계 (P3-9, 문서 전체를 읽지 않음)
      const countMap = await getApplicantCounts(jobsData.map((job) => job.id), user!.uid);
      setAppCounts(Object.fromEntries(countMap));
    } catch (error) {
      console.error('공고 로드 실패:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  /** 확인 바텀시트에서 마감/삭제 확정 */
  const handleConfirmAction = async () => {
    if (!confirmTarget || actionLoading) return; // 처리 중 중복 탭 방지
    setActionLoading(true);
    setActionError(null);
    try {
      if (confirmTarget.type === 'close') {
        await updateJob(confirmTarget.job.id, { status: 'closed' });
        showToast('공고를 마감했어요');
      } else {
        await deleteJob(confirmTarget.job.id);
        showToast('공고를 삭제했어요');
      }
      setConfirmTarget(null);
      await loadJobs();
    } catch (error) {
      console.error(confirmTarget.type === 'close' ? '마감 실패:' : '삭제 실패:', error);
      setActionError(
        confirmTarget.type === 'close'
          ? '마감 처리에 실패했어요. 잠시 후 다시 시도해주세요.'
          : '삭제에 실패했어요. 잠시 후 다시 시도해주세요.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  /** 날짜 포맷 */
  const formatDate = (date: Date) => {
    const d = new Date(date);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  };

  /** 상단 헤더 */
  const header = (
    <div className="flex items-center justify-between mb-6">
      <div className="flex items-center gap-2">
        <BackButton className="-ml-2" />
        <h1 className="text-xl font-bold">내 공고</h1>
      </div>
      <Link
        href="/jobs/create"
        className="inline-flex items-center min-h-[44px] py-2.5 px-4 bg-primary-500 text-white text-base font-medium rounded-lg"
      >
        + 새 공고
      </Link>
    </div>
  );

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <LoadingSpinner />
      </div>
    );
  }

  // 로드 실패 — 빈 목록으로 위장하지 않고 재시도 화면 표시 (P2-3)
  if (loadError) {
    return (
      <div className="px-4 pt-6 pb-24">
        {header}
        <ErrorState title="공고을 불러오지 못했어요" onRetry={loadJobs} />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-24">
      {header}

      {/* 공고 목록 */}
      {jobs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-base mb-4">아직 올린 공고이 없습니다</p>
          <Link
            href="/jobs/create"
            className="inline-block py-3 px-6 bg-primary-500 text-white text-base font-medium rounded-lg"
          >
            첫 공고 작성하기
          </Link>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="card">
              <Link href={`/jobs/${job.id}`}>
                <div className="flex items-center justify-between mb-2">
                  <StatusBadge status={job.status} />
                  <span className="text-sm text-gray-500">{formatDate(job.createdAt)}</span>
                </div>
                <h3 className="font-semibold text-base mb-1">{job.title}</h3>
                <p className="text-lg font-bold text-accent-600 mb-1">
                  {formatWon(job.dailyWage)}
                </p>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span>{job.category}</span>
                  <span>·</span>
                  <span>{job.location.address}</span>
                </div>
              </Link>

              {/* 하단 액션 */}
              <div className="mt-3 pt-3 border-t border-gray-100">
                {/* 지원자 목록 보기 */}
                <Link
                  href={`/my-jobs/${job.id}/applicants`}
                  className="flex items-center justify-between min-h-[44px] py-2 text-base font-medium text-primary-500"
                >
                  <span>지원자 {appCounts[job.id] || 0}명 보기</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </Link>

                {/* 수정 / 마감 / 다시 올리기 / 삭제 — 오터치 방지: 버튼 간격 넓게, 삭제는 빨간색 구분 (P2-2) */}
                <div className="flex gap-3 mt-2">
                  {job.status === 'open' && (
                    <>
                      <Link
                        href={`/jobs/create?edit=${job.id}`}
                        className="flex-1 min-h-[44px] py-3 flex items-center justify-center text-base font-medium border border-gray-200 text-gray-700 rounded-lg"
                      >
                        수정
                      </Link>
                      <button
                        onClick={() => {
                          setActionError(null);
                          setConfirmTarget({ type: 'close', job });
                        }}
                        className="flex-1 min-h-[44px] py-3 text-base font-medium border border-gray-200 text-gray-600 rounded-lg"
                      >
                        마감
                      </button>
                    </>
                  )}
                  {job.status === 'closed' && (
                    <Link
                      href={`/jobs/create?copy=${job.id}`}
                      className="flex-1 min-h-[44px] py-3 flex items-center justify-center text-base font-medium bg-primary-500 text-white rounded-lg"
                    >
                      다시 올리기
                    </Link>
                  )}
                  <button
                    onClick={() => {
                      setActionError(null);
                      setConfirmTarget({ type: 'delete', job });
                    }}
                    className="flex-1 min-h-[44px] py-3 text-base font-medium border border-red-300 text-red-600 rounded-lg"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 마감/삭제 확인 바텀시트 (P2-5) */}
      <ConfirmSheet
        open={confirmTarget !== null}
        title={
          confirmTarget?.type === 'delete' ? '공고를 삭제할까요?' : '공고를 마감할까요?'
        }
        description={
          confirmTarget?.type === 'delete'
            ? `'${confirmTarget.job.title}' 공고가 삭제되고,\n지원자 정보도 함께 삭제돼요.\n이 작업은 되돌릴 수 없어요.`
            : confirmTarget
            ? `'${confirmTarget.job.title}' 공고를 마감하면\n새 지원을 받을 수 없어요.`
            : undefined
        }
        confirmText={confirmTarget?.type === 'delete' ? '삭제하기' : '마감하기'}
        danger={confirmTarget?.type === 'delete'}
        loading={actionLoading}
        loadingText={confirmTarget?.type === 'delete' ? '삭제 중...' : '마감 중...'}
        error={actionError}
        onConfirm={handleConfirmAction}
        onCancel={() => {
          if (!actionLoading) setConfirmTarget(null);
        }}
      />

      {/* 토스트 알림 */}
      {toastElement}
    </div>
  );
}
