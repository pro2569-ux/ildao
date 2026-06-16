'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getPublicWorkers, getFavorites, addFavorite, removeFavorite } from '@/lib/firestore';
import { JOB_CATEGORIES } from '@/lib/constants';
import { UserProfile, JobCategory } from '@/types';

/** 직종 필터 목록 ('전체' + 공용 직종 상수 — 기존엔 '기타'가 누락돼 '기타' 구직자가 검색 안 됨) */
const FILTER_CATEGORIES: (JobCategory | '전체')[] = ['전체', ...JOB_CATEGORIES];

/**
 * 구직자 목록 페이지
 * - 프로필 공개한 구직자 목록
 * - 직종/지역 필터
 */
export default function WorkersPage() {
  const router = useRouter();
  const { user, userProfile } = useAuth();
  const isEmployer = userProfile?.role === 'employer';

  const [workers, setWorkers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<JobCategory | '전체'>('전체');

  // 즐겨찾기 상태 (#24 — 구인자만 사용)
  const [favoritedIds, setFavoritedIds] = useState<Set<string>>(new Set());
  const [favBusy, setFavBusy] = useState<string | null>(null);

  useEffect(() => {
    // 필터 빠른 전환 시 stale 응답이 최신 결과를 덮어쓰지 않도록 무시 플래그 사용
    let cancelled = false;
    setLoading(true);
    getPublicWorkers({
      skills: selectedCategory === '전체' ? undefined : selectedCategory,
    })
      .then((data) => {
        if (!cancelled) setWorkers(data);
      })
      .catch((error) => {
        if (!cancelled) console.error('구직자 목록 로드 실패:', error);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedCategory]);

  // 구인자의 기존 즐겨찾기 근로자 목록 로드
  useEffect(() => {
    if (!user || !isEmployer) {
      setFavoritedIds(new Set());
      return;
    }
    getFavorites(user.uid, 'user')
      .then((favs) => setFavoritedIds(new Set(favs.map((f) => f.targetId))))
      .catch((error) => console.error('즐겨찾기 로드 실패:', error));
  }, [user, isEmployer]);

  /** 즐겨찾기 토글 (#24) */
  const toggleFavorite = async (workerId: string) => {
    if (!user) return;
    setFavBusy(workerId);
    try {
      if (favoritedIds.has(workerId)) {
        await removeFavorite(user.uid, workerId);
        setFavoritedIds((prev) => {
          const next = new Set(prev);
          next.delete(workerId);
          return next;
        });
      } else {
        await addFavorite(user.uid, workerId, 'user');
        setFavoritedIds((prev) => new Set(prev).add(workerId));
      }
    } catch (error) {
      console.error('즐겨찾기 처리 실패:', error);
      alert('즐겨찾기 처리에 실패했습니다.');
    } finally {
      setFavBusy(null);
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

                {/* 즐겨찾기 토글 (구인자만) */}
                {isEmployer && (
                  <button
                    onClick={() => toggleFavorite(worker.uid)}
                    disabled={favBusy === worker.uid}
                    aria-label={favoritedIds.has(worker.uid) ? '즐겨찾기 해제' : '즐겨찾기 추가'}
                    className="p-1 flex-shrink-0 disabled:opacity-50"
                  >
                    <svg
                      className={`w-5 h-5 ${favoritedIds.has(worker.uid) ? 'text-accent-500' : 'text-gray-300'}`}
                      fill={favoritedIds.has(worker.uid) ? 'currentColor' : 'none'}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.196-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.783-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
                    </svg>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
