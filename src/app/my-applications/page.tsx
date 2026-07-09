'use client';

import { useState, useEffect, useRef, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  subscribeToApplicationsByWorker,
  cancelApplication,
  getJob,
  getUserProfile,
} from '@/lib/firestore';
import { Application, ApplicationStatus, JobPost } from '@/types';
import ErrorState from '@/components/ui/ErrorState';
import StatusBadge from '@/components/ui/StatusBadge';
import BackButton from '@/components/ui/BackButton';
import { formatWon, formatDate as formatStartDate, isToday, isTomorrow } from '@/lib/format';

/** 필터 값 (전체 + 지원 상태) */
type FilterValue = 'all' | ApplicationStatus;

/** 화면 표시용 지원 내역 (공고 정보 + 구인자 전화번호 포함) */
type ApplicationItem = Application & {
  job?: JobPost;
  employerPhone?: string;
};

/**
 * 내 지원 내역 페이지
 * - 지원한 공고 목록 + 상태 (실시간 구독)
 * - URL 쿼리 ?filter=pending|accepted|rejected 로 초기 필터 선택
 * - 대기중 지원 취소 / 수락된 지원 전화하기
 */
function MyApplicationsContent() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();

  // URL 쿼리(?filter=pending)로 초기 상태 필터 설정
  const searchParams = useSearchParams();
  const filterParam = searchParams.get('filter');
  const initialFilter: FilterValue =
    filterParam === 'pending' || filterParam === 'accepted' || filterParam === 'rejected'
      ? filterParam
      : 'all';

  const [applications, setApplications] = useState<ApplicationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [retryKey, setRetryKey] = useState(0); // 재시도 시 구독 재시작용
  const [filter, setFilter] = useState<FilterValue>(initialFilter);

  // 지원 취소 확인 바텀시트 상태
  const [cancelTarget, setCancelTarget] = useState<ApplicationItem | null>(null);
  const [cancelling, setCancelling] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);

  // 공고/구인자 전화번호 캐시 (스냅샷마다 다시 조회하지 않도록)
  const jobCache = useRef<Map<string, JobPost | null>>(new Map());
  const phoneCache = useRef<Map<string, string | null>>(new Map());
  // 스냅샷 순서 보장용 시퀀스 (이전 스냅샷의 늦은 응답이 최신 상태를 덮지 않도록)
  const enrichSeq = useRef(0);

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      const returnUrl = filterParam
        ? `/my-applications?filter=${filterParam}`
        : '/my-applications';
      router.replace(`/login?returnUrl=${encodeURIComponent(returnUrl)}`);
      return;
    }

    // 지원 내역 실시간 구독 — 스냅샷마다 공고/전화번호 정보를 붙여서 반영
    // 구독 실패 시 빈 목록으로 위장하지 않고 에러 화면 표시 (P2-3)
    const unsubscribe = subscribeToApplicationsByWorker(
      user.uid,
      (apps) => {
        void enrichApplications(apps);
      },
      () => {
        setLoadError(true);
        setLoading(false);
      }
    );
    return () => unsubscribe();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, authLoading, retryKey]);

  /** 에러 화면에서 다시 시도 — 구독 재시작 */
  const handleRetry = () => {
    setLoadError(false);
    setLoading(true);
    setRetryKey((k) => k + 1);
  };

  /** 지원 내역에 공고 정보 + (수락 건) 구인자 전화번호를 병렬로 붙임 */
  const enrichApplications = async (apps: Application[]) => {
    const seq = ++enrichSeq.current;
    try {
      // 아직 캐시에 없는 공고만 병렬 조회
      const jobIds = Array.from(new Set(apps.map((a) => a.jobId))).filter(
        (id) => !jobCache.current.has(id)
      );
      // 수락된 지원의 구인자 전화번호만 병렬 조회 (N+1 최소화)
      const employerIds = Array.from(
        new Set(apps.filter((a) => a.status === 'accepted').map((a) => a.employerId))
      ).filter((id) => !phoneCache.current.has(id));

      await Promise.all([
        ...jobIds.map(async (id) => {
          const job = await getJob(id).catch(() => null);
          jobCache.current.set(id, job);
        }),
        ...employerIds.map(async (id) => {
          const profile = await getUserProfile(id).catch(() => null);
          phoneCache.current.set(id, profile?.phone || null);
        }),
      ]);
    } catch (error) {
      console.error('지원 내역 정보 로드 실패:', error);
    }

    // 더 최신 스냅샷 처리가 시작됐으면 이 결과는 버림
    if (seq !== enrichSeq.current) return;

    setApplications(
      apps.map((app) => ({
        ...app,
        job: jobCache.current.get(app.jobId) || undefined,
        employerPhone:
          app.status === 'accepted'
            ? phoneCache.current.get(app.employerId) || undefined
            : undefined,
      }))
    );
    setLoading(false);
  };

  /** 지원 취소 확정 */
  const handleCancelConfirm = async () => {
    if (!cancelTarget || cancelling) return;
    setCancelling(true);
    setCancelError(null);
    try {
      await cancelApplication(cancelTarget.id);
      // 실시간 구독이 목록을 자동 갱신 — 시트만 닫음
      setCancelTarget(null);
    } catch (error) {
      console.error('지원 취소 실패:', error);
      // cancelApplication이 던지는 안내 문구만 그대로 노출, 그 외(FirebaseError 등)는 일반 문구
      const message =
        error instanceof Error && !('code' in error)
          ? error.message
          : '지원 취소에 실패했어요. 잠시 후 다시 해보세요.';
      setCancelError(message);
    } finally {
      setCancelling(false);
    }
  };

  /** 필터링된 목록 */
  const filteredApps =
    filter === 'all' ? applications : applications.filter((a) => a.status === filter);

  /** 날짜 포맷 (지원일) */
  const formatDate = (date: Date) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  /** 상단 헤더 */
  const header = (
    <div className="flex items-center gap-2 mb-4">
      <BackButton className="-ml-2" />
      <h1 className="text-xl font-bold">지원 내역</h1>
    </div>
  );

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  // 구독 실패 — 재시도 화면 (P2-3)
  if (loadError) {
    return (
      <div className="px-4 pt-6 pb-24">
        {header}
        <ErrorState title="지원 내역을 불러오지 못했어요" onRetry={handleRetry} />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-24">
      {header}

      {/* 상태 필터 */}
      <div className="flex gap-2 mb-4">
        {[
          { value: 'all', label: '전체' },
          { value: 'pending', label: '대기중' },
          { value: 'accepted', label: '수락됨' },
          { value: 'rejected', label: '거절됨' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value as FilterValue)}
            className={`min-h-[44px] py-2 px-3.5 rounded-full text-base font-medium transition-colors ${
              filter === f.value
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 지원 내역 목록 */}
      {filteredApps.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-500 text-base">
            {filter === 'all' ? '아직 지원한 공고가 없습니다' : `${filter === 'pending' ? '대기중인' : filter === 'accepted' ? '수락된' : '거절된'} 지원이 없습니다`}
          </p>
          {filter === 'all' && (
            <Link
              href="/jobs"
              className="inline-block mt-3 py-3 px-5 bg-primary-500 text-white text-base font-medium rounded-lg"
            >
              구인공고 보러가기
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApps.map((app) => {
            return (
              <div key={app.id} className="card">
                <Link href={`/jobs/${app.jobId}`} className="block">
                  <div className="flex items-center justify-between mb-2">
                    <StatusBadge status={app.status} />
                    <span className="text-sm text-gray-500">
                      지원일 {formatDate(app.createdAt)}
                    </span>
                  </div>
                  {app.job ? (
                    <>
                      <h3 className="font-semibold text-base">{app.job.title}</h3>
                      <p className="text-lg font-bold text-accent-600 mt-1">
                        {formatWon(app.job.dailyWage)}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-sm text-gray-600">
                        <span>{app.job.category}</span>
                        <span>·</span>
                        <span>{app.job.location.address}</span>
                      </div>
                      {/* 근무 시작일 — 오늘/내일 시작이면 강조 (P2-17) */}
                      <p className="mt-1 text-sm">
                        {isToday(app.job.startDate) ? (
                          <span className="font-bold text-accent-600">오늘 시작</span>
                        ) : isTomorrow(app.job.startDate) ? (
                          <span className="font-bold text-accent-600">내일 시작</span>
                        ) : (
                          <span className="text-gray-600">
                            {formatStartDate(app.job.startDate)} 시작
                          </span>
                        )}
                      </p>
                    </>
                  ) : (
                    <p className="text-base text-gray-500">삭제된 공고</p>
                  )}
                </Link>

                {/* 액션 버튼 — 수락됨: 전화하기 / 대기중: 지원 취소 */}
                {(app.status === 'pending' ||
                  (app.status === 'accepted' && app.employerPhone)) && (
                  <div className="flex gap-3 mt-3 pt-3 border-t border-gray-100">
                    {app.status === 'accepted' && app.employerPhone && (
                      <a
                        href={`tel:${app.employerPhone}`}
                        className="flex-1 min-h-[44px] py-3 text-center text-base font-semibold bg-primary-500 text-white rounded-lg"
                      >
                        📞 전화하기
                      </a>
                    )}
                    {app.status === 'pending' && (
                      <button
                        onClick={() => {
                          setCancelError(null);
                          setCancelTarget(app);
                        }}
                        className="flex-1 min-h-[44px] py-3 text-center text-base font-medium border border-gray-200 text-gray-600 rounded-lg"
                      >
                        지원 취소
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* 지원 취소 확인 바텀시트 */}
      {cancelTarget && (
        <>
          {/* 배경 오버레이 — 하단 네비게이션(z-50)보다 위에 표시 */}
          <div
            className="fixed inset-0 bg-black/40 z-[55]"
            onClick={() => !cancelling && setCancelTarget(null)}
          />

          {/* 바텀시트 */}
          <div className="fixed bottom-0 left-0 right-0 z-[60] bg-white rounded-t-2xl animate-slide-up">
            <div className="max-w-lg mx-auto px-4 pt-4 pb-8">
              {/* 핸들 바 */}
              <div className="flex justify-center mb-3">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              <h3 className="text-lg font-bold text-center mb-2">지원을 취소할까요?</h3>
              <p className="text-base text-gray-600 text-center mb-6">
                {`'${cancelTarget.job?.title || '해당 공고'}' 지원이 취소돼요.`}
              </p>

              {/* 취소 실패 에러 메시지 */}
              {cancelError && (
                <p className="text-sm text-red-500 text-center mb-3">{cancelError}</p>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setCancelTarget(null)}
                  disabled={cancelling}
                  className="flex-1 min-h-[44px] py-3 text-base font-medium border border-gray-200 text-gray-600 rounded-lg disabled:opacity-50"
                >
                  돌아가기
                </button>
                <button
                  onClick={handleCancelConfirm}
                  disabled={cancelling}
                  className="flex-1 min-h-[44px] py-3 text-base font-semibold bg-red-500 text-white rounded-lg disabled:opacity-50"
                >
                  {cancelling ? '취소 중...' : '지원 취소'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/** useSearchParams 사용을 위한 Suspense 경계 */
export default function MyApplicationsPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
        </div>
      }
    >
      <MyApplicationsContent />
    </Suspense>
  );
}
