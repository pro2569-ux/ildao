'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getJob, hasApplied, applyToJob, getUserProfile } from '@/lib/firestore';
import { JobPost, UserProfile } from '@/types';
import KakaoMap from '@/components/ui/KakaoMap';

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
  const [applying, setApplying] = useState(false);

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
  }, [jobId, user, userProfile]);

  const loadJobDetail = async () => {
    setLoading(true);
    try {
      const jobData = await getJob(jobId);
      if (!jobData) {
        router.replace('/jobs');
        return;
      }
      setJob(jobData);

      // 구인자 정보 로드
      const employerData = await getUserProfile(jobData.employerId);
      setEmployer(employerData);
    } catch (error) {
      console.error('공고 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  /** 지원하기 */
  const handleApply = async () => {
    if (!user || !job) return;
    setApplying(true);
    try {
      await applyToJob(jobId, user.uid, job.employerId);
      setApplied(true);
    } catch (error) {
      console.error('지원 실패:', error);
      alert('지원에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setApplying(false);
    }
  };

  /** 날짜 포맷 */
  const formatDate = (date: Date) => {
    const d = new Date(date);
    return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!job) return null;

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
      </div>

      <div className="px-4 pt-4">
        {/* 상태 뱃지 */}
        <span className={`inline-block text-xs font-medium px-2.5 py-1 rounded-full mb-3 ${
          job.status === 'open'
            ? 'bg-green-100 text-green-600'
            : 'bg-gray-100 text-gray-500'
        }`}>
          {job.status === 'open' ? '모집중' : job.status === 'closed' ? '마감' : '진행중'}
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
            value={`${formatDate(job.startDate)}${job.endDate ? ` ~ ${formatDate(job.endDate)}` : ' ~'}`}
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
              <div>
                <p className="font-semibold text-sm">{employer.companyName || employer.name}</p>
                {employer.representativeName && (
                  <p className="text-xs text-gray-500">대표 {employer.representativeName}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 등록일 */}
        <p className="text-xs text-gray-400 text-center mb-4">
          등록일: {formatDate(job.createdAt)}
        </p>
      </div>

      {/* 하단 지원 버튼 (구직자만) */}
      {userProfile?.role === 'worker' && job.status === 'open' && (
        <div className="fixed bottom-16 left-0 right-0 px-4 pb-4 bg-gradient-to-t from-white via-white pt-4">
          <div className="max-w-lg mx-auto">
            {applied ? (
              <button
                disabled
                className="w-full py-3.5 bg-gray-100 text-gray-500 font-semibold rounded-xl"
              >
                지원 완료
              </button>
            ) : (
              <button
                onClick={handleApply}
                disabled={applying}
                className="w-full py-3.5 btn-primary rounded-xl font-semibold disabled:opacity-50"
              >
                {applying ? '지원 중...' : '지원하기'}
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
