'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getJob,
  getApplicationsByJobWithProfiles,
  updateApplicationStatus,
  ApplicationWithProfile,
} from '@/lib/firestore';
import { JobPost, ApplicationStatus } from '@/types';
import ConfirmSheet from '@/components/ui/ConfirmSheet';
import ErrorState from '@/components/ui/ErrorState';
import StatusBadge from '@/components/ui/StatusBadge';
import BackButton from '@/components/ui/BackButton';
import { useToast } from '@/components/ui/Toast';
import { formatWon } from '@/lib/format';

/** 수락/거절 확인 바텀시트 대상 */
type StatusTarget = { app: ApplicationWithProfile; status: ApplicationStatus };

/**
 * 지원자 목록 페이지 (구인자 전용)
 * - 내 공고에 지원한 사람 목록 + 프로필
 * - 수락/거절 처리, 전화 연결
 */
export default function JobApplicantsPage() {
  const params = useParams();
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { showToast, toastElement } = useToast();

  const jobId = params.id as string;

  const [job, setJob] = useState<JobPost | null>(null);
  const [applicants, setApplicants] = useState<ApplicationWithProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [notFound, setNotFound] = useState(false);
  const [notMine, setNotMine] = useState(false);

  // 수락/거절 확인 바텀시트 상태
  const [statusTarget, setStatusTarget] = useState<StatusTarget | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace(`/login?returnUrl=/my-jobs/${jobId}/applicants`);
      return;
    }
    if (user) loadData();
  }, [user, authLoading, jobId]);

  const loadData = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const jobData = await getJob(jobId);
      if (!jobData) {
        setNotFound(true);
        return;
      }
      if (jobData.employerId !== user!.uid) {
        setNotMine(true);
        return;
      }
      setJob(jobData);

      const apps = await getApplicationsByJobWithProfiles(jobId);
      setApplicants(apps);
    } catch (error) {
      console.error('지원자 목록 로드 실패:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  /** 확인 바텀시트에서 지원 수락/거절 확정 */
  const handleStatusConfirm = async () => {
    if (!statusTarget || processing) return; // 처리 중 중복 탭 방지
    const { app, status } = statusTarget;
    const label = status === 'accepted' ? '수락' : '거절';

    setProcessing(true);
    try {
      await updateApplicationStatus(app.id, status);
      // 성공 시 카드 상태 즉시 갱신
      setApplicants((prev) =>
        prev.map((a) => (a.id === app.id ? { ...a, status } : a))
      );
      setStatusTarget(null);
      showToast(`지원을 ${label}했어요`);
    } catch (error) {
      console.error('지원 상태 변경 실패:', error);
      setStatusTarget(null);
      showToast(`${label} 처리에 실패했어요. 잠시 후 다시 시도해주세요.`, 'error');
    } finally {
      setProcessing(false);
    }
  };

  /** 날짜 포맷 (지원일) */
  const formatDate = (date: Date) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  /** 날짜 포맷 (시작일) */
  const formatFullDate = (date: Date) => {
    const d = new Date(date);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  };

  /** 상단 헤더 */
  const header = (
    <div className="flex items-center gap-2 mb-4">
      <BackButton className="-ml-2" />
      <h1 className="text-xl font-bold">지원자 목록</h1>
    </div>
  );

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  // 없는 공고이거나 내 공고가 아닌 경우
  if (notFound || notMine) {
    return (
      <div className="px-4 pt-6 pb-24">
        {header}
        <div className="text-center py-12">
          <p className="text-gray-500 text-base mb-4">
            {notFound ? '공고를 찾을 수 없어요' : '내 공고만 볼 수 있어요'}
          </p>
          <Link
            href="/my-jobs"
            className="inline-block py-3 px-6 bg-primary-500 text-white text-base font-medium rounded-lg"
          >
            내 공고 보러가기
          </Link>
        </div>
      </div>
    );
  }

  // 로드 실패 — 빈 목록으로 위장하지 않고 재시도 화면 표시 (P2-3)
  if (loadError || !job) {
    return (
      <div className="px-4 pt-6 pb-24">
        {header}
        <ErrorState title="지원자 목록을 불러오지 못했어요" onRetry={loadData} />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-24">
      {header}

      {/* 공고 요약 */}
      <div className="card mb-4">
        <h2 className="font-semibold text-base">{job.title}</h2>
        <p className="text-lg font-bold text-accent-600 mt-1">{formatWon(job.dailyWage)}</p>
        <p className="text-sm text-gray-600 mt-0.5">{formatFullDate(job.startDate)} 시작</p>
      </div>

      {/* 지원자 목록 */}
      {applicants.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-base">아직 지원한 사람이 없습니다</p>
        </div>
      ) : (
        <>
          <p className="text-sm text-gray-600 mb-3">지원자 {applicants.length}명</p>
          <div className="space-y-3">
            {applicants.map((app) => {
              const worker = app.workerProfile;
              return (
                <div key={app.id} className="card">
                  {/* 상태 + 지원일 */}
                  <div className="flex items-center justify-between mb-2">
                    <StatusBadge status={app.status} />
                    <span className="text-sm text-gray-500">지원일 {formatDate(app.createdAt)}</span>
                  </div>

                  {/* 지원자 프로필 */}
                  {worker ? (
                    <div className="flex items-start gap-3">
                      <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                        {worker.profileImage ? (
                          <img
                            src={worker.profileImage}
                            alt={worker.name}
                            className="w-full h-full object-cover"
                            referrerPolicy="no-referrer"
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-primary-100">
                            <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <h3 className="font-semibold text-base">{worker.name}</h3>
                          {worker.experience != null && (
                            <span className="text-sm text-gray-600">경력 {worker.experience}년</span>
                          )}
                        </div>
                        {worker.skills && worker.skills.length > 0 && (
                          <div className="flex flex-wrap gap-1 mb-1">
                            {worker.skills.map((skill) => (
                              <span
                                key={skill}
                                className="text-sm px-2 py-0.5 bg-blue-50 text-primary-600 rounded-full"
                              >
                                {skill}
                              </span>
                            ))}
                          </div>
                        )}
                        {worker.desiredWage ? (
                          <span className="text-sm font-semibold text-accent-600">
                            희망 {worker.desiredWage.toLocaleString()}원
                          </span>
                        ) : null}
                      </div>
                    </div>
                  ) : (
                    <p className="text-base text-gray-500">지원자 정보를 불러올 수 없어요</p>
                  )}

                  {/* 액션 버튼 */}
                  <div className="mt-3 pt-3 border-t border-gray-100 space-y-2">
                    {worker?.phone ? (
                      <a
                        href={`tel:${worker.phone}`}
                        className="flex items-center justify-center gap-2 w-full min-h-[44px] py-3 bg-green-500 text-white text-base font-semibold rounded-lg"
                      >
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                            d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                        </svg>
                        전화하기
                      </a>
                    ) : (
                      <div className="w-full py-3 bg-gray-100 text-gray-500 text-base font-medium rounded-lg text-center">
                        전화번호 미등록
                      </div>
                    )}

                    {app.status === 'pending' && (
                      // 오터치 방지: 거절/수락 버튼 간격 넓게 (P2-2)
                      <div className="flex gap-3">
                        <button
                          onClick={() => setStatusTarget({ app, status: 'rejected' })}
                          disabled={processing}
                          className="flex-1 min-h-[44px] py-3 border border-gray-300 text-gray-600 text-base font-semibold rounded-lg disabled:opacity-50"
                        >
                          거절
                        </button>
                        <button
                          onClick={() => setStatusTarget({ app, status: 'accepted' })}
                          disabled={processing}
                          className="flex-1 min-h-[44px] py-3 bg-primary-500 text-white text-base font-semibold rounded-lg disabled:opacity-50"
                        >
                          수락
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* 수락/거절 확인 바텀시트 (P2-5) */}
      <ConfirmSheet
        open={statusTarget !== null}
        title={
          statusTarget?.status === 'accepted'
            ? '이 지원자를 수락할까요?'
            : '이 지원자를 거절할까요?'
        }
        description={
          statusTarget
            ? statusTarget.status === 'accepted'
              ? `${statusTarget.app.workerProfile?.name || '지원자'}님을 수락해요.\n수락 후 전화로 일정을 안내해 주세요.`
              : `${statusTarget.app.workerProfile?.name || '지원자'}님의 지원을 거절해요.`
            : undefined
        }
        confirmText={statusTarget?.status === 'accepted' ? '수락하기' : '거절하기'}
        danger={statusTarget?.status === 'rejected'}
        loading={processing}
        loadingText={statusTarget?.status === 'accepted' ? '수락 중...' : '거절 중...'}
        onConfirm={handleStatusConfirm}
        onCancel={() => {
          if (!processing) setStatusTarget(null);
        }}
      />

      {/* 토스트 알림 */}
      {toastElement}
    </div>
  );
}
