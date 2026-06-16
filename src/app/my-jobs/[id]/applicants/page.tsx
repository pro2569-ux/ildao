'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { getJob, getApplicationsByJob, updateApplicationStatus } from '@/lib/firestore';
import { Application, JobPost, ApplicationStatus } from '@/types';
import { PageLoader } from '@/components/ui/Spinner';

/**
 * 지원자 관리 페이지 (구인자 전용)
 * - 특정 공고의 지원자 목록 (비정규화된 스냅샷으로 비공개 프로필도 표시)
 * - 수락/거절 처리
 * - 수락된 지원자는 연락처(전화) 노출
 */
export default function ApplicantsPage() {
  const { user, ready } = useRequireAuth('employer');
  const params = useParams();
  const router = useRouter();
  const jobId = params.id as string;

  const [job, setJob] = useState<JobPost | null>(null);
  const [applications, setApplications] = useState<Application[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [actionId, setActionId] = useState<string | null>(null);

  useEffect(() => {
    if (ready) loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, jobId]);

  const loadData = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const jobData = await getJob(jobId);
      // 내 공고가 아니면 접근 차단 (서버 룰도 지원 목록을 employer 본인으로 제한)
      if (!jobData || jobData.employerId !== user!.uid) {
        router.replace('/my-jobs');
        return;
      }
      setJob(jobData);
      const apps = await getApplicationsByJob(jobId, user!.uid);
      setApplications(apps);
    } catch (error) {
      console.error('지원자 로드 실패:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  /** 지원 상태 변경 (수락/거절) */
  const handleStatus = async (appId: string, status: ApplicationStatus) => {
    setActionId(appId);
    try {
      await updateApplicationStatus(appId, status);
      setApplications((prev) =>
        prev.map((a) => (a.id === appId ? { ...a, status } : a))
      );
    } catch (error) {
      console.error('상태 변경 실패:', error);
      alert('처리에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setActionId(null);
    }
  };

  const statusBadge = (status: ApplicationStatus) => {
    switch (status) {
      case 'accepted':
        return { text: '수락됨', className: 'bg-green-100 text-green-600' };
      case 'rejected':
        return { text: '거절됨', className: 'bg-red-100 text-red-500' };
      default:
        return { text: '대기중', className: 'bg-yellow-100 text-yellow-600' };
    }
  };

  if (!ready || loading) {
    return (
      <PageLoader />
    );
  }

  if (loadError || !job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <p className="text-sm text-gray-600 mb-4">지원자 정보를 불러오지 못했습니다.</p>
        <div className="flex gap-2">
          <button onClick={loadData} className="py-2.5 px-6 btn-primary rounded-xl text-sm font-semibold">
            다시 시도
          </button>
          <button onClick={() => router.replace('/my-jobs')} className="py-2.5 px-6 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold">
            내 구인글
          </button>
        </div>
      </div>
    );
  }

  const acceptedCount = applications.filter((a) => a.status === 'accepted').length;

  return (
    <div className="px-4 pt-6 pb-24">
      {/* 상단 */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold">지원자 관리</h1>
      </div>

      {/* 공고 요약 */}
      <div className="card mb-4">
        <h2 className="font-semibold text-sm">{job.title}</h2>
        <p className="text-xs text-gray-500 mt-1">
          지원 {applications.length}명 · 수락 {acceptedCount}/{job.numberOfWorkers}명
        </p>
      </div>

      {/* 지원자 목록 */}
      {applications.length === 0 ? (
        <div className="text-center py-16">
          <svg className="w-14 h-14 mx-auto text-gray-200 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2}
              d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p className="text-gray-400 text-sm">아직 지원자가 없습니다</p>
        </div>
      ) : (
        <div className="space-y-3">
          {applications.map((app) => {
            const badge = statusBadge(app.status);
            const busy = actionId === app.id;
            return (
              <div key={app.id} className="card">
                <div className="flex items-start justify-between">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="font-semibold text-sm">{app.workerName || '이름 미상'}</h3>
                      <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
                        {badge.text}
                      </span>
                    </div>
                    {/* 보유 기술 */}
                    {app.workerSkills && app.workerSkills.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {app.workerSkills.map((skill) => (
                          <span key={skill} className="text-xs bg-blue-50 text-primary-500 px-2 py-0.5 rounded-full">
                            {skill}
                          </span>
                        ))}
                      </div>
                    )}
                    {/* 경력 / 희망 일당 */}
                    <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                      {app.workerExperience != null && <span>경력 {app.workerExperience}년</span>}
                      {app.workerExperience != null && app.workerDesiredWage ? <span>·</span> : null}
                      {app.workerDesiredWage ? (
                        <span className="text-accent-500 font-medium">
                          희망 {app.workerDesiredWage.toLocaleString()}원
                        </span>
                      ) : null}
                    </div>
                  </div>
                </div>

                {/* 지원 메시지 */}
                {app.message && (
                  <p className="text-sm text-gray-600 mt-2 bg-gray-50 rounded-lg px-3 py-2 whitespace-pre-wrap">
                    {app.message}
                  </p>
                )}

                {/* 수락된 지원자: 연락처 노출 */}
                {app.status === 'accepted' && app.workerPhone && (
                  <a
                    href={`tel:${app.workerPhone}`}
                    className="block mt-3 py-2 text-center text-sm font-medium bg-primary-500 text-white rounded-lg"
                  >
                    전화하기 ({app.workerPhone})
                  </a>
                )}

                {/* 액션 버튼 */}
                <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                  {app.status !== 'accepted' && (
                    <button
                      onClick={() => handleStatus(app.id, 'accepted')}
                      disabled={busy}
                      className="flex-1 py-2 text-sm font-medium bg-green-500 text-white rounded-lg disabled:opacity-50"
                    >
                      {busy ? '처리 중...' : '수락'}
                    </button>
                  )}
                  {app.status !== 'rejected' && (
                    <button
                      onClick={() => handleStatus(app.id, 'rejected')}
                      disabled={busy}
                      className="flex-1 py-2 text-sm font-medium border border-gray-200 text-gray-500 rounded-lg disabled:opacity-50"
                    >
                      {busy ? '처리 중...' : '거절'}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
