'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getPublicWorkers } from '@/lib/firestore';
import { UserProfile, JobCategory } from '@/types';

/** 직종 필터 목록 */
const FILTER_CATEGORIES: (JobCategory | '전체')[] = [
  '전체', '철근', '목공', '설비', '전기', '도장', '용접', '타일', '미장', '방수', '조적', '비계', '잡역',
];

/**
 * 구직자 목록 페이지
 * - 프로필 공개한 구직자 목록
 * - 직종/지역 필터
 */
export default function WorkersPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<JobCategory | '전체'>('전체');

  useEffect(() => {
    loadWorkers();
  }, [selectedCategory]);

  const loadWorkers = async () => {
    setLoading(true);
    try {
      const data = await getPublicWorkers({
        skills: selectedCategory === '전체' ? undefined : selectedCategory,
      });
      setWorkers(data);
    } catch (error) {
      console.error('구직자 목록 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="px-4 pt-6 pb-24">
      {/* 상단 */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold">구직자 찾기</h1>
      </div>

      {/* 직종 필터 */}
      <div className="flex gap-2 overflow-x-auto pb-3 mb-4 scrollbar-hide">
        {FILTER_CATEGORIES.map((cat) => (
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

      {/* 구직자 목록 */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-6 w-6 border-2 border-primary-500 border-t-transparent" />
        </div>
      ) : workers.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">
            {selectedCategory === '전체'
              ? '공개된 구직자 프로필이 없습니다'
              : `${selectedCategory} 분야 구직자가 없습니다`}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {workers.map((worker) => (
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
                    <h3 className="font-semibold text-sm">{worker.name}</h3>
                    {worker.experience && (
                      <span className="text-xs text-gray-500">경력 {worker.experience}년</span>
                    )}
                  </div>
                  {/* 보유 기술 태그 */}
                  <div className="flex flex-wrap gap-1 mb-2">
                    {worker.skills?.map((skill) => (
                      <span
                        key={skill}
                        className="text-xs px-2 py-0.5 bg-blue-50 text-primary-600 rounded-full"
                      >
                        {skill}
                      </span>
                    ))}
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-gray-500">
                      {worker.region || '지역 미설정'}
                    </span>
                    {worker.desiredWage && (
                      <span className="text-xs font-medium text-accent-500">
                        희망 {worker.desiredWage.toLocaleString()}원
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
