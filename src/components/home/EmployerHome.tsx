'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getJobs, getEmployerStats } from '@/lib/firestore';
import { formatDate } from '@/lib/format';
import { Spinner } from '@/components/ui/Spinner';
import { JobPost, Application } from '@/types';

/** 구인자 전용 홈 화면 */
export default function EmployerHome() {
  const { userProfile } = useAuth();
  const [myJobs, setMyJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeJobCount, setActiveJobCount] = useState(0);
  const [totalApplicants, setTotalApplicants] = useState(0);
  const [recentApps, setRecentApps] = useState<Application[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);
  const [statsError, setStatsError] = useState(false);
  const [retryKey, setRetryKey] = useState(0);

  useEffect(() => {
    if (!userProfile?.uid) return;
    // 계정 전환·언마운트 시 늦게 끝난 응답이 최신 화면을 덮어쓰지 않도록 cancelled 가드 (WorkerHome과 동일 패턴)
    let cancelled = false;
    const uid = userProfile.uid;

    const loadMyJobs = async () => {
      try {
        const jobs = await getJobs({ employerId: uid, limitCount: 5 });
        if (!cancelled) setMyJobs(jobs);
      } catch (error) {
        if (!cancelled) console.error('구인글 로드 실패:', error);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    const loadStats = async () => {
      if (!cancelled) { setStatsLoading(true); setStatsError(false); }
      try {
        const stats = await getEmployerStats(uid);
        if (!cancelled) {
          setActiveJobCount(stats.activeJobs);
          setTotalApplicants(stats.totalApplicants);
          setRecentApps(stats.recentApplications);
        }
      } catch (error) {
        if (!cancelled) {
          console.error('통계 로드 실패:', error);
          setStatsError(true);
        }
      } finally {
        if (!cancelled) setStatsLoading(false);
      }
    };

    loadMyJobs();
    loadStats();

    return () => {
      cancelled = true;
    };
  }, [userProfile?.uid, retryKey]);

  return (
    <div className="px-4 pt-6 pb-24">
      {/* 상단 인사 */}
      <header className="mb-6">
        <p className="text-sm text-gray-500">안녕하세요,</p>
        <h1 className="text-xl font-bold text-gray-900">
          {userProfile?.companyName || userProfile?.name}님
        </h1>
      </header>

      {/* 대시보드 통계 — 로딩 중/실패는 0과 구분되게 대시(–)로 표시 (UI-03) */}
      <div className="mb-6">
        <div className="grid grid-cols-3 gap-3">
          <div className="card text-center">
            <p className="text-2xl font-bold text-primary-500">{statsLoading || statsError ? '–' : activeJobCount}</p>
            <p className="text-xs text-gray-500 mt-1">진행중 공고</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-accent-500">{statsLoading || statsError ? '–' : totalApplicants}</p>
            <p className="text-xs text-gray-500 mt-1">총 지원자</p>
          </div>
          <div className="card text-center">
            <p className="text-2xl font-bold text-green-500">{statsLoading || statsError ? '–' : recentApps.filter((a) => a.status === 'pending').length}</p>
            <p className="text-xs text-gray-500 mt-1">대기중</p>
          </div>
        </div>
        {statsError && (
          <p className="mt-2 text-xs text-center text-red-500">
            통계를 불러오지 못했습니다.{' '}
            <button onClick={() => setRetryKey((k) => k + 1)} className="text-primary-500 font-medium underline">
              다시 시도
            </button>
          </p>
        )}
      </div>

      {/* 빠른 액션 버튼 */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <Link
          href="/jobs/create"
          className="flex items-center gap-3 p-4 bg-primary-500 text-white rounded-xl"
        >
          <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm">구인글 작성</p>
            <p className="text-xs opacity-80">새 공고 등록</p>
          </div>
        </Link>
        <Link
          href="/workers"
          className="flex items-center gap-3 p-4 bg-white border border-gray-200 rounded-xl"
        >
          <div className="w-10 h-10 bg-accent-50 rounded-lg flex items-center justify-center">
            <svg className="w-5 h-5 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </div>
          <div>
            <p className="font-semibold text-sm text-gray-900">구직자 찾기</p>
            <p className="text-xs text-gray-500">이력 검색</p>
          </div>
        </Link>
      </div>

      {/*  내 구인글 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">내 구인글</h2>
          <Link href="/my-jobs" className="text-sm text-primary-500 font-medium">
            전체보기
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : myJobs.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-400 text-sm mb-3">아직 올린 구인글이 없습니다</p>
            <Link
              href="/jobs/create"
              className="inline-block py-2 px-4 bg-primary-500 text-white text-sm font-medium rounded-lg"
            >
              첫 구인글 작성하기
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {myJobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="card block">
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${job.status === 'open'
                      ? 'bg-green-100 text-green-600'
                      : 'bg-gray-100 text-gray-500'
                  }`}>
                    {job.status === 'open' ? '모집중' : job.status === 'closed' ? '마감' : '진행중'}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(job.createdAt)}</span>
                </div>
                <h3 className="font-semibold text-sm">{job.title}</h3>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs text-gray-500">{job.category}</span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-accent-500 font-medium">
                    {job.dailyWage.toLocaleString()}원
                  </span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-500">{job.numberOfWorkers}명</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

