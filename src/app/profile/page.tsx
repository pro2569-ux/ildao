'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { toggleProfilePublic, updateUserProfile, deleteUserAccount } from '@/lib/firestore';
import { enablePush, isPushPermissionGranted, listenForegroundMessages } from '@/lib/fcm';
import ConfirmSheet from '@/components/ui/ConfirmSheet';

/**
 * 내 정보 (프로필) 페이지
 * - 프로필 정보 표시
 * - 로그아웃 기능
 * - 비로그인 시 로그인 페이지로 리다이렉트
 */
export default function ProfilePage() {
  const { user, userProfile, loading, signOut, refreshProfile } = useAuth();
  const router = useRouter();
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  // 로그아웃 실수 방지 확인 시트 (P2-18)
  const [showLogoutSheet, setShowLogoutSheet] = useState(false);
  // 역할 변경 확인 시트 (P3-6)
  const [showRoleSheet, setShowRoleSheet] = useState(false);
  const [roleChanging, setRoleChanging] = useState(false);
  const [roleError, setRoleError] = useState<string | null>(null);
  // 회원탈퇴 확인 시트 (P3-6)
  const [showDeleteSheet, setShowDeleteSheet] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  // 탈퇴 중 최근 로그인 필요(auth/requires-recent-login) 상태 — 재로그인 유도
  const [needsRelogin, setNeedsRelogin] = useState(false);
  // 푸시 알림 설정 (P3-1)
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** 토스트 표시 (3초 후 자동으로 사라짐) */
  const showToast = (message: string) => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToastMessage(message);
    toastTimerRef.current = setTimeout(() => setToastMessage(null), 3000);
  };

  // 페이지 이탈 시 토스트 타이머 정리
  useEffect(() => {
    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  // 비로그인 시 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // 푸시 알림 상태 확인 + 이미 허용된 경우 포그라운드 리스너 등록 (P3-1)
  useEffect(() => {
    const granted = isPushPermissionGranted();
    setPushEnabled(granted);
    if (granted) {
      void listenForegroundMessages();
    }
  }, []);

  /** 알림 설정 클릭 (P3-1) */
  const handleNotificationSetting = async () => {
    if (!user || pushBusy) return;

    // 이미 허용된 상태 — 안내만
    if (pushEnabled) {
      showToast('알림이 켜져 있어요');
      return;
    }

    setPushBusy(true);
    try {
      const result = await enablePush(user.uid);
      if (result === 'granted') {
        setPushEnabled(true);
        showToast('알림을 켰어요');
      } else if (result === 'denied') {
        showToast('브라우저 설정에서 알림을 허용해주세요');
      } else {
        showToast('이 브라우저는 알림을 지원하지 않아요');
      }
    } catch (error) {
      console.error('알림 설정 실패:', error);
      showToast('알림 설정에 실패했어요. 다시 시도해주세요');
    } finally {
      setPushBusy(false);
    }
  };

  /** 로그아웃 핸들러 */
  const handleSignOut = async () => {
    await signOut();
    router.replace('/login');
  };

  /** 프로필 공개 토글 */
  const handleTogglePublic = async () => {
    if (!user || !userProfile) return;
    try {
      const newValue = !userProfile.isPublic;
      await toggleProfilePublic(user.uid, newValue);
      await refreshProfile();
    } catch (error) {
      console.error('프로필 공개 설정 실패:', error);
    }
  };

  // 역할 변경 대상 (현재 역할의 반대)
  const nextRole = userProfile?.role === 'worker' ? 'employer' : 'worker';
  const nextRoleLabel = nextRole === 'employer' ? '구인자' : '구직자';

  /** 역할 변경 핸들러 (P3-6) */
  const handleRoleChange = async () => {
    if (!user || !userProfile) return;
    setRoleChanging(true);
    setRoleError(null);
    try {
      await updateUserProfile(user.uid, { role: nextRole });
      await refreshProfile();
      setShowRoleSheet(false);
      showToast(`${nextRoleLabel}로 전환했어요`);
    } catch (error) {
      console.error('역할 변경 실패:', error);
      setRoleError('역할 변경에 실패했어요. 다시 시도해주세요.');
    } finally {
      setRoleChanging(false);
    }
  };

  /** 회원탈퇴 핸들러 (P3-6) */
  const handleDeleteAccount = async () => {
    if (!user) return;

    // 최근 로그인 필요 안내 상태에서 확인 → 로그아웃 후 로그인 페이지로
    if (needsRelogin) {
      await signOut();
      router.replace('/login');
      return;
    }

    setDeleting(true);
    setDeleteError(null);
    try {
      // 1) Firestore 프로필 삭제 (공고/지원 기록은 분쟁 대비 보존 — firestore.ts 참고)
      await deleteUserAccount(user.uid);
      // 2) Firebase Auth 계정 삭제
      await user.delete();
      // 3) 남은 세션 정리 후 로그인 페이지로
      await signOut().catch(() => {}); // 이미 삭제된 계정이면 무시
      router.replace('/login');
    } catch (error: any) {
      console.error('회원탈퇴 실패:', error);
      if (error?.code === 'auth/requires-recent-login') {
        // 보안 정책상 오래된 세션으로는 계정 삭제 불가 → 재로그인 유도
        setDeleteError('보안을 위해 다시 로그인한 뒤 탈퇴해주세요');
        setNeedsRelogin(true);
      } else {
        setDeleteError('탈퇴 처리에 실패했어요. 다시 시도해주세요.');
      }
      setDeleting(false);
    }
  };

  // 로딩 중
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  if (!user) return null;

  return (
    <div className="px-4 pt-6 pb-24">
      <h1 className="text-xl font-bold mb-6">내 정보</h1>

      {/* 프로필 카드 */}
      <div className="card mb-4">
        <div className="flex items-center gap-4">
          {/* 프로필 이미지 */}
          <div className="w-16 h-16 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            {user.photoURL ? (
              <img
                src={user.photoURL}
                alt="프로필"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
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
          <h3 className="font-semibold text-sm text-gray-500 uppercase tracking-wider">프로필 정보</h3>

          <InfoRow label="연락처" value={userProfile.phone} />

          {userProfile.role === 'worker' ? (
            <>
              <InfoRow
                label="보유 기술"
                value={userProfile.skills?.join(', ') || '-'}
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
              <h3 className="font-semibold text-base text-gray-800">프로필 공개</h3>
              <p className="text-sm text-gray-500 mt-0.5">
                구인자에게 내 프로필이 노출됩니다
              </p>
            </div>
            {/* p-2로 터치 영역 44px 이상 확보 (시각 크기는 유지) */}
            <button
              onClick={handleTogglePublic}
              aria-label="프로필 공개 전환"
              className="p-2 -m-2 flex-shrink-0"
            >
              <span className={`relative block w-12 h-7 rounded-full transition-colors ${
                userProfile.isPublic ? 'bg-primary-500' : 'bg-gray-300'
              }`}>
                <span className={`absolute top-0.5 w-6 h-6 bg-white rounded-full shadow transition-transform ${
                  userProfile.isPublic ? 'translate-x-5' : 'translate-x-0.5'
                }`} />
              </span>
            </button>
          </div>
        </div>
      )}

      {/* 프로필 미설정 안내 */}
      {!userProfile && (
        <div className="card mb-4 text-center py-6">
          <p className="text-gray-500 text-base mb-3">프로필이 설정되지 않았습니다.</p>
          <button
            onClick={() => router.push('/register')}
            className="btn-primary text-base py-3 px-5 min-h-[44px]"
          >
            프로필 설정하기
          </button>
        </div>
      )}

      {/* 메뉴 */}
      <div className="card mb-4 divide-y divide-gray-100">
        <MenuItem label="프로필 수정" onClick={() => router.push('/profile/edit')} />
        {/* 역할 변경 — 구직자↔구인자 전환 (P3-6) */}
        {userProfile && (
          <MenuItem
            label="역할 변경"
            badge={userProfile.role === 'worker' ? '현재 구직자' : '현재 구인자'}
            onClick={() => {
              setRoleError(null);
              setShowRoleSheet(true);
            }}
          />
        )}
        {/* 하단 네비에서 빠진 즐겨찾기 진입점 (P2-12) */}
        <MenuItem label="즐겨찾기" onClick={() => router.push('/favorites')} />
        {/* 푸시 알림 켜기 (P3-1) */}
        <MenuItem
          label="알림 설정"
          badge={pushBusy ? '설정 중...' : pushEnabled ? '켜짐' : '꺼짐'}
          onClick={handleNotificationSetting}
        />
        {/* TODO: 대표 전화(tel:) 또는 카카오채널로 교체 */}
        <MenuItem
          label="문의하기"
          onClick={() => {
            window.location.href = 'mailto:pro2569@gmail.com?subject=일다오 문의';
          }}
        />
        <MenuItem label="이용약관" onClick={() => router.push('/terms')} />
        <MenuItem label="개인정보처리방침" onClick={() => router.push('/privacy')} />
      </div>

      {/* 로그아웃 — 확인 시트 경유 (P2-18) */}
      <button
        onClick={() => setShowLogoutSheet(true)}
        className="w-full py-3 min-h-[44px] text-center text-base text-red-500 font-medium bg-white rounded-xl border border-gray-100 hover:bg-red-50 transition-colors"
      >
        로그아웃
      </button>

      {/* 회원탈퇴 — 작은 텍스트 버튼 (P3-6, 법적 필수) */}
      <div className="text-center mt-3">
        <button
          onClick={() => {
            setDeleteError(null);
            setNeedsRelogin(false);
            setShowDeleteSheet(true);
          }}
          className="inline-block px-4 py-3 min-h-[44px] text-sm text-gray-500 underline underline-offset-2"
        >
          회원탈퇴
        </button>
      </div>

      <ConfirmSheet
        open={showLogoutSheet}
        title="로그아웃할까요?"
        description="다시 이용하려면 로그인이 필요해요"
        confirmText="로그아웃"
        onConfirm={handleSignOut}
        onCancel={() => setShowLogoutSheet(false)}
      />

      {/* 역할 변경 확인 시트 (P3-6) */}
      <ConfirmSheet
        open={showRoleSheet}
        title={`${nextRoleLabel}로 전환할까요?`}
        description="홈 화면과 메뉴가 바뀌어요"
        confirmText="전환하기"
        loading={roleChanging}
        loadingText="전환 중..."
        error={roleError}
        onConfirm={handleRoleChange}
        onCancel={() => setShowRoleSheet(false)}
      />

      {/* 회원탈퇴 확인 시트 (P3-6) */}
      <ConfirmSheet
        open={showDeleteSheet}
        title="정말 탈퇴할까요?"
        description="프로필 정보가 삭제되며 되돌릴 수 없어요"
        confirmText={needsRelogin ? '다시 로그인하기' : '탈퇴하기'}
        danger
        loading={deleting}
        loadingText="탈퇴 처리 중..."
        error={deleteError}
        onConfirm={handleDeleteAccount}
        onCancel={() => setShowDeleteSheet(false)}
      />

      {/* 버전 정보 */}
      <p className="text-center text-sm text-gray-500 mt-4">일다오 v1.0.0</p>

      {/* 토스트 메시지 */}
      {toastMessage && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-50 bg-black/70 text-white text-sm px-4 py-2.5 rounded-full whitespace-nowrap">
          {toastMessage}
        </div>
      )}
    </div>
  );
}

/** 정보 행 컴포넌트 */
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-base font-medium text-gray-900">{value}</span>
    </div>
  );
}

/** 메뉴 항목 컴포넌트 */
function MenuItem({ label, badge, onClick }: { label: string; badge?: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center justify-between py-3.5 min-h-[44px] text-base text-gray-700 hover:bg-gray-50 transition-colors"
    >
      <span className="flex items-center gap-1.5">
        {label}
        {badge && (
          <span className="text-xs text-gray-500 bg-gray-100 px-1.5 py-0.5 rounded-full">
            {badge}
          </span>
        )}
      </span>
      <svg className="w-4 h-4 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </button>
  );
}
