'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createJob, updateJob, getJob } from '@/lib/firestore';
import { JobCategory, JobPost } from '@/types';
import { formatWon, formatManwon } from '@/lib/format';
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

/** Date → input[type=date] 값 (YYYY-MM-DD) */
const toDateInput = (date: Date) => {
  const d = new Date(date);
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${month}-${day}`;
};

/**
 * 공고 작성 페이지
 * - 직종 선택, 일당, 근무 위치, 날짜, 인원 수, 상세 설명
 * - Firestore jobs 컬렉션에 저장
 * - ?edit=<jobId>: 내 공고 수정 모드 (updateJob, status·applicants·createdAt 보존)
 * - ?copy=<jobId>: 재게시 모드 (프리필 후 새 공고로 등록, 지난 시작일은 내일로 보정)
 */
function CreateJobContent() {
  const { user, userProfile, loading: authLoading } = useAuth();
  const router = useRouter();

  // edit가 copy보다 우선 (둘 다 있으면 수정 모드)
  const searchParams = useSearchParams();
  const editId = searchParams.get('edit');
  const copyId = searchParams.get('copy');
  const isEditMode = Boolean(editId);
  const isCopyMode = !isEditMode && Boolean(copyId);

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
  // edit/copy 모드: 기존 공고 불러오는 중 여부, 불러오기 실패/차단 안내
  const [initializing, setInitializing] = useState(isEditMode || isCopyMode);
  const [loadError, setLoadError] = useState('');
  // copy 모드: 시작일 보정 안내
  const [notice, setNotice] = useState('');

  useEffect(() => {
    if (!isEditMode && !isCopyMode) return;
    if (authLoading) return;
    if (!user) {
      // 로그인 후 다시 이 화면으로 돌아오도록 returnUrl 전달
      const target = isEditMode ? `/jobs/create?edit=${editId}` : `/jobs/create?copy=${copyId}`;
      router.replace(`/login?returnUrl=${encodeURIComponent(target)}`);
      return;
    }
    loadSourceJob();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editId, copyId, authLoading, user]);

  /** edit/copy 대상 공고 불러와서 폼 프리필 */
  const loadSourceJob = async () => {
    setInitializing(true);
    try {
      const jobId = (editId || copyId)!;
      const job = await getJob(jobId);

      if (!job) {
        setLoadError('공고를 찾을 수 없어요. 이미 삭제되었거나 주소가 잘못되었을 수 있어요.');
        return;
      }
      if (job.employerId !== user!.uid) {
        setLoadError(
          isEditMode
            ? '내가 올린 공고만 수정할 수 있어요.'
            : '내가 올린 공고만 다시 올릴 수 있어요.'
        );
        return;
      }

      // 공통 프리필
      setTitle(job.title);
      setCategory(job.category);
      setDailyWage(job.dailyWage ? job.dailyWage.toLocaleString() : '');
      const addressParts = (job.location?.address || '').split(' ');
      setRegion(addressParts[0] || '');
      setAddressDetail(addressParts.slice(1).join(' '));
      setWorkHours(job.workHours || '08:00~17:00');
      setNumberOfWorkers(String(job.numberOfWorkers || 1));
      setDescription(job.description || '');
      setLat(job.location?.lat || 0);
      setLng(job.location?.lng || 0);

      // 날짜 프리필
      const jobStart = new Date(job.startDate);
      jobStart.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      if (isCopyMode && jobStart.getTime() < today.getTime()) {
        // 재게시: 지난 시작일은 내일로 보정하고, 종료일도 기간을 유지해 함께 이동
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        setStartDate(toDateInput(tomorrow));
        if (job.endDate) {
          const jobEnd = new Date(job.endDate);
          jobEnd.setHours(0, 0, 0, 0);
          const durationDays = Math.max(
            0,
            Math.round((jobEnd.getTime() - jobStart.getTime()) / 86400000)
          );
          const newEnd = new Date(tomorrow);
          newEnd.setDate(newEnd.getDate() + durationDays);
          setEndDate(toDateInput(newEnd));
        }
        setNotice('지난 공고라 시작일을 내일로 바꿨어요. 시작일을 확인해주세요.');
      } else {
        setStartDate(toDateInput(job.startDate));
        if (job.endDate) setEndDate(toDateInput(job.endDate));
      }
    } catch (err) {
      console.error('공고 불러오기 실패:', err);
      setLoadError('공고 정보를 불러오지 못했어요. 인터넷 연결을 확인하고 다시 시도해주세요.');
    } finally {
      setInitializing(false);
    }
  };

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

      if (isEditMode) {
        // 수정 모드: status·applicants·createdAt은 건드리지 않음 (updateJob이 updatedAt 자동 갱신)
        const updateData: Partial<JobPost> = {
          title: title.trim(),
          category: category as JobCategory,
          dailyWage: wageNumber,
          numberOfWorkers: Number(numberOfWorkers) || 1,
          startDate: new Date(startDate),
          workHours,
          location: {
            address: fullAddress,
            lat: lat,
            lng: lng,
          },
          description: description.trim(),
          // 종료일을 지운 경우에도 반영되도록 null 저장 (undefined는 Firestore가 허용하지 않음)
          endDate: endDate ? new Date(endDate) : (null as any),
        };
        await updateJob(editId!, updateData);
      } else {
        const createData: Omit<JobPost, 'id' | 'createdAt' | 'updatedAt' | 'applicants' | 'status' | 'isPremium'> = {
          employerId: user.uid,
          title: title.trim(),
          category: category as JobCategory,
          dailyWage: wageNumber,
          numberOfWorkers: Number(numberOfWorkers) || 1,
          startDate: new Date(startDate),
          workHours,
          location: {
            address: fullAddress,
            lat: lat,
            lng: lng,
          },
          description: description.trim(),
        };
        // 종료일이 있을 때만 포함 (undefined 값은 Firestore 저장 시 오류 발생)
        if (endDate) createData.endDate = new Date(endDate);
        await createJob(createData);
      }

      router.push('/my-jobs');
    } catch (err: any) {
      console.error(isEditMode ? '공고 수정 실패:' : '공고 작성 실패:', err);
      setError(
        isEditMode
          ? '공고 수정에 실패했어요. 인터넷 연결을 확인하고 다시 시도해주세요.'
          : '공고 등록에 실패했어요. 인터넷 연결을 확인하고 다시 시도해주세요.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  /** 일당 포맷팅 */
  const formatWage = (value: string) => {
    const raw = value.replace(/\D/g, '');
    return raw ? Number(raw).toLocaleString() : '';
  };

  const pageTitle = isEditMode ? '공고 수정' : isCopyMode ? '공고 다시 올리기' : '공고 작성';

  // 기존 공고 불러오는 중 (edit/copy 모드)
  if ((isEditMode || isCopyMode) && (authLoading || initializing)) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  // 불러오기 실패 / 본인 공고 아님
  if (loadError) {
    return (
      <div className="px-4 pt-6 pb-24 min-h-screen">
        <div className="flex items-center gap-3 mb-6">
          <button onClick={() => router.back()} className="p-1">
            <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <h1 className="text-xl font-bold">{pageTitle}</h1>
        </div>
        <div className="text-center py-12">
          <p className="text-gray-500 text-sm mb-4">{loadError}</p>
          <Link
            href="/my-jobs"
            className="inline-block py-2.5 px-6 bg-primary-500 text-white text-sm font-medium rounded-lg"
          >
            내 공고 보기
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-24 min-h-screen">
      {/* 상단 */}
      <div className="flex items-center gap-3 mb-6">
        <button onClick={() => router.back()} className="p-1">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold">{pageTitle}</h1>
      </div>

      <div className="space-y-5">
        {/* 재게시 시작일 보정 안내 */}
        {notice && (
          <div className="p-3 bg-accent-50 text-accent-600 text-sm rounded-lg">
            {notice}
          </div>
        )}

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
            inputMode="numeric"
            pattern="[0-9]*"
            value={dailyWage}
            onChange={(e) => setDailyWage(formatWage(e.target.value))}
            placeholder="예: 250,000"
            className="w-full py-3 px-4 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          />
          {/* 금액 확인 도움말 (0 개수 확인용 만원 환산) */}
          {dailyWage && (
            <p className="mt-1 text-sm text-gray-600">
              {formatWon(Number(dailyWage.replace(/,/g, '')))} ({formatManwon(Number(dailyWage.replace(/,/g, '')))})
            </p>
          )}
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
            inputMode="numeric"
            pattern="[0-9]*"
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
          {isSaving
            ? isEditMode ? '수정 중...' : '등록 중...'
            : isEditMode ? '수정 완료' : '공고 등록'}
        </button>
      </div>
    </div>
  );
}

/** useSearchParams 사용을 위한 Suspense 경계 */
export default function CreateJobPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
        </div>
      }
    >
      <CreateJobContent />
    </Suspense>
  );
}
