'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { collection, query, where, getCountFromServer } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { getJobs, getEmployerStats, getJob, getUserProfile } from '@/lib/firestore';
import { JobPost, Application } from '@/types';
import ErrorState from '@/components/ui/ErrorState';
import { formatWon, formatDate } from '@/lib/format';

/** 최근 지원 + 지원자 이름·공고 제목 (새 지원자 섹션용) */
type RecentApplication = Application & { workerName: string; jobTitle: string };

/** 구인자 전용 홈 화면 */
export default function EmployerHome() {
  const { userProfile } = useAuth();
  const [myJobs, setMyJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeJobCount, setActiveJobCount] = useState(0);
  const [totalApplicants, setTotalApplicants] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [recentApps, setRecentApps] = useState<RecentApplication[]>([]);
  // 로드 실패를 "데이터 없음"으로 위장하지 않기 위한 에러 상태 (P2-3)
  const [statsError, setStatsError] = useState(false);
  const [jobsError, setJobsError] = useState(false);

  useEffect(() => {
    if (userProfile?.uid) {
      loadMyJobs();
      loadStats();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userProfile?.uid]);

  const loadStats = async () => {
    setStatsError(false);
    try {
      // 대기중 지원 수 — equality where만 사용하는 집계 (복합 인덱스 불필요)
      const pendingQuery = query(
        collection(db, 'applications'),
        where('employerId', '==', userProfile!.uid),
        where('status', '==', 'pending')
      );

      const [stats, pendingSnap] = await Promise.all([
        getEmployerStats(userProfile!.uid),
        getCountFromServer(pendingQuery),
      ]);
      setActiveJobCount(stats.activeJobs);
      setTotalApplicants(stats.totalApplicants);
      setPendingCount(pendingSnap.data().count);

      // 최근 지원 5건에 지원자 이름·공고 제목 join
      const detailed = await Promise.all(
        stats.recentApplications.slice(0, 5).map(async (app) => {
          const [worker, job] = await Promise.all([
            getUserProfile(app.workerId).catch(() => null),
            getJob(app.jobId).catch(() => null),
          ]);
          return {
            ...app,
            workerName: worker?.name || '이름 미등록',
            jobTitle: job?.title || '삭제된 공고',
          };
        })
      );
      setRecentApps(detailed);
    } catch (error) {
      console.error('통계 로드 실패:', error);
      setStatsError(true);
    }
  };

  const loadMyJobs = async () => {
    setLoading(true);
    setJobsError(false);
    try {
      const jobs = await getJobs({
        employerId: userProfile!.uid,
        limitCount: 5,
      });
      setMyJobs(jobs);
    } catch (error) {
      console.error('공고 로드 실패:', error);
      setJobsError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-24">
      {/* 상단 인사 */}
      <header className="mb-6">
        <p className="text-sm text-ink-soft">안녕하세요,</p>
        <h1 className="text-2xl font-extrabold text-navy">
          {userProfile?.companyName || userProfile?.name}님
        </h1>
      </header>

      {/* 대시보드 통계 (탭하면 관련 화면으로 이동) */}
      {statsError ? (
        <div className="card mb-6">
          <ErrorState
            title="현황을 불러오지 못했어요"
            onRetry={loadStats}
            className="!py-6"
          />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3 mb-6">
          <Link href="/my-jobs" className="card text-center min-h-[44px]">
            <p className="text-3xl font-extrabold text-primary-600 tnum">{activeJobCount}</p>
            <p className="text-sm text-ink-soft font-semibold mt-1">진행중 공고</p>
          </Link>
          <Link href="/my-jobs" className="card text-center min-h-[44px]">
            <p className="text-3xl font-extrabold text-accent-500 tnum">{totalApplicants}</p>
            <p className="text-sm text-ink-soft font-semibold mt-1">총 지원자</p>
          </Link>
          <Link href="/my-jobs" className="card text-center min-h-[44px]">
            <p className="text-3xl font-extrabold text-ok tnum">{pendingCount}</p>
            <p className="text-sm text-ink-soft font-semibold mt-1">대기중</p>
          </Link>
        </div>
      )}

      {/* 빠른 액션 버튼 */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link
          href="/jobs/create"
          className="btn-primary flex items-center gap-3 p-4 min-h-[44px] rounded-2xl"
        >
          <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-base">공고 작성</p>
            <p className="text-sm opacity-80">새 공고 등록</p>
          </div>
        </Link>
        <Link
          href="/workers"
          className="card flex items-center gap-3 p-4 min-h-[44px]"
        >
          <div className="w-10 h-10 bg-accent-50 rounded-xl flex items-center justify-center flex-shrink-0">
            <svg className="w-5 h-5 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="font-bold text-base text-ink">구직자 찾기</p>
            <p className="text-sm text-ink-soft">이력 검색</p>
          </div>
        </Link>
      </div>

      {/* 새 지원자 */}
      {!statsError && recentApps.length > 0 && (
        <section className="mb-6">
          <h2 className="text-lg font-bold text-ink mb-3">새 지원자</h2>
          <div className="space-y-2">
            {recentApps.map((app) => (
              <Link
                key={app.id}
                href={`/my-jobs/${app.jobId}/applicants`}
                className="card flex items-center justify-between gap-3"
              >
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-base text-ink">
                    {app.workerName}
                    <span className="font-normal text-ink-soft">님이 지원했어요</span>
                  </p>
                  <p className="text-sm text-ink-soft mt-0.5 truncate">{app.jobTitle}</p>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {app.status === 'pending' && (
                    <span className="inline-flex items-center text-sm font-semibold px-2.5 py-1 bg-warn-50 text-warn rounded-full whitespace-nowrap">
                      대기중
                    </span>
                  )}
                  <span className="text-sm text-ink-soft">{formatDate(app.createdAt)}</span>
                  <svg className="w-4 h-4 text-ink-soft" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/*  내 공고 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-ink">내 공고</h2>
          <Link href="/my-jobs" className="text-sm text-primary-600 font-bold py-2 px-1">
            전체보기
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : jobsError ? (
          <ErrorState
            title="공고를 불러오지 못했어요"
            onRetry={loadMyJobs}
            className="card !py-8"
          />
        ) : myJobs.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-ink-soft text-base mb-4">아직 올린 공고가 없습니다</p>
            <Link
              href="/jobs/create"
              className="btn-primary inline-block min-h-[44px] text-base"
            >
              첫 공고 작성하기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {myJobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="card flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <span className={`inline-flex items-center text-xs font-bold px-2.5 py-1 rounded-full whitespace-nowrap ${job.status === 'open'
                        ? 'bg-ok-50 text-ok-700'
                        : 'bg-paper text-ink-soft'
                    }`}>
                      {job.status === 'open' ? '모집중' : job.status === 'closed' ? '마감' : '진행중'}
                    </span>
                    <span className="cat-tag bg-primary-50 text-primary-700">{job.category}</span>
                  </div>
                  <h3 className="font-bold text-base text-ink truncate">{job.title}</h3>
                  <p className="text-sm text-ink-soft mt-0.5 flex items-center gap-1.5">
                    <span>{job.numberOfWorkers}명 모집</span>
                    <span aria-hidden="true">·</span>
                    <span>{formatDate(job.createdAt)}</span>
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-accent-500 font-extrabold text-xl tnum">
                    {formatWon(job.dailyWage)}
                  </span>
                  <p className="text-xs text-ink-soft font-semibold">일당</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
