'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { useRequireAuth } from '@/hooks/useRequireAuth';
import { updateUserProfile } from '@/lib/firestore';
import { REGIONS, JOB_CATEGORIES } from '@/lib/constants';
import { JobCategory } from '@/types';
import { Spinner, PageLoader } from '@/components/ui/Spinner';

/**
 * 프로필 편집 페이지
 * - 구직자/구인자 역할에 따라 다른 필드 표시
 * - 기존 프로필 정보를 미리 채움
 * - 저장 시 Firestore 업데이트 후 이전 페이지로 이동
 */
export default function ProfileEditPage() {
  // 로그인 + 프로필 등록 필수 — 미가입/로드실패 사용자가 빈 화면에 갇히던 문제(#44)는
  // 훅이 /register·/login·홈으로 안내해 해소
  const { user, userProfile, ready, refreshProfile } = useRequireAuth();
  const router = useRouter();

  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  // 공통 필드
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [profileImage, setProfileImage] = useState('');
  const [imgError, setImgError] = useState(false);

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

  // 인증/프로필 가드는 useRequireAuth가 담당 (#44)

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
    // 한국 휴대폰/유선 번호 형식 검증 (#47)
    const phoneDigits = phone.replace(/\D/g, '');
    const isValidPhone = /^01[016789]\d{7,8}$/.test(phoneDigits) || /^0[2-6]\d{7,9}$/.test(phoneDigits);
    if (!isValidPhone) {
      setError('올바른 전화번호를 입력해주세요.');
      return;
    }
    // 프로필 이미지 URL 형식 검증 (#48 — http/https만 허용)
    const trimmedImage = profileImage.trim();
    if (trimmedImage) {
      let validUrl = false;
      try {
        const parsed = new URL(trimmedImage);
        validUrl = parsed.protocol === 'http:' || parsed.protocol === 'https:';
      } catch {
        validUrl = false;
      }
      if (!validUrl) {
        setError('프로필 사진 URL이 올바르지 않습니다. (http/https)');
        return;
      }
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
        // 경력 정규화 (#34): 음수·비현실 값 차단 (0~50년)
        updateData.experience = Math.max(0, Math.min(50, Math.floor(Number(experience) || 0)));
        updateData.region = region;
        updateData.desiredWage = Math.max(0, Number(desiredWage.replace(/,/g, '')) || 0);
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

  // 가드 통과 전(로딩·리다이렉트 대기)에는 스피너만 표시
  if (!ready || !user || !userProfile) {
    return (
      <PageLoader />
    );
  }

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

      {/* 프로필 이미지 섹션 */}
      <div className="card mb-5">
        <div className="flex flex-col items-center gap-3">
          {/* 현재 프로필 이미지 또는 플레이스홀더 */}
          <div className="relative w-20 h-20 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
            {profileImage && !imgError ? (
              <Image
                src={profileImage}
                alt="프로필"
                fill
                sizes="80px"
                unoptimized
                className="object-cover"
                referrerPolicy="no-referrer"
                onError={() => setImgError(true)}
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-primary-100">
                <svg className="w-10 h-10 text-primary-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
            )}
          </div>

          {/* 프로필 사진 URL 입력 */}
          <div className="w-full">
            <label className="block text-sm font-medium text-gray-500 mb-1">
              프로필 사진 URL
            </label>
            <input
              type="url"
              value={profileImage}
              onChange={(e) => {
                setProfileImage(e.target.value);
                setImgError(false); // URL 수정 시 미리보기 복원 (#48)
              }}
              placeholder="https://example.com/photo.jpg"
              className="w-full py-2.5 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
          </div>

          {/* URL 미리보기 */}
          {profileImage && (
            <p className="text-xs text-gray-400 truncate w-full text-center">
              미리보기: {profileImage}
            </p>
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

      {/* 하단 고정 저장 버튼 */}
      <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
        <div className="max-w-lg mx-auto">
          <button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full py-3.5 btn-primary rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? (
              <span className="flex items-center justify-center gap-2">
                <Spinner size="xs" className="text-white" />
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
