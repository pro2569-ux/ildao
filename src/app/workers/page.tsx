'use client';

import { useState, useEffect } from 'react';
import { getPublicWorkers } from '@/lib/firestore';
import { UserProfile, JobCategory } from '@/types';
import BackButton from '@/components/ui/BackButton';
import ErrorState from '@/components/ui/ErrorState';
import { formatWon } from '@/lib/format';
import { REGIONS } from '@/lib/constants';

/** 직종 필터 목록 */
const FILTER_CATEGORIES: (JobCategory | '전체')[] = [
  '전체', '철근', '목공', '설비', '전기', '도장', '용접', '타일', '미장', '방수', '조적', '비계', '잡역',
];

/** worker.region('서울 강남구' 등) prefix 매칭 (P2-6 — 클라이언트 필터) */
const matchesWorkerRegion = (worker: UserProfile, region: string): boolean => {
  if (region === '전국') return true;
  return worker.region?.startsWith(region) ?? false;
};

/**
 * 구직자 목록 페이지
 * - 프로필 공개한 구직자 목록
 * - 직종/지역 필터
 */
export default function WorkersPage() {
  const [workers, setWorkers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<JobCategory | '전체'>('전체');
  const [selectedRegion, setSelectedRegion] = useState<string>('전국');

  useEffect(() => {
    loadWorkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory]);

  const loadWorkers = async () => {
    setLoading(true);
    setError(false);
    try {
      const data = await getPublicWorkers({
        skills: selectedCategory === '전체' ? undefined : selectedCategory,
      });
      setWorkers(data);
    } catch (error) {
      console.error('구직자 목록 로드 실패:', error);
      setError(true); // 실패를 "구직자 없음"으로 위장하지 않음 (P2-3)
    } finally {
      setLoading(false);
    }
  };

  // 지역은 클라이언트에서 prefix 매칭 (P2-6 — Firestore 복합 인덱스 방지)
  const filteredWorkers = workers.filter((worker) =>
    matchesWorkerRegion(worker, selectedRegion)
  );

  return (
    <div className="px-4 pt-6 pb-24">
      {/* 상단 */}
      <div className="flex items-center gap-2 mb-4">
        <BackButton className="-ml-2" />
        <h1 className="text-xl font-bold">구직자 찾기</h1>
      </div>

      {/* 직종 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-2 mb-2 scrollbar-hide">
        {FILTER_CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setSelectedCategory(cat)}
            className={`flex-shrink-0 py-2.5 px-4 rounded-full text-base font-medium transition-colors ${
              selectedCategory === cat
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-gray-200 text-gray-700'
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* 지역 필터 (P2-6) */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {REGIONS.map((region) => (
          <button
            key={region}
            onClick={() => setSelectedRegion(region)}
            className={`flex-shrink-0 py-2.5 px-4 rounded-full text-base font-medium transition-colors ${
              selectedRegion === region
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-gray-200 text-gray-700'
            }`}
          >
            {region}
          </button>
        ))}
      </div>

      {/* 구직자 목록 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : error ? (
        <ErrorState onRetry={loadWorkers} />
      ) : filteredWorkers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-600 text-base">
            {selectedCategory === '전체' && selectedRegion === '전국'
              ? '공개된 구직자 프로필이 없습니다'
              : `${selectedRegion !== '전국' ? `${selectedRegion} ` : ''}${
                  selectedCategory !== '전체' ? `${selectedCategory} 분야 ` : ''
                }구직자가 없습니다`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {filteredWorkers.map((worker) => (
            <div key={worker.uid} className="card">
              <div className="flex items-start gap-3">
                {/* 프로필 이미지 */}
                <div className="w-12 h-12 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
                  {worker.profileImage ? (
                    <img
                      src={worker.profileImage}
                      alt={worker.name}
                      className="w-full h-full object-cover"
                      referrerPolicy="no-referrer"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-primary-100">
                      <svg className="w-6 h-6 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    </div>
                  )}
                </div>

                {/* 프로필 정보 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h3 className="font-semibold text-base">{worker.name}</h3>
                    {worker.experience && (
                      <span className="text-sm text-gray-600">경력 {worker.experience}년</span>
                    )}
                  </div>
                  {/* 보유 기술 태그 */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {worker.skills?.map((skill) => (
                      <span
                        key={skill}
                        className="text-sm px-2.5 py-0.5 bg-blue-50 text-primary-600 rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">
                      {worker.region || '지역 미설정'}
                    </span>
                    {worker.desiredWage && (
                      <span className="text-lg font-bold text-accent-500">
                        희망 {formatWon(worker.desiredWage)}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* 전화하기 버튼 — 전화번호 등록된 구직자만 표시 */}
              {worker.phone && (
                <div className="mt-3 pt-3 border-t border-gray-100">
                  <a
                    href={`tel:${worker.phone}`}
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
          ))}
        </div>
      )}
    </div>
  );
}
