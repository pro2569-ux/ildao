'use client';

import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, setDoc,
  query, where, orderBy, limit, serverTimestamp, Timestamp,
  getCountFromServer, writeBatch,
  DocumentData, DocumentReference, QueryConstraint
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { JobPost, Application, UserProfile, JobCategory, JobStatus, ApplicationStatus, DailyWorkRecord, TeamMember, TeamDailyWork, Favorite } from '@/types';

// ===== 날짜 변환 헬퍼 =====
// Firestore Timestamp → Date. serverTimestamp 펜딩(null)·undefined·Invalid Date를
// 모두 현재 시각으로 안전하게 폴백한다(#41 — new Date(null)=1970, new Date(undefined)=Invalid 회피).
const toDate = (ts: any): Date => {
  if (ts?.toDate) return ts.toDate();
  if (ts == null) return new Date();
  const d = new Date(ts);
  return isNaN(d.getTime()) ? new Date() : d;
};

// ===== 배치 삭제 헬퍼 (Firestore 배치당 500개 제한 대응) =====
async function deleteInBatches(refs: DocumentReference[]): Promise<void> {
  const CHUNK = 450;
  for (let i = 0; i < refs.length; i += CHUNK) {
    const batch = writeBatch(db);
    refs.slice(i, i + CHUNK).forEach((r) => batch.delete(r));
    await batch.commit();
  }
}

// ===== 구인글 관련 =====

/** 구인글 생성 */
export async function createJob(data: Omit<JobPost, 'id' | 'createdAt' | 'updatedAt' | 'status' | 'isPremium'>): Promise<string> {
  const docRef = await addDoc(collection(db, 'jobs'), {
    ...data,
    status: 'open',
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
  if (filters?.region) constraints.push(where('region', '==', filters.region));
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

/** 구인글 삭제 (연관 지원 내역까지 일괄 정리) */
export async function deleteJob(jobId: string, employerId: string): Promise<void> {
  // 이 공고에 달린 지원 내역을 먼저 삭제해 고아 데이터·통계 왜곡 방지
  // (타인 소유의 favorites는 클라이언트에서 정리 불가 — 즐겨찾기 화면이 삭제된 공고를 null 처리)
  const appsSnap = await getDocs(
    query(
      collection(db, 'applications'),
      where('jobId', '==', jobId),
      where('employerId', '==', employerId)
    )
  );
  await deleteInBatches(appsSnap.docs.map((d) => d.ref));
  await deleteDoc(doc(db, 'jobs', jobId));
}

// ===== 지원 관련 =====

/** 지원 시 함께 저장하는 지원자 스냅샷 (구인자가 비공개 프로필도 확인 가능하도록 비정규화) */
export interface ApplicantSnapshot {
  name: string;
  phone: string;
  skills?: string[];
  experience?: number;
  desiredWage?: number;
  message?: string;
}

/** 구인글에 지원 (docId: {jobId}_{workerId} — 중복/동시 지원이 같은 문서로 수렴해 이중 생성 방지) */
export async function applyToJob(
  jobId: string,
  workerId: string,
  employerId: string,
  applicant: ApplicantSnapshot
): Promise<string> {
  const docId = `${jobId}_${workerId}`;
  await setDoc(doc(db, 'applications', docId), {
    jobId,
    workerId,
    employerId,
    status: 'pending' as ApplicationStatus,
    workerName: applicant.name,
    workerPhone: applicant.phone,
    workerSkills: applicant.skills ?? [],
    workerExperience: applicant.experience ?? null,
    workerDesiredWage: applicant.desiredWage ?? null,
    message: (applicant.message ?? '').trim(),
    createdAt: serverTimestamp(),
  });
  return docId;
}

/** 특정 구인글의 지원 목록 (보안 규칙상 해당 공고의 구인자 본인만 조회 가능) */
export async function getApplicationsByJob(jobId: string, employerId: string): Promise<Application[]> {
  const q = query(
    collection(db, 'applications'),
    where('jobId', '==', jobId),
    where('employerId', '==', employerId),
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

/** 이미 지원했는지 확인 (결정적 docId 단건 조회 — 쿼리보다 저렴) */
export async function hasApplied(jobId: string, workerId: string): Promise<boolean> {
  const snapshot = await getDoc(doc(db, 'applications', `${jobId}_${workerId}`));
  return snapshot.exists();
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

/** 지원자 수 가져오기 (구인글별, 보안 규칙상 해당 공고의 구인자 본인만 조회 가능) */
export async function getApplicationCount(jobId: string, employerId: string): Promise<number> {
  const q = query(
    collection(db, 'applications'),
    where('jobId', '==', jobId),
    where('employerId', '==', employerId)
  );
  // 집계 쿼리: 문서를 전부 읽지 않고 서버에서 개수만 계산 (읽기 비용 절감)
  const snapshot = await getCountFromServer(q);
  return snapshot.data().count;
}

// ===== Phase 2: 공수 기록 관련 =====

/** 일별 공수 저장 (upsert — 단일 setDoc merge로 getDoc 분기·read-then-write race 제거, #157) */
export async function saveDailyWork(userId: string, date: string, data: Partial<DailyWorkRecord>): Promise<void> {
  const docId = `${userId}_${date}`;
  // 호출부는 항상 전체 필드를 전달하므로 merge로 신규/수정을 한 번에 처리한다.
  // (defaults를 넣지 않아 부분 업데이트 시 기존 값이 default로 덮어써지지 않음)
  await setDoc(
    doc(db, 'dailyWorks', docId),
    { userId, date, ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
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

/** 팀원 공수 저장 (upsert — 단일 setDoc merge, #157) */
export async function saveTeamDailyWork(teamLeaderId: string, memberId: string, date: string, data: Partial<TeamDailyWork>): Promise<void> {
  const docId = `${teamLeaderId}_${memberId}_${date}`;
  // 호출부가 memberName 등 전체 필드를 전달하므로 merge 1회로 처리
  await setDoc(
    doc(db, 'teamDailyWorks', docId),
    { teamLeaderId, memberId, date, ...data, updatedAt: serverTimestamp() },
    { merge: true }
  );
}

/** 팀원 삭제 시 해당 팀원의 공수 기록 일괄 삭제 (고아 레코드 방지) */
export async function deleteTeamMemberWorks(teamLeaderId: string, memberId: string): Promise<void> {
  const snap = await getDocs(
    query(
      collection(db, 'teamDailyWorks'),
      where('teamLeaderId', '==', teamLeaderId),
      where('memberId', '==', memberId)
    )
  );
  await deleteInBatches(snap.docs.map((d) => d.ref));
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

/** 즐겨찾기 추가 (docId: {userId}_{targetId} — 중복 추가/동시 호출이 같은 문서로 수렴해 중복 생성 방지) */
export async function addFavorite(userId: string, targetId: string, targetType: 'user' | 'job'): Promise<string> {
  const docId = `${userId}_${targetId}`;
  await setDoc(doc(db, 'favorites', docId), {
    userId,
    targetId,
    targetType,
    createdAt: serverTimestamp(),
  });
  return docId;
}

/** 즐겨찾기 삭제 (결정적 docId 단건 삭제) */
export async function removeFavorite(userId: string, targetId: string): Promise<void> {
  await deleteDoc(doc(db, 'favorites', `${userId}_${targetId}`));
}

/** 즐겨찾기 여부 확인 (결정적 docId 단건 조회 — 쿼리보다 저렴) */
export async function isFavorited(userId: string, targetId: string): Promise<boolean> {
  const snapshot = await getDoc(doc(db, 'favorites', `${userId}_${targetId}`));
  return snapshot.exists();
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

  // 총 지원자 수 (집계 쿼리 — limit 걸린 목록의 size를 쓰면 10에서 캡핑됨)
  const countSnap = await getCountFromServer(
    query(collection(db, 'applications'), where('employerId', '==', employerId))
  );
  const totalApplicants = countSnap.data().count;

  // 최근 지원 10건
  const appsQuery = query(
    collection(db, 'applications'),
    where('employerId', '==', employerId),
    orderBy('createdAt', 'desc'),
    limit(10)
  );
  const appsSnap = await getDocs(appsQuery);
  const recentApplications = appsSnap.docs.map((d) => ({
    ...d.data(),
    id: d.id,
    createdAt: toDate(d.data().createdAt),
  } as Application));

  return { activeJobs, totalApplicants, recentApplications };
}
