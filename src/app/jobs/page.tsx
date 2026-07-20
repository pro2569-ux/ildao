'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getJobs } from '@/lib/firestore';
import { fetchJobsPage, JobsCursor, JOBS_PAGE_SIZE } from '@/lib/jobsPager';
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

/** 클라이언트 필터/정렬 경로에서 한 번에 가져올 건수 (P3-5) */
const CLIENT_LOAD_COUNT = 100;
/** 검색 중일 때 더 넓게 가져올 건수 (P3-5) */
const SEARCH_LOAD_COUNT = 200;

/** userProfile.region('서울 강남구' 등)을 REGIONS 시/도로 prefix 매칭 (P2-6) */
const regionFromProfile = (profileRegion?: string): string =>
  REGIONS.find((r) => r !== '전국' && profileRegion?.startsWith(r)) ?? '전국';

/** 검색 비교용 정규화 — 공백 제거 + 소문자 (P3-5) */
const normalizeForSearch = (s: string): string => s.toLowerCase().replace(/\s+/g, '');

/**
 * 구인 공고 피드 페이지
 * - 전체 구인 공고 리스트
 * - 지역/직종/일당 필터
 * - 정렬 (최신순, 일당 높은순)
 * - 현장명/동네 텍스트 검색 + "더보기" 페이지네이션 + 새로고침 (P3-5)
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
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<JobCategory | '전체'>(initialCategory);
  const [selectedRegion, setSelectedRegion] = useState<string>('전국');
  const [regionTouched, setRegionTouched] = useState(false);
  const [sortBy, setSortBy] = useState<SortOption>('latest');

  // 검색 (P3-5) — searchInput은 입력 그대로, search는 300ms 디바운스 반영값
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');

  // 페이지네이션 상태 (P3-5)
  const [cursor, setCursor] = useState<JobsCursor | null>(null); // 서버 커서 (다음 페이지 시작점)
  const [hasMore, setHasMore] = useState(false);                 // 서버 커서 모드: 다음 페이지 존재 여부
  const [visibleCount, setVisibleCount] = useState(JOBS_PAGE_SIZE); // 클라이언트 모드: 노출 개수

  // 서버 커서 페이지네이션 사용 조건 (P3-5):
  // 필터·일당순 정렬·검색이 없을 때만. 그 외에는 커서가 의미 없으므로(클라이언트 처리)
  // getJobs()로 크게 가져와 클라이언트에서 잘라 보여준다.
  const useServerPaging =
    selectedCategory === '전체' && selectedRegion === '전국' && sortBy === 'latest' && search === '';

  // 로그인 유저의 지역을 기본 필터로 (유저가 직접 칩을 바꾸기 전까지만)
  useEffect(() => {
    if (regionTouched || !userProfile?.region) return;
    setSelectedRegion(regionFromProfile(userProfile.region));
  }, [userProfile, regionTouched]);

  // 검색어 300ms 디바운스 (P3-5)
  useEffect(() => {
    const timer = setTimeout(() => setSearch(searchInput.trim()), 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // 필터/정렬/검색어가 바뀌면 커서 리셋 후 처음부터 다시 로드
  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedRegion, sortBy, search]);

  /** 처음부터 다시 로드 (커서/노출 개수 리셋) */
  const loadJobs = async () => {
    setLoading(true);
    setError(false);
    try {
      if (useServerPaging) {
        // 기본 화면: 서버 커서 페이지네이션 (20건씩)
        const page = await fetchJobsPage({ pageSize: JOBS_PAGE_SIZE });
        setJobs(page.jobs);
        setCursor(page.cursor);
        setHasMore(page.hasMore);
      } else {
        // 필터/일당순/검색 활성: 크게 가져와 클라이언트 처리 (복합 인덱스 회피 정책 유지)
        const data = await getJobs({
          status: 'open',
          category: selectedCategory === '전체' ? undefined : selectedCategory,
          region: selectedRegion,
          sortBy: sortBy === 'highWage' ? 'dailyWage' : 'createdAt',
          sortDir: 'desc',
          limitCount: search ? SEARCH_LOAD_COUNT : CLIENT_LOAD_COUNT,
        });
        setJobs(data);
        setCursor(null);
        setHasMore(false);
      }
      setVisibleCount(JOBS_PAGE_SIZE);
    } catch (error) {
      console.error('구인 공고 로드 실패:', error);
      setError(true); // 실패를 "공고 없음"으로 위장하지 않음 (P2-3)
    } finally {
      setLoading(false);
    }
  };

  /** "더보기" — 서버 모드는 다음 페이지 조회, 클라이언트 모드는 노출 개수 확대 */
  const loadMore = async () => {
    if (!useServerPaging) {
      setVisibleCount((count) => count + JOBS_PAGE_SIZE);
      return;
    }
    if (!cursor || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await fetchJobsPage({ pageSize: JOBS_PAGE_SIZE, cursor });
      setJobs((prev) => [...prev, ...page.jobs]);
      setCursor(page.cursor);
      setHasMore(page.hasMore);
    } catch (error) {
      // 더보기 실패는 기존 목록을 유지하고 버튼을 남겨 재시도 가능하게 함
      console.error('공고 더보기 실패:', error);
    } finally {
      setLoadingMore(false);
    }
  };

  /** 새로고침 — 커서 리셋 후 처음부터 재조회 (P3-5) */
  const refresh = async () => {
    if (refreshing || loading) return;
    setRefreshing(true);
    try {
      await loadJobs();
    } finally {
      setRefreshing(false);
    }
  };

  // 검색 필터 (클라이언트) — title + location.address에 공백 무시·대소문자 무시 포함 검사 (P3-5)
  // 시작일 지난 공고 하단 정렬(P2-16)은 누적 목록 전체 기준으로 다시 적용 (페이지 경계에서도 일관되게)
  const orderedJobs = useMemo(() => {
    const keyword = normalizeForSearch(search);
    const searched = keyword
      ? jobs.filter((job) =>
          normalizeForSearch(`${job.title} ${job.location.address}`).includes(keyword)
        )
      : jobs;
    const fresh = searched.filter((job) => !isPastDay(job.startDate));
    const stale = searched.filter((job) => isPastDay(job.startDate));
    return [...fresh, ...stale];
  }, [jobs, search]);

  // 화면에 실제로 보여줄 목록 — 클라이언트 모드는 20건씩 잘라서 노출
  const visibleJobs = useServerPaging ? orderedJobs : orderedJobs.slice(0, visibleCount);
  // "더보기" 버튼 표시 여부
  const canLoadMore = useServerPaging ? hasMore : visibleCount < orderedJobs.length;

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="text-2xl font-bold text-ink mb-4">구인공고</h1>

      {/* 현장명/동네 검색 (P3-5) */}
      <div className="relative mb-3">
        <svg
          className="absolute left-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-ink-soft pointer-events-none"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-4.35-4.35M17 10.5a6.5 6.5 0 11-13 0 6.5 6.5 0 0113 0z" />
        </svg>
        <input
          type="search"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder="현장명, 동네 검색"
          aria-label="현장명, 동네 검색"
          className="w-full h-12 pl-11 pr-4 rounded-xl border border-line bg-white text-base text-ink placeholder:text-ink-soft focus:outline-none focus:border-primary-500 focus:ring-2 focus:ring-primary-50"
        />
      </div>

      {/* 직종 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`flex-shrink-0 py-2.5 px-4 rounded-full text-base font-semibold transition-colors ${
              selectedCategory === cat
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-white border border-line text-ink'
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
            className={`flex-shrink-0 py-2.5 px-4 rounded-full text-base font-semibold transition-colors ${
              selectedRegion === region
                ? 'bg-primary-500 text-white shadow-sm'
                : 'bg-white border border-line text-ink'
            }`}
          >
            {region}
          </button>
        ))}
      </div>

      {/* 정렬 옵션 + 새로고침 */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-base text-ink-soft font-medium">
          {loading
            ? '로딩중...'
            : search
              ? `'${search}' 검색 결과 ${orderedJobs.length}건`
              : `${orderedJobs.length}건`}
        </span>
        <div className="flex items-center gap-1">
          <button
            onClick={() => setSortBy('latest')}
            className={`text-base font-semibold py-2.5 px-2 ${
              sortBy === 'latest' ? 'text-primary-600' : 'text-ink-soft'
            }`}
          >
            최신순
          </button>
          <span className="w-px h-4 bg-line" aria-hidden="true" />
          <button
            onClick={() => setSortBy('highWage')}
            className={`text-base font-semibold py-2.5 px-2 ${
              sortBy === 'highWage' ? 'text-primary-600' : 'text-ink-soft'
            }`}
          >
            일당 높은순
          </button>
          {/* 새로고침 버튼 (P3-5) — 커서 리셋 후 재조회 */}
          <button
            onClick={refresh}
            aria-label="공고 새로고침"
            className="w-11 h-11 flex items-center justify-center text-ink-soft -mr-2"
          >
            <svg
              className={`w-5 h-5 ${refreshing || loading ? 'animate-spin' : ''}`}
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              viewBox="0 0 24 24"
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
              />
            </svg>
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
      ) : visibleJobs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-ink-soft text-base">
            {search
              ? `'${search}' 검색 결과가 없어요`
              : selectedCategory === '전체' && selectedRegion === '전국'
                ? '등록된 구인공고가 없습니다'
                : `${selectedRegion !== '전국' ? `${selectedRegion} ` : ''}${
                    selectedCategory !== '전체' ? `${selectedCategory} ` : ''
                  }공고가 없습니다`}
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {visibleJobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="card block">
                <div className="flex items-start gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center flex-wrap gap-1.5 mb-1.5">
                      <StatusBadge status={job.status} />
                      {/* 시작일 지난 공고 표시 (P2-16) — 모집중인데 시작일이 지난 죽은 공고 구분 */}
                      {job.status === 'open' && isPastDay(job.startDate) && (
                        <span className="cat-tag bg-warn-50 text-warn whitespace-nowrap">
                          시작일 지남
                        </span>
                      )}
                      <span className="cat-tag bg-primary-50 text-primary-700">
                        {job.category}
                      </span>
                    </div>
                    <h3 className="font-bold text-base text-ink truncate">{job.title}</h3>
                    <p className="text-sm text-ink-soft mt-0.5 truncate flex items-center gap-1">
                      <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                        <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
                      </svg>
                      {job.location.address}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="text-accent-500 font-extrabold text-xl tnum">{formatWon(job.dailyWage)}</span>
                    <p className="text-xs text-ink-soft font-semibold">일당</p>
                  </div>
                </div>
                <div className="flex items-center justify-between mt-2.5 pt-2.5 border-t border-line">
                  <span className="text-xs text-ink-soft font-medium">
                    {job.numberOfWorkers}명 모집 · {formatDate(job.startDate)}~
                  </span>
                  <span className="text-xs text-ink-soft">{formatDate(job.createdAt)}</span>
                </div>
              </Link>
            ))}
          </div>

          {/* 더보기 / 끝 안내 (P3-5) */}
          {canLoadMore ? (
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className="w-full h-12 mt-4 rounded-xl bg-white border border-line text-base font-bold text-navy flex items-center justify-center gap-2 active:bg-paper disabled:opacity-60"
            >
              {loadingMore ? (
                <>
                  <span className="animate-spin rounded-full h-5 w-5 border-2 border-primary-500 border-t-transparent" />
                  불러오는 중...
                </>
              ) : (
                '더보기'
              )}
            </button>
          ) : (
            <p className="text-center text-base text-ink-soft py-6">
              마지막 공고까지 봤어요
            </p>
          )}
        </>
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
