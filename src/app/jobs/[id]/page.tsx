'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import {
  getJob,
  hasApplied,
  applyToJob,
  getUserProfile,
  addFavorite,
  removeFavorite,
  isFavorited,
} from '@/lib/firestore';
import { notifyUser } from '@/lib/fcm';
import { JobPost, UserProfile } from '@/types';
import KakaoMap from '@/components/ui/KakaoMap';
import BackButton from '@/components/ui/BackButton';
import ErrorState from '@/components/ui/ErrorState';
import StatusBadge from '@/components/ui/StatusBadge';
import { useToast } from '@/components/ui/Toast';
import { formatWon, formatDate } from '@/lib/format';

/**
 * 구인 공고 상세 페이지
 * - 공고 상세 정보
 * - 지원하기 버튼 (구직자만) → 확인 바텀시트 → 완료 안내
 * - 이미 지원했으면 "지원 완료" 표시
 * - 업체 정보에 구인자 전화하기 버튼 (전화번호 등록 시)
 * - 비로그인 사용자는 "로그인하고 지원하기" → 로그인 후 이 페이지로 복귀
 */
export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, userProfile, loading: authLoading } = useAuth();
  const { showToast, toastElement } = useToast();

  const [job, setJob] = useState<JobPost | null>(null);
  const [employer, setEmployer] = useState<UserProfile | null>(null);
  const [applied, setApplied] = useState(false);
  // 즐겨찾기 (P3-8) — 로그인한 구직자만
  const [favorited, setFavorited] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applyError, setApplyError] = useState('');
  const [showConfirmSheet, setShowConfirmSheet] = useState(false);
  const [showCompleteSheet, setShowCompleteSheet] = useState(false);

  const jobId = params.id as string;

  // 공고 + 업체 정보 로드
  useEffect(() => {
    loadJobDetail();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobId]);

  // 지원 여부 확인 — user/userProfile 로드가 끝난 뒤 확실히 실행되도록 분리
  useEffect(() => {
    if (!user || userProfile?.role !== 'worker') return;

    let cancelled = false;
    const checkApplied = async () => {
      try {
        const alreadyApplied = await hasApplied(jobId, user.uid);
        if (!cancelled) setApplied(alreadyApplied);
      } catch (error) {
        console.error('지원 여부 확인 실패:', error);
      }
    };
    checkApplied();

    // 즐겨찾기 여부 확인 (P3-8)
    const checkFavorited = async () => {
      try {
        const fav = await isFavorited(user.uid, jobId);
        if (!cancelled) setFavorited(fav);
      } catch (error) {
        console.error('즐겨찾기 여부 확인 실패:', error);
      }
    };
    checkFavorited();

    return () => {
      cancelled = true;
    };
  }, [jobId, user, userProfile]);

  const loadJobDetail = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const jobData = await getJob(jobId);
      if (!jobData) {
        router.replace('/jobs');
        return;
      }
      setJob(jobData);

      // 구인자 정보 로드 (실패해도 공고는 보여줌 — 비로그인 등 권한 문제 대비)
      try {
        const employerData = await getUserProfile(jobData.employerId);
        setEmployer(employerData);
      } catch (error) {
        console.error('업체 정보 로드 실패:', error);
        setEmployer(null);
      }
    } catch (error) {
      console.error('공고 로드 실패:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  /** 지원 확정 (확인 바텀시트의 [지원할게요]) */
  const handleApply = async () => {
    if (!user || !job) return;
    setApplying(true);
    setApplyError('');
    try {
      await applyToJob(jobId, user.uid, job.employerId);
      setApplied(true);
      setShowConfirmSheet(false);
      setShowCompleteSheet(true);

      // 구인자에게 새 지원자 푸시 알림 (P3-1) — fire-and-forget, 실패해도 지원 흐름에 영향 없음
      try {
        void notifyUser(user, {
          toUserId: job.employerId,
          title: '새 지원자가 있어요',
          body: `${job.title} 공고에 새 지원자가 왔어요. 확인해보세요`,
          url: `/my-jobs/${jobId}/applicants`,
        });
      } catch (notifyError) {
        console.warn('지원 알림 발송 실패(무시):', notifyError);
      }
    } catch (error) {
      console.error('지원 실패:', error);
      if (error instanceof Error && error.message.includes('이미 지원')) {
        // 중복 지원 — 구조적으로 막혀 있음
        setApplied(true);
        setShowConfirmSheet(false);
        alert('이미 지원한 공고예요.');
      } else {
        setApplyError('지원에 실패했어요. 인터넷 연결을 확인하고 다시 시도해주세요.');
      }
    } finally {
      setApplying(false);
    }
  };

  /** 즐겨찾기 하트 토글 (P3-8) */
  const handleToggleFavorite = async () => {
    if (!user || favBusy) return;
    setFavBusy(true);
    try {
      if (favorited) {
        await removeFavorite(user.uid, jobId);
        setFavorited(false);
        showToast('즐겨찾기에서 뺐어요');
      } else {
        await addFavorite(user.uid, jobId, 'job');
        setFavorited(true);
        showToast('즐겨찾기에 담았어요');
      }
    } catch (error) {
      console.error('즐겨찾기 처리 실패:', error);
      showToast('잠시 후 다시 시도해주세요', 'error');
    } finally {
      setFavBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  // 로드 실패 — 쉬운 안내 + 다시 시도 (P2-3 공용 ErrorState)
  if (loadError) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        <ErrorState title="공고를 불러오지 못했어요" onRetry={loadJobDetail} />
        <Link href="/jobs" className="mt-2 py-2 text-base text-primary-600 underline">
          공고 목록으로 가기
        </Link>
      </div>
    );
  }

  if (!job) return null;

  return (
    <div className="pb-24 min-h-screen">
      {/* 상단 바 */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-2 flex items-center gap-2 z-10">
        <BackButton className="-ml-2" />
        <h1 className="text-lg font-bold truncate flex-1">공고 상세</h1>
        {/* 즐겨찾기 하트 (P3-8) — 로그인한 구직자만, 터치 44px */}
        {user && userProfile?.role === 'worker' && (
          <button
            onClick={handleToggleFavorite}
            disabled={favBusy}
            aria-label={favorited ? '즐겨찾기 빼기' : '즐겨찾기 담기'}
            aria-pressed={favorited}
            className="w-11 h-11 -mr-2 flex items-center justify-center flex-shrink-0 disabled:opacity-50"
          >
            {favorited ? (
              <svg className="w-7 h-7 text-red-500" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
              </svg>
            ) : (
              <svg className="w-7 h-7 text-gray-400" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round"
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z" />
              </svg>
            )}
          </button>
        )}
      </div>

      <div className="px-4 pt-4">
        {/* 상태 뱃지 (P2-13 공용 StatusBadge) */}
        <StatusBadge status={job.status} size="md" className="mb-3" />

        {/* 제목 */}
        <h2 className="text-xl font-bold text-gray-900 mb-2">{job.title}</h2>

        {/* 카테고리 */}
        <span className="inline-block text-sm px-2.5 py-1 bg-blue-50 text-primary-600 rounded-full mb-4">
          {job.category}
        </span>

        {/* 핵심 정보 카드 */}
        <div className="card mb-4 space-y-3">
          <InfoRow label="일당" value={formatWon(job.dailyWage)} accent />
          <InfoRow label="모집 인원" value={`${job.numberOfWorkers}명`} />
          <InfoRow label="근무 위치" value={job.location.address} />
          <InfoRow
            label="근무 기간"
            value={`${formatDate(job.startDate)}${job.endDate ? ` ~ ${formatDate(job.endDate)}` : ' ~'}`}
          />
          <InfoRow label="근무 시간" value={job.workHours} />
        </div>

        {/* 현장 위치 지도 */}
        {job.location.address && (
          <div className="card mb-4">
            <h3 className="font-semibold text-base text-gray-700 mb-2">현장 위치</h3>
            <KakaoMap
              mode="view"
              address={job.location.address}
              lat={job.location.lat}
              lng={job.location.lng}
              height="200px"
            />
          </div>
        )}

        {/* 상세 설명 */}
        {job.description && (
          <div className="card mb-4">
            <h3 className="font-semibold text-base text-gray-700 mb-2">상세 설명</h3>
            <p className="text-base text-gray-700 whitespace-pre-wrap leading-relaxed">
              {job.description}
            </p>
          </div>
        )}

        {/* 업체 정보 */}
        {employer && (
          <div className="card mb-4">
            <h3 className="font-semibold text-base text-gray-700 mb-2">업체 정보</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-base">{employer.companyName || employer.name}</p>
                {employer.representativeName && (
                  <p className="text-sm text-gray-600">대표 {employer.representativeName}</p>
                )}
              </div>
            </div>

            {/* 구인자 전화하기 — 전화번호 등록된 경우에만 표시 */}
            {employer.phone && (
              <div className="mt-3 pt-3 border-t border-gray-100">
                <a
                  href={`tel:${employer.phone}`}
                  className="flex items-center justify-center gap-2 w-full py-3 bg-primary-500 text-white text-base font-medium rounded-lg"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 7V5z" />
                  </svg>
                  전화하기
                </a>
              </div>
            )}
          </div>
        )}

        {/* 등록일 */}
        <p className="text-sm text-gray-500 text-center mb-4">
          등록일: {formatDate(job.createdAt, { withYear: true })}
        </p>
      </div>

      {/* 하단 버튼 — 비로그인: 로그인 유도 / 구직자: 지원하기 */}
      {!authLoading && !user && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-4 bg-gradient-to-t from-white via-white pt-4">
          <div className="max-w-lg mx-auto">
            <Link
              href={`/login?returnUrl=${encodeURIComponent(`/jobs/${jobId}`)}`}
              className="block w-full py-3.5 btn-primary rounded-xl font-semibold text-center"
            >
              로그인하고 지원하기
            </Link>
          </div>
        </div>
      )}
      {userProfile?.role === 'worker' && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-4 bg-gradient-to-t from-white via-white pt-4">
          <div className="max-w-lg mx-auto">
            {job.status !== 'open' ? (
              <>
                <Link
                  href={`/jobs?category=${encodeURIComponent(job.category)}`}
                  className="block text-center text-base text-primary-600 underline py-2 mb-1"
                >
                  비슷한 공고 보러가기
                </Link>
                <button
                  disabled
                  className="w-full py-3.5 bg-gray-100 text-gray-500 font-semibold rounded-xl"
                >
                  마감된 공고예요
                </button>
              </>
            ) : applied ? (
              <button
                disabled
                className="w-full py-3.5 bg-gray-100 text-gray-500 font-semibold rounded-xl"
              >
                지원 완료
              </button>
            ) : (
              <button
                onClick={() => {
                  setApplyError('');
                  setShowConfirmSheet(true);
                }}
                disabled={applying}
                className="w-full py-3.5 btn-primary rounded-xl font-semibold disabled:opacity-50"
              >
                지원하기
              </button>
            )}
          </div>
        </div>
      )}

      {/* 지원 확인 바텀시트 */}
      {showConfirmSheet && job && (
        <>
          {/* 배경 오버레이 */}
          <div
            className="fixed inset-0 bg-black/40 z-[60]"
            onClick={() => {
              if (!applying) setShowConfirmSheet(false);
            }}
          />

          {/* 바텀시트 */}
          <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
            <div className="max-w-lg mx-auto px-4 pt-4 pb-8">
              {/* 핸들 바 */}
              <div className="flex justify-center mb-3">
                <div className="w-10 h-1 bg-gray-300 rounded-full" />
              </div>

              <h3 className="text-lg font-bold text-center mb-4">이 공고에 지원할까요?</h3>

              {/* 공고 요약 */}
              <div className="bg-gray-50 rounded-xl p-4 mb-5 space-y-2">
                <p className="text-base font-bold text-gray-900">{job.title}</p>
                <p className="text-base font-bold text-accent-500">
                  일당 {job.dailyWage.toLocaleString()}원
                </p>
                <p className="text-sm text-gray-600">
                  시작일: {formatDate(job.startDate)}
                </p>
              </div>

              {/* 지원 실패 안내 */}
              {applyError && (
                <p className="text-sm text-red-500 text-center mb-3">{applyError}</p>
              )}

              {/* 확정 / 취소 버튼 */}
              <button
                onClick={handleApply}
                disabled={applying}
                className="w-full py-4 btn-primary rounded-xl text-lg font-bold disabled:opacity-50 mb-3"
              >
                {applying ? '지원 중...' : '지원할게요'}
              </button>
              <button
                onClick={() => setShowConfirmSheet(false)}
                disabled={applying}
                className="w-full py-4 bg-gray-100 text-gray-600 rounded-xl text-lg font-semibold disabled:opacity-50"
              >
                취소
              </button>
            </div>
          </div>
        </>
      )}

      {/* 지원 완료 안내 바텀시트 */}
      {showCompleteSheet && (
        <>
          <div
            className="fixed inset-0 bg-black/40 z-[60]"
            onClick={() => setShowCompleteSheet(false)}
          />
          <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-2xl animate-slide-up">
            <div className="max-w-lg mx-auto px-4 pt-6 pb-8 text-center">
              {/* 체크 아이콘 */}
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-4">
                <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>

              <h3 className="text-xl font-bold text-gray-900 mb-2">지원 접수!</h3>
              <p className="text-base text-gray-600 mb-6">
                사장님이 수락하면 알려드릴게요
              </p>

              <Link
                href="/my-applications"
                className="block w-full py-4 btn-primary rounded-xl text-lg font-bold mb-3"
              >
                내 지원 내역 보기
              </Link>
              <button
                onClick={() => setShowCompleteSheet(false)}
                className="w-full py-4 bg-gray-100 text-gray-600 rounded-xl text-lg font-semibold"
              >
                닫기
              </button>
            </div>
          </div>
        </>
      )}

      {/* 토스트 알림 */}
      {toastElement}

      {/* 바텀시트 슬라이드업 애니메이션 */}
      <style jsx global>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}

/** 정보 행 컴포넌트 */
function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-base text-gray-600 flex-shrink-0">{label}</span>
      <span
        className={`text-right ${
          accent ? 'text-xl text-accent-500 font-bold' : 'text-base font-medium text-gray-900'
        }`}
      >
        {value}
      </span>
    </div>
  );
}
