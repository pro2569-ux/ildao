'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getJobsPage, type JobCursor } from '@/lib/firestore';
import { REGIONS, JOB_CATEGORIES } from '@/lib/constants';
import { formatDate } from '@/lib/format';
import { Spinner } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { JobPost, JobCategory } from '@/types';

/** 직종 필터 목록 ('전체' + 공용 직종 상수) */
const CATEGORIES: (JobCategory | '전체')[] = ['전체', ...JOB_CATEGORIES];

/** 정렬 옵션 */
type SortOption = 'latest' | 'highWage';

/** 한 페이지 로드 개수 (커서 페이지네이션) */
const PAGE_SIZE = 20;

/**
 * 구인 공고 피드 페이지
 * - 전체 구인 공고 리스트
 * - 지역/직종/일당 필터
 * - 정렬 (최신순, 일당 높은순)
 */
export default function JobsPage() {
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [lastDoc, setLastDoc] = useState<JobCursor | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<JobCategory | '전체'>('전체');
  const [selectedRegion, setSelectedRegion] = useState<string>('전체');
  const [sortBy, setSortBy] = useState<SortOption>('latest');

  // 현재 필터/정렬을 getJobsPage 인자로 변환 (#40 — 전체 fetch 방지, 커서 페이지네이션)
  const buildFilters = () => ({
    status: 'open' as const,
    category: selectedCategory === '전체' ? undefined : selectedCategory,
    region: selectedRegion === '전체' ? undefined : selectedRegion,
    sortBy: (sortBy === 'highWage' ? 'dailyWage' : 'createdAt') as 'createdAt' | 'dailyWage',
    sortDir: 'desc' as const,
  });

  // 필터/정렬 변경 시 첫 페이지를 새로 로드 (빠른 전환 시 stale 응답은 cancelled로 무시)
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    getJobsPage(buildFilters(), PAGE_SIZE)
      .then((res) => {
        if (cancelled) return;
        setJobs(res.jobs);
        setLastDoc(res.lastDoc);
        setHasMore(res.hasMore);
      })
      .catch((error) => {
        if (!cancelled) console.error('구인 공고 로드 실패:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // buildFilters는 아래 원시 필터 값에서 파생되므로 그 값들만 의존
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedRegion, sortBy]);

  // '더보기' — 마지막 문서를 커서로 다음 페이지를 이어서 로드
  const loadMore = async () => {
    if (loadingMore || !hasMore || !lastDoc) return;
    setLoadingMore(true);
    try {
      const res = await getJobsPage(buildFilters(), PAGE_SIZE, lastDoc);
      setJobs((prev) => [...prev, ...res.jobs]);
      setLastDoc(res.lastDoc);
      setHasMore(res.hasMore);
    } catch (error) {
      console.error('추가 공고 로드 실패:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="text-xl font-bold mb-4">구인공고</h1>

      {/* 지역 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-2 scrollbar-hide">
        {['전체', ...REGIONS].map((r) => (
          <button
            key={r}
            onClick={() => setSelectedRegion(r)}
            className={`flex-shrink-0 py-2 px-3 rounded-full text-sm font-medium transition-colors ${
              selectedRegion === r
                ? 'bg-accent-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            {r}
          </button>
        ))}
      </div>

      {/* 직종 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-3 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`flex-shrink-0 py-2 px-3 rounded-full text-sm font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 정렬 옵션 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-gray-500">
          {loading ? '로딩중...' : `${jobs.length}건${hasMore ? '+' : ''}`}
        </span>
        <div className="flex gap-2">
          <button
            onClick={() => setSortBy('latest')}
            className={`text-sm font-medium ${
              sortBy === 'latest' ? 'text-primary-500' : 'text-gray-400'
            }`}
          >
            최신순
          </button>
          <span className="text-gray-300">|</span>
          <button
            onClick={() => setSortBy('highWage')}
            className={`text-sm font-medium ${
              sortBy === 'highWage' ? 'text-primary-500' : 'text-gray-400'
            }`}
          >
            일당 높은순
          </button>
        </div>
      </div>

      {/* 공고 목록 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <Spinner size="sm" />
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          message={
            selectedRegion !== '전체'
              ? `${selectedRegion} 지역의 ${selectedCategory === '전체' ? '' : selectedCategory + ' '}공고가 없습니다`
              : selectedCategory === '전체'
              ? '등록된 구인공고가 없습니다'
              : `${selectedCategory} 관련 공고가 없습니다`
          }
        />
      ) : (
        <>
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`} className="card block">
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-blue-100 text-primary-600">
                    {job.category}
                  </span>
                  {/* 시작 임박(D-3 이내) 뱃지 — 실데이터 기반 정보성 보강 (JOBS-04) */}
                  {(() => {
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const start = new Date(job.startDate); start.setHours(0, 0, 0, 0);
                    const d = Math.round((start.getTime() - today.getTime()) / 86400000);
                    if (d < 0 || d > 3) return null;
                    return (
                      <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-red-50 text-red-500">
                        {d === 0 ? '오늘 시작' : d === 1 ? '내일 시작' : `D-${d}`}
                      </span>
                    );
                  })()}
                </div>
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
        {hasMore && (
          <button
            onClick={loadMore}
            disabled={loadingMore}
            className="w-full py-3 mt-3 text-sm font-medium text-primary-500 bg-white border border-gray-200 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loadingMore ? '불러오는 중...' : '더보기'}
          </button>
        )}
        </>
      )}
    </div>
  );
}
