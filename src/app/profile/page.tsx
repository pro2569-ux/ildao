'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useAuth } from '@/contexts/AuthContext';
import { toggleProfilePublic } from '@/lib/firestore';
import { PageLoader } from '@/components/ui/Spinner';

/**
 * 내 정보 (프로필) 페이지
 * - 프로필 정보 표시
 * - 로그아웃 기능
 * - 비로그인 시 로그인 페이지로 리다이렉트
 */
export default function ProfilePage() {
  const { user, userProfile, loading, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [imgError, setImgError] = useState(false);
  const [togglingPublic, setTogglingPublic] = useState(false);

  // 비로그인 시 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  /** 로그아웃 핸들러 */
  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  /** 프로필 공개 토글 */
  const handleTogglePublic = async () => {
    if (!user || !userProfile || togglingPublic) return;
    setTogglingPublic(true);
    try {
      const newValue = !userProfile.isPublic;
      await toggleProfilePublic(user.uid, newValue);
      await refreshProfile();
    } catch (error) {
      console.error('프로필 공개 설정 실패:', error);
      alert('공개 설정 변경에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setTogglingPublic(false);
    }
  };

  // 로딩 중
  if (loading) {
    return (
      <PageLoader />
    );
  }

  if (!user) return null;

  // 편집 화면에서 저장한 profileImage(임의 URL) 우선, 없으면 소셜 로그인 photoURL (#UI-02)
  const profileImageSrc = userProfile?.profileImage || user.photoURL;

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="text-xl font-bold mb-6">내 정보</h1>

      {/* 프로필 카드 */}
      <div className="card mb-4">
        <div className="flex items-center gap-4">
          {/* 프로필 이미지 */}
          <div className="relative w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            {profileImageSrc && !imgError ? (
              <Image
                src={profileImageSrc}
                alt="프로필"
                fill
                sizes="64px"
                unoptimized
                className="object-cover"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary-100">
                <svg className="w-8 h-8 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <h2 className="font-bold text-lg truncate">
              {userProfile?.name || user.displayName || '사용자'}
            </h2>
            <p className="text-sm text-gray-500 truncate">{user.email}</p>
            {userProfile && (
              <span className={`inline-block mt-1 text-xs font-medium px-2 py-0.5 rounded-full ${
                userProfile.role === 'worker'
                  ? 'bg-blue-100 text-primary-600'
                  : 'bg-orange-100 text-accent-500'
              }`}>
                {userProfile.role === 'worker' ? '구직자' : '구인자'}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* 프로필 상세 정보 */}
      {userProfile && (
        <div className="card mb-4 space-y-3">
          <h3 className="font-semibold text-sm text-gray-400 uppercase tracking-wider">프로필 정보</h3>

          <InfoRow label="연락처" value={userProfile.phone} />

          {userProfile.role === 'worker' ? (
            <>
              <InfoRow
                label="보유 기술"
                value={userProfile.skills?.join(', ') || '-'}
              />
              <InfoRow
                label="선호 지역"
                value={userProfile.region || '-'}
              />
              <InfoRow
                label="경력"
                value={userProfile.experience ? `${userProfile.experience}년` : '-'}
              />
              <InfoRow
                label="희망 일당"
                value={userProfile.desiredWage ? `${userProfile.desiredWage.toLocaleString()}원` : '-'}
              />
              <InfoRow
                label="자기소개"
                value={userProfile.introduction || '-'}
              />
            </>
          ) : (
            <>
              <InfoRow label="업체명" value={userProfile.companyName || '-'} />
              <InfoRow label="대표자" value={userProfile.representativeName || '-'} />
              <InfoRow
                label="주요 직종"
                value={userProfile.mainJobCategories?.join(', ') || '-'}
              />
              <InfoRow
                label="업체 소개"
                value={userProfile.companyIntro || '-'}
              />
            </>
          )}
        </div>
      )}

      {/* 구직 프로필 공개 설정 (구직자만) */}
      {userProfile?.role === 'worker' && (
        <div className="card mb-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-sm text-gray-700">프로필 공개</h3>
              <p className="text-xs text-gray-500 mt-0.5">
                구인자에게 내 프로필이 노출됩니다
              </p>
            </div>
            <button
              onClick={handleTogglePublic}
              disabled={togglingPublic}
              role="switch"
              aria-checked={!!userProfile.isPublic}
              aria-label="프로필 공개"
              className={`relative w-12 h-7 rounded-full transition-colors disabled:opacity-60 ${
                userProfile.isPublic ? 'bg-primary-500' : 'bg-gray-300'
              }`}
            >
              <div className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                userProfile.isPublic ? 'translate-x-5' : 'translate-x-0.5'
              }`} />
            </button>
          </div>
        </div>
      )}

      {/* 프로필 미설정 안내 */}
      {!userProfile && (
        <div className="card mb-4 text-center py-6">
          <p className="text-gray-500 text-sm mb-3">프로필이 설정되지 않았습니다.</p>
          <button
            onClick={() => router.push('/register')}
            className="btn-primary text-sm py-2 px-4"
          >
            프로필 설정하기
          </button>
        </div>
      )}

      {/* 메뉴 */}
      <div className="card mb-4 divide-y divide-gray-100">
        <MenuItem label="프로필 수정" onClick={() => router.push('/profile/edit')} />
        <MenuItem label="알림 설정" onClick={() => {/* TODO */}} />
        <MenuItem label="문의하기" onClick={() => {/* TODO */}} />
        <MenuItem label="이용약관" onClick={() => {/* TODO */}} />
      </div>

      {/* 로그아웃 */}
      <button
        onClick={handleSignOut}
        className="w-full py-3 text-center text-red-500 font-medium bg-white rounded-xl border border-gray-100 hover:bg-red-50 transition-colors"
      >
        로그아웃
      </button>

      {/* 버전 정보 */}
      <p className="text-center text-xs text-gray-300 mt-4">일다오 v1.0.0</p>
    </div>
  );
}

/** 정보 행 컴포넌트 */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-900">{value}</span>
    </div>
  );
}

/** 메뉴 항목 컴포넌트 */
function MenuItem({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-3.5 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <span>{label}</span>
      <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
