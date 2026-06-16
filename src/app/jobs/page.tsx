'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getJobs } from '@/lib/firestore';
import { JobPost, JobCategory } from '@/types';

/** 직종 필터 목록 */
const CATEGORIES: (JobCategory | '전체')[] = [
  '전체', '철근', '목공', '설비', '전기', '도장', '용접', '타일', '미장', '방수', '조적', '비계', '잡역', '기타',
];

/** 정렬 옵션 */
type SortOption = 'latest' | 'highWage';

/**
 * 구인 공고 피드 페이지
 * - 전체 구인 공고 리스트
 * - 지역/직종/일당 필터
 * - 정렬 (최신순, 일당 높은순)
 */
export default function JobsPage() {
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<JobCategory | '전체'>('전체');
  const [sortBy, setSortBy] = useState<SortOption>('latest');

  useEffect(() => {
    // 필터/정렬을 빠르게 전환하면 이전 요청 응답이 최신 결과를 덮어쓸 수 있으므로
    // cleanup으로 stale 응답을 무시한다
    let cancelled = false;
    setLoading(true);
    getJobs({
      status: 'open',
      category: selectedCategory === '전체' ? undefined : selectedCategory,
      sortBy: sortBy === 'highWage' ? 'dailyWage' : 'createdAt',
      sortDir: 'desc',
      // 첫 화면 로드량·읽기 비용을 제한 (#40 — 전체 fetch 방지). 추후 커서 페이지네이션 여지
      limitCount: 50,
    })
      .then((data) => {
        if (!cancelled) setJobs(data);
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
  }, [selectedCategory, sortBy]);

  /** 날짜 포맷 */
  const formatDate = (date: Date) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="text-xl font-bold mb-4">구인공고</h1>

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
          {loading ? '로딩중...' : `${jobs.length}건`}
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
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : jobs.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">
            {selectedCategory === '전체'
              ? '등록된 구인공고가 없습니다'
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
    </div>
  );
}
