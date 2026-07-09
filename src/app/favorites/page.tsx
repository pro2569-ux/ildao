'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getFavorites, removeFavorite, getUserProfile, getJob } from '@/lib/firestore';
import { Favorite, UserProfile, JobPost } from '@/types';
import ConfirmSheet from '@/components/ui/ConfirmSheet';
import ErrorState from '@/components/ui/ErrorState';
import StatusBadge from '@/components/ui/StatusBadge';
import BackButton from '@/components/ui/BackButton';
import { useToast } from '@/components/ui/Toast';

/** 즐겨찾기한 구직자 (구인자용) */
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

/** 해제 확인 바텀시트 대상 */
interface RemoveTarget {
  targetId: string;
  label: string;
}

/**
 * 즐겨찾기 페이지
 * - 구인자: 즐겨찾기 구직자 탭
 * - 구직자: 즐겨찾기 업체 / 즐겨찾기 공고 탭
 */
export default function FavoritesPage() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();
  const { showToast, toastElement } = useToast();

  // 구인자용 상태
  const [favoriteWorkers, setFavoriteWorkers] = useState<FavoriteWorker[]>([]);

  // 구직자용 상태
  const [favoriteJobs, setFavoriteJobs] = useState<FavoriteJob[]>([]);
  const [favoriteCompanies, setFavoriteCompanies] = useState<FavoriteCompany[]>([]);

  // 공통 상태
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [activeTab, setActiveTab] = useState(0);

  // 해제 확인 바텀시트 상태
  const [removeTarget, setRemoveTarget] = useState<RemoveTarget | null>(null);
  const [removing, setRemoving] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);

  const isEmployer = userProfile?.role === 'employer';

  // 로그인 여부 체크 및 데이터 로드
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (user && userProfile) {
      loadFavorites();
    }
  }, [user, userProfile, authLoading]);

  /** 즐겨찾기 데이터 로드 */
  const loadFavorites = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    setLoadError(false);

    try {
      if (isEmployer) {
        // 구인자: 즐겨찾기 구직자 로드
        const favs = await getFavorites(user.uid, 'user');
        const withProfiles = await Promise.all(
          favs.map(async (fav) => {
            const worker = await getUserProfile(fav.targetId);
            return { ...fav, worker };
          })
        );
        setFavoriteWorkers(withProfiles);
      } else {
        // 구직자: 즐겨찾기 업체 + 즐겨찾기 공고 로드
        const [userFavs, jobFavs] = await Promise.all([
          getFavorites(user.uid, 'user'),
          getFavorites(user.uid, 'job'),
        ]);

        // 즐겨찾기 업체 프로필 로드
        const companiesWithProfiles = await Promise.all(
          userFavs.map(async (fav) => {
            const company = await getUserProfile(fav.targetId);
            return { ...fav, company };
          })
        );
        setFavoriteCompanies(companiesWithProfiles);

        // 즐겨찾기 공고 상세 로드
        const jobsWithDetails = await Promise.all(
          jobFavs.map(async (fav) => {
            const job = await getJob(fav.targetId);
            return { ...fav, job };
          })
        );
        setFavoriteJobs(jobsWithDetails);
      }
    } catch (err: any) {
      console.error('즐겨찾기 로드 실패:', err);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [user, isEmployer]);

  /** 확인 바텀시트에서 즐겨찾기 해제 확정 */
  const handleRemoveConfirm = async () => {
    if (!user || !removeTarget || removing) return;
    const { targetId } = removeTarget;

    setRemoving(true);
    setRemoveError(null);
    try {
      await removeFavorite(user.uid, targetId);
      // 로컬 상태에서 제거
      setFavoriteWorkers((prev) => prev.filter((f) => f.targetId !== targetId));
      setFavoriteJobs((prev) => prev.filter((f) => f.targetId !== targetId));
      setFavoriteCompanies((prev) => prev.filter((f) => f.targetId !== targetId));
      setRemoveTarget(null);
      showToast('즐겨찾기에서 해제했어요');
    } catch (err) {
      console.error('즐겨찾기 해제 실패:', err);
      setRemoveError('즐겨찾기 해제에 실패했어요. 잠시 후 다시 시도해주세요.');
    } finally {
      setRemoving(false);
    }
  };

  /** 날짜 포맷 */
  const formatDate = (date?: Date) => {
    if (!date) return '';
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  /** 일당 포맷 */
  const formatWage = (wage?: number) => {
    if (!wage) return '-';
    return `${wage.toLocaleString()}원`;
  };

  // ===== 로딩 / 인증 처리 =====
  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  // ===== 구인자 탭 구성 =====
  const employerTabs = [{ label: '즐겨찾기 구직자', count: favoriteWorkers.length }];

  // ===== 구직자 탭 구성 =====
  const workerTabs = [
    { label: '즐겨찾기 업체', count: favoriteCompanies.length },
    { label: '즐겨찾기 공고', count: favoriteJobs.length },
  ];

  const tabs = isEmployer ? employerTabs : workerTabs;

  return (
    <div className="px-4 pt-6 pb-24">
      {/* 상단 헤더 */}
      <div className="flex items-center gap-2 mb-4">
        <BackButton className="-ml-2" />
        <h1 className="text-xl font-bold">즐겨찾기</h1>
      </div>

      {/* 탭 메뉴 */}
      {tabs.length > 1 && (
        <div className="flex border-b border-gray-200 mb-4">
          {tabs.map((tab, idx) => (
            <button
              key={tab.label}
              onClick={() => setActiveTab(idx)}
              className={`flex-1 min-h-[44px] py-3 text-base font-medium text-center border-b-2 transition-colors ${
                activeTab === idx
                  ? 'border-primary-500 text-primary-500'
                  : 'border-transparent text-gray-500'
              }`}
            >
              {tab.label}
              {tab.count > 0 && (
                <span className="ml-1 text-sm">({tab.count})</span>
              )}
            </button>
          ))}
        </div>
      )}

      {/* 에러 상태 — 빈 목록으로 위장하지 않고 재시도 화면 표시 (P2-3) */}
      {loadError && (
        <ErrorState title="즐겨찾기를 불러오지 못했어요" onRetry={loadFavorites} />
      )}

      {/* 로딩 상태 */}
      {loading && !loadError && (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent" />
        </div>
      )}

      {/* 콘텐츠 영역 */}
      {!loading && !loadError && (
        <>
          {/* ===== 구인자: 즐겨찾기 구직자 ===== */}
          {isEmployer && activeTab === 0 && (
            <>
              {favoriteWorkers.length === 0 ? (
                <EmptyState
                  icon="worker"
                  message="즐겨찾기한 구직자가 없습니다"
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
                          <p className="text-base text-gray-500">탈퇴한 사용자</p>
                          <button
                            onClick={() => setRemoveTarget({ targetId: fav.targetId, label: '해당 사용자' })}
                            className="mt-2 min-h-[44px] px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg"
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
                            <h3 className="font-semibold text-base">{w.name}</h3>
                            {/* 보유 기술 */}
                            {w.skills && w.skills.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-1.5">
                                {w.skills.map((skill) => (
                                  <span
                                    key={skill}
                                    className="text-sm bg-blue-50 text-primary-600 px-2 py-0.5 rounded-full"
                                  >
                                    {skill}
                                  </span>
                                ))}
                              </div>
                            )}
                            {/* 경력 / 희망 일당 */}
                            <div className="flex items-center gap-2 mt-1.5 text-sm text-gray-600">
                              {w.experience != null && (
                                <span>경력 {w.experience}년</span>
                              )}
                              {w.experience != null && w.desiredWage && <span>·</span>}
                              {w.desiredWage && (
                                <span className="text-base text-accent-600 font-bold">
                                  희망 {formatWage(w.desiredWage)}
                                </span>
                              )}
                            </div>
                            {w.region && (
                              <p className="text-sm text-gray-500 mt-1">{w.region}</p>
                            )}
                          </div>
                        </div>
                        {/* 액션 버튼 */}
                        <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
                          {w.phone && (
                            <a
                              href={`tel:${w.phone}`}
                              className="flex-1 min-h-[44px] py-3 text-center text-base font-medium bg-primary-500 text-white rounded-lg"
                            >
                              연락하기
                            </a>
                          )}
                          <button
                            onClick={() => setRemoveTarget({ targetId: fav.targetId, label: w.name })}
                            className="flex-1 min-h-[44px] py-3 text-center text-base font-medium border border-gray-200 text-gray-600 rounded-lg"
                          >
                            즐겨찾기 해제
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ===== 구직자: 즐겨찾기 업체 (탭 0) ===== */}
          {!isEmployer && activeTab === 0 && (
            <>
              {favoriteCompanies.length === 0 ? (
                <EmptyState
                  icon="company"
                  message="즐겨찾기 업체가 없습니다"
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
                          <p className="text-base text-gray-500">탈퇴한 업체</p>
                          <button
                            onClick={() => setRemoveTarget({ targetId: fav.targetId, label: '해당 업체' })}
                            className="mt-2 min-h-[44px] px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg"
                          >
                            삭제
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div key={fav.targetId} className="card">
                        <div className="flex-1 min-w-0">
                          <h3 className="font-semibold text-base">
                            {c.companyName || c.name}
                          </h3>
                          {c.representativeName && (
                            <p className="text-sm text-gray-600 mt-0.5">
                              대표: {c.representativeName}
                            </p>
                          )}
                          {/* 주요 직종 */}
                          {c.mainJobCategories && c.mainJobCategories.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-1.5">
                              {c.mainJobCategories.map((cat) => (
                                <span
                                  key={cat}
                                  className="text-sm bg-orange-50 text-accent-600 px-2 py-0.5 rounded-full"
                                >
                                  {cat}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                        {/* 액션 버튼 */}
                        <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
                          {c.phone && (
                            <a
                              href={`tel:${c.phone}`}
                              className="flex-1 min-h-[44px] py-3 text-center text-base font-medium bg-primary-500 text-white rounded-lg"
                            >
                              연락하기
                            </a>
                          )}
                          <button
                            onClick={() => setRemoveTarget({ targetId: fav.targetId, label: c.companyName || c.name })}
                            className="flex-1 min-h-[44px] py-3 text-center text-base font-medium border border-gray-200 text-gray-600 rounded-lg"
                          >
                            즐겨찾기 해제
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* ===== 구직자: 즐겨찾기 공고 (탭 1) ===== */}
          {!isEmployer && activeTab === 1 && (
            <>
              {favoriteJobs.length === 0 ? (
                <EmptyState
                  icon="job"
                  message="즐겨찾기 공고가 없습니다"
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
                          <p className="text-base text-gray-500">삭제된 공고</p>
                          <button
                            onClick={() => setRemoveTarget({ targetId: fav.targetId, label: '해당 공고' })}
                            className="min-h-[44px] px-4 py-2 text-sm font-medium text-red-600 border border-red-200 rounded-lg"
                          >
                            삭제
                          </button>
                        </div>
                      );
                    }
                    return (
                      <div key={fav.targetId} className="card">
                        <Link href={`/jobs/${j.id}`} className="block">
                          <div className="flex items-center justify-between mb-1.5">
                            <StatusBadge status={j.status} />
                            <span className="text-sm text-gray-500">
                              {formatDate(j.createdAt)}
                            </span>
                          </div>
                          <h3 className="font-semibold text-base">{j.title}</h3>
                          <p className="text-lg font-bold text-accent-600 mt-1">
                            {formatWage(j.dailyWage)}
                          </p>
                          <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                            <span>{j.category}</span>
                            <span>·</span>
                            <span className="truncate">{j.location.address}</span>
                          </div>
                        </Link>
                        {/* 즐겨찾기 해제 */}
                        <div className="mt-3 pt-3 border-t border-gray-100">
                          <button
                            onClick={() => setRemoveTarget({ targetId: fav.targetId, label: j.title })}
                            className="w-full min-h-[44px] py-3 text-center text-base font-medium border border-gray-200 text-gray-600 rounded-lg"
                          >
                            즐겨찾기 해제
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

      {/* 즐겨찾기 해제 확인 바텀시트 (P2-5) */}
      <ConfirmSheet
        open={removeTarget !== null}
        title="즐겨찾기를 해제할까요?"
        description={
          removeTarget ? `'${removeTarget.label}'을(를) 즐겨찾기에서 해제해요.` : undefined
        }
        confirmText="해제하기"
        loading={removing}
        loadingText="해제 중..."
        error={removeError}
        onConfirm={handleRemoveConfirm}
        onCancel={() => {
          if (!removing) setRemoveTarget(null);
        }}
      />

      {/* 토스트 알림 */}
      {toastElement}
    </div>
  );
}

// ===== 빈 상태 컴포넌트 =====

function EmptyState({
  icon,
  message,
  subMessage,
  linkHref,
  linkText,
}: {
  icon: 'worker' | 'company' | 'job';
  message: string;
  subMessage: string;
  linkHref: string;
  linkText: string;
}) {
  return (
    <div className="text-center py-16">
      {/* 아이콘 */}
      {icon === 'worker' && (
        <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      )}
      {icon === 'company' && (
        <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
        </svg>
      )}
      {icon === 'job' && (
        <svg className="w-16 h-16 mx-auto text-gray-300 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
        </svg>
      )}
      <p className="text-gray-600 text-base font-medium">{message}</p>
      <p className="text-gray-500 text-sm mt-1">{subMessage}</p>
      <Link
        href={linkHref}
        className="inline-block mt-4 py-3 px-6 bg-primary-500 text-white text-base font-medium rounded-lg"
      >
        {linkText}
      </Link>
    </div>
  );
}
