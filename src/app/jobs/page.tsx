'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getJobs } from '@/lib/firestore';
import { JobPost, JobCategory } from '@/types';
import ErrorState from '@/components/ui/ErrorState';
import StatusBadge from '@/components/ui/StatusBadge';
import { formatWon, formatDate, isPastDay } from '@/lib/format';
import { REGIONS } from '@/lib/constants';

/** 직종 필터 목록 */
const CATEGORIES: (JobCategory | '전체')[] = [
  '전체', '철근', '목공', '설비', '전기', '도장', '용접', '타일', '미장', '방수', '조적', '비계', '잡역', '기타',
];

/** 정렬 옵션 */
type SortOption = 'latest' | 'highWage';

/** userProfile.region('서울 강남구' 등)을 REGIONS 시/도로 prefix 매칭 (P2-6) */
const regionFromProfile = (profileRegion?: string): string =>
  REGIONS.find((r) => r !== '전국' && profileRegion?.startsWith(r)) ?? '전국';

/**
 * 구인 공고 피드 페이지
 * - 전체 구인 공고 리스트
 * - 지역/직종/일당 필터
 * - 정렬 (최신순, 일당 높은순)
 */
function JobsContent() {
  // URL 쿼리(?category=철근)로 초기 직종 필터 설정
  const searchParams = useSearchParams();
  const categoryParam = searchParams.get('category');
  const initialCategory: JobCategory | '전체' =
    categoryParam && CATEGORIES.includes(categoryParam as JobCategory | '전체')
      ? (categoryParam as JobCategory | '전체')
      : '전체';

  const { userProfile } = useAuth();

  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<JobCategory | '전체'>(initialCategory);
  const [selectedRegion, setSelectedRegion] = useState<string>('전국');
  const [regionTouched, setRegionTouched] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('latest');

  // 로그인 유저의 지역을 기본 필터로 (유저가 직접 칩을 바꾸기 전까지만)
  useEffect(() => {
    if (regionTouched || !userProfile?.region) return;
    setSelectedRegion(regionFromProfile(userProfile.region));
  }, [userProfile, regionTouched]);

  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedRegion, sortBy]);

  const loadJobs = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getJobs({
        status: 'open',
        category: selectedCategory === '전체' ? undefined : selectedCategory,
        region: selectedRegion,
        sortBy: sortBy === 'highWage' ? 'dailyWage' : 'createdAt',
        sortDir: 'desc',
      });
      setJobs(data);
    } catch (error) {
      console.error('구인 공고 로드 실패:', error);
      setError(true); // 실패를 "공고 없음"으로 위장하지 않음 (P2-3)
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="text-xl font-bold mb-4">구인공고</h1>

      {/* 직종 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`flex-shrink-0 py-2.5 px-4 rounded-full text-base font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-gray-200 text-gray-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 지역 필터 (P2-6) */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-3 scrollbar-hide">
        {REGIONS.map((region) => (
          <button
            key={region}
            onClick={() => {
              setRegionTouched(true);
              setSelectedRegion(region);
            }}
            className={`flex-shrink-0 py-2.5 px-4 rounded-full text-base font-medium transition-colors ${
              selectedRegion === region
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-gray-200 text-gray-700'
            }`}
          >
            {region}
          </button>
        ))}
      </div>

      {/* 정렬 옵션 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-base text-gray-600">
          {loading ? '로딩중...' : `${jobs.length}건`}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSortBy('latest')}
            className={`text-base font-medium py-2.5 px-2 ${
              sortBy === 'latest' ? 'text-primary-500' : 'text-gray-600'
            }`}
          >
            최신순
          </button>
          <span className="w-px h-4 bg-gray-300" aria-hidden="true" />
          <button
            onClick={() => setSortBy('highWage')}
            className={`text-base font-medium py-2.5 px-2 ${
              sortBy === 'highWage' ? 'text-primary-500' : 'text-gray-600'
            }`}
          >
            일당 높은순
          </button>
        </div>
      </div>

      {/* 공고 목록 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : error ? (
        <ErrorState onRetry={loadJobs} />
      ) : jobs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 text-base">
            {selectedCategory === '전체' && selectedRegion === '전국'
              ? '등록된 구인공고가 없습니다'
              : `${selectedRegion !== '전국' ? `${selectedRegion} ` : ''}${
                  selectedCategory !== '전체' ? `${selectedCategory} ` : ''
                }공고가 없습니다`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {jobs.map((job) => (
            <Link key={job.id} href={`/jobs/${job.id}`} className="card block">
              <div className="flex items-center justify-between mb-1.5">
                <div className="flex items-center gap-1.5">
                  <StatusBadge status={job.status} />
                  {/* 시작일 지난 공고 표시 (P2-16) — 모집중인데 시작일이 지난 죽은 공고 구분 */}
                  {job.status === 'open' && isPastDay(job.startDate) && (
                    <span className="text-sm font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-500 whitespace-nowrap">
                      시작일 지남
                    </span>
                  )}
                  <span className="text-sm font-medium px-2.5 py-1 rounded-full bg-blue-100 text-primary-600">
                    {job.category}
                  </span>
                </div>
                <span className="text-sm text-gray-500">{formatDate(job.createdAt)}</span>
              </div>
              <h3 className="font-semibold text-base">{job.title}</h3>
              <p className="text-sm text-gray-600 mt-1 truncate">
                {job.location.address}
              </p>
              <div className="flex items-center justify-between mt-2">
                <span className="text-accent-500 font-bold text-lg">
                  일당 {formatWon(job.dailyWage)}
                </span>
                <span className="text-sm text-gray-600">
                  {job.numberOfWorkers}명 모집 · {formatDate(job.startDate)}~
                </span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

/** useSearchParams 사용을 위한 Suspense 경계 */
export default function JobsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent" />
        </div>
      }
    >
      <JobsContent />
    </Suspense>
  );
}
