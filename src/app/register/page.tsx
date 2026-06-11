'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole, JobCategory } from '@/types';

/** 사용 가능한 직종 목록 */
const JOB_CATEGORIES: JobCategory[] = [
  '철근', '목공', '설비', '전기', '도장', '용접', '타일', '미장', '방수', '조적', '비계', '잡역', '기타',
];

/**
 * 회원가입 (프로필 설정) 페이지
 * - Google 로그인 후 최초 프로필 설정
 * - 사용자 유형(구인자/구직자) 선택
 * - 유형별 추가 정보 입력
 */
export default function RegisterPage() {
  const { user, userProfile, loading, refreshProfile } = useAuth();
  const router = useRouter();

  // 단계: 1=역할선택, 2=정보입력
  const [step, setStep] = useState(1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  // 공통 필드
  const [role, setRole] = useState<UserRole | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  // 구직자(근로자) 전용 필드
  const [skills, setSkills] = useState<JobCategory[]>([]);
  const [experience, setExperience] = useState('');
  const [desiredWage, setDesiredWage] = useState('');

  // 구인자(업체) 전용 필드
  const [companyName, setCompanyName] = useState('');
  const [representativeName, setRepresentativeName] = useState('');
  const [mainJobCategories, setMainJobCategories] = useState<JobCategory[]>([]);

  // 인증 상태 확인
  useEffect(() => {
    if (!loading) {
      if (!user) {
        // 로그인 안 되어 있으면 로그인 페이지로
        router.replace('/login');
      } else if (userProfile) {
        // 이미 프로필이 있으면 홈으로
        router.replace('/');
      } else {
        // Google 계정에서 이름 자동 채우기
        setName(user.displayName || '');
      }
    }
  }, [user, userProfile, loading, router]);

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
  const handleSubmit = async () => {
    if (!user || !role) return;

    // 유효성 검사
    if (!name.trim()) {
      setError('이름을 입력해주세요.');
      return;
    }
    if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
      setError('연락처를 올바르게 입력해주세요.');
      return;
    }

    if (role === 'worker' && skills.length === 0) {
      setError('보유 기술을 1개 이상 선택해주세요.');
      return;
    }
    if (role === 'employer' && !companyName.trim()) {
      setError('업체명을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    setError('');

    try {
      // Firestore에 프로필 저장
      const profileData: Record<string, any> = {
        uid: user.uid,
        email: user.email || '',
        role,
        name: name.trim(),
        phone: phone.trim(),
        profileImage: user.photoURL || '',
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      };

      if (role === 'worker') {
        profileData.skills = skills;
        profileData.experience = experience ? Number(experience) : 0;
        profileData.desiredWage = desiredWage ? Number(desiredWage.replace(/,/g, '')) : 0;
      } else {
        profileData.companyName = companyName.trim();
        profileData.representativeName = representativeName.trim();
        profileData.mainJobCategories = mainJobCategories;
      }

      await setDoc(doc(db, 'users', user.uid), profileData);
      await refreshProfile();
      router.replace('/');
    } catch (err) {
      console.error('프로필 저장 실패:', err);
      setError('프로필 저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  // 로딩 중
  if (loading || !user) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-24 min-h-screen">
      {/* 상단 진행 표시 */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-2">
          <div className={`h-1 flex-1 rounded-full ${step >= 1 ? 'bg-primary-500' : 'bg-gray-200'}`} />
          <div className={`h-1 flex-1 rounded-full ${step >= 2 ? 'bg-primary-500' : 'bg-gray-200'}`} />
        </div>
        <h1 className="text-xl font-bold text-gray-900">
          {step === 1 ? '어떤 용도로 사용하시나요?' : '기본 정보를 입력해주세요'}
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          {step === 1
            ? '맞춤형 서비스를 제공하기 위해 필요합니다.'
            : role === 'worker'
            ? '구직 프로필에 표시되는 정보입니다.'
            : '구인 게시 시 표시되는 업체 정보입니다.'}
        </p>
      </div>

      {/* 1단계: 역할 선택 */}
      {step === 1 && (
        <div className="space-y-4">
          {/* 구직자 카드 */}
          <button
            onClick={() => { setRole('worker'); setStep(2); }}
            className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
              role === 'worker'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 bg-white hover:border-primary-300'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-primary-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">일자리를 찾고 있어요</h3>
                <p className="text-sm text-gray-500">구직자 (근로자) · 일자리 검색, 지원, 공수 관리</p>
              </div>
            </div>
          </button>

          {/* 구인자 카드 */}
          <button
            onClick={() => { setRole('employer'); setStep(2); }}
            className={`w-full text-left p-5 rounded-xl border-2 transition-all ${
              role === 'employer'
                ? 'border-primary-500 bg-primary-50'
                : 'border-gray-200 bg-white hover:border-primary-300'
            }`}
          >
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-orange-100 rounded-xl flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-accent-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
              </div>
              <div>
                <h3 className="font-bold text-gray-900 mb-1">인력을 구하고 있어요</h3>
                <p className="text-sm text-gray-500">구인자 (업체) · 구인 게시, 인력 관리</p>
              </div>
            </div>
          </button>
        </div>
      )}

      {/* 2단계: 정보 입력 */}
      {step === 2 && (
        <div className="space-y-5">
          {/* 공통: 이름 */}
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

          {/* 공통: 연락처 */}
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

          {/* ===== 구직자(근로자) 전용 ===== */}
          {role === 'worker' && (
            <>
              {/* 보유 기술 선택 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  보유 기술 / 직종 <span className="text-red-500">*</span>
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
                  경력 (년)
                </label>
                <input
                  type="number"
                  value={experience}
                  onChange={(e) => setExperience(e.target.value)}
                  placeholder="예: 5"
                  min="0"
                  max="50"
                  className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
              </div>

              {/* 희망 일당 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  희망 일당 (원)
                </label>
                <input
                  type="text"
                  value={desiredWage}
                  onChange={(e) => {
                    const raw = e.target.value.replace(/\D/g, '');
                    setDesiredWage(raw ? Number(raw).toLocaleString() : '');
                  }}
                  placeholder="예: 250,000"
                  className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                />
              </div>
            </>
          )}

          {/* ===== 구인자(업체) 전용 ===== */}
          {role === 'employer' && (
            <>
              {/* 업체명 */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1.5">
                  업체명 <span className="text-red-500">*</span>
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
            </>
          )}

          {/* 에러 메시지 */}
          {error && (
            <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
              {error}
            </div>
          )}

          {/* 버튼 영역 */}
          <div className="flex gap-3 pt-2">
            <button
              onClick={() => { setStep(1); setError(''); }}
              className="flex-1 py-3 px-4 bg-gray-100 text-gray-700 font-semibold rounded-xl hover:bg-gray-200 transition-colors"
            >
              이전
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSaving}
              className="flex-[2] py-3 px-4 btn-primary rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSaving ? '저장 중...' : '가입 완료'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
