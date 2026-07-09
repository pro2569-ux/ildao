'use client';

import { useState, useEffect, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { createJob, updateJob, getJob } from '@/lib/firestore';
import { JobCategory, JobPost } from '@/types';
import { formatWon, formatManwon } from '@/lib/format';
import KakaoMap from '@/components/ui/KakaoMap';
import BackButton from '@/components/ui/BackButton';
import { useToast } from '@/components/ui/Toast';

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

/** 작성 중 임시저장 localStorage 키 (P2-14, 순수 작성 모드 전용) */
const DRAFT_KEY = 'ildao_job_draft';

/** 일당 프리셋 (P2-14) */
const WAGE_PRESETS = [150000, 180000, 200000, 250000];

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
  // 검증 실패한 필드 (P2-14) — 해당 필드에 빨간 테두리 + 스크롤
  const [errorField, setErrorField] = useState<string | null>(null);
  // edit/copy 모드: 기존 공고 불러오는 중 여부, 불러오기 실패/차단 안내
  const [initializing, setInitializing] = useState(isEditMode || isCopyMode);
  const [loadError, setLoadError] = useState('');
  // copy 모드: 시작일 보정 안내
  const [notice, setNotice] = useState('');
  // 임시저장 복원 여부 (P2-14) — 복원 완료 전에는 저장 effect가 덮어쓰지 않도록
  const [draftReady, setDraftReady] = useState(false);
  const [draftRestored, setDraftRestored] = useState(false);
  const { showToast, toastElement } = useToast();

  /** 순수 작성 모드에서만 임시저장/이탈경고 동작 */
  const isPureCreate = !isEditMode && !isCopyMode;

  // ===== 임시저장 복원 + 시작일 기본값(내일) (P2-14) =====
  useEffect(() => {
    if (!isPureCreate) return;
    let restoredStart = '';
    try {
      const raw = localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        if (d.title || d.category || d.dailyWage || d.addressDetail || d.description) {
          setTitle(d.title || '');
          setCategory(d.category || '');
          setDailyWage(d.dailyWage || '');
          setRegion(d.region || '');
          setAddressDetail(d.addressDetail || '');
          setStartDate(d.startDate || '');
          setEndDate(d.endDate || '');
          setWorkHours(d.workHours || '08:00~17:00');
          setNumberOfWorkers(d.numberOfWorkers || '1');
          setDescription(d.description || '');
          restoredStart = d.startDate || '';
          setDraftRestored(true);
        }
      }
    } catch {
      // 복원 실패 시 빈 폼으로 시작 (임시저장은 편의 기능)
    }
    // 시작일 기본값: 내일 (복원된 값이 없을 때만)
    if (!restoredStart) {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      setStartDate(toDateInput(tomorrow));
    }
    setDraftReady(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ===== 작성 내용 임시저장 (P2-14) — 전화·이탈로 날아가지 않게 =====
  useEffect(() => {
    if (!isPureCreate || !draftReady) return;
    const hasContent = title || category || dailyWage || addressDetail || description;
    try {
      if (hasContent) {
        localStorage.setItem(
          DRAFT_KEY,
          JSON.stringify({
            title, category, dailyWage, region, addressDetail,
            startDate, endDate, workHours, numberOfWorkers, description,
          })
        );
      } else {
        localStorage.removeItem(DRAFT_KEY);
      }
    } catch {
      // 저장소 접근 실패는 무시 (작성 자체에는 지장 없음)
    }
  }, [isPureCreate, draftReady, title, category, dailyWage, region, addressDetail, startDate, endDate, workHours, numberOfWorkers, description]);

  // ===== 브라우저 이탈(새로고침·탭 닫기) 경고 (P2-14) =====
  useEffect(() => {
    if (!isPureCreate) return;
    const handler = (e: BeforeUnloadEvent) => {
      const hasContent = title || category || dailyWage || description;
      if (hasContent && !isSaving) {
        e.preventDefault();
        e.returnValue = '';
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [isPureCreate, title, category, dailyWage, description, isSaving]);

  /** 임시저장 버리고 새로 쓰기 (P2-14) */
  const clearDraft = () => {
    try {
      localStorage.removeItem(DRAFT_KEY);
    } catch {}
    setTitle('');
    setCategory('');
    setDailyWage('');
    setRegion('');
    setAddressDetail('');
    setEndDate('');
    setWorkHours('08:00~17:00');
    setNumberOfWorkers('1');
    setDescription('');
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setStartDate(toDateInput(tomorrow));
    setDraftRestored(false);
  };

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

  /** 검증 실패 필드 강조 + 해당 위치로 스크롤 (P2-14) */
  const focusError = (field: string, message: string) => {
    setError(message);
    setErrorField(field);
    document.getElementById(`field-${field}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  /** 폼 제출 */
  const handleSubmit = async () => {
    // 유효성 검사 — 실패한 필드로 스크롤 + 빨간 테두리 (P2-14)
    setError('');
    setErrorField(null);
    if (!title.trim()) return focusError('title', '제목을 입력해주세요.');
    if (!category) return focusError('category', '직종을 선택해주세요.');
    if (!dailyWage) return focusError('wage', '일당을 입력해주세요.');
    if (!region) return focusError('region', '지역을 선택해주세요.');
    if (!startDate) return focusError('startDate', '근무 시작일을 선택해주세요.');
    if (!isEditMode) {
      // 새 공고는 지난 날짜로 시작할 수 없음 (수정 모드는 진행 중 공고가 있어 제외)
      const s = new Date(startDate + 'T00:00:00');
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      if (s.getTime() < today.getTime()) {
        return focusError('startDate', '시작일은 오늘 이후로 선택해주세요.');
      }
    }
    if (endDate && endDate < startDate) {
      return focusError('endDate', '종료일은 시작일보다 빠를 수 없어요.');
    }
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

      // 등록 완료: 임시저장 비우고 토스트를 잠깐 보여준 뒤 이동 (P2-14)
      // 성공 시 isSaving을 유지해 이동 전 중복 제출 방지
      if (isPureCreate) {
        try {
          localStorage.removeItem(DRAFT_KEY);
        } catch {}
      }
      showToast(isEditMode ? '공고를 수정했어요' : '공고를 등록했어요');
      setTimeout(() => router.push('/my-jobs'), 700);
    } catch (err: any) {
      console.error(isEditMode ? '공고 수정 실패:' : '공고 작성 실패:', err);
      setError(
        isEditMode
          ? '공고 수정에 실패했어요. 인터넷 연결을 확인하고 다시 시도해주세요.'
          : '공고 등록에 실패했어요. 인터넷 연결을 확인하고 다시 시도해주세요.'
      );
      setIsSaving(false);
    }
  };

  /** 일당 포맷팅 */
  const formatWage = (value: string) => {
    const raw = value.replace(/\D/g, '');
    return raw ? Number(raw).toLocaleString() : '';
  };

  /** 검증 실패 필드 테두리 클래스 (P2-14) */
  const fieldBorder = (field: string) =>
    errorField === field ? 'border-red-500 ring-2 ring-red-100' : 'border-gray-300';

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
          <BackButton className="-ml-2" />
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
        <BackButton className="-ml-2" />
        <h1 className="text-xl font-bold">{pageTitle}</h1>
      </div>

      <div className="space-y-5">
        {/* 재게시 시작일 보정 안내 */}
        {notice && (
          <div className="p-3 bg-accent-50 text-accent-600 text-sm rounded-lg">
            {notice}
          </div>
        )}

        {/* 임시저장 복원 안내 (P2-14) */}
        {draftRestored && (
          <div className="p-3 bg-primary-50 text-primary-600 text-sm rounded-lg flex items-center justify-between gap-2">
            <span>작성 중이던 내용을 불러왔어요.</span>
            <button
              type="button"
              onClick={clearDraft}
              className="flex-shrink-0 underline font-semibold min-h-[44px] px-1"
            >
              새로 쓰기
            </button>
          </div>
        )}

        {/* 제목 */}
        <div id="field-title">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            제목 <span className="text-red-500">*</span>
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); if (errorField === 'title') setErrorField(null); }}
            placeholder="예: 철근공 3명 급구"
            className={`w-full py-3 px-4 border ${fieldBorder('title')} rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm`}
          />
        </div>

        {/* 직종 선택 */}
        <div
          id="field-category"
          className={errorField === 'category' ? 'rounded-xl ring-2 ring-red-300 p-2 -m-2' : ''}
        >
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            직종 <span className="text-red-500">*</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {JOB_CATEGORIES.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => { setCategory(cat); if (errorField === 'category') setErrorField(null); }}
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
        <div id="field-wage">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            일당 (원) <span className="text-red-500">*</span>
          </label>
          {/* 일당 프리셋 (P2-14) — 자주 쓰는 값 원탭 입력 */}
          <div className="flex gap-2 mb-2">
            {WAGE_PRESETS.map((w) => (
              <button
                key={w}
                type="button"
                onClick={() => { setDailyWage(w.toLocaleString()); if (errorField === 'wage') setErrorField(null); }}
                className={`flex-1 min-h-[44px] rounded-lg text-sm font-bold transition-colors ${
                  dailyWage === w.toLocaleString()
                    ? 'bg-primary-500 text-white'
                    : 'bg-gray-100 text-gray-700 active:bg-gray-200'
                }`}
              >
                {w / 10000}만
              </button>
            ))}
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            value={dailyWage}
            onChange={(e) => { setDailyWage(formatWage(e.target.value)); if (errorField === 'wage') setErrorField(null); }}
            placeholder="예: 250,000"
            className={`w-full py-3 px-4 border ${fieldBorder('wage')} rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm`}
          />
          {/* 금액 확인 도움말 (0 개수 확인용 만원 환산) */}
          {dailyWage && (
            <p className="mt-1 text-sm text-gray-600">
              {formatWon(Number(dailyWage.replace(/,/g, '')))} ({formatManwon(Number(dailyWage.replace(/,/g, '')))})
            </p>
          )}
        </div>

        {/* 근무 위치 */}
        <div id="field-region">
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            근무 위치 <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-3 gap-2 mb-2">
            <select
              value={region}
              onChange={(e) => { setRegion(e.target.value); if (errorField === 'region') setErrorField(null); }}
              className={`col-span-1 py-3 px-3 border ${fieldBorder('region')} rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm bg-white`}
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
          <div id="field-startDate">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              시작일 <span className="text-red-500">*</span>
            </label>
            <input
              type="date"
              value={startDate}
              min={!isEditMode ? toDateInput(new Date()) : undefined}
              onChange={(e) => { setStartDate(e.target.value); if (errorField === 'startDate') setErrorField(null); }}
              className={`w-full py-3 px-4 border ${fieldBorder('startDate')} rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm`}
            />
          </div>
          <div id="field-endDate">
            <label className="block text-sm font-semibold text-gray-700 mb-1.5">
              종료일
            </label>
            <input
              type="date"
              value={endDate}
              min={startDate || undefined}
              onChange={(e) => { setEndDate(e.target.value); if (errorField === 'endDate') setErrorField(null); }}
              className={`w-full py-3 px-4 border ${fieldBorder('endDate')} rounded-xl focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm`}
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

        {/* 필요 인원 — 스테퍼 (P2-14) */}
        <div>
          <label className="block text-sm font-semibold text-gray-700 mb-1.5">
            필요 인원
          </label>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setNumberOfWorkers(String(Math.max(1, (Number(numberOfWorkers) || 1) - 1)))}
              disabled={(Number(numberOfWorkers) || 1) <= 1}
              className="w-12 h-12 rounded-xl bg-gray-100 text-2xl font-bold text-gray-700 flex items-center justify-center disabled:opacity-30 active:bg-gray-200 transition-colors"
              aria-label="인원 줄이기"
            >
              -
            </button>
            <div className="flex-1 text-center text-lg font-bold text-gray-800">
              {Number(numberOfWorkers) || 1}명
            </div>
            <button
              type="button"
              onClick={() => setNumberOfWorkers(String(Math.min(100, (Number(numberOfWorkers) || 1) + 1)))}
              disabled={(Number(numberOfWorkers) || 1) >= 100}
              className="w-12 h-12 rounded-xl bg-gray-100 text-2xl font-bold text-gray-700 flex items-center justify-center disabled:opacity-30 active:bg-gray-200 transition-colors"
              aria-label="인원 늘리기"
            >
              +
            </button>
          </div>
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

      {/* 등록/수정 성공 토스트 (P2-14) */}
      {toastElement}
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
