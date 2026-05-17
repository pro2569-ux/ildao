'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getJobs, getEmployerStats } from '@/lib/firestore';
import { JobPost, Application } from '@/types';

/** 구인자 전용 홈 화면 */
export default function EmployerHome() {
  const { userProfile } = useAuth();
  const [myJobs, setMyJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeJobCount, setActiveJobCount] = useState(0);
  const [totalApplicants, setTotalApplicants] = useState(0);
  const [recentApps, setRecentApps] = useState<Application[]>([]);

  useEffect(() => {
    if (userProfile?.uid) {
      loadMyJobs();
      loadStats();
    }
  }, [userProfile?.uid]);

  const loadStats = async () => {
    try {
      const stats = await getEmployerStats(userProfile!.uid);
      setActiveJobCount(stats.activeJobs);
      setTotalApplicants(stats.totalApplicants);
      setRecentApps(stats.recentApplications);
    } catch (error) {
      console.error('통둲 로드 실패:', error);
    }
  };

  const loadMyJobs = async () => {
    try {
      const jobs = await getJobs({
        employerId: userProfile!.uid,
        limitCount: 5,
      });
      setMyJobs(jobs);
    } catch (error) {
      console.error('구인글 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  /** 날짜 포맷 */
  const formatDate = (date: Date) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="px-4 pt-6 pb-24">
      {/* 상닠 인사 */}
      <header className="mb-6">
        <p className="text-sm text-gray-500">안녕하세요,</p>
        <h1 className="text-xl font-bold text-gray-900">
          {userProfile?.companyName || userProfile?.name}님
        </h1>
      </header>

      {/* 대시보드 통둲 */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="card text-center">
          <p className="text-2xl font-bold text-primary-500">{activeJobCount}</p>
          <p className="text-xs text-gray-500 mt-1">진행중 공고</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-accent-500">{totalApplicants}</p>
          <p className="text-xs text-gray-500 mt-1">총 지원자</p>
        </div>
        <div className="card text-center">
          <p className="text-2xl font-bold text-green-500">{recentApps.filter(a => a.status === 'pending').length}</p>
          <p className="text-xs text-gray-500 mt-1">대기중</p>
        </div>
      </div>

      {/* 빠른 액션 버트 */}
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
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent" />
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
                  <span className="text-xs text-gray-500">{job.numberOfWorkers}늨</span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

