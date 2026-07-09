'use client';

import {
  collection, getDocs, query, where, orderBy, startAfter, limit,
  QueryConstraint, QueryDocumentSnapshot, DocumentData,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { JobPost } from '@/types';

// ===== 구인 공고 커서 페이지네이션 헬퍼 (P3-5) =====
// 공고 피드의 "더보기" 서버 페이지네이션 전용.
// ※ 복합 인덱스 회피 정책: where는 status 하나만(또는 0개) + createdAt 정렬.
//   직종/지역 필터·일당순 정렬이 활성일 때는 이 헬퍼 대신
//   기존 getJobs()로 크게 가져와 클라이언트에서 처리한다 (jobs/page.tsx 참고).

/** 한 페이지 크기 (첫 로드 및 "더보기" 단위) */
export const JOBS_PAGE_SIZE = 20;

/** 다음 페이지 시작점 커서 — 마지막으로 받은 Firestore 문서 스냅샷 */
export type JobsCursor = QueryDocumentSnapshot<DocumentData>;

/** fetchJobsPage 결과 */
export interface JobsPageResult {
  jobs: JobPost[];
  /** 다음 페이지 조회 시 넘길 커서 (문서가 없으면 null) */
  cursor: JobsCursor | null;
  /** 다음 페이지가 실제로 존재하는지 (pageSize+1건 조회로 판별) */
  hasMore: boolean;
}

/** Timestamp → Date 변환 (firestore.ts와 동일한 규칙) */
const toDate = (ts: any): Date => ts?.toDate?.() || new Date(ts) || new Date();

/** Firestore 문서 → JobPost 변환 */
const mapJob = (d: QueryDocumentSnapshot<DocumentData>): JobPost => {
  const data = d.data();
  return {
    ...data,
    id: d.id,
    startDate: toDate(data.startDate),
    endDate: data.endDate ? toDate(data.endDate) : undefined,
    createdAt: toDate(data.createdAt),
    updatedAt: toDate(data.updatedAt),
  } as JobPost;
};

/**
 * 모집중 공고 한 페이지 조회 (createdAt 내림차순)
 * - cursor 이후 문서부터 pageSize건 반환. cursor 미전달 시 처음부터.
 * - hasMore 판별을 위해 pageSize+1건을 요청하고 초과분은 버림.
 * - 필터/정렬이 바뀌면 반드시 커서를 버리고 처음부터 다시 조회할 것.
 */
export async function fetchJobsPage(options?: {
  cursor?: JobsCursor | null;
  pageSize?: number;
}): Promise<JobsPageResult> {
  const pageSize = options?.pageSize ?? JOBS_PAGE_SIZE;

  const constraints: QueryConstraint[] = [
    where('status', '==', 'open'),
    orderBy('createdAt', 'desc'),
  ];
  if (options?.cursor) constraints.push(startAfter(options.cursor));
  constraints.push(limit(pageSize + 1)); // 다음 페이지 존재 여부 확인용 +1건

  const snapshot = await getDocs(query(collection(db, 'jobs'), ...constraints));

  const hasMore = snapshot.docs.length > pageSize;
  const pageDocs = hasMore ? snapshot.docs.slice(0, pageSize) : snapshot.docs;

  return {
    jobs: pageDocs.map(mapJob),
    cursor: pageDocs.length > 0 ? pageDocs[pageDocs.length - 1] : null,
    hasMore,
  };
}
