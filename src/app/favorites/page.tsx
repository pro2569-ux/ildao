'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { getFavorites, removeFavorite, getUserProfile, getJob } from '@/lib/firestore';
import { formatDate, formatWon } from '@/lib/format';
import { Favorite, UserProfile, JobPost } from '@/types';
import { Spinner, PageLoader } from '@/components/ui/Spinner';
import { EmptyState } from '@/components/ui/EmptyState';
import { ErrorState } from '@/components/ui/ErrorState';
import { jobStatusBadge } from '@/lib/constants';

/** 즐겨찾기한 근로자 (구인자용) */
interface FavoriteWorker extends Favorite {
  worker?: UserProfile | null;
}

/** 즐겨찾기한 공고 (구직자용) */
interface FavoriteJob extends Favorite {
  job?: JobPost | null;
}

/** 즐겨찾기한 업체 (구직자용) */
interface FavoriteCompany extends Favorite {
  company?: UserProfile | null;
}

/**
 * 즐겨찾기 페이지
 * - 구인자: 즐겨찾기 근로자 탭
 * - 구직자: 관심 업체 / 관심 공고 탭
 */
export default function FavoritesPage() {
  // 로그인 + 프로필 등록 필수 — 미가입 사용자가 무한 스피너에 갇히던 문제(#28)는
  // 훅이 /register로 안내해 해소
  const { user, userProfile, ready } = useRequireAuth();
  const router = useRouter();

  // 구인자용 상태
  const [favoriteWorkers, setFavoriteWorkers] = useState<FavoriteWorker[]>([]);

  // 구직자용 상태
  const [favoriteJobs, setFavoriteJobs] = useState<FavoriteJob[]>([]);
  const [favoriteCompanies, setFavoriteCompanies] = useState<FavoriteCompany[]>([]);

  // 공통 상태
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);
  const [removingId, setRemovingId] = useState<string | null>(null);

  const isEmployer = userProfile?.role === 'employer';

  // 가드 통과 후 데이터 로드
  useEffect(() => {
    if (ready) loadFavorites();
  }, [ready]);

  /** 즐겨찾기 데이터 로드 */
  const loadFavorites = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setError(null);

    try {
      if (isEmployer) {
        // 구인자: 즐겨찾기 근로자 로드
        const favs = await getFavorites(user.uid, 'user');
        const withProfiles = await Promise.all(
          favs.map(async (fav) => {
            // 탈퇴(null) 또는 비공개 전환(권한 거부) 모두 목록 전체를 깨뜨리지 않도록 null 처리
            const worker = await getUserProfile(fav.targetId).catch(() => null);
            return { ...fav, worker };
          })
        );
        setFavoriteWorkers(withProfiles);
      } else {
        // 구직자: 관심 업체 + 관심 공고 로드
        const [userFavs, jobFavs] = await Promise.all([
          getFavorites(user.uid, 'user'),
          getFavorites(user.uid, 'job'),
        ]);

        // 관심 업체 프로필 로드
        const companiesWithProfiles = await Promise.all(
          userFavs.map(async (fav) => {
            const company = await getUserProfile(fav.targetId).catch(() => null);
            return { ...fav, company };
          })
        );
        setFavoriteCompanies(companiesWithProfiles);

        // 관심 공고 상세 로드
        const jobsWithDetails = await Promise.all(
          jobFavs.map(async (fav) => {
            // 삭제(null)·일시적 로드 실패 모두 목록 전체를 깨뜨리지 않도록 null 처리 (프로필 로드와 동일 패턴)
            const job = await getJob(fav.targetId).catch(() => null);
            return { ...fav, job };
          })
        );
        setFavoriteJobs(jobsWithDetails);
      }
    } catch (err) {
      console.error('즐겨찾기 로드 실패:', err);
      setError('즐겨찾기 목록을 불러오지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [user, isEmployer]);

  /** 즐겨찾기 해제 (확인 후) */
  const handleRemoveFavorite = async (targetId: string, label: string) => {
    if (!user) return;
    const confirmed = window.confirm(`${label}을(를) 즐겨찾기에서 해제하시겠습니까?`);
    if (!confirmed) return;

    setRemovingId(targetId);
    try {
      await removeFavorite(user.uid, targetId);
      // 로컬 상태에서 제거
      setFavoriteWorkers((prev) => prev.filter((f) => f.targetId !== targetId));
      setFavoriteJobs((prev) => prev.filter((f) => f.targetId !== targetId));
      setFavoriteCompanies((prev) => prev.filter((f) => f.targetId !== targetId));
    } catch (err) {
      console.error('즐겨찾기 해제 실패:', err);
      alert('즐겨찾기 해제에 실패했습니다.');
    } finally {
      setRemovingId(null);
    }
  };

  // ===== 로딩 / 인증 처리 =====
  if (!ready) {
    return (
      <PageLoader />
    );
  }

  // ===== 구인자 탭 구성 =====
  const employerTabs = [{ label: '즐겨찾기 근로자', count: favoriteWorkers.length }];

  // ===== 구직자 탭 구성 =====
  const workerTabs = [
    { label: '관심 업체', count: favoriteCompanies.length },
    { label: '관심 공고', count: favoriteJobs.length },
  ];

  const tabs = isEmployer ? employerTabs : workerTabs;

  return (
    <div className="px-4 pt-6 pb-24">
      {/* 상단 헤더 */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold">즐겨찾기</h1>
      </div>

      {/* 탭 메뉴 */}
      {tabs.length > 1 && (
        <div className="flex border-b border-gray-200 mb-4">
          {tabs.map((tab, idx) => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(idx)}
              className={`flex-1 py-3 text-sm font-medium text-center border-b-2 transition-colors ${
                activeTab === idx
                  ? 'border-primary-500 text-primary-500'
                  : 'border-transparent text-gray-400'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 text-xs">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 에러 상태 */}
      {error && <ErrorState message={error} onRetry={loadFavorites} />}

      {/* 로딩 상태 */}
      {loading && !error && (
        <div className="flex justify-center py-12">
          <Spinner size="sm" />
        </div>
      )}

      {/* 콘텐츠 영역 */}
      {!loading && !error && (
        <>
          {/* ===== 구인자: 즐겨찾기 근로자 ===== */}
          {isEmployer && activeTab === 0 && (
            <>
              {favoriteWorkers.length === 0 ? (
                <EmptyState
                  icon={WORKER_ICON}
                  message="즐겨찾기한 근로자가 없습니다"
                  subMessage="마음에 드는 구직자를 즐겨찾기에 추가해보세요"
                  linkHref="/workers"
                  linkText="구직자 찾기"
                />
              ) : (
                <div className="space-y-3">
                  {favoriteWorkers.map((fav) => {
                    const w = fav.worker;
                    if (!w) {
                      return (
                        <div key={fav.targetId} className="card">
                          <p className="text-sm text-gray-400">탈퇴했거나 프로필을 비공개한 사용자</p>
                          <button
                            onClick={() => handleRemoveFavorite(fav.targetId, '해당 사용자')}
                            disabled={removingId === fav.targetId}
                            className="mt-2 text-xs text-red-400"
                          >
                            삭제
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div key={fav.targetId} className="card">
                        <div className="flex items-start justify-between">
                          <div className="flex-1 min-w-0">
                            <h3 className="font-semibold text-sm">{w.name}</h3>
                            {/* 보유 기술 */}
                            {w.skills && w.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {w.skills.map((skill) => (
                                  <span
                                    key={skill}
                                    className="text-xs bg-blue-50 text-primary-500 px-2 py-0.5 rounded-full"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* 경력 / 희망 일당 */}
                            <div className="flex items-center gap-2 mt-1.5 text-xs text-gray-500">
                              {w.experience != null && (
                                <span>경력 {w.experience}년</span>
                              )}
                              {w.experience != null && w.desiredWage && <span>·</span>}
                              {w.desiredWage && (
                                <span className="text-accent-500 font-medium">
                                  희망 {formatWon(w.desiredWage)}
                                </span>
                              )}
                            </div>
                            {w.region && (
                              <p className="text-xs text-gray-400 mt-1">{w.region}</p>
                            )}
                          </div>
                        </div>
                        {/* 액션 버튼 */}
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                          {w.phone && (
                            <a
                              href={`tel:${w.phone}`}
                              className="flex-1 py-2 text-center text-sm font-medium bg-primary-500 text-white rounded-lg"
                            >
                              연락하기
                            </a>
                          )}
                          <button
                            onClick={() => handleRemoveFavorite(fav.targetId, w.name)}
                            disabled={removingId === fav.targetId}
                            className="flex-1 py-2 text-center text-sm font-medium border border-gray-200 text-gray-500 rounded-lg disabled:opacity-50"
                          >
                            {removingId === fav.targetId ? '해제 중...' : '즐겨찾기 해제'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ===== 구직자: 관심 업체 (탭 0) ===== */}
          {!isEmployer && activeTab === 0 && (
            <>
              {favoriteCompanies.length === 0 ? (
                <EmptyState
                  icon={COMPANY_ICON}
                  message="관심 업체가 없습니다"
                  subMessage="마음에 드는 업체를 즐겨찾기에 추가해보세요"
                  linkHref="/jobs"
                  linkText="구인공고 둘러보기"
                />
              ) : (
                <div className="space-y-3">
                  {favoriteCompanies.map((fav) => {
                    const c = fav.company;
                    if (!c) {
                      return (
                        <div key={fav.targetId} className="card">
                          <p className="text-sm text-gray-400">탈퇴한 업체</p>
                          <button
                            onClick={() => handleRemoveFavorite(fav.targetId, '해당 업체')}
                            disabled={removingId === fav.targetId}
                            className="mt-2 text-xs text-red-400"
                          >
                            삭제
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div key={fav.targetId} className="card">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-sm">
                            {c.companyName || c.name}
                          </h3>
                          {c.representativeName && (
                            <p className="text-xs text-gray-500 mt-0.5">
                              대표: {c.representativeName}
                            </p>
                          )}
                          {/* 주요 직종 */}
                          {c.mainJobCategories && c.mainJobCategories.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {c.mainJobCategories.map((cat) => (
                                <span
                                  key={cat}
                                  className="text-xs bg-orange-50 text-accent-500 px-2 py-0.5 rounded-full"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* 액션 버튼 */}
                        <div className="flex gap-2 mt-3 pt-3 border-t border-gray-100">
                          {c.phone && (
                            <a
                              href={`tel:${c.phone}`}
                              className="flex-1 py-2 text-center text-sm font-medium bg-primary-500 text-white rounded-lg"
                            >
                              연락하기
                            </a>
                          )}
                          <button
                            onClick={() => handleRemoveFavorite(fav.targetId, c.companyName || c.name)}
                            disabled={removingId === fav.targetId}
                            className="flex-1 py-2 text-center text-sm font-medium border border-gray-200 text-gray-500 rounded-lg disabled:opacity-50"
                          >
                            {removingId === fav.targetId ? '해제 중...' : '즐겨찾기 해제'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ===== 구직자: 관심 공고 (탭 1) ===== */}
          {!isEmployer && activeTab === 1 && (
            <>
              {favoriteJobs.length === 0 ? (
                <EmptyState
                  icon={JOB_ICON}
                  message="관심 공고가 없습니다"
                  subMessage="마음에 드는 공고를 즐겨찾기에 추가해보세요"
                  linkHref="/jobs"
                  linkText="구인공고 둘러보기"
                />
              ) : (
                <div className="space-y-3">
                  {favoriteJobs.map((fav) => {
                    const j = fav.job;
                    if (!j) {
                      return (
                        <div key={fav.targetId} className="card flex items-center justify-between">
                          <p className="text-sm text-gray-400">삭제된 공고</p>
                          <button
                            onClick={() => handleRemoveFavorite(fav.targetId, '해당 공고')}
                            disabled={removingId === fav.targetId}
                            className="text-xs text-red-400"
                          >
                            삭제
                          </button>
                        </div>
                      );
                    }
                    const badge = jobStatusBadge(j.status);
                    return (
                      <div key={fav.targetId} className="card">
                        <Link href={`/jobs/${j.id}`} className="block">
                          <div className="flex items-center justify-between mb-1.5">
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
                              {badge.text}
                            </span>
                            <span className="text-xs text-gray-400">
                              {formatDate(j.createdAt)}
                            </span>
                          </div>
                          <h3 className="font-semibold text-sm">{j.title}</h3>
                          <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                            <span>{j.category}</span>
                            <span>·</span>
                            <span className="text-accent-500 font-medium">
                              {formatWon(j.dailyWage)}
                            </span>
                            <span>·</span>
                            <span className="truncate">{j.location.address}</span>
                          </div>
                        </Link>
                        {/* 즐겨찾기 해제 */}
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <button
                            onClick={() => handleRemoveFavorite(fav.targetId, j.title)}
                            disabled={removingId === fav.targetId}
                            className="w-full py-2 text-center text-sm font-medium border border-gray-200 text-gray-500 rounded-lg disabled:opacity-50"
                          >
                            {removingId === fav.targetId ? '해제 중...' : '즐겨찾기 해제'}
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}

// ===== 빈 상태 아이콘 (공용 EmptyState에 prop으로 주입) =====

const WORKER_ICON = (
  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
  </svg>
);
const COMPANY_ICON = (
  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
  </svg>
);
const JOB_ICON = (
  <svg className="w-16 h-16" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
  </svg>
);
