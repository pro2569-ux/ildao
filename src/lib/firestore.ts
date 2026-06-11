'use client';

import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, setDoc,
  query, where, orderBy, limit, serverTimestamp, Timestamp,
  DocumentData, QueryConstraint
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
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

/** 구인글 목록 조회 (필터 지원) */
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

  // Firestore는 inequality filter + orderBy 동시 사용에 제한이 있으므로
  // 기본 정렬은 createdAt desc
  constraints.push(orderBy(filters?.sortBy || 'createdAt', filters?.sortDir || 'desc'));

  if (filters?.limitCount) constraints.push(limit(filters.limitCount));

  const q = query(collection(db, 'jobs'), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
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

/** 구인글에 지원 */
export async function applyToJob(jobId: string, workerId: string, employerId: string): Promise<string> {
  const docRef = await addDoc(collection(db, 'applications'), {
    jobId,
    workerId,
    employerId,
    status: 'pending' as ApplicationStatus,
    createdAt: serverTimestamp(),
  });
  return docRef.id;
}

/** 특정 구인글의 지원 목록 */
export async function getApplicationsByJob(jobId: string): Promise<Application[]> {
  const q = query(
    collection(db, 'applications'),
    where('jobId', '==', jobId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id,
    createdAt: toDate(doc.data().createdAt),
  } as Application));
}

/** 구직자의 지원 내역 */
export async function getApplicationsByWorker(workerId: string): Promise<Application[]> {
  const q = query(
    collection(db, 'applications'),
    where('workerId', '==', workerId),
    orderBy('createdAt', 'desc')
  );
  const snapshot = await getDocs(q);
  return snapshot.docs.map((doc) => ({
    ...doc.data(),
    id: doc.id,
    createdAt: toDate(doc.data().createdAt),
  } as Application));
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

/** 지원자 수 가져오기 (구인글별) */
export async function getApplicationCount(jobId: string): Promise<number> {
  const q = query(
    collection(db, 'applications'),
    where('jobId', '==', jobId)
  );
  const snapshot = await getDocs(q);
  return snapshot.size;
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

/** 구인자 대시보드 통계 */
export async function getEmployerStats(employerId: string): Promise<{
  activeJobs: number;
  totalApplicants: number;
  recentApplications: Application[];
}> {
  // 진행 중인 구인글
  const jobsQuery = query(
    collection(db, 'jobs'),
    where('employerId', '==', employerId),
    where('status', '==', 'open')
  );
  const jobsSnap = await getDocs(jobsQuery);
  const activeJobs = jobsSnap.size;

  // 총 지원자 수 & 최근 지원
  const appsQuery = query(
    collection(db, 'applications'),
    where('employerId', '==', employerId),
    orderBy('createdAt', 'desc'),
    limit(10)
  );
  const appsSnap = await getDocs(appsQuery);
  const totalApplicants = appsSnap.size;
  const recentApplications = appsSnap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    createdAt: toDate(d.data().createdAt),
  } as Application));

  return { activeJobs, totalApplicants, recentApplications };
}
