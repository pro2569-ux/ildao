'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getJobs, getApplicationsByWorker } from '@/lib/firestore';
import { formatDate } from '@/lib/format';
import { Spinner } from '@/components/ui/Spinner';
import { JobPost, Application, JobCategory } from '@/types';

/** 직종 카테고리 목록 */
const CATEGORIES: { name: JobCategory | '전체'; icon: string }[] = [
  { name: '전체', icon: '📋' },
  { name: '철근', icon: '🔩' },
  { name: '목공', icon: '🪵' },
  { name: '설비', icon: '🔧' },
  { name: '전기', icon: '⚡' },
  { name: '도장', icon: '🎨' },
  { name: '용접', icon: '🔥' },
  { name: '타일', icon: '🧱' },
];

/** 구직자 전용 홈 화면 */
export default function WorkerHome() {
  const { userProfile } = useAuth();
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<JobCategory | '전체'>('전체');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // 직종 필터를 빠르게 전환하면 이전 응답이 최신 화면을 덮어쓸 수 있으므로
    // cleanup으로 stale 응답을 무시한다
    let cancelled = false;
    setLoading(true);
    Promise.all([
      getJobs({
        status: 'open',
        category: selectedCategory === '전체' ? undefined : selectedCategory,
        limitCount: 10,
      }),
      userProfile?.uid ? getApplicationsByWorker(userProfile.uid) : Promise.resolve([]),
    ])
      .then(([jobsData, appsData]) => {
        if (cancelled) return;
        setJobs(jobsData);
        setApplications(appsData);
      })
      .catch((error) => {
        if (!cancelled) console.error('데이터 로드 실패:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCategory, userProfile?.uid]);

  /** 지원 상태 카운트 */
  const pendingCount = applications.filter((a) => a.status === 'pending').length;
  const acceptedCount = applications.filter((a) => a.status === 'accepted').length;

  return (
    <div className="px-4 pt-6 pb-24">
      {/* 상단 인사 */}
      <header className="mb-4">
        <p className="text-sm text-gray-500">안녕하세요,</p>
        <h1 className="text-xl font-bold text-gray-900">{userProfile?.name}님</h1>
      </header>

      {/* 지원 현황 카드 */}
      <div className="flex gap-3 mb-6">
        <Link href="/my-applications" className="flex-1 card text-center">
          <p className="text-2xl font-bold text-primary-500">{pendingCount}</p>
          <p className="text-xs text-gray-500 mt-1">지원 대기</p>
        </Link>
        <Link href="/my-applications" className="flex-1 card text-center">
          <p className="text-2xl font-bold text-green-500">{acceptedCount}</p>
          <p className="text-xs text-gray-500 mt-1">수락됨</p>
        </Link>
        <Link href="/my-applications" className="flex-1 card text-center">
          <p className="text-2xl font-bold text-gray-900">{applications.length}</p>
          <p className="text-xs text-gray-500 mt-1">전체 지원</p>
        </Link>
      </div>

      {/* 직종 빠른 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.name}
            onClick={() => setSelectedCategory(cat.name)}
            className={`flex-shrink-0 flex items-center gap-1.5 py-2 px-3 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === cat.name
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            <span>{cat.icon}</span>
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      {/* 최신 구인 공고 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">최신 구인공고</h2>
          <Link href="/jobs" className="text-sm text-primary-500 font-medium">
            전체보기
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <Spinner size="sm" />
          </div>
        ) : jobs.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-gray-400 text-sm">
              {selectedCategory === '전체'
                ? '아직 등록된 구인공고가 없습니다'
                : `${selectedCategory} 관련 공고가 없습니다`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="card block">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-primary-600">
                    {job.category}
                  </span>
                  <span className="text-xs text-gray-400">{formatDate(job.createdAt)}</span>
                </div>
                <h3 className="font-semibold text-sm">{job.title}</h3>
                <p className="text-xs text-gray-500 mt-1 truncate">
                  {job.location.address}
                </p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-accent-500 font-bold text-sm">
                    일당 {job.dailyWage.toLocaleString()}원
                  </span>
                  <span className="text-xs text-gray-400">
                    {job.numberOfWorkers}명 모집 · {formatDate(job.startDate)}~
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
