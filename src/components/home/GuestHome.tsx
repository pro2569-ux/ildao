'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { getJobs } from '@/lib/firestore';
import { JobPost } from '@/types';
import ErrorState from '@/components/ui/ErrorState';
import { formatWon } from '@/lib/format';

/** 비로그인 사용자 홈 화면 */
export default function GuestHome() {
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [loading, setLoading] = useState(true);
  // 로드 실패를 "공고 없음"으로 위장하지 않기 위한 에러 상태 (P2-3)
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    loadJobs();
  }, []);

  /** 모집중 공고 3건 로드 */
  const loadJobs = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await getJobs({ status: 'open', limitCount: 3 });
      setJobs(data);
    } catch (error) {
      console.error('공고 로드 실패:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-24">
      {/* 상단 헤더 */}
      <header className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <span className="w-8 h-8 rounded-[9px] bg-navy text-white grid place-items-center shadow-card">
            <svg className="w-[18px] h-[18px]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
              <path d="M4 21V9l8-5 8 5v12" /><path d="M9 21v-6h6v6" />
            </svg>
          </span>
          <h1 className="text-xl font-extrabold tracking-tight text-navy">일다오</h1>
        </div>
        <Link
          href="/login"
          className="btn-primary py-2.5 px-5 min-h-[44px] flex items-center text-base"
        >
          로그인
        </Link>
      </header>

      {/* 앱 소개 배너 — 청사진 네이비 */}
      <div className="relative overflow-hidden rounded-2xl p-6 mb-7 text-white shadow-card-lg"
        style={{ background: 'linear-gradient(135deg, #122a52 0%, #1d3f78 100%)' }}>
        <h2 className="text-xl font-extrabold leading-snug mb-1.5">건설·일용직,<br />오늘 바로 일하세요</h2>
        <p className="text-sm text-white/80 mb-4">현장과 근로자를 가장 빠르게 잇는 곳</p>
        <Link
          href="/login"
          className="inline-flex items-center min-h-[44px] py-2.5 px-6 bg-white text-navy text-base font-bold rounded-xl"
        >
          시작하기
        </Link>
      </div>

      {/* 카테고리 빠른 접근 */}
      <section className="mb-7">
        <h2 className="text-lg font-bold mb-3 text-ink">직종별 공고</h2>
        <div className="grid grid-cols-4 gap-2.5">
          {['철근', '목공', '설비', '전기', '도장', '용접', '타일', '더보기'].map((name) => {
            const isMore = name === '더보기';
            return (
              <Link
                key={name}
                href={isMore ? '/jobs' : `/jobs?category=${encodeURIComponent(name)}`}
                className={`flex items-center justify-center py-3.5 min-h-[48px] rounded-xl border text-base font-bold transition-colors ${
                  isMore
                    ? 'bg-accent-50 border-accent-100 text-accent-600'
                    : 'bg-white border-line text-ink hover:border-primary-300 hover:text-primary-600'
                }`}
              >
                {name}
              </Link>
            );
          })}
        </div>
      </section>

      {/* 최신 공고 목록 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-ink">최신 공고</h2>
        </div>
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 bg-white/60 border border-line rounded-2xl animate-pulse" />
            ))}
          </div>
        ) : loadError ? (
          <ErrorState
            title="공고를 불러오지 못했어요"
            onRetry={loadJobs}
            className="card !py-8"
          />
        ) : jobs.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-ink-soft text-base">지금 올라온 공고를 보려면 로그인하세요</p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="card flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <span className="cat-tag bg-primary-50 text-primary-700 mb-1.5">{job.category}</span>
                  <h3 className="font-bold text-base text-ink truncate">{job.title}</h3>
                  <p className="text-sm text-ink-soft mt-0.5 truncate flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}>
                      <path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" />
                    </svg>
                    {job.location.address}
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
        <div className="mt-4 text-center">
          <Link href="/login" className="inline-block py-3 text-base text-primary-600 font-bold">
            로그인하고 더 많은 공고 보기 →
          </Link>
        </div>
      </section>
    </div>
  );
}
