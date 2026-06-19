'use client';

import {
  collection, doc, addDoc, getDoc, getDocs, updateDoc, deleteDoc, setDoc,
  query, where, orderBy, limit, startAfter, serverTimestamp, Timestamp, documentId,
  getCountFromServer, writeBatch,
  DocumentData, DocumentReference, QueryConstraint, QueryDocumentSnapshot
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

// 월 범위를 [시작일, 다음 달 1일) 반열린 구간으로 반환 — 존재하지 않는 '-31' 매직값/사전식 운 의존 제거 (FIRESTORE-01)
function monthRange(year: number, month: number): { start: string; endExclusive: string } {
  const start = `${year}-${String(month).padStart(2, '0')}-01`;
  const nextYear = month === 12 ? year + 1 : year;
  const nextMonth = month === 12 ? 1 : month + 1;
  const endExclusive = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`;
  return { start, endExclusive };
}

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

/** 구인글 목록 조회 (필터 지원)
 *
 * ⚠️ 인덱스 계약 (QUERY-01): (filter 조합 + sortBy)마다 firestore.indexes.json에 복합 인덱스가 있어야 한다.
 *   현재 인덱스가 커버하는 조합(= 실제 호출부):
 *     - status (+category/region 조합) + createdAt|dailyWage
 *     - employerId + createdAt,  employerId + status + createdAt
 *   status 없이 region/category 단독, employerId + dailyWage 등 새 조합을 호출하려면 먼저
 *   firestore.indexes.json에 해당 인덱스를 추가·배포할 것(없으면 런타임에 'requires an index' 에러).
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

/** 구인글 문서 → JobPost 매핑 (Timestamp→Date 변환 공통화) */
function mapJobDoc(d: QueryDocumentSnapshot): JobPost {
  const data = d.data();
  return {
    ...data,
    id: d.id,
    startDate: toDate(data.startDate),
    endDate: data.endDate ? toDate(data.endDate) : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } as JobPost;
}

/** 페이지네이션 커서 (구인글 피드 '더보기'용 — 내부적으로 Firestore 스냅샷) */
export type JobCursor = QueryDocumentSnapshot;

/** 구인글 한 페이지 조회 (커서 기반 — startAfter)
 *  pageSize+1개를 요청해 초과분 유무로 hasMore를 판정하고, 다음 호출에 lastDoc을 startAfter로 넘긴다.
 *  필터/정렬 조합의 인덱스 계약은 getJobs와 동일 (QUERY-01 참고). */
export async function getJobsPage(
  filters: {
    category?: JobCategory;
    region?: string;
    status?: JobStatus;
    employerId?: string;
    sortBy?: 'createdAt' | 'dailyWage';
    sortDir?: 'asc' | 'desc';
  },
  pageSize: number,
  startAfterDoc?: JobCursor | null
): Promise<{ jobs: JobPost[]; lastDoc: JobCursor | null; hasMore: boolean }> {
  const constraints: QueryConstraint[] = [];
  if (filters.category) constraints.push(where('category', '==', filters.category));
  if (filters.region) constraints.push(where('region', '==', filters.region));
  if (filters.status) constraints.push(where('status', '==', filters.status));
  if (filters.employerId) constraints.push(where('employerId', '==', filters.employerId));
  constraints.push(orderBy(filters.sortBy || 'createdAt', filters.sortDir || 'desc'));
  if (startAfterDoc) constraints.push(startAfter(startAfterDoc));
  // pageSize+1개를 읽어 마지막 페이지 여부(hasMore)를 판정
  constraints.push(limit(pageSize + 1));

  const snapshot = await getDocs(query(collection(db, 'jobs'), ...constraints));
  const hasMore = snapshot.docs.length > pageSize;
  const pageDocs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;
  const jobs = pageDocs.map(mapJobDoc);
  const lastDoc = pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null;
  return { jobs, lastDoc, hasMore };
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

/** 여러 구인글을 documentId in 청크(최대 30)로 일괄 조회 — 지원 내역 등의 N+1 방지 (EMP-03) */
export async function getJobsByIds(jobIds: string[]): Promise<Map<string, JobPost>> {
  const uniqueIds = Array.from(new Set(jobIds)).filter(Boolean);
  const result = new Map<string, JobPost>();
  const CHUNK = 30; // Firestore 'in' 필터 최대값
  for (let i = 0; i < uniqueIds.length; i += CHUNK) {
    const chunk = uniqueIds.slice(i, i + CHUNK);
    const snapshot = await getDocs(
      query(collection(db, 'jobs'), where(documentId(), 'in', chunk))
    );
    snapshot.docs.forEach((d) => {
      const data = d.data();
      result.set(d.id, {
        ...data,
        id: d.id,
        startDate: toDate(data.startDate),
        endDate: data.endDate ? toDate(data.endDate) : undefined,
        createdAt: toDate(data.createdAt),
        updatedAt: toDate(data.updatedAt),
      } as JobPost);
    });
  }
  return result;
}

/** 구인글 수정 (소유권·불변 필드(employerId/createdAt) 검증은 firestore.rules가 담당 — LIB-03) */
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

/** 공개 프로필 구직자 목록 (직종 필터만 지원 — 지역 필터는 UI·인덱스 미구현이라 미지원, LIB-01) */
export async function getPublicWorkers(filters?: {
  skills?: JobCategory;
}): Promise<UserProfile[]> {
  const constraints: QueryConstraint[] = [
    where('role', '==', 'worker'),
    // ⚠️ isPublic==true 제약은 절대 제거 금지 (SEC-06) — users read 규칙의 isPublic 분기가
    //    이 list 쿼리 통과의 유일한 근거다. 제거하면 보안 규칙이 쿼리를 거부해 전체 조회가 실패한다.
    where('isPublic', '==', true),
  ];

  if (filters?.skills) constraints.push(where('skills', 'array-contains', filters.skills));

  const q = query(collection(db, 'users'), ...constraints);
  const snapshot = await getDocs(q);

  return snapshot.docs.map((doc) => {
    const data = doc.data();
    return {
      ...data,
      uid: doc.id, // 저장된 uid 필드 누락에도 견고하게 docId로 보강 (LIB-02)
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
    uid: docSnap.id, // 저장된 uid 필드 누락에도 견고하게 docId로 보강 (LIB-02)
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } as UserProfile;
}

/** 프로필 공개 설정 토글 (본인 문서만 수정 가능 — 검증은 firestore.rules가 담당 — LIB-03) */
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

/** 일별 공수 삭제 (빈 기록 정리용 — 존재하지 않는 문서 삭제는 멱등) */
export async function deleteDailyWork(userId: string, date: string): Promise<void> {
  await deleteDoc(doc(db, 'dailyWorks', `${userId}_${date}`));
}

/** 특정 월의 공수 기록 조회 */
export async function getMonthlyWorks(userId: string, year: number, month: number): Promise<DailyWorkRecord[]> {
  const { start, endExclusive } = monthRange(year, month);

  const q = query(
    collection(db, 'dailyWorks'),
    where('userId', '==', userId),
    where('date', '>=', start),
    where('date', '<', endExclusive),
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
  const { start, endExclusive } = monthRange(year, month);

  const q = query(
    collection(db, 'teamDailyWorks'),
    where('teamLeaderId', '==', teamLeaderId),
    where('date', '>=', start),
    where('date', '<', endExclusive),
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

/** 프로필 업데이트 (본인 문서·불변 필드(uid/role/email) 검증은 firestore.rules가 담당 — LIB-03) */
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
  pendingApplicants: number;
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

  // 대기중(pending) 지원자 수 — 서버 집계로 정확히 (예전엔 limit 10 목록을 클라이언트 필터해 10에서 캡됨, CALC-01)
  // ⚠️ applications employerId+status 복합 인덱스 필요 (firestore.indexes.json — 배포해야 실효)
  const pendingSnap = await getCountFromServer(
    query(
      collection(db, 'applications'),
      where('employerId', '==', employerId),
      where('status', '==', 'pending')
    )
  );
  const pendingApplicants = pendingSnap.data().count;

  return { activeJobs, totalApplicants, pendingApplicants };
}
