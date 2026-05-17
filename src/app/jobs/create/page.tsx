'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createJob } from '@/lib/firestore';
import { JobCategory } from '@/types';
import { Timestamp } from 'firebase/firestore';
import KakaoMap from '@/components/ui/KakaoMap';

/** 사용 가능한 직종 목록 */
const JOB_CATEGORIES: JobCategory[] = [
  '철근', '목공', '설비', '전기', '도장', '용접', '타일', '미장', '방수', '조적', '비계', '잡역', '기타',
];

/** 지역 목록 (시/도) */
const REGIONS = [
  '서울', '경기', '인천', '부산', '대구', '광주', '대전', '울산', '세종',
  '강원', '충북', '충남', '전북', '전남', '경북', '경남', '제주',
];

/**
 * 구인글 작성 페이지
 * - 직종 선택, 일당, 근무 위치, 날짜, 인원 수, 상세 설명
 * - Firestore jobs 컬렉션에 저장
 */
export default function CreateJobPage() {
  const { user, userProfile } = useAuth();
  const router = useRouter();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<JobCategory | ''>('');
  const [dailyWage, setDailyWage] = useState('');
  const [region, setRegion] = useState('');
  const [addressDetail, setAddressDetail] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [workHours, setWorkHours] = useState('08:00~17:00');
  const [numberOfWorkers, setNumberOfWorkers] = useState('1');
  const [description, setDescription] = useState('');
  const [lat, setLat] = useState(0);
  const [lng, setLng] = useState(0);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');

  /** 폼 제출 */
  const handleSubmit = async () => {
    // 유효성 검사
    if (!title.trim()) { setError('제목을 입력해주세요.'); return; }
    if (!category) { setError('직종을 선택해주세요.'); return; }
    if (!dailyWage) { setError('일당을 입력해주세요.'); return; }
    if (!region) { setError('지역을 선택해주세요.'); return; }
    if (!startDate) { setError('근무 시작일을 선택해주세요.'); return; }
    if (!user || !userProfile) { setError('로그인이 필요합니다.'); return; }

    setIsSaving(true);
    setError('');

    try {
      const wageNumber = Number(dailyWage.replace(/,/g, ''));
      const fullAddress = `${region} ${addressDetail}`.trim();

      await createJob({
        employerId: user.uid,
        title: title.trim(),
        category: category as JobCategory,
        dailyWage: wageNumber,
        numberOfWorkers: Number(numberOfWorkers) || 1,
        startDate: new Date(startDate),
        endDate: endDate ? new Date(endDate) : undefined,
        workHours,
        location: {
          address: fullAddress,
          lat: lat,
          lng: lng,
        },
        description: description.trim(),
      });

      router.push('/my-jobs');
    } catch (err: any) {
      console.error('구인글 작성 실패:', err);
      alert('구인글 등록 에러: ' + (err?.message || JSON.stringify(err)));
      setError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  /** 일당 포맷팅 */
  const formatWage = (value: string) => {
    const raw = value.replace(/\D/g, '');
    return raw ? Number(raw).toLocaleString() : '';
  };

  return (
    <div className="px-4 pt-6 pb-24 min-h-screen">
      {/* 상단 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold">구인글 작성</h1>
      </div>

      <div className="space-y-5">
        {/* 제목 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="예: 철근공 3명 급구"
            className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>

        {/* 직종 선택 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            직종 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {JOB_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategory(cat)}
                className={`py-1.5 px-3 rounded-full text-sm font-medium transition-colors ${
                  category === cat
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        {/* 일당 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            일당 (원) <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={dailyWage}
            onChange={(e) => setDailyWage(formatWage(e.target.value))}
            placeholder="예: 250,000"
            className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>

        {/* 근무 위치 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            근무 위치 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="col-span-1 py-3 px-3 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white"
            >
              <option value="">시/도</option>
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
            <input
              type="text"
              value={addressDetail}
              onChange={(e) => setAddressDetail(e.target.value)}
              placeholder="상세 주소"
              className="col-span-2 py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
            />
          </div>
          {/* 카카오맵 위치 선택 */}
          <div className="mt-2">
            <KakaoMap
              mode="select"
              address={`${region} ${addressDetail}`.trim()}
              onSelect={(data) => {
                const parts = data.address.split(' ');
                if (parts.length > 0) setRegion(parts[0]);
                if (parts.length > 1) setAddressDetail(parts.slice(1).join(' '));
                setLat(data.lat);
                setLng(data.lng);
              }}
              height="180px"
            />
          </div>
        </div>

        {/* 근무 날짜 */}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              시작일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              종료일
            </label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            />
          </div>
        </div>

        {/* 근무 시간 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            근무 시간
          </label>
          <input
            type="text"
            value={workHours}
            onChange={(e) => setWorkHours(e.target.value)}
            placeholder="08:00~17:00"
            className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>

        {/* 필요 인원 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            필요 인원
          </label>
          <input
            type="number"
            value={numberOfWorkers}
            onChange={(e) => setNumberOfWorkers(e.target.value)}
            min="1"
            max="100"
            className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
        </div>

        {/* 상세 설명 */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            상세 설명
          </label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="근무 조건, 우대 사항, 현장 정보 등을 자유롭게 작성해주세요."
            rows={4}
            className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm resize-none"
          />
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="p-3 bg-red-50 text-red-600 text-sm rounded-lg">
            {error}
          </div>
        )}

        {/* 제출 버튼 */}
        <button
          onClick={handleSubmit}
          disabled={isSaving}
          className="w-full py-3.5 btn-primary rounded-xl font-semibold disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSaving ? '등록 중...' : '구인글 등록'}
        </button>
      </div>
    </div>
  );
}
