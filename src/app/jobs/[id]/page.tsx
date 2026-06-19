'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { getJob, hasApplied, applyToJob, getUserProfile, isFavorited, addFavorite, removeFavorite } from '@/lib/firestore';
import { formatDateFull } from '@/lib/format';
import { JobPost, UserProfile } from '@/types';
import { jobStatusBadge } from '@/lib/constants';
import KakaoMap from '@/components/ui/KakaoMap';
import { PageLoader } from '@/components/ui/Spinner';

/**
 * 구인 공고 상세 페이지
 * - 공고 상세 정보
 * - 지원하기 버튼 (구직자만)
 * - 이미 지원했으면 "지원 완료" 표시
 */
export default function JobDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user, userProfile } = useAuth();

  const [job, setJob] = useState<JobPost | null>(null);
  const [employer, setEmployer] = useState<UserProfile | null>(null);
  const [applied, setApplied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [applying, setApplying] = useState(false);
  const [favorited, setFavorited] = useState(false);
  const [favBusy, setFavBusy] = useState(false);
  const [companyFav, setCompanyFav] = useState(false);
  const [companyFavBusy, setCompanyFavBusy] = useState(false);
  const [applyMessage, setApplyMessage] = useState('');

  const jobId = params.id as string;

  useEffect(() => {
    loadJobDetail();
  }, [jobId]);

  // 지원 여부 확인은 별도 effect로 분리 — 새로고침 직후에는 userProfile이
  // 비동기로 늦게 도착하므로, 공고 로드 effect에 묶으면 검사가 건너뛰어진다
  useEffect(() => {
    if (!user || userProfile?.role !== 'worker') return;
    hasApplied(jobId, user.uid)
      .then(setApplied)
      .catch((error) => console.error('지원 여부 확인 실패:', error));
    // 공고 즐겨찾기 상태 로드 (#24)
    isFavorited(user.uid, jobId)
      .then(setFavorited)
      .catch((error) => console.error('즐겨찾기 상태 확인 실패:', error));
  }, [jobId, user, userProfile]);

  // 업체(관심 업체) 즐겨찾기 상태 — 공고 로드 후 employerId 기준 (#24)
  useEffect(() => {
    if (!user || userProfile?.role !== 'worker' || !job) return;
    isFavorited(user.uid, job.employerId)
      .then(setCompanyFav)
      .catch((error) => console.error('업체 즐겨찾기 상태 확인 실패:', error));
  }, [job, user, userProfile]);

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

      // 구인자 정보 로드 (실패해도 공고 자체는 표시되도록 분리 처리)
      const employerData = await getUserProfile(jobData.employerId).catch(() => null);
      setEmployer(employerData);
    } catch (error) {
      console.error('공고 로드 실패:', error);
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  /** 지원하기 */
  const handleApply = async () => {
    if (!user || !job) return;
    setApplying(true);
    try {
      // stale 화면 방어(#20): 페이지를 열어둔 사이 마감/삭제됐을 수 있으므로 지원 직전 최신 상태 재확인
      // (서버 규칙도 open 공고만 허용하지만, 사용자에게 명확한 안내를 위해 클라이언트에서도 확인)
      const fresh = await getJob(jobId);
      if (!fresh) {
        alert('삭제된 공고입니다.');
        router.replace('/jobs');
        return;
      }
      if (fresh.status !== 'open') {
        setJob(fresh);
        alert('이미 마감된 공고입니다.');
        return;
      }
      // 지원자 스냅샷을 함께 저장 — 구인자가 비공개 프로필도 확인 가능 (연락처는 수락 후 노출)
      await applyToJob(jobId, user.uid, job.employerId, {
        name: userProfile?.name ?? '',
        phone: userProfile?.phone ?? '',
        skills: userProfile?.skills,
        experience: userProfile?.experience,
        desiredWage: userProfile?.desiredWage,
        message: applyMessage,
      });
      setApplied(true);
    } catch (error) {
      console.error('지원 실패:', error);
      alert('지원에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setApplying(false);
    }
  };

  /** 즐겨찾기 토글 (#24 — 구직자만) */
  const toggleFavorite = async () => {
    if (!user) return;
    setFavBusy(true);
    try {
      if (favorited) {
        await removeFavorite(user.uid, jobId);
        setFavorited(false);
      } else {
        await addFavorite(user.uid, jobId, 'job');
        setFavorited(true);
      }
    } catch (error) {
      console.error('즐겨찾기 처리 실패:', error);
      alert('즐겨찾기 처리에 실패했습니다.');
    } finally {
      setFavBusy(false);
    }
  };

  /** 관심 업체 토글 (#24 — 구직자만) */
  const toggleCompanyFavorite = async () => {
    if (!user || !job) return;
    setCompanyFavBusy(true);
    try {
      if (companyFav) {
        await removeFavorite(user.uid, job.employerId);
        setCompanyFav(false);
      } else {
        await addFavorite(user.uid, job.employerId, 'user');
        setCompanyFav(true);
      }
    } catch (error) {
      console.error('업체 즐겨찾기 처리 실패:', error);
      alert('즐겨찾기 처리에 실패했습니다.');
    } finally {
      setCompanyFavBusy(false);
    }
  };

  if (loading) {
    return (
      <PageLoader />
    );
  }

  // 로드 실패 → 빈 화면 대신 안내 + 재시도/뒤로 (#37)
  if (loadError || !job) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6 text-center">
        <p className="text-sm text-gray-600 mb-4">공고 정보를 불러오지 못했습니다.</p>
        <div className="flex gap-2">
          <button
            onClick={() => loadJobDetail()}
            className="py-2.5 px-6 btn-primary rounded-xl text-sm font-semibold"
          >
            다시 시도
          </button>
          <button
            onClick={() => router.replace('/jobs')}
            className="py-2.5 px-6 bg-gray-100 text-gray-600 rounded-xl text-sm font-semibold"
          >
            목록으로
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="pb-24 min-h-screen">
      {/* 상단 바 */}
      <div className="sticky top-0 bg-white border-b border-gray-100 px-4 py-3 flex items-center gap-3 z-10">
        <button onClick={() => router.back()} className="p-1">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-lg font-bold truncate flex-1">공고 상세</h1>
        {userProfile?.role === 'worker' && (
          <button
            onClick={toggleFavorite}
            disabled={favBusy}
            aria-label={favorited ? '즐겨찾기 해제' : '즐겨찾기 추가'}
            className="p-1 disabled:opacity-50"
          >
            <svg
              className={`w-6 h-6 ${favorited ? 'text-accent-500' : 'text-gray-300'}`}
              fill={favorited ? 'currentColor' : 'none'}
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
            </svg>
          </button>
        )}
      </div>

      <div className="px-4 pt-4">
        {/* 상태 뱃지 */}
        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-3 ${jobStatusBadge(job.status).className}`}>
          {jobStatusBadge(job.status).text}
        </span>

        {/* 제목 */}
        <h2 className="text-xl font-bold text-gray-900 mb-2">{job.title}</h2>

        {/* 카테고리 */}
        <span className="inline-block text-xs px-2 py-0.5 bg-blue-50 text-primary-600 rounded-full mb-4">
          {job.category}
        </span>

        {/* 핵심 정보 카드 */}
        <div className="card mb-4 space-y-3">
          <InfoRow label="일당" value={`${job.dailyWage.toLocaleString()}원`} accent />
          <InfoRow label="모집 인원" value={`${job.numberOfWorkers}명`} />
          <InfoRow label="근무 위치" value={job.location.address} />
          <InfoRow
            label="근무 기간"
            value={`${formatDateFull(job.startDate)}${job.endDate ? ` ~ ${formatDateFull(job.endDate)}` : ' ~'}`}
          />
          <InfoRow label="근무 시간" value={job.workHours} />
        </div>

        {/* 현장 위치 지도 */}
        {job.location.address && (
          <div className="card mb-4">
            <h3 className="font-semibold text-sm text-gray-700 mb-2">현장 위치</h3>
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
            <h3 className="font-semibold text-sm text-gray-700 mb-2">상세 설명</h3>
            <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">
              {job.description}
            </p>
          </div>
        )}

        {/* 업체 정보 */}
        {employer && (
          <div className="card mb-4">
            <h3 className="font-semibold text-sm text-gray-700 mb-2">업체 정보</h3>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center">
                <svg className="w-5 h-5 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div className="flex-1">
                <p className="font-semibold text-sm">{employer.companyName || employer.name}</p>
                {employer.representativeName && (
                  <p className="text-xs text-gray-500">대표 {employer.representativeName}</p>
                )}
              </div>
              {userProfile?.role === 'worker' && (
                <button
                  onClick={toggleCompanyFavorite}
                  disabled={companyFavBusy}
                  className={`text-xs font-medium px-3 py-1.5 rounded-full border disabled:opacity-50 ${
                    companyFav
                      ? 'bg-accent-50 text-accent-500 border-accent-200'
                      : 'bg-white text-gray-500 border-gray-200'
                  }`}
                >
                  {companyFav ? '관심 업체 ✓' : '관심 업체'}
                </button>
              )}
            </div>
          </div>
        )}

        {/* 등록일 */}
        <p className="text-xs text-gray-400 text-center mb-4">
          등록일: {formatDateFull(job.createdAt)}
        </p>
      </div>

      {/* 하단 지원 영역 (모집중 공고). 비로그인·구인자도 막다른 화면이 되지 않도록 분기 (JOBS-01) */}
      {job.status === 'open' && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-4 bg-gradient-to-t from-white via-white pt-4">
          <div className="max-w-lg mx-auto">
            {userProfile?.role === 'worker' ? (
              applied ? (
                <button
                  disabled
                  className="w-full py-3.5 bg-gray-100 text-gray-500 font-semibold rounded-xl"
                >
                  지원 완료
                </button>
              ) : (
                <>
                  <textarea
                    value={applyMessage}
                    onChange={(e) => setApplyMessage(e.target.value)}
                    maxLength={200}
                    rows={2}
                    placeholder="간단한 자기소개나 메시지를 남겨보세요 (선택)"
                    className="w-full mb-2 py-2 px-3 border border-gray-300 rounded-xl text-sm resize-none bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                  <button
                    onClick={handleApply}
                    disabled={applying}
                    className="w-full py-3.5 btn-primary rounded-xl font-semibold disabled:opacity-50"
                  >
                    {applying ? '지원 중...' : '지원하기'}
                  </button>
                </>
              )
            ) : !user ? (
              // 비로그인 — 로그인 후 이 공고로 복귀해 지원
              <Link
                href={`/login?next=/jobs/${job.id}`}
                className="block w-full py-3.5 btn-primary rounded-xl font-semibold text-center"
              >
                로그인하고 지원하기
              </Link>
            ) : (
              // 구인자 등 지원 불가 계정
              <button
                disabled
                className="w-full py-3.5 bg-gray-100 text-gray-500 font-semibold rounded-xl"
              >
                구직자만 지원할 수 있습니다
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

/** 정보 행 컴포넌트 */
function InfoRow({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className={`text-sm font-medium ${accent ? 'text-accent-500 font-bold' : 'text-gray-900'}`}>
        {value}
      </span>
    </div>
  );
}
