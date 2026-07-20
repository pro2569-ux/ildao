'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { updateUserProfile } from '@/lib/firestore';
import { uploadProfileImage } from '@/lib/storage';
import { JobCategory } from '@/types';
import { formatWon, formatManwon } from '@/lib/format';

/** 사용 가능한 직종 목록 */
const JOB_CATEGORIES: JobCategory[] = [
  '철근', '목공', '설비', '전기', '도장', '용접', '타일', '미장', '방수', '조적', '비계', '잡역', '기타',
];

/** 지역 목록 */
const REGIONS = [
  '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

/**
 * 프로필 편집 페이지
 * - 구직자/구인자 역할에 따라 다른 필드 표시
 * - 기존 프로필 정보를 미리 채움
 * - 저장 시 Firestore 업데이트 후 이전 페이지로 이동
 */
export default function ProfileEditPage() {
  const { user, userProfile, loading, refreshProfile } = useAuth();
  const router = useRouter();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // 공통 필드
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileImage, setProfileImage] = useState('');

  // 프로필 사진 업로드 상태 (P3-7)
  const [isUploading, setIsUploading] = useState(false);
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 구직자(근로자) 전용 필드
  const [skills, setSkills] = useState<JobCategory[]>([]);
  const [experience, setExperience] = useState('');
  const [region, setRegion] = useState('');
  const [desiredWage, setDesiredWage] = useState('');
  const [introduction, setIntroduction] = useState('');

  // 구인자(업체) 전용 필드
  const [companyName, setCompanyName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [mainJobCategories, setMainJobCategories] = useState<JobCategory[]>([]);
  const [companyIntro, setCompanyIntro] = useState('');

  // 비로그인 시 로그인 페이지로 리다이렉트
  useEffect(() => {
    if (!loading && !user) {
      router.replace('/login');
    }
  }, [user, loading, router]);

  // 기존 프로필 정보로 필드 초기화
  useEffect(() => {
    if (userProfile) {
      setName(userProfile.name || '');
      setPhone(userProfile.phone || '');
      setProfileImage(userProfile.profileImage || '');

      if (userProfile.role === 'worker') {
        setSkills((userProfile.skills as JobCategory[]) || []);
        setExperience(userProfile.experience ? String(userProfile.experience) : '');
        setRegion(userProfile.region || '');
        setDesiredWage(
          userProfile.desiredWage ? userProfile.desiredWage.toLocaleString() : ''
        );
        setIntroduction(userProfile.introduction || '');
      } else {
        setCompanyName(userProfile.companyName || '');
        setRepresentativeName(userProfile.representativeName || '');
        setMainJobCategories(userProfile.mainJobCategories || []);
        setCompanyIntro(userProfile.companyIntro || '');
      }
    }
  }, [userProfile]);

  // 저장 안 한 수정 내용이 있으면 새로고침/탭 닫기 경고 (P2-18)
  // 위 프리필과 동일한 규칙으로 프로필 원본과 현재 입력값을 비교해 변경 여부 판단
  useEffect(() => {
    if (!userProfile) return;
    const handler = (e: BeforeUnloadEvent) => {
      if (isSaving || success) return;
      const clean =
        name === (userProfile.name || '') &&
        phone === (userProfile.phone || '') &&
        profileImage === (userProfile.profileImage || '') &&
        (userProfile.role === 'worker'
          ? JSON.stringify(skills) === JSON.stringify((userProfile.skills as JobCategory[]) || []) &&
            experience === (userProfile.experience ? String(userProfile.experience) : '') &&
            region === (userProfile.region || '') &&
            desiredWage === (userProfile.desiredWage ? userProfile.desiredWage.toLocaleString() : '') &&
            introduction === (userProfile.introduction || '')
          : companyName === (userProfile.companyName || '') &&
            representativeName === (userProfile.representativeName || '') &&
            JSON.stringify(mainJobCategories) === JSON.stringify(userProfile.mainJobCategories || []) &&
            companyIntro === (userProfile.companyIntro || ''));
      if (!clean) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [userProfile, isSaving, success, name, phone, profileImage, skills, experience, region, desiredWage, introduction, companyName, representativeName, mainJobCategories, companyIntro]);

  /** 직종 토글 (구직자 skills) */
  const toggleSkill = (category: JobCategory) => {
    setSkills((prev) =>
      prev.includes(category) ? prev.filter((s) => s !== category) : [...prev, category]
    );
  };

  /** 직종 토글 (구인자 mainJobCategories) */
  const toggleMainCategory = (category: JobCategory) => {
    setMainJobCategories((prev) =>
      prev.includes(category) ? prev.filter((c) => c !== category) : [...prev, category]
    );
  };

  /** 프로필 사진 선택 → 즉시 Storage 업로드 (P3-7) */
  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // 같은 파일 재선택도 동작하도록 입력값 초기화
    e.target.value = '';
    if (!file || !user) return;

    setIsUploading(true);
    setUploadError('');

    try {
      const url = await uploadProfileImage(user.uid, file);
      // 업로드 성공 → 상태에만 반영, 실제 저장은 하단 저장 버튼 흐름 그대로
      setProfileImage(url);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '사진 올리기에 실패했습니다.');
    } finally {
      setIsUploading(false);
    }
  };

  /** 전화번호 포맷팅 (010-0000-0000) */
  const formatPhone = (value: string) => {
    const digits = value.replace(/\D/g, '').slice(0, 11);
    if (digits.length <= 3) return digits;
    if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
    return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
  };

  /** 프로필 저장 */
  const handleSave = async () => {
    if (!user || !userProfile) return;

    // 유효성 검사
    if (!name.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setError('연락처를 올바르게 입력해주세요.');
      return;
    }

    setIsSaving(true);
    setError('');
    setSuccess(false);

    try {
      const updateData: Record<string, any> = {
        name: name.trim(),
        phone: phone.trim(),
        profileImage: profileImage.trim(),
      };

      if (userProfile.role === 'worker') {
        updateData.skills = skills;
        updateData.experience = experience ? Number(experience) : 0;
        updateData.region = region;
        updateData.desiredWage = desiredWage ? Number(desiredWage.replace(/,/g, '')) : 0;
        updateData.introduction = introduction.trim();
      } else {
        updateData.companyName = companyName.trim();
        updateData.representativeName = representativeName.trim();
        updateData.mainJobCategories = mainJobCategories;
        updateData.companyIntro = companyIntro.trim();
      }

      await updateUserProfile(user.uid, updateData);
      await refreshProfile();

      setSuccess(true);
      // 성공 피드백 후 이전 페이지로 이동
      setTimeout(() => {
        router.back();
      }, 800);
    } catch (err) {
      console.error('프로필 수정 실패:', err);
      setError('프로필 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
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

  if (!user || !userProfile) return null;

  return (
    <div className="px-4 pt-4 pb-28 min-h-screen">
      {/* 상단 헤더: 뒤로가기 + 제목 */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="뒤로가기"
        >
          <svg className="w-5 h-5 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold text-gray-900">프로필 수정</h1>
      </div>

      {/* 프로필 사진 섹션 (P3-7: 갤러리에서 사진 선택 → Storage 업로드) */}
      <div className="card mb-5">
        <div className="flex flex-col items-center gap-3">
          {/* 현재 프로필 사진 또는 기본 아바타 (원형 미리보기) */}
          <div className="relative w-24 h-24 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            {profileImage ? (
              <img
                key={profileImage}
                src={profileImage}
                alt="프로필"
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                }}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary-100">
                <svg className="w-12 h-12 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}

            {/* 업로드 중 오버레이 스피너 */}
            {isUploading && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <div className="animate-spin rounded-full h-7 w-7 border-2 border-white border-t-transparent" />
              </div>
            )}
          </div>

          {/* 숨겨진 파일 입력 (갤러리에서 사진 선택) */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleImageSelect}
            className="hidden"
          />

          {/* 사진 선택 버튼 (큰 터치 영역) */}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full py-3.5 bg-primary-500 text-white rounded-xl font-semibold text-base hover:bg-primary-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isUploading ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                사진 올리는 중...
              </span>
            ) : (
              '사진 선택'
            )}
          </button>

          {/* 사진 삭제 (작은 버튼) */}
          {profileImage && !isUploading && (
            <button
              type="button"
              onClick={() => {
                setProfileImage('');
                setUploadError('');
              }}
              className="text-sm text-gray-400 underline hover:text-gray-600 transition-colors"
            >
              사진 삭제
            </button>
          )}

          {/* 업로드 실패 에러 메시지 */}
          {uploadError && (
            <p className="text-sm text-red-500 text-center">{uploadError}</p>
          )}
        </div>
      </div>

      {/* 기본 정보 */}
      <div className="space-y-5">
        {/* 이름 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            이름 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="홍길동"
            className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>

        {/* 연락처 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            연락처 <span className="text-red-500">*</span>
          </label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(formatPhone(e.target.value))}
            placeholder="010-0000-0000"
            className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>

        {/* ===== 구직자(근로자) 전용 필드 ===== */}
        {userProfile.role === 'worker' && (
          <>
            {/* 보유 기술 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                보유 기술
              </label>
              <div className="flex flex-wrap gap-2">
                {JOB_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleSkill(cat)}
                    className={`py-1.5 px-3 rounded-full text-sm font-medium transition-colors ${
                      skills.includes(cat)
                        ? 'bg-primary-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 경력 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                경력
              </label>
              <div className="relative">
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="예: 5"
                  min="0"
                  max="50"
                  className="w-full py-3 px-4 pr-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  년
                </span>
              </div>
            </div>

            {/* 선호 지역 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                선호 지역
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm bg-white appearance-none"
              >
                <option value="">지역 선택</option>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            {/* 희망 일당 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                희망 일당
              </label>
              <div className="relative">
                <input
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={desiredWage}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setDesiredWage(raw ? Number(raw).toLocaleString() : '');
                  }}
                  placeholder="예: 250,000"
                  className="w-full py-3 px-4 pr-10 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">
                  원
                </span>
              </div>
              {/* 금액 확인 도움말 (0 개수 확인용 만원 환산) */}
              {desiredWage && (
                <p className="mt-1 text-sm text-gray-600">
                  {formatWon(Number(desiredWage.replace(/,/g, '')))} ({formatManwon(Number(desiredWage.replace(/,/g, '')))})
                </p>
              )}
            </div>

            {/* 자기소개 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                자기소개
              </label>
              <textarea
                value={introduction}
                onChange={(e) => setIntroduction(e.target.value)}
                placeholder="간단한 자기소개를 입력해주세요"
                rows={4}
                className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm resize-none"
              />
            </div>
          </>
        )}

        {/* ===== 구인자(업체) 전용 필드 ===== */}
        {userProfile.role === 'employer' && (
          <>
            {/* 업체명 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                업체명
              </label>
              <input
                type="text"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="(주) 건설이엔지"
                className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
            </div>

            {/* 대표자명 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                대표자명
              </label>
              <input
                type="text"
                value={representativeName}
                onChange={(e) => setRepresentativeName(e.target.value)}
                placeholder="대표자 이름"
                className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
              />
            </div>

            {/* 주요 직종 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                주요 직종
              </label>
              <div className="flex flex-wrap gap-2">
                {JOB_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => toggleMainCategory(cat)}
                    className={`py-1.5 px-3 rounded-full text-sm font-medium transition-colors ${
                      mainJobCategories.includes(cat)
                        ? 'bg-accent-500 text-white'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                    }`}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* 업체 소개 */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                업체 소개
              </label>
              <textarea
                value={companyIntro}
                onChange={(e) => setCompanyIntro(e.target.value)}
                placeholder="업체에 대한 간단한 소개를 입력해주세요"
                rows={4}
                className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm resize-none"
              />
            </div>
          </>
        )}
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="mt-4 p-3 bg-red-50 text-red-600 text-sm rounded-lg">
          {error}
        </div>
      )}

      {/* 성공 메시지 */}
      {success && (
        <div className="mt-4 p-3 bg-green-50 text-green-600 text-sm rounded-lg">
          프로필이 저장되었습니다!
        </div>
      )}

      {/* 하단 고정 저장 버튼 (z-40: 하단 네비/배너에 가리지 않도록) */}
      <div className="fixed bottom-0 left-0 right-0 z-40 p-4 bg-white border-t border-gray-100">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3.5 btn-primary rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
                저장 중...
              </span>
            ) : success ? (
              '저장 완료!'
            ) : (
              '저장하기'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
