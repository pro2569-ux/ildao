'use client';

import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  saveDailyWork,
  deleteDailyWork,
  getMonthlyWorks,
  getWorksByDateRange,
  saveTeamMembers,
  getTeamMembers,
  saveTeamDailyWork,
  deleteTeamDailyWork,
  getTeamMonthlyWorks,
  updateUserProfile,
} from '@/lib/firestore';
import { DailyWorkRecord, WeatherType, TeamMember, TeamDailyWork } from '@/types';
import { formatManwon } from '@/lib/format';
import ConfirmSheet from '@/components/ui/ConfirmSheet';
import { useToast } from '@/components/ui/Toast';

// ===== 상수 정의 =====

/** 탭 타입 */
type TabMode = 'personal' | 'team';

/** 요일 한글 라벨 */
const DAY_LABELS = ['일', '월', '화', '수', '목', '금', '토'];

/** 날씨 아이콘 매핑 */
const WEATHER_OPTIONS: { type: WeatherType; icon: string; label: string }[] = [
  { type: 'sunny', icon: '☀️', label: '맑음' },
  { type: 'cloudy', icon: '☁️', label: '흐림' },
  { type: 'rainy', icon: '🌧️', label: '비' },
  { type: 'snowy', icon: '❄️', label: '눈' },
  { type: 'windy', icon: '💨', label: '바람' },
  { type: 'none', icon: '➖', label: '없음' },
];

// ===== 유틸리티 함수 =====

/** 해당 월의 일수 반환 */
function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

/** 해당 월 1일의 요일 (0=일, 6=토) */
function getFirstDayOfMonth(year: number, month: number): number {
  return new Date(year, month - 1, 1).getDay();
}

/** 날짜를 YYYY-MM-DD 형식으로 변환 */
function formatDateKey(year: number, month: number, day: number): string {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

/** 숫자를 한국 원화 형식으로 포맷 */
function formatWon(amount: number): string {
  return amount.toLocaleString('ko-KR') + '원';
}

// ===== 메인 컴포넌트 =====

/**
 * 공수 계산기 페이지
 * - 개인용: 개인 공수 기록 및 급여 계산
 * - 팀장용: 팀원 공수 관리 및 팀 총합 계산
 */
export default function CalculatorPage() {
  const { user, userProfile, loading: authLoading, refreshProfile } = useAuth();

  // ===== 공통 상태 =====
  const [activeTab, setActiveTab] = useState<TabMode>('personal');
  const [currentYear, setCurrentYear] = useState(() => new Date().getFullYear());
  const [currentMonth, setCurrentMonth] = useState(() => new Date().getMonth() + 1);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // ===== 개인용 상태 =====
  const [monthlyRecords, setMonthlyRecords] = useState<Map<string, DailyWorkRecord>>(new Map());
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [dailyWageInput, setDailyWageInput] = useState<number>(0);

  // 일별 입력 모달 상태
  const [editManDay, setEditManDay] = useState(0);
  const [editOvertime, setEditOvertime] = useState(false);
  const [editDayOff, setEditDayOff] = useState(false);
  const [editExtension, setEditExtension] = useState(false);
  const [editExpense, setEditExpense] = useState(0);
  const [editMemo, setEditMemo] = useState('');
  const [editWeather, setEditWeather] = useState<WeatherType>('none');
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // 기록 삭제 확인 시트 상태 (P2-8) — 개인용/팀원용 모달 공용
  const [deleteTarget, setDeleteTarget] = useState<'personal' | 'team' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // 저장/삭제 성공 피드백 토스트 (P2-8)
  const { showToast, toastElement } = useToast();

  // 기간 조회 상태
  const [periodStart, setPeriodStart] = useState('');
  const [periodEnd, setPeriodEnd] = useState('');
  const [periodRecords, setPeriodRecords] = useState<DailyWorkRecord[] | null>(null);

  // ===== 팀장용 상태 =====
  const [teamMembers, setTeamMembers] = useState<TeamMember[]>([]);
  const [teamWorks, setTeamWorks] = useState<TeamDailyWork[]>([]);
  const [selectedMember, setSelectedMember] = useState<TeamMember | null>(null);
  const [showAddMember, setShowAddMember] = useState(false);
  const [newMemberName, setNewMemberName] = useState('');
  const [newMemberPhone, setNewMemberPhone] = useState('');
  const [newMemberWage, setNewMemberWage] = useState(0);

  // 팀원용 일별 입력 모달 상태
  const [teamSelectedDate, setTeamSelectedDate] = useState<string | null>(null);
  const [teamEditManDay, setTeamEditManDay] = useState(0);
  const [teamEditOvertime, setTeamEditOvertime] = useState(false);
  const [teamEditDayOff, setTeamEditDayOff] = useState(false);
  const [teamEditExtension, setTeamEditExtension] = useState(false);
  const [teamEditMemo, setTeamEditMemo] = useState('');

  // ===== 초기 데이터 로드 =====

  /** 일당 초기값 설정 (사용자 프로필에서) */
  useEffect(() => {
    if (userProfile?.desiredWage) {
      setDailyWageInput(userProfile.desiredWage);
    }
  }, [userProfile]);

  /** 개인 월별 공수 로드 */
  const loadPersonalMonthly = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const records = await getMonthlyWorks(user.uid, currentYear, currentMonth);
      const map = new Map<string, DailyWorkRecord>();
      records.forEach((r) => map.set(r.date, r));
      setMonthlyRecords(map);
    } catch (err: any) {
      console.error('월별 공수 로드 실패:', err);
      setError('데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [user, currentYear, currentMonth]);

  /** 팀 데이터 로드 */
  const loadTeamData = useCallback(async () => {
    if (!user) return;
    setIsLoading(true);
    setError(null);
    try {
      const [members, works] = await Promise.all([
        getTeamMembers(user.uid),
        getTeamMonthlyWorks(user.uid, currentYear, currentMonth),
      ]);
      setTeamMembers(members);
      setTeamWorks(works);
    } catch (err: any) {
      console.error('팀 데이터 로드 실패:', err);
      setError('팀 데이터를 불러오는 중 오류가 발생했습니다.');
    } finally {
      setIsLoading(false);
    }
  }, [user, currentYear, currentMonth]);

  /** 탭/월 변경 시 데이터 로드 */
  useEffect(() => {
    if (!user) return;
    if (activeTab === 'personal') {
      loadPersonalMonthly();
    } else {
      loadTeamData();
    }
  }, [activeTab, currentYear, currentMonth, user, loadPersonalMonthly, loadTeamData]);

  // ===== 월 네비게이션 =====

  const goToPrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const goToNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  // ===== 캘린더 데이터 계산 =====

  const calendarDays = useMemo(() => {
    const daysInMonth = getDaysInMonth(currentYear, currentMonth);
    const firstDay = getFirstDayOfMonth(currentYear, currentMonth);
    const days: (number | null)[] = [];

    // 첫 주 빈칸 채우기
    for (let i = 0; i < firstDay; i++) {
      days.push(null);
    }
    // 날짜 채우기
    for (let d = 1; d <= daysInMonth; d++) {
      days.push(d);
    }
    return days;
  }, [currentYear, currentMonth]);

  // ===== 공수 셀 색상 (개인용) =====

  const getCellColor = (dateKey: string): string => {
    const record = monthlyRecords.get(dateKey);
    if (!record || record.manDay === 0) return 'bg-gray-50';
    if (record.manDay <= 0.5) return 'bg-yellow-100';
    if (record.manDay <= 1.0) return 'bg-green-100';
    return 'bg-blue-100';
  };

  // ===== 팀원 공수 셀 색상 =====

  const getTeamCellColor = (memberId: string, dateKey: string): string => {
    const record = teamWorks.find((w) => w.memberId === memberId && w.date === dateKey);
    if (!record || record.manDay === 0) return 'bg-gray-50';
    if (record.manDay <= 0.5) return 'bg-yellow-100';
    if (record.manDay <= 1.0) return 'bg-green-100';
    return 'bg-blue-100';
  };

  // ===== 개인용: 날짜 클릭 → 모달 열기 =====

  /** 기존 기록이 있으면 프리필, 없으면 기본값 초기화 */
  const prefillEditFields = (existing?: DailyWorkRecord) => {
    if (existing) {
      setEditManDay(existing.manDay);
      setEditOvertime(existing.overtime);
      setEditDayOff(existing.dayOff);
      setEditExtension(existing.extension);
      setEditExpense(existing.expense);
      setEditMemo(existing.memo);
      setEditWeather(existing.weather);
    } else {
      // 기본값 초기화
      setEditManDay(0);
      setEditOvertime(false);
      setEditDayOff(false);
      setEditExtension(false);
      setEditExpense(0);
      setEditMemo('');
      setEditWeather('none');
    }
  };

  const openDayModal = (day: number) => {
    const dateKey = formatDateKey(currentYear, currentMonth, day);
    setSelectedDate(dateKey);
    setSaveError(null);
    prefillEditFields(monthlyRecords.get(dateKey));
  };

  // ===== 개인용: 오늘 기록하기 원탭 (P2-7) =====

  /** 캘린더에서 오늘을 찾지 않고 바로 오늘 날짜 모달을 연다 ("퇴근 후 30초 기록") */
  const openTodayModal = async () => {
    if (!user) return;
    const now = new Date();
    const y = now.getFullYear();
    const m = now.getMonth() + 1;
    const dateKey = formatDateKey(y, m, now.getDate());
    const sameMonth = y === currentYear && m === currentMonth;

    // 다른 달을 보던 중이면 오늘이 속한 달로 이동
    if (!sameMonth) {
      setCurrentYear(y);
      setCurrentMonth(m);
    }

    let existing = sameMonth ? monthlyRecords.get(dateKey) : undefined;
    if (!sameMonth) {
      // 보던 달 데이터에는 오늘이 없으므로 단건 조회로 기존 기록 프리필 (기본값 저장으로 덮어쓰는 사고 방지)
      try {
        const records = await getWorksByDateRange(user.uid, dateKey, dateKey);
        existing = records[0];
      } catch (error) {
        console.error('오늘 기록 조회 실패:', error);
      }
    }

    setSelectedDate(dateKey);
    setSaveError(null);
    prefillEditFields(existing);
  };

  const closeDayModal = () => {
    setSelectedDate(null);
    setSaveError(null);
  };

  // ===== 개인용: 공수 저장 =====

  const handleSavePersonal = async () => {
    if (!user || !selectedDate) return;
    setIsSaving(true);
    try {
      await saveDailyWork(user.uid, selectedDate, {
        manDay: editManDay,
        overtime: editOvertime,
        dayOff: editDayOff,
        extension: editExtension,
        expense: editExpense,
        memo: editMemo,
        weather: editWeather,
        dailyWage: dailyWageInput,
      });
      // 로컬 상태 업데이트
      setMonthlyRecords((prev) => {
        const next = new Map(prev);
        next.set(selectedDate, {
          userId: user.uid,
          date: selectedDate,
          manDay: editManDay,
          overtime: editOvertime,
          dayOff: editDayOff,
          extension: editExtension,
          expense: editExpense,
          memo: editMemo,
          weather: editWeather,
          dailyWage: dailyWageInput,
        });
        return next;
      });
      closeDayModal();
      showToast('공수를 저장했어요');
    } catch (err) {
      console.error('공수 저장 실패:', err);
      setSaveError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  // ===== 개인용: 기록 삭제 (P2-8) =====

  const handleDeletePersonal = async () => {
    if (!user || !selectedDate) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteDailyWork(user.uid, selectedDate);
      setMonthlyRecords((prev) => {
        const next = new Map(prev);
        next.delete(selectedDate);
        return next;
      });
      setDeleteTarget(null);
      closeDayModal();
      showToast('기록을 삭제했어요');
    } catch (err) {
      console.error('기록 삭제 실패:', err);
      setDeleteError('삭제에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ===== 개인용: 월간 요약 계산 =====

  const personalSummary = useMemo(() => {
    let totalManDay = 0;
    let overtimeCount = 0;
    let dayOffCount = 0;
    let extensionCount = 0;
    let totalExpense = 0;
    let estimatedWage = 0;
    // 기록별 일당이 현재 일당과 다른 날이 하나라도 있으면 "X공 × 일당" 공식 표기가 성립하지 않음
    let usesRecordWage = false;

    monthlyRecords.forEach((record) => {
      totalManDay += record.manDay;
      if (record.overtime) overtimeCount++;
      if (record.dayOff) dayOffCount++;
      if (record.extension) extensionCount++;
      totalExpense += record.expense || 0;
      // Σ(공수 × 그날 일당) — 일당 미저장(옛 기록·0)이면 현재 일당으로 대체 (P2-9)
      const wage = record.dailyWage || dailyWageInput;
      estimatedWage += record.manDay * wage;
      if (record.manDay > 0 && record.dailyWage && record.dailyWage !== dailyWageInput) {
        usesRecordWage = true;
      }
    });

    return { totalManDay, overtimeCount, dayOffCount, extensionCount, totalExpense, estimatedWage, usesRecordWage };
  }, [monthlyRecords, dailyWageInput]);

  // ===== 개인용: 일당 수정 시 프로필 자동 저장 (P2-9) =====

  const handleWageBlur = async () => {
    if (!user || !userProfile) return;
    // 값이 실제로 바뀐 경우에만 저장 (매 blur마다 쓰기 방지)
    if (dailyWageInput > 0 && dailyWageInput !== (userProfile.desiredWage || 0)) {
      try {
        await updateUserProfile(user.uid, { desiredWage: dailyWageInput });
        await refreshProfile();
        showToast('일당을 프로필에 저장했어요');
      } catch (err) {
        console.error('일당 프로필 저장 실패:', err);
        // 저장 실패해도 계산기 사용에는 지장 없으므로 조용히 넘어감
      }
    }
  };

  // ===== 기간 합계 조회 =====

  const handlePeriodQuery = async () => {
    if (!user || !periodStart || !periodEnd) return;
    setIsLoading(true);
    try {
      const records = await getWorksByDateRange(user.uid, periodStart, periodEnd);
      setPeriodRecords(records);
    } catch (err) {
      console.error('기간 조회 실패:', err);
      setError('기간 조회에 실패했습니다.');
    } finally {
      setIsLoading(false);
    }
  };

  const periodSummary = useMemo(() => {
    if (!periodRecords) return null;
    let totalManDay = 0;
    let totalExpense = 0;
    let estimatedWage = 0;
    periodRecords.forEach((r) => {
      totalManDay += r.manDay;
      totalExpense += r.expense || 0;
      // Σ(공수 × 그날 일당) — 일당 미저장 기록은 현재 일당으로 대체 (P2-9)
      estimatedWage += r.manDay * (r.dailyWage || dailyWageInput);
    });
    return { totalManDay, totalExpense, estimatedWage };
  }, [periodRecords, dailyWageInput]);

  // ===== 팀장용: 팀원 추가 =====

  const handleAddMember = async () => {
    if (!user || !newMemberName.trim()) return;
    const newMember: TeamMember = {
      id: Date.now().toString(),
      name: newMemberName.trim(),
      phone: newMemberPhone.trim() || undefined,
      dailyWage: newMemberWage || undefined,
    };
    const updatedMembers = [...teamMembers, newMember];
    try {
      await saveTeamMembers(user.uid, updatedMembers);
      setTeamMembers(updatedMembers);
      setNewMemberName('');
      setNewMemberPhone('');
      setNewMemberWage(0);
      setShowAddMember(false);
    } catch (err) {
      console.error('팀원 추가 실패:', err);
      setError('팀원 추가에 실패했습니다.');
    }
  };

  // ===== 팀장용: 팀원 삭제 =====

  const handleDeleteMember = async (memberId: string) => {
    if (!user) return;
    const updatedMembers = teamMembers.filter((m) => m.id !== memberId);
    try {
      await saveTeamMembers(user.uid, updatedMembers);
      setTeamMembers(updatedMembers);
      if (selectedMember?.id === memberId) {
        setSelectedMember(null);
      }
    } catch (err) {
      console.error('팀원 삭제 실패:', err);
      setError('팀원 삭제에 실패했습니다.');
    }
  };

  // ===== 팀장용: 팀원별 월간 공수 합계 =====

  const getMemberMonthlyTotal = (memberId: string): number => {
    return teamWorks
      .filter((w) => w.memberId === memberId)
      .reduce((sum, w) => sum + w.manDay, 0);
  };

  // ===== 팀장용: 팀원 캘린더에서 날짜 클릭 =====

  const openTeamDayModal = (day: number) => {
    if (!selectedMember) return;
    const dateKey = formatDateKey(currentYear, currentMonth, day);
    setTeamSelectedDate(dateKey);
    setSaveError(null);

    const existing = teamWorks.find(
      (w) => w.memberId === selectedMember.id && w.date === dateKey
    );
    if (existing) {
      setTeamEditManDay(existing.manDay);
      setTeamEditOvertime(existing.overtime);
      setTeamEditDayOff(existing.dayOff);
      setTeamEditExtension(existing.extension);
      setTeamEditMemo(existing.memo);
    } else {
      setTeamEditManDay(0);
      setTeamEditOvertime(false);
      setTeamEditDayOff(false);
      setTeamEditExtension(false);
      setTeamEditMemo('');
    }
  };

  const closeTeamDayModal = () => {
    setTeamSelectedDate(null);
    setSaveError(null);
  };

  // ===== 팀장용: 팀원 공수 저장 =====

  const handleSaveTeamWork = async () => {
    if (!user || !selectedMember || !teamSelectedDate) return;
    setIsSaving(true);
    try {
      await saveTeamDailyWork(user.uid, selectedMember.id, teamSelectedDate, {
        memberName: selectedMember.name,
        manDay: teamEditManDay,
        overtime: teamEditOvertime,
        dayOff: teamEditDayOff,
        extension: teamEditExtension,
        memo: teamEditMemo,
      });
      // 로컬 상태 업데이트
      setTeamWorks((prev) => {
        const idx = prev.findIndex(
          (w) => w.memberId === selectedMember.id && w.date === teamSelectedDate
        );
        const newRecord: TeamDailyWork = {
          teamLeaderId: user.uid,
          memberId: selectedMember.id,
          memberName: selectedMember.name,
          date: teamSelectedDate,
          manDay: teamEditManDay,
          overtime: teamEditOvertime,
          dayOff: teamEditDayOff,
          extension: teamEditExtension,
          memo: teamEditMemo,
        };
        if (idx >= 0) {
          const next = [...prev];
          next[idx] = newRecord;
          return next;
        }
        return [...prev, newRecord];
      });
      closeTeamDayModal();
      showToast(`${selectedMember.name}님 공수를 저장했어요`);
    } catch (err) {
      console.error('팀원 공수 저장 실패:', err);
      setSaveError('저장에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsSaving(false);
    }
  };

  // ===== 팀장용: 팀원 기록 삭제 (P2-8) =====

  const handleDeleteTeamWork = async () => {
    if (!user || !selectedMember || !teamSelectedDate) return;
    setIsDeleting(true);
    setDeleteError(null);
    try {
      await deleteTeamDailyWork(user.uid, selectedMember.id, teamSelectedDate);
      setTeamWorks((prev) =>
        prev.filter(
          (w) => !(w.memberId === selectedMember.id && w.date === teamSelectedDate)
        )
      );
      setDeleteTarget(null);
      closeTeamDayModal();
      showToast('기록을 삭제했어요');
    } catch (err) {
      console.error('팀원 기록 삭제 실패:', err);
      setDeleteError('삭제에 실패했습니다. 다시 시도해주세요.');
    } finally {
      setIsDeleting(false);
    }
  };

  // ===== 팀 전체 요약 =====

  const teamSummary = useMemo(() => {
    let totalManDay = 0;
    let totalWage = 0;

    teamMembers.forEach((member) => {
      const memberTotal = teamWorks
        .filter((w) => w.memberId === member.id)
        .reduce((sum, w) => sum + w.manDay, 0);
      totalManDay += memberTotal;
      totalWage += memberTotal * (member.dailyWage || 0);
    });

    return { totalManDay, totalWage };
  }, [teamMembers, teamWorks]);

  // ===== 로딩 & 비로그인 처리 =====

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-500" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="px-4 pt-6 pb-24 text-center">
        <h1 className="text-xl font-bold mb-4">공수 계산기</h1>
        <p className="text-gray-500 mb-4">로그인 후 이용할 수 있습니다.</p>
      </div>
    );
  }

  // ===== 공통 캘린더 렌더링 =====

  /** 오늘 날짜 (현재 보고 있는 연/월에 속할 때만 강조) */
  const today = new Date();
  const todayDay =
    today.getFullYear() === currentYear && today.getMonth() + 1 === currentMonth
      ? today.getDate()
      : null;

  /** 캘린더 그리드 (개인용 또는 팀원용) */
  const renderCalendar = (
    mode: 'personal' | 'teamMember',
    onDayClick: (day: number) => void
  ) => (
    <div className="card mb-4">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 gap-1 mb-2">
        {DAY_LABELS.map((label, i) => (
          <div
            key={label}
            className={`text-center text-xs font-medium py-1 ${
              i === 0 ? 'text-red-500' : i === 6 ? 'text-blue-500' : 'text-gray-500'
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 날짜 그리드 */}
      <div className="grid grid-cols-7 gap-1">
        {calendarDays.map((day, idx) => {
          if (day === null) {
            return <div key={`empty-${idx}`} className="aspect-square" />;
          }

          const dateKey = formatDateKey(currentYear, currentMonth, day);
          const dayOfWeek = new Date(currentYear, currentMonth - 1, day).getDay();

          // 셀 색상 결정
          let cellBg: string;
          let manDayValue: number | undefined;

          if (mode === 'personal') {
            cellBg = getCellColor(dateKey);
            manDayValue = monthlyRecords.get(dateKey)?.manDay;
          } else {
            cellBg = selectedMember ? getTeamCellColor(selectedMember.id, dateKey) : 'bg-gray-50';
            const tw = teamWorks.find(
              (w) => w.memberId === selectedMember?.id && w.date === dateKey
            );
            manDayValue = tw?.manDay;
          }

          const isToday = day === todayDay;

          return (
            <button
              key={dateKey}
              onClick={() => onDayClick(day)}
              className={`aspect-square rounded-lg flex flex-col items-center justify-center text-sm transition-colors ${cellBg} hover:ring-2 hover:ring-primary-500 ${
                isToday ? 'ring-2 ring-primary-500' : ''
              }`}
            >
              <span
                className={`text-xs ${isToday ? 'font-bold' : ''} ${
                  dayOfWeek === 0 ? 'text-red-500' : dayOfWeek === 6 ? 'text-blue-500' : 'text-gray-700'
                }`}
              >
                {day}
              </span>
              {manDayValue !== undefined && manDayValue > 0 && (
                <span className="text-sm font-bold text-gray-700">{manDayValue}</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );

  // ===== 공수 스테퍼 렌더링 =====

  const renderManDayStepper = (
    value: number,
    setValue: (v: number) => void
  ) => (
    <>
      {/* 공수 프리셋 버튼 (자주 쓰는 값 바로 입력) */}
      <div className="flex gap-2 mt-4">
        {[0.5, 1.0, 1.5].map((preset) => (
          <button
            key={preset}
            onClick={() => setValue(preset)}
            className={`flex-1 py-3 rounded-lg text-base font-bold transition-colors ${
              value === preset
                ? 'bg-primary-500 text-white'
                : 'bg-gray-100 text-gray-700 active:bg-gray-200'
            }`}
          >
            {preset.toFixed(1)}공
          </button>
        ))}
      </div>

      <div className="flex items-center justify-center gap-4 my-4">
        <button
          onClick={() => setValue(Math.max(0, Math.round((value - 0.1) * 10) / 10))}
          disabled={value <= 0}
          className="w-14 h-14 rounded-full bg-gray-100 text-2xl font-bold text-gray-700 flex items-center justify-center disabled:opacity-30 active:bg-gray-200 transition-colors"
        >
          -
        </button>
        <div className="text-center">
          <div className="text-5xl font-extrabold text-primary-500 tabular-nums min-w-[100px]">
            {value.toFixed(1)}
          </div>
          <div className="text-xs text-gray-400 mt-1">공수</div>
        </div>
        <button
          onClick={() => setValue(Math.min(2.0, Math.round((value + 0.1) * 10) / 10))}
          disabled={value >= 2.0}
          className="w-14 h-14 rounded-full bg-gray-100 text-2xl font-bold text-gray-700 flex items-center justify-center disabled:opacity-30 active:bg-gray-200 transition-colors"
        >
          +
        </button>
      </div>
    </>
  );

  // ===== 토글 버튼 렌더링 =====

  const renderTogglePills = (
    overtime: boolean,
    setOvertime: (v: boolean) => void,
    dayOff: boolean,
    setDayOff: (v: boolean) => void,
    extension: boolean,
    setExtension: (v: boolean) => void
  ) => (
    <>
      <div className="flex gap-2 justify-center mb-4">
      <button
        onClick={() => setOvertime(!overtime)}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          overtime
            ? 'bg-accent-500 text-white'
            : 'bg-gray-100 text-gray-600'
        }`}
      >
        잔업
      </button>
      <button
        onClick={() => setDayOff(!dayOff)}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          dayOff
            ? 'bg-accent-500 text-white'
            : 'bg-gray-100 text-gray-600'
        }`}
      >
        휴무
      </button>
      <button
        onClick={() => setExtension(!extension)}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          extension
            ? 'bg-accent-500 text-white'
            : 'bg-gray-100 text-gray-600'
        }`}
      >
        연장
      </button>
      </div>
      {/* 잔업/연장은 급여 자동 반영이 아닌 표시용임을 안내 (P2-9) */}
      {(overtime || extension) && (
        <p className="text-sm text-gray-500 text-center -mt-2 mb-4">
          잔업·연장은 표시용이에요. 급여에 넣으려면 공수를 조정해 주세요.
        </p>
      )}
    </>
  );

  // ===== 개인용 일별 입력 모달 =====

  const renderPersonalDayModal = () => {
    if (!selectedDate) return null;

    // 날짜 표시용 파싱
    const [, m, d] = selectedDate.split('-');
    const dateObj = new Date(selectedDate + 'T00:00:00');
    const dayLabel = DAY_LABELS[dateObj.getDay()];
    // 저장된 기록이 있는 날만 삭제 버튼 표시 (P2-8)
    const hasRecord = monthlyRecords.has(selectedDate);

    return (
      <>
        {/* 배경 오버레이 — 저장 중에는 탭해도 닫히지 않음 (P2-8) */}
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={isSaving ? undefined : closeDayModal}
        />

        {/* 바텀시트 모달 */}
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
          <div className="max-w-lg mx-auto px-4 pt-4 pb-8">
            {/* 핸들 바 */}
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            {/* 날짜 헤더 */}
            <h3 className="text-lg font-bold text-center mb-2">
              {parseInt(m)}월 {parseInt(d)}일 ({dayLabel})
            </h3>

            {/* 공수 스테퍼 (가장 중요한 컨트롤 - 크게 표시) — 공수 입력 시 휴무 해제 (모순 방지, P2-9) */}
            {renderManDayStepper(editManDay, (v) => {
              setEditManDay(v);
              if (v > 0) setEditDayOff(false);
            })}

            {/* 잔업/휴무/연장 토글 — 휴무 선택 시 공수 0 (모순 방지, P2-9) */}
            {renderTogglePills(
              editOvertime, setEditOvertime,
              editDayOff, (v) => {
                setEditDayOff(v);
                if (v) setEditManDay(0);
              },
              editExtension, setEditExtension
            )}

            {/* 경비 입력 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">경비</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₩</span>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={editExpense || ''}
                  onChange={(e) => setEditExpense(Number(e.target.value) || 0)}
                  placeholder="0"
                  className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {/* 금액 확인 도움말 (0 개수 확인용 만원 환산) */}
              {editExpense > 0 && (
                <p className="mt-1 text-sm text-gray-600">
                  {formatWon(editExpense)}
                  {editExpense >= 10000 && ` (${formatManwon(editExpense)})`}
                </p>
              )}
            </div>

            {/* 메모 입력 */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-1">메모</label>
              <input
                type="text"
                value={editMemo}
                onChange={(e) => setEditMemo(e.target.value)}
                placeholder="현장명, 특이사항 등"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* 날씨 선택 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-600 mb-2">날씨</label>
              <div className="flex gap-2 justify-center">
                {WEATHER_OPTIONS.map((w) => (
                  <button
                    key={w.type}
                    onClick={() => setEditWeather(w.type)}
                    className={`flex flex-col items-center px-2.5 py-1.5 rounded-lg text-xs transition-colors ${
                      editWeather === w.type
                        ? 'bg-primary-50 ring-2 ring-primary-500'
                        : 'bg-gray-50'
                    }`}
                  >
                    <span className="text-lg">{w.icon}</span>
                    <span className="text-gray-500 mt-0.5">{w.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* 저장 실패 에러 메시지 */}
            {saveError && (
              <p className="text-sm text-red-500 text-center mb-3">{saveError}</p>
            )}

            {/* 취소/저장 버튼 (P2-8: 배경 탭 없이도 닫을 수 있게) */}
            <div className="flex gap-3">
              <button
                onClick={closeDayModal}
                disabled={isSaving}
                className="flex-1 min-h-[48px] py-3 bg-gray-100 text-gray-700 text-base font-bold rounded-lg disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleSavePersonal}
                disabled={isSaving}
                className="btn-primary flex-[2] py-3 text-base font-bold disabled:opacity-50"
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>

            {/* 기록 삭제 (P2-8) — 저장된 기록이 있는 날만 */}
            {hasRecord && (
              <button
                onClick={() => setDeleteTarget('personal')}
                disabled={isSaving}
                className="w-full min-h-[44px] mt-2 text-red-500 text-base font-medium disabled:opacity-50"
              >
                이 날 기록 삭제
              </button>
            )}
          </div>
        </div>
      </>
    );
  };

  // ===== 팀원 일별 입력 모달 =====

  const renderTeamDayModal = () => {
    if (!teamSelectedDate || !selectedMember) return null;

    const [, m, d] = teamSelectedDate.split('-');
    const dateObj = new Date(teamSelectedDate + 'T00:00:00');
    const dayLabel = DAY_LABELS[dateObj.getDay()];
    // 저장된 기록이 있는 날만 삭제 버튼 표시 (P2-8)
    const hasRecord = teamWorks.some(
      (w) => w.memberId === selectedMember.id && w.date === teamSelectedDate
    );

    return (
      <>
        {/* 배경 오버레이 — 저장 중에는 탭해도 닫히지 않음 (P2-8) */}
        <div
          className="fixed inset-0 bg-black/40 z-40"
          onClick={isSaving ? undefined : closeTeamDayModal}
        />
        <div className="fixed bottom-0 left-0 right-0 z-50 bg-white rounded-t-2xl max-h-[85vh] overflow-y-auto animate-slide-up">
          <div className="max-w-lg mx-auto px-4 pt-4 pb-8">
            <div className="flex justify-center mb-3">
              <div className="w-10 h-1 bg-gray-300 rounded-full" />
            </div>

            <h3 className="text-lg font-bold text-center mb-1">
              {selectedMember.name}
            </h3>
            <p className="text-sm text-gray-400 text-center mb-2">
              {parseInt(m)}월 {parseInt(d)}일 ({dayLabel})
            </p>

            {/* 공수 스테퍼 — 공수 입력 시 휴무 해제 (모순 방지, P2-9) */}
            {renderManDayStepper(teamEditManDay, (v) => {
              setTeamEditManDay(v);
              if (v > 0) setTeamEditDayOff(false);
            })}

            {/* 토글 — 휴무 선택 시 공수 0 (모순 방지, P2-9) */}
            {renderTogglePills(
              teamEditOvertime, setTeamEditOvertime,
              teamEditDayOff, (v) => {
                setTeamEditDayOff(v);
                if (v) setTeamEditManDay(0);
              },
              teamEditExtension, setTeamEditExtension
            )}

            {/* 메모 */}
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-600 mb-1">메모</label>
              <input
                type="text"
                value={teamEditMemo}
                onChange={(e) => setTeamEditMemo(e.target.value)}
                placeholder="비고"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>

            {/* 저장 실패 에러 메시지 */}
            {saveError && (
              <p className="text-sm text-red-500 text-center mb-3">{saveError}</p>
            )}

            {/* 취소/저장 버튼 (P2-8) */}
            <div className="flex gap-3">
              <button
                onClick={closeTeamDayModal}
                disabled={isSaving}
                className="flex-1 min-h-[48px] py-3 bg-gray-100 text-gray-700 text-base font-bold rounded-lg disabled:opacity-50"
              >
                취소
              </button>
              <button
                onClick={handleSaveTeamWork}
                disabled={isSaving}
                className="btn-primary flex-[2] py-3 text-base font-bold disabled:opacity-50"
              >
                {isSaving ? '저장 중...' : '저장'}
              </button>
            </div>

            {/* 기록 삭제 (P2-8) — 저장된 기록이 있는 날만 */}
            {hasRecord && (
              <button
                onClick={() => setDeleteTarget('team')}
                disabled={isSaving}
                className="w-full min-h-[44px] mt-2 text-red-500 text-base font-medium disabled:opacity-50"
              >
                이 날 기록 삭제
              </button>
            )}
          </div>
        </div>
      </>
    );
  };

  // ===== 메인 렌더 =====

  return (
    <div className="px-4 pt-6 pb-24 max-w-lg mx-auto">
      {/* 페이지 타이틀 */}
      <h1 className="text-xl font-bold mb-4">공수 계산기</h1>

      {/* ===== 상단 탭 (개인용 / 팀장용) ===== */}
      <div className="flex bg-gray-100 rounded-xl p-1 mb-4">
        <button
          onClick={() => setActiveTab('personal')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'personal'
              ? 'bg-white text-primary-500 shadow-sm'
              : 'text-gray-500'
          }`}
        >
          개인용
        </button>
        <button
          onClick={() => setActiveTab('team')}
          className={`flex-1 py-2.5 rounded-lg text-sm font-semibold transition-colors ${
            activeTab === 'team'
              ? 'bg-white text-primary-500 shadow-sm'
              : 'text-gray-500'
          }`}
        >
          팀장용
        </button>
      </div>

      {/* ===== 월 네비게이션 ===== */}
      <div className="flex items-center justify-between mb-4">
        <button
          onClick={goToPrevMonth}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
        >
          &lsaquo;
        </button>
        <h2 className="text-lg font-bold">
          {currentYear}년 {currentMonth}월
        </h2>
        <button
          onClick={goToNextMonth}
          className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center text-gray-600 hover:bg-gray-200 transition-colors"
        >
          &rsaquo;
        </button>
      </div>

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 text-red-600 text-sm px-4 py-3 rounded-lg mb-4">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">닫기</button>
        </div>
      )}

      {/* 로딩 표시 */}
      {isLoading && (
        <div className="flex justify-center py-8">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary-500" />
        </div>
      )}

      {/* ===== 개인용 모드 ===== */}
      {activeTab === 'personal' && !isLoading && (
        <>
          {/* 오늘 기록하기 원탭 버튼 (P2-7) */}
          <button
            onClick={openTodayModal}
            className="w-full min-h-[56px] mb-4 bg-accent-500 hover:bg-accent-600 active:bg-accent-600 text-white text-lg font-bold rounded-xl flex items-center justify-center gap-2 shadow-sm"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            오늘 기록하기
            <span className="text-base font-semibold text-orange-100">
              {new Date().getMonth() + 1}월 {new Date().getDate()}일
            </span>
          </button>

          {/* 캘린더 그리드 */}
          {renderCalendar('personal', openDayModal)}

          {/* 월간 요약 카드 */}
          <div className="card mb-4">
            <h3 className="text-base font-bold mb-3">월간 요약</h3>

            <div className="grid grid-cols-2 gap-3 mb-4">
              <div className="bg-blue-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-extrabold text-primary-500">
                  {personalSummary.totalManDay.toFixed(1)}
                </div>
                <div className="text-xs text-gray-500 mt-1">총 공수</div>
              </div>
              <div className="bg-orange-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-extrabold text-accent-500">
                  {personalSummary.overtimeCount}
                </div>
                <div className="text-xs text-gray-500 mt-1">잔업 일수</div>
              </div>
              <div className="bg-gray-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-extrabold text-gray-600">
                  {personalSummary.dayOffCount}
                </div>
                <div className="text-xs text-gray-500 mt-1">휴무 일수</div>
              </div>
              <div className="bg-green-50 rounded-lg p-3 text-center">
                <div className="text-2xl font-extrabold text-green-600">
                  {personalSummary.extensionCount}
                </div>
                <div className="text-xs text-gray-500 mt-1">연장 일수</div>
              </div>
            </div>

            {/* 일당 입력 */}
            <div className="mb-3">
              <label className="block text-sm font-medium text-gray-600 mb-1">일당</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₩</span>
                <input
                  type="number"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  value={dailyWageInput || ''}
                  onChange={(e) => setDailyWageInput(Number(e.target.value) || 0)}
                  onBlur={handleWageBlur}
                  placeholder="일당을 입력하세요"
                  className="w-full pl-8 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {/* 금액 확인 도움말 (0 개수 확인용 만원 환산) */}
              {dailyWageInput > 0 && (
                <p className="mt-1 text-sm text-gray-600">
                  {formatWon(dailyWageInput)}
                  {dailyWageInput >= 10000 && ` (${formatManwon(dailyWageInput)})`}
                </p>
              )}
            </div>

            {/* 예상 급여 (눈에 띄게 표시) */}
            <div className="bg-primary-50 rounded-lg p-4 text-center">
              <div className="text-xs text-gray-500 mb-1">예상 급여</div>
              <div className="text-2xl font-extrabold text-primary-500">
                {formatWon(personalSummary.estimatedWage)}
              </div>
              <div className="text-sm text-gray-500 mt-1">
                {personalSummary.usesRecordWage
                  ? '기록한 날의 일당으로 각각 계산했어요'
                  : `${personalSummary.totalManDay.toFixed(1)}공 × ${formatWon(dailyWageInput)}`}
              </div>
              <div className="text-sm text-gray-600 mt-2">
                3.3% 공제 후: {formatWon(Math.round(personalSummary.estimatedWage * 0.967))}
              </div>
              {/* 잔업/연장은 표시용 — 급여 자동 반영 안 됨 안내 (P2-9) */}
              {(personalSummary.overtimeCount > 0 || personalSummary.extensionCount > 0) && (
                <div className="text-sm text-gray-500 mt-2">
                  잔업·연장 표시는 급여에 자동 반영되지 않아요. 그날 공수로 조정해 주세요.
                </div>
              )}
            </div>

            {/* 총 경비 표시 */}
            {personalSummary.totalExpense > 0 && (
              <div className="mt-3 text-sm text-gray-500 text-center">
                총 경비: {formatWon(personalSummary.totalExpense)}
              </div>
            )}
          </div>

          {/* 기간 합계 조회 섹션 */}
          <div className="card mb-4">
            <h3 className="text-base font-bold mb-3">기간 합계</h3>
            <div className="flex gap-2 mb-3">
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">시작일</label>
                <input
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              <div className="flex-1">
                <label className="block text-xs text-gray-500 mb-1">종료일</label>
                <input
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
            <button
              onClick={handlePeriodQuery}
              disabled={!periodStart || !periodEnd || isLoading}
              className="btn-primary w-full py-2.5 text-sm font-semibold disabled:opacity-50"
            >
              기간 합계 보기
            </button>

            {/* 기간 합계 결과 */}
            {periodSummary && (
              <div className="mt-4 bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">총 공수</span>
                  <span className="text-lg font-bold">{periodSummary.totalManDay.toFixed(1)}공</span>
                </div>
                <div className="flex justify-between items-center mb-2">
                  <span className="text-sm text-gray-600">총 경비</span>
                  <span className="text-sm font-medium">{formatWon(periodSummary.totalExpense)}</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-gray-200">
                  <span className="text-sm font-medium text-gray-700">예상 급여</span>
                  <span className="text-lg font-bold text-primary-500">
                    {formatWon(periodSummary.estimatedWage)}
                  </span>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {/* ===== 팀장용 모드 ===== */}
      {activeTab === 'team' && !isLoading && (
        <>
          {/* 선택된 팀원이 없으면 팀원 목록, 있으면 팀원 캘린더 */}
          {!selectedMember ? (
            <>
              {/* 팀원 관리 카드 */}
              <div className="card mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h3 className="text-base font-bold">팀원 관리</h3>
                  <button
                    onClick={() => setShowAddMember(true)}
                    className="text-sm font-medium text-primary-500"
                  >
                    + 추가
                  </button>
                </div>

                {/* 팀원 추가 폼 */}
                {showAddMember && (
                  <div className="bg-gray-50 rounded-lg p-3 mb-3">
                    <input
                      type="text"
                      value={newMemberName}
                      onChange={(e) => setNewMemberName(e.target.value)}
                      placeholder="이름 *"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <input
                      type="tel"
                      value={newMemberPhone}
                      onChange={(e) => setNewMemberPhone(e.target.value)}
                      placeholder="연락처"
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm mb-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <div className="relative mb-2">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm">₩</span>
                      <input
                        type="number"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={newMemberWage || ''}
                        onChange={(e) => setNewMemberWage(Number(e.target.value) || 0)}
                        placeholder="일당"
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      {/* 금액 확인 도움말 (0 개수 확인용 만원 환산) */}
                      {newMemberWage > 0 && (
                        <p className="mt-1 text-sm text-gray-600">
                          {formatWon(newMemberWage)}
                          {newMemberWage >= 10000 && ` (${formatManwon(newMemberWage)})`}
                        </p>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setShowAddMember(false)}
                        className="flex-1 py-2 rounded-lg bg-gray-200 text-sm font-medium text-gray-600"
                      >
                        취소
                      </button>
                      <button
                        onClick={handleAddMember}
                        disabled={!newMemberName.trim()}
                        className="flex-1 btn-primary py-2 text-sm font-medium disabled:opacity-50"
                      >
                        추가
                      </button>
                    </div>
                  </div>
                )}

                {/* 팀원 리스트 */}
                {teamMembers.length === 0 ? (
                  <p className="text-sm text-gray-400 text-center py-6">
                    등록된 팀원이 없습니다.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {teamMembers.map((member) => {
                      const memberTotal = getMemberMonthlyTotal(member.id);
                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between bg-gray-50 rounded-lg p-3"
                        >
                          <button
                            onClick={() => setSelectedMember(member)}
                            className="flex-1 text-left"
                          >
                            <div className="font-medium text-sm">{member.name}</div>
                            <div className="text-xs text-gray-400">
                              {member.phone || '연락처 없음'}
                              {member.dailyWage ? ` · ${formatWon(member.dailyWage)}` : ''}
                            </div>
                          </button>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <div className="text-lg font-bold text-primary-500">
                                {memberTotal.toFixed(1)}
                              </div>
                              <div className="text-sm text-gray-500">공수</div>
                            </div>
                            <button
                              onClick={() => handleDeleteMember(member.id)}
                              className="min-w-[44px] min-h-[44px] flex items-center justify-center text-red-500 text-sm hover:text-red-600"
                            >
                              삭제
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 팀 월간 총합 카드 */}
              {teamMembers.length > 0 && (
                <div className="card mb-4">
                  <h3 className="text-base font-bold mb-3">팀 월간 총합</h3>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="bg-blue-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-extrabold text-primary-500">
                        {teamSummary.totalManDay.toFixed(1)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">총 팀 공수</div>
                    </div>
                    <div className="bg-orange-50 rounded-lg p-3 text-center">
                      <div className="text-2xl font-extrabold text-accent-500">
                        {formatWon(teamSummary.totalWage)}
                      </div>
                      <div className="text-xs text-gray-500 mt-1">예상 총 급여</div>
                    </div>
                  </div>
                </div>
              )}
            </>
          ) : (
            <>
              {/* 팀원 캘린더 뷰 (뒤로가기 포함) */}
              <div className="flex items-center gap-2 mb-4">
                <button
                  onClick={() => setSelectedMember(null)}
                  className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-600"
                >
                  &lsaquo;
                </button>
                <h3 className="text-base font-bold">{selectedMember.name}</h3>
                {selectedMember.dailyWage && (
                  <span className="text-xs text-gray-400 ml-auto">
                    일당 {formatWon(selectedMember.dailyWage)}
                  </span>
                )}
              </div>

              {/* 팀원 캘린더 */}
              {renderCalendar('teamMember', openTeamDayModal)}

              {/* 팀원 월간 요약 */}
              <div className="card mb-4">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">이번 달 총 공수</span>
                  <span className="text-xl font-bold text-primary-500">
                    {getMemberMonthlyTotal(selectedMember.id).toFixed(1)}공
                  </span>
                </div>
                {selectedMember.dailyWage && (
                  <div className="flex justify-between items-center mt-2 pt-2 border-t border-gray-100">
                    <span className="text-sm text-gray-600">예상 급여</span>
                    <span className="text-lg font-bold text-accent-500">
                      {formatWon(getMemberMonthlyTotal(selectedMember.id) * selectedMember.dailyWage)}
                    </span>
                  </div>
                )}
              </div>
            </>
          )}
        </>
      )}

      {/* ===== 모달들 ===== */}
      {renderPersonalDayModal()}
      {renderTeamDayModal()}

      {/* 기록 삭제 확인 시트 (P2-8) — 일별 모달(z-50) 위에 표시됨 */}
      <ConfirmSheet
        open={deleteTarget !== null}
        title="이 날 기록을 삭제할까요?"
        description="삭제한 기록은 되돌릴 수 없어요"
        confirmText="삭제"
        danger
        loading={isDeleting}
        loadingText="삭제 중..."
        error={deleteError}
        onConfirm={deleteTarget === 'personal' ? handleDeletePersonal : handleDeleteTeamWork}
        onCancel={() => {
          setDeleteTarget(null);
          setDeleteError(null);
        }}
      />

      {/* 저장/삭제 성공 토스트 (P2-8) */}
      {toastElement}

      {/* 바텀시트 슬라이드업 애니메이션 */}
      <style jsx global>{`
        @keyframes slide-up {
          from {
            transform: translateY(100%);
          }
          to {
            transform: translateY(0);
          }
        }
        .animate-slide-up {
          animation: slide-up 0.3s ease-out;
        }
      `}</style>
    </div>
  );
}
