'use client';

import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, setDoc,
  query, where, orderBy, limit, serverTimestamp, Timestamp, writeBatch,
  arrayUnion, arrayRemove, onSnapshot, getCountFromServer,
  DocumentData, QueryConstraint, QueryDocumentSnapshot, Unsubscribe
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { matchesRegion } from '@/lib/constants';
import { JobPost, Application, UserProfile, JobCategory, JobStatus, ApplicationStatus, DailyWorkRecord, TeamMember, TeamDailyWork, Favorite } from '@/types';

// ===== 날짜 변환 헬퍼 =====
const toDate = (ts: any): Date => ts?.toDate?.() || new Date(ts) || new Date();

// ===== 구인글 관련 =====

/** 구인글 생성 */
export async function createJob(data: Omit<JobPost, 'id' | 'createdAt' | 'updatedAt' | 'applicants' | 'status' | 'isPremium'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'jobs'), {
    ...data,
    status: 'open',
    applicants: [],
    isPremium: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return docRef.id;
}

/**
 * 구인글 목록 조회 (필터 지원)
 * - region 필터: 쿼리에 where를 추가하지 않고 클라이언트에서 prefix 매칭 (P2-6, 복합 인덱스 방지)
 *   '전국' 또는 미지정이면 필터 없음.
 * - 안전 정렬 (P2-3): equality 필터(직종 등) + dailyWage 정렬 조합은 복합 인덱스가 필요하므로,
 *   해당 조합일 때 쿼리는 equality만 쓰고 정렬·limit은 함수 안에서 클라이언트 수행.
 *   단독 정렬(필터 없음) 경로는 기존 그대로 서버 orderBy 사용.
 */
export async function getJobs(filters?: {
  category?: JobCategory;
  region?: string;
  status?: JobStatus;
  employerId?: string;
  limitCount?: number;
  sortBy?: 'createdAt' | 'dailyWage';
  sortDir?: 'asc' | 'desc';
}): Promise<JobPost[]> {
  const constraints: QueryConstraint[] = [];

  if (filters?.category) constraints.push(where('category', '==', filters.category));
  if (filters?.status) constraints.push(where('status', '==', filters.status));
  if (filters?.employerId) constraints.push(where('employerId', '==', filters.employerId));

  const sortBy = filters?.sortBy || 'createdAt';
  const sortDir = filters?.sortDir || 'desc';

  // equality where + dailyWage orderBy 조합은 복합 인덱스가 필요 → 클라이언트 정렬 (P2-3)
  const hasEqualityFilter = constraints.length > 0;
  const sortOnClient = hasEqualityFilter && sortBy === 'dailyWage';

  // region 필터는 항상 클라이언트 prefix 매칭 (P2-6)
  const regionFilter =
    filters?.region && filters.region !== '전국' ? filters.region : undefined;

  // 클라이언트에서 필터/정렬을 수행하면 limit도 클라이언트에서 (조기 절단 방지)
  const limitOnClient = sortOnClient || !!regionFilter;

  if (!sortOnClient) constraints.push(orderBy(sortBy, sortDir));
  if (filters?.limitCount && !limitOnClient) constraints.push(limit(filters.limitCount));

  const q = query(collection(db, 'jobs'), ...constraints);
  const snapshot = await getDocs(q);

  let jobs = snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      id: doc.id,
      startDate: toDate(data.startDate),
      endDate: data.endDate ? toDate(data.endDate) : undefined,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    } as JobPost;
  });

  if (regionFilter) {
    jobs = jobs.filter((job) => matchesRegion(job, regionFilter));
  }

  if (sortOnClient) {
    jobs.sort((a, b) =>
      sortDir === 'asc'
        ? (a.dailyWage || 0) - (b.dailyWage || 0)
        : (b.dailyWage || 0) - (a.dailyWage || 0)
    );
  }

  if (filters?.limitCount && limitOnClient) {
    jobs = jobs.slice(0, filters.limitCount);
  }

  return jobs;
}

/** 구인글 단건 조회 */
export async function getJob(jobId: string): Promise<JobPost | null> {
  const docSnap = await getDoc(doc(db, 'jobs', jobId));
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    ...data,
    id: docSnap.id,
    startDate: toDate(data.startDate),
    endDate: data.endDate ? toDate(data.endDate) : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } as JobPost;
}

/** 구인글 수정 */
export async function updateJob(jobId: string, data: Partial<JobPost>): Promise<void> {
  const { id, createdAt, ...updateData } = data as any;
  await updateDoc(doc(db, 'jobs', jobId), {
    ...updateData,
    updatedAt: serverTimestamp(),
  });
}

/** 구인글 삭제 */
export async function deleteJob(jobId: string): Promise<void> {
  await deleteDoc(doc(db, 'jobs', jobId));
}

// ===== 지원 관련 =====
// 문서 ID 규칙: `${jobId}_${workerId}` — 같은 공고에 중복 지원을 구조적으로 차단.
// applications 컬렉션이 지원 데이터의 원본이며, jobs.applicants 배열은 보조 데이터.
// ※ 복합 인덱스를 피하기 위해 쿼리는 equality where만 쓰고 정렬은 클라이언트에서 수행.

/** ApplicationWithProfile: 지원 내역 + 지원자 프로필 (지원자 목록 화면용) */
export type ApplicationWithProfile = Application & { workerProfile: UserProfile | null };

/** Firestore 문서 → Application 변환 (serverTimestamp 반영 전이면 현재 시각으로 대체) */
const mapApplication = (d: QueryDocumentSnapshot<DocumentData>): Application => {
  const data = d.data();
  return {
    ...data,
    id: d.id,
    createdAt: data.createdAt ? toDate(data.createdAt) : new Date(),
  } as Application;
};

/** createdAt 내림차순 정렬 (클라이언트 정렬용) */
const byCreatedAtDesc = (a: Application, b: Application) =>
  b.createdAt.getTime() - a.createdAt.getTime();

/**
 * 구인글에 지원
 * - 문서 ID를 `${jobId}_${workerId}`로 고정(setDoc)해 중복 지원을 차단
 * - 이미 지원한 공고면 Error를 던짐 (message: '이미 지원한 공고예요.')
 * - jobs.applicants에 workerId를 arrayUnion (보조 데이터 — 실패해도 지원 자체는 유효)
 * @returns 생성된 지원 문서 ID (`${jobId}_${workerId}`)
 */
export async function applyToJob(jobId: string, workerId: string, employerId: string): Promise<string> {
  const applicationId = `${jobId}_${workerId}`;
  const appRef = doc(db, 'applications', applicationId);

  const existing = await getDoc(appRef);
  if (existing.exists()) {
    throw new Error('이미 지원한 공고예요.');
  }

  await setDoc(appRef, {
    jobId,
    workerId,
    employerId,
    status: 'pending' as ApplicationStatus,
    createdAt: serverTimestamp(),
  });

  // jobs.applicants 배열 동기화 (실패해도 지원은 정상 처리된 상태)
  try {
    await updateDoc(doc(db, 'jobs', jobId), { applicants: arrayUnion(workerId) });
  } catch (e) {
    console.warn('jobs.applicants 동기화 실패 (지원은 정상 처리됨):', e);
  }

  return applicationId;
}

/**
 * 지원 취소 — pending 상태일 때만 가능
 * - pending이 아니거나 문서가 없으면 Error를 던짐 (message를 그대로 사용자에게 보여줘도 됨)
 * - jobs.applicants에서 workerId를 arrayRemove (보조 데이터 — 실패해도 취소 자체는 유효)
 */
export async function cancelApplication(applicationId: string): Promise<void> {
  const appRef = doc(db, 'applications', applicationId);
  const snap = await getDoc(appRef);

  if (!snap.exists()) {
    throw new Error('지원 내역을 찾을 수 없어요.');
  }

  const data = snap.data();
  if (data.status !== 'pending') {
    throw new Error(
      data.status === 'accepted'
        ? '이미 수락된 지원은 취소할 수 없어요.'
        : '이미 처리된 지원은 취소할 수 없어요.'
    );
  }

  await deleteDoc(appRef);

  // jobs.applicants 배열 동기화 (실패해도 취소는 정상 처리된 상태)
  try {
    await updateDoc(doc(db, 'jobs', data.jobId), { applicants: arrayRemove(data.workerId) });
  } catch (e) {
    console.warn('jobs.applicants 동기화 실패 (취소는 정상 처리됨):', e);
  }
}

/** 특정 구인글의 지원 목록 (createdAt 내림차순 — 클라이언트 정렬) */
export async function getApplicationsByJob(jobId: string): Promise<Application[]> {
  const q = query(
    collection(db, 'applications'),
    where('jobId', '==', jobId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapApplication).sort(byCreatedAtDesc);
}

/**
 * 특정 구인글의 지원 목록 + 지원자 프로필 (지원자 목록 화면용)
 * - 프로필은 병렬 fetch, 조회 실패(탈퇴 등) 시 workerProfile: null
 */
export async function getApplicationsByJobWithProfiles(jobId: string): Promise<ApplicationWithProfile[]> {
  const applications = await getApplicationsByJob(jobId);
  const profiles = await Promise.all(
    applications.map((app) => getUserProfile(app.workerId).catch(() => null))
  );
  return applications.map((app, i) => ({ ...app, workerProfile: profiles[i] }));
}

/** 구직자의 지원 내역 (createdAt 내림차순 — 클라이언트 정렬) */
export async function getApplicationsByWorker(workerId: string): Promise<Application[]> {
  const q = query(
    collection(db, 'applications'),
    where('workerId', '==', workerId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapApplication).sort(byCreatedAtDesc);
}

/**
 * 구직자의 지원 내역 실시간 구독 (createdAt 내림차순 — 클라이언트 정렬)
 * @param onError 구독 실패 콜백 (선택 — ErrorState 표시용, P2). 미전달 시 콘솔 로그만.
 * @returns unsubscribe 함수 — useEffect cleanup에서 반드시 호출할 것
 */
export function subscribeToApplicationsByWorker(
  workerId: string,
  callback: (applications: Application[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'applications'),
    where('workerId', '==', workerId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map(mapApplication).sort(byCreatedAtDesc));
    },
    (error) => {
      console.error('지원 내역 구독 오류:', error);
      onError?.(error);
    }
  );
}

/**
 * 특정 구인글의 지원 목록 실시간 구독 (createdAt 내림차순 — 클라이언트 정렬)
 * @param onError 구독 실패 콜백 (선택 — ErrorState 표시용, P2). 미전달 시 콘솔 로그만.
 * @returns unsubscribe 함수 — useEffect cleanup에서 반드시 호출할 것
 */
export function subscribeToApplicationsByJob(
  jobId: string,
  callback: (applications: Application[]) => void,
  onError?: (error: Error) => void
): Unsubscribe {
  const q = query(
    collection(db, 'applications'),
    where('jobId', '==', jobId)
  );
  return onSnapshot(
    q,
    (snapshot) => {
      callback(snapshot.docs.map(mapApplication).sort(byCreatedAtDesc));
    },
    (error) => {
      console.error('지원자 목록 구독 오류:', error);
      onError?.(error);
    }
  );
}

/**
 * 구인자에게 들어온 최근 지원 목록
 * - equality where만 사용 (복합 인덱스 방지) — 정렬·limit은 클라이언트에서
 */
export async function getRecentApplicationsByEmployer(employerId: string, limitCount: number = 5): Promise<Application[]> {
  const q = query(
    collection(db, 'applications'),
    where('employerId', '==', employerId)
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map(mapApplication).sort(byCreatedAtDesc).slice(0, limitCount);
}

/** 이미 지원했는지 확인 */
export async function hasApplied(jobId: string, workerId: string): Promise<boolean> {
  const q = query(
    collection(db, 'applications'),
    where('jobId', '==', jobId),
    where('workerId', '==', workerId)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

/** 지원 상태 변경 (구인자가 수락/거절) */
export async function updateApplicationStatus(applicationId: string, status: ApplicationStatus): Promise<void> {
  await updateDoc(doc(db, 'applications', applicationId), { status });
}

// ===== 사용자 프로필 관련 =====

/** 공개 프로필 구직자 목록 */
export async function getPublicWorkers(filters?: {
  skills?: JobCategory;
  region?: string;
}): Promise<UserProfile[]> {
  const constraints: QueryConstraint[] = [
    where('role', '==', 'worker'),
    where('isPublic', '==', true),
  ];

  if (filters?.skills) constraints.push(where('skills', 'array-contains', filters.skills));

  const q = query(collection(db, 'users'), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      createdAt: toDate(data.createdAt),
      updatedAt: toDate(data.updatedAt),
    } as UserProfile;
  });
}

/** 사용자 프로필 단건 조회 */
export async function getUserProfile(uid: string): Promise<UserProfile | null> {
  const docSnap = await getDoc(doc(db, 'users', uid));
  if (!docSnap.exists()) return null;
  const data = docSnap.data();
  return {
    ...data,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } as UserProfile;
}

/** 프로필 공개 설정 토글 */
export async function toggleProfilePublic(uid: string, isPublic: boolean): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    isPublic,
    updatedAt: serverTimestamp(),
  });
}

/** 지원자 수 가져오기 (구인글별) — getCountFromServer 집계 사용 */
export async function getApplicationCount(jobId: string): Promise<number> {
  const q = query(
    collection(db, 'applications'),
    where('jobId', '==', jobId)
  );
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}

// ===== Phase 2: 공수 기록 관련 =====

/** 일별 공수 저장 (upsert) */
export async function saveDailyWork(userId: string, date: string, data: Partial<DailyWorkRecord>): Promise<void> {
  const docId = `${userId}_${date}`;
  const docRef = doc(db, 'dailyWorks', docId);
  const existing = await getDoc(docRef);

  if (existing.exists()) {
    await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
  } else {
    await setDoc(docRef, {
      userId,
      date,
      manDay: 0,
      overtime: false,
      dayOff: false,
      extension: false,
      expense: 0,
      memo: '',
      weather: 'none',
      ...data,
      createdAt: serverTimestamp(),
    });
  }
}

/**
 * 일별 공수 삭제 (P2)
 * - 문서 ID 규칙 `${userId}_${date}` — 본인 기록만 삭제 가능 (firestore.rules에서 강제)
 */
export async function deleteDailyWork(userId: string, date: string): Promise<void> {
  await deleteDoc(doc(db, 'dailyWorks', `${userId}_${date}`));
}

/** 특정 월의 공수 기록 조회 */
export async function getMonthlyWorks(userId: string, year: number, month: number): Promise<DailyWorkRecord[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  const q = query(
    collection(db, 'dailyWorks'),
    where('userId', '==', userId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    createdAt: toDate(d.data().createdAt),
  } as DailyWorkRecord));
}

/** 특정 기간의 공수 기록 조회 */
export async function getWorksByDateRange(userId: string, startDate: string, endDate: string): Promise<DailyWorkRecord[]> {
  const q = query(
    collection(db, 'dailyWorks'),
    where('userId', '==', userId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    createdAt: toDate(d.data().createdAt),
  } as DailyWorkRecord));
}

// ===== Phase 2: 팀장용 팀원 공수 관리 =====

/** 팀원 목록 저장 */
export async function saveTeamMembers(userId: string, members: TeamMember[]): Promise<void> {
  await setDoc(doc(db, 'teams', userId), {
    members,
    updatedAt: serverTimestamp(),
  });
}

/** 팀원 목록 조회 */
export async function getTeamMembers(userId: string): Promise<TeamMember[]> {
  const docSnap = await getDoc(doc(db, 'teams', userId));
  if (!docSnap.exists()) return [];
  return docSnap.data().members || [];
}

/** 팀원 공수 저장 */
export async function saveTeamDailyWork(teamLeaderId: string, memberId: string, date: string, data: Partial<TeamDailyWork>): Promise<void> {
  const docId = `${teamLeaderId}_${memberId}_${date}`;
  const docRef = doc(db, 'teamDailyWorks', docId);
  const existing = await getDoc(docRef);

  if (existing.exists()) {
    await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
  } else {
    await setDoc(docRef, {
      teamLeaderId,
      memberId,
      memberName: data.memberName || '',
      date,
      manDay: 0,
      overtime: false,
      dayOff: false,
      extension: false,
      memo: '',
      ...data,
      createdAt: serverTimestamp(),
    });
  }
}

/**
 * 팀원 공수 삭제 (P2)
 * - 문서 ID 규칙 `${teamLeaderId}_${memberId}_${date}` — 팀장 본인 기록만 삭제 가능 (firestore.rules에서 강제)
 */
export async function deleteTeamDailyWork(teamLeaderId: string, memberId: string, date: string): Promise<void> {
  await deleteDoc(doc(db, 'teamDailyWorks', `${teamLeaderId}_${memberId}_${date}`));
}

/** saveTeamDailyWorksBulk 입력 항목 (P2-15) */
export type TeamDailyWorkEntry = {
  memberId: string;
  memberName: string;
  manDay: number;
  overtime?: boolean;
  dayOff?: boolean;
  extension?: boolean;
  memo?: string;
};

/**
 * 팀원 공수 일괄 저장 (P2-15) — 같은 날짜의 여러 팀원 기록을 writeBatch로 한 번에 upsert.
 * - 기존 문서 조회는 equality where 2개(teamLeaderId, date)만 사용 — 복합 인덱스 불필요
 * - 휴무(dayOff)면 manDay를 0으로 고정 (모순 방지 — UI와 이중 안전장치)
 * - writeBatch 한도 500건 — 팀원 수 기준으로 충분
 */
export async function saveTeamDailyWorksBulk(
  teamLeaderId: string,
  date: string,
  entries: TeamDailyWorkEntry[]
): Promise<void> {
  if (entries.length === 0) return;

  // 해당 날짜의 기존 기록 확인 (신규/수정 구분용)
  const q = query(
    collection(db, 'teamDailyWorks'),
    where('teamLeaderId', '==', teamLeaderId),
    where('date', '==', date)
  );
  const snapshot = await getDocs(q);
  const existingIds = new Set(snapshot.docs.map((d) => d.id));

  const batch = writeBatch(db);
  for (const entry of entries) {
    const docId = `${teamLeaderId}_${entry.memberId}_${date}`;
    const docRef = doc(db, 'teamDailyWorks', docId);
    const payload = {
      memberName: entry.memberName,
      manDay: entry.dayOff ? 0 : entry.manDay, // 휴무면 공수 0 고정
      overtime: entry.overtime ?? false,
      dayOff: entry.dayOff ?? false,
      extension: entry.extension ?? false,
      memo: entry.memo ?? '',
    };
    if (existingIds.has(docId)) {
      batch.update(docRef, { ...payload, updatedAt: serverTimestamp() });
    } else {
      batch.set(docRef, {
        teamLeaderId,
        memberId: entry.memberId,
        date,
        ...payload,
        createdAt: serverTimestamp(),
      });
    }
  }
  await batch.commit();
}

/** 팀원들의 월별 공수 조회 */
export async function getTeamMonthlyWorks(teamLeaderId: string, year: number, month: number): Promise<TeamDailyWork[]> {
  const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
  const endDate = `${year}-${String(month).padStart(2, '0')}-31`;

  const q = query(
    collection(db, 'teamDailyWorks'),
    where('teamLeaderId', '==', teamLeaderId),
    where('date', '>=', startDate),
    where('date', '<=', endDate),
    orderBy('date', 'asc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    createdAt: toDate(d.data().createdAt),
  } as TeamDailyWork));
}

// ===== Phase 2: 즐겨찾기 관련 =====

/** 즐겨찾기 추가 */
export async function addFavorite(userId: string, targetId: string, targetType: 'user' | 'job'): Promise<string> {
  const docRef = await addDoc(collection(db, 'favorites'), {
    userId,
    targetId,
    targetType,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/** 즐겨찾기 삭제 */
export async function removeFavorite(userId: string, targetId: string): Promise<void> {
  const q = query(
    collection(db, 'favorites'),
    where('userId', '==', userId),
    where('targetId', '==', targetId)
  );
  const snapshot = await getDocs(q);
  const deletePromises = snapshot.docs.map((d) => deleteDoc(doc(db, 'favorites', d.id)));
  await Promise.all(deletePromises);
}

/** 즐겨찾기 여부 확인 */
export async function isFavorited(userId: string, targetId: string): Promise<boolean> {
  const q = query(
    collection(db, 'favorites'),
    where('userId', '==', userId),
    where('targetId', '==', targetId)
  );
  const snapshot = await getDocs(q);
  return !snapshot.empty;
}

/** 내 즐겨찾기 목록 조회 */
export async function getFavorites(userId: string, targetType?: 'user' | 'job'): Promise<Favorite[]> {
  const constraints: QueryConstraint[] = [
    where('userId', '==', userId),
  ];
  if (targetType) constraints.push(where('targetType', '==', targetType));
  constraints.push(orderBy('createdAt', 'desc'));

  const q = query(collection(db, 'favorites'), ...constraints);
  const snapshot = await getDocs(q);
  return snapshot.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    createdAt: toDate(d.data().createdAt),
  } as Favorite));
}

// ===== Phase 2: 프로필 편집 =====

/** 프로필 업데이트 */
export async function updateUserProfile(uid: string, data: Record<string, any>): Promise<void> {
  await updateDoc(doc(db, 'users', uid), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

// ===== Phase 2: 구인자 대시보드 통계 =====

/**
 * 구인자 대시보드 통계
 * - 개수는 getCountFromServer 집계 사용 (equality where만 — 인덱스 불필요, 10건 제한 없음)
 */
export async function getEmployerStats(employerId: string): Promise<{
  activeJobs: number;
  totalApplicants: number;
  recentApplications: Application[];
}> {
  // 진행 중인 구인글 수
  const jobsQuery = query(
    collection(db, 'jobs'),
    where('employerId', '==', employerId),
    where('status', '==', 'open')
  );

  // 총 지원자 수 (전체 집계)
  const appsQuery = query(
    collection(db, 'applications'),
    where('employerId', '==', employerId)
  );

  const [jobsCountSnap, appsCountSnap, recentApplications] = await Promise.all([
    getCountFromServer(jobsQuery),
    getCountFromServer(appsQuery),
    getRecentApplicationsByEmployer(employerId, 10),
  ]);

  return {
    activeJobs: jobsCountSnap.data().count,
    totalApplicants: appsCountSnap.data().count,
    recentApplications,
  };
}
