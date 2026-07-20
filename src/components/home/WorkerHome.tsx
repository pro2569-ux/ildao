'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import {
  getJobs,
  getJob,
  getUserProfile,
  subscribeToApplicationsByWorker,
} from '@/lib/firestore';
import { JobPost, Application, JobCategory } from '@/types';
import ErrorState from '@/components/ui/ErrorState';
import { formatWon, formatDate } from '@/lib/format';

/** 직종 카테고리 목록 — 공고 피드와 동일하게 전체 직종 노출 (P2-18) */
const CATEGORIES: { name: JobCategory | '전체'; icon: string }[] = [
  { name: '전체', icon: '📋' },
  { name: '철근', icon: '🔩' },
  { name: '목공', icon: '🪵' },
  { name: '설비', icon: '🔧' },
  { name: '전기', icon: '⚡' },
  { name: '도장', icon: '🎨' },
  { name: '용접', icon: '🔥' },
  { name: '타일', icon: '🧱' },
  { name: '미장', icon: '🪣' },
  { name: '방수', icon: '☔' },
  { name: '조적', icon: '🏗️' },
  { name: '비계', icon: '🪜' },
  { name: '잡역', icon: '💪' },
  { name: '기타', icon: '📦' },
];

/** 닫은 수락 배너의 application id 목록을 저장하는 localStorage 키 */
const DISMISSED_BANNERS_KEY = 'dismissedAcceptedBanners';

/** 수락 배너 표시 정보 */
interface AcceptedBanner {
  appId: string;
  jobTitle: string;
  employerPhone: string | null;
}

/** 구직자 전용 홈 화면 */
export default function WorkerHome() {
  const { userProfile } = useAuth();
  const [jobs, setJobs] = useState<JobPost[]>([]);
  const [applications, setApplications] = useState<Application[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<JobCategory | '전체'>('전체');
  const [loading, setLoading] = useState(true);
  // 로드 실패를 "공고 없음"으로 위장하지 않기 위한 에러 상태 (P2-3)
  const [loadError, setLoadError] = useState(false);

  // 수락 배너 상태
  const [dismissedIds, setDismissedIds] = useState<string[]>([]);
  const [banner, setBanner] = useState<AcceptedBanner | null>(null);
  // 같은 지원 건의 배너 정보를 중복 조회하지 않도록 마지막 조회 대상 기억
  const bannerFetchedFor = useRef<string | null>(null);

  // 닫은 배너 목록 로드 (localStorage)
  useEffect(() => {
    try {
      const stored = localStorage.getItem(DISMISSED_BANNERS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setDismissedIds(parsed);
      }
    } catch (error) {
      console.error('닫은 배너 목록 로드 실패:', error);
    }
  }, []);

  // 최신 공고 로드 (카테고리 변경 시)
  useEffect(() => {
    loadJobs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  // 지원 현황 실시간 구독
  useEffect(() => {
    if (!userProfile?.uid) {
      setApplications([]);
      return;
    }
    const unsubscribe = subscribeToApplicationsByWorker(userProfile.uid, setApplications);
    return () => unsubscribe();
  }, [userProfile?.uid]);

  // 수락 배너 — 닫지 않은 수락 건 중 최신 1건의 공고 제목/구인자 전화번호 로드
  useEffect(() => {
    const latestAccepted = applications.find(
      (a) => a.status === 'accepted' && !dismissedIds.includes(a.id)
    );
    if (!latestAccepted) {
      bannerFetchedFor.current = null;
      setBanner(null);
      return;
    }
    if (bannerFetchedFor.current === latestAccepted.id) return;
    bannerFetchedFor.current = latestAccepted.id;

    (async () => {
      try {
        const [job, employer] = await Promise.all([
          getJob(latestAccepted.jobId).catch(() => null),
          getUserProfile(latestAccepted.employerId).catch(() => null),
        ]);
        // 조회 중 대상이 바뀌었으면 (더 최신 수락 건 등) 이 결과는 버림
        if (bannerFetchedFor.current !== latestAccepted.id) return;
        setBanner({
          appId: latestAccepted.id,
          jobTitle: job?.title || '지원한 공고',
          employerPhone: employer?.phone || null,
        });
      } catch (error) {
        console.error('수락 배너 정보 로드 실패:', error);
      }
    })();
  }, [applications, dismissedIds]);

  const loadJobs = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const jobsData = await getJobs({
        status: 'open',
        category: selectedCategory === '전체' ? undefined : selectedCategory,
        limitCount: 10,
      });
      setJobs(jobsData);
    } catch (error) {
      console.error('데이터 로드 실패:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  /** 수락 배너 닫기 — localStorage에 저장해 다시 안 뜸 */
  const dismissBanner = () => {
    if (!banner) return;
    const next = [...dismissedIds, banner.appId];
    setDismissedIds(next);
    setBanner(null);
    try {
      localStorage.setItem(DISMISSED_BANNERS_KEY, JSON.stringify(next));
    } catch (error) {
      console.error('닫은 배너 목록 저장 실패:', error);
    }
  };

  /** 지원 상태 카운트 */
  const pendingCount = applications.filter((a) => a.status === 'pending').length;
  const acceptedCount = applications.filter((a) => a.status === 'accepted').length;

  return (
    <div className="px-4 pt-6 pb-24">
      {/* 수락 배너 */}
      {banner && (
        <div className="relative bg-ok-50 border border-ok/40 rounded-2xl p-4 mb-4 shadow-sm">
          <button
            onClick={dismissBanner}
            aria-label="배너 닫기"
            className="absolute top-2 right-2 p-2.5 text-ink-soft"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <p className="text-base font-bold text-ink pr-10">
            {`'${banner.jobTitle}'에 수락됐어요!`}
          </p>
          <p className="text-sm text-ink-soft mt-1">사장님께 전화로 확인해보세요</p>
          {banner.employerPhone && (
            <a
              href={`tel:${banner.employerPhone}`}
              className="flex items-center justify-center gap-2 w-full mt-3 min-h-[48px] py-3 bg-ok text-white text-center text-base font-bold rounded-xl"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 0 1 2-2h2.4a1 1 0 0 1 1 .76l1 4a1 1 0 0 1-.29.95L7.6 10.6a12 12 0 0 0 5.8 5.8l1.9-1.9a1 1 0 0 1 .95-.29l4 1a1 1 0 0 1 .76 1V19a2 2 0 0 1-2 2A16 16 0 0 1 3 5z" />
              </svg>
              전화하기
            </a>
          )}
        </div>
      )}

      {/* 상단 인사 */}
      <header className="mb-4">
        <p className="text-sm text-ink-soft">안녕하세요,</p>
        <h1 className="text-2xl font-extrabold text-navy">{userProfile?.name}님</h1>
      </header>

      {/* 지원 현황 카드 */}
      <div className="flex gap-3 mb-6">
        <Link href="/my-applications?filter=pending" className="flex-1 card text-center min-h-[44px]">
          <p className="text-3xl font-extrabold text-primary-600 tnum">{pendingCount}</p>
          <p className="text-sm text-ink-soft font-semibold mt-1">지원 대기</p>
        </Link>
        <Link href="/my-applications?filter=accepted" className="flex-1 card text-center min-h-[44px]">
          <p className="text-3xl font-extrabold text-ok tnum">{acceptedCount}</p>
          <p className="text-sm text-ink-soft font-semibold mt-1">수락됨</p>
        </Link>
        <Link href="/my-applications" className="flex-1 card text-center min-h-[44px]">
          <p className="text-3xl font-extrabold text-ink tnum">{applications.length}</p>
          <p className="text-sm text-ink-soft font-semibold mt-1">전체 지원</p>
        </Link>
      </div>

      {/* 직종 빠른 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-4 scrollbar-hide">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.name}
            onClick={() => setSelectedCategory(cat.name)}
            className={`flex-shrink-0 flex items-center py-2.5 px-4 min-h-[44px] rounded-full text-base font-semibold transition-colors ${
              selectedCategory === cat.name
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-line text-ink'
            }`}
          >
            <span>{cat.name}</span>
          </button>
        ))}
      </div>

      {/* 최신 공고 */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-bold text-ink">최신 공고</h2>
          <Link href="/jobs" className="text-sm text-primary-600 font-semibold py-2 px-1">
            전체보기
          </Link>
        </div>

        {loading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent" />
          </div>
        ) : loadError ? (
          <ErrorState
            title="공고를 불러오지 못했어요"
            onRetry={loadJobs}
            className="card !py-8"
          />
        ) : jobs.length === 0 ? (
          <div className="card text-center py-8">
            <p className="text-ink-soft text-base">
              {selectedCategory === '전체'
                ? '아직 등록된 공고가 없습니다'
                : `${selectedCategory} 관련 공고가 없습니다`}
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {jobs.map((job) => (
              <Link key={job.id} href={`/jobs/${job.id}`} className="card flex items-center gap-3">
                <div className="flex-1 min-w-0">
                  <span className="cat-tag bg-primary-50 text-primary-700 mb-1.5">{job.category}</span>
                  <h3 className="font-bold text-base text-ink truncate">{job.title}</h3>
                  <p className="text-sm text-ink-soft mt-0.5 truncate flex items-center gap-1">
                    <svg className="w-3.5 h-3.5 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2}><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z" /></svg>
                    {job.location.address}
                  </p>
                  <p className="text-xs text-ink-soft mt-1 tnum">
                    {job.numberOfWorkers}명 모집 · {formatDate(job.startDate)}~
                  </p>
                </div>
                <div className="text-right flex-shrink-0">
                  <span className="text-accent-500 font-extrabold text-xl tnum">{formatWon(job.dailyWage)}</span>
                  <p className="text-xs text-ink-soft font-semibold">일당</p>
                  <p className="text-xs text-ink-soft mt-1 tnum">{formatDate(job.createdAt)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
