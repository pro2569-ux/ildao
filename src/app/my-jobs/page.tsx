'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { getJobs, updateJob, deleteJob, getApplicationCount } from '@/lib/firestore';
import { formatDateFull } from '@/lib/format';
import { JobPost } from '@/types';
import { jobStatusBadge } from '@/lib/constants';
import { PageLoader } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';

/**
 * 내 구인글 관리 페이지
 * - 올린 구인글 목록
 * - 지원자 수 표시
 * - 수정/삭제/마감 기능
 */
export default function MyJobsPage() {
  // 구인자 전용 페이지 — 비로그인/구직자/미가입 사용자는 리다이렉트 (#31)
  const { user, ready } = useRequireAuth('employer');
  const router = useRouter();
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [appCounts, setAppCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [actionJobId, setActionJobId] = useState<string | null>(null);

  useEffect(() => {
    if (ready) loadJobs();
  }, [ready]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const jobsData = await getJobs({ employerId: user!.uid });
      setJobs(jobsData);

      // 각 구인글의 지원자 수 조회
      const counts: Record<string, number> = {};
      await Promise.all(
        jobsData.map(async (job) => {
          counts[job.id] = await getApplicationCount(job.id, user!.uid);
        })
      );
      setAppCounts(counts);
    } catch (error) {
      console.error('구인글 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  /** 구인글 마감 */
  const handleClose = async (jobId: string) => {
    if (!confirm('이 구인글을 마감하시겠습니까?')) return;
    setActionJobId(jobId);
    try {
      await updateJob(jobId, { status: 'closed' });
      await loadJobs();
    } catch (error) {
      console.error('마감 실패:', error);
      alert('마감에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setActionJobId(null);
    }
  };

  /** 구인글 삭제 */
  const handleDelete = async (jobId: string) => {
    if (!confirm('이 구인글을 삭제하시겠습니까? 받은 지원 내역도 함께 삭제되며, 이 작업은 취소할 수 없습니다.')) return;
    setActionJobId(jobId);
    try {
      await deleteJob(jobId, user!.uid);
      await loadJobs();
    } catch (error) {
      console.error('삭제 실패:', error);
      alert('삭제에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setActionJobId(null);
    }
  };

  if (!ready || loading) {
    return (
      <PageLoader />
    );
  }

  return (
    <div className="px-4 pt-6 pb-24">
      {/* 상단 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={() => router.back()} className="p-1">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">내 구인글</h1>
        </div>
        <Link
          href="/jobs/create"
          className="py-2 px-4 bg-primary-500 text-white text-sm font-medium rounded-lg"
        >
          + 새 구인글
        </Link>
      </div>

      {/* 구인글 목록 */}
      {jobs.length === 0 ? (
        <EmptyState
          message="아직 올린 구인글이 없습니다"
          linkHref="/jobs/create"
          linkText="첫 구인글 작성하기"
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <div key={job.id} className="card">
              <Link href={`/jobs/${job.id}`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${jobStatusBadge(job.status).className}`}>
                    {jobStatusBadge(job.status).text}
                  </span>
                  <span className="text-xs text-gray-400">{formatDateFull(job.createdAt)}</span>
                </div>
                <h3 className="font-semibold text-sm mb-1">{job.title}</h3>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <span>{job.category}</span>
                  <span>·</span>
                  <span className="text-accent-500 font-medium">{job.dailyWage.toLocaleString()}원</span>
                  <span>·</span>
                  <span>{job.location.address}</span>
                </div>
              </Link>

              {/* 하단 액션 */}
              <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
                <Link
                  href={`/my-jobs/${job.id}/applicants`}
                  className="text-xs text-primary-500 font-medium hover:underline"
                >
                  지원자 {appCounts[job.id] || 0}명 보기 →
                </Link>
                <div className="flex items-center gap-2">
                  {job.status === 'open' && (
                    <button
                      onClick={() => handleClose(job.id)}
                      disabled={actionJobId === job.id}
                      className="text-xs text-gray-500 hover:text-gray-700 py-1 px-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      마감
                    </button>
                  )}
                  <button
                    onClick={() => handleDelete(job.id)}
                    disabled={actionJobId === job.id}
                    className="text-xs text-red-500 hover:text-red-700 py-1 px-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    삭제
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
