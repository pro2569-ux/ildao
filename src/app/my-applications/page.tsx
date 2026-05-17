'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { getApplicationsByWorker, getJob } from '@/lib/firestore';
import { Application, JobPost } from '@/types';

/**
 * 내 지원 내역 페이지
 * - 지원한 공고 목록 + 상태
 */
export default function MyApplicationsPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [applications, setApplications] = useState<(Application & { job?: JobPost })[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'pending' | 'accepted' | 'rejected'>('all');

  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (user) loadApplications();
  }, [user, authLoading]);

  const loadApplications = async () => {
    setLoading(true);
    try {
      const apps = await getApplicationsByWorker(user!.uid);
      // 각 지원에 대한 구인글 정보 로드
      const appsWithJobs = await Promise.all(
        apps.map(async (app) => {
          const job = await getJob(app.jobId);
          return { ...app, job: job || undefined };
        })
      );
      setApplications(appsWithJobs);
    } catch (error) {
      console.error('지원 내역 로드 실패:', error);
    } finally {
      setLoading(false);
    }
  };

  /** 필터링된 목록 */
  const filteredApps = filter === 'all'
    ? applications
    : applications.filter((a) => a.status === filter);

  /** 상태 뱃지 */
  const statusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return { text: '대기중', className: 'bg-yellow-100 text-yellow-600' };
      case 'accepted':
        return { text: '수락됨', className: 'bg-green-100 text-green-600' };
      case 'rejected':
        return { text: '거절됨', className: 'bg-red-100 text-red-500' };
      default:
        return { text: status, className: 'bg-gray-100 text-gray-500' };
    }
  };

  /** 날짜 포맷 */
  const formatDate = (date: Date) => {
    const d = new Date(date);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  };

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-primary-500 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 pb-24">
      {/* 상단 */}
      <div className="flex items-center gap-3 mb-4">
        <button onClick={() => router.back()} className="p-1">
          <svg className="w-6 h-6 text-gray-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 className="text-xl font-bold">지원 내역</h1>
      </div>

      {/* 상태 필터 */}
      <div className="flex gap-2 mb-4">
        {[
          { value: 'all', label: '전체' },
          { value: 'pending', label: '대기중' },
          { value: 'accepted', label: '수락됨' },
          { value: 'rejected', label: '거절됨' },
        ].map((f) => (
          <button
            key={f.value}
            onClick={() => setFilter(f.value as any)}
            className={`py-1.5 px-3 rounded-full text-sm font-medium transition-colors ${
              filter === f.value
                ? 'bg-primary-500 text-white'
                : 'bg-white border border-gray-200 text-gray-600'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {/* 지원 내역 목록 */}
      {filteredApps.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-gray-400 text-sm">
            {filter === 'all' ? '아직 지원한 공고가 없습니다' : `${filter === 'pending' ? '대기중인' : filter === 'accepted' ? '수락된' : '거절된'} 지원이 없습니다`}
          </p>
          {filter === 'all' && (
            <Link
              href="/jobs"
              className="inline-block mt-3 py-2 px-4 bg-primary-500 text-white text-sm font-medium rounded-lg"
            >
              구인공고 보러가기
            </Link>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filteredApps.map((app) => {
            const badge = statusBadge(app.status);
            return (
              <Link key={app.id} href={`/jobs/${app.jobId}`} className="card block">
                <div className="flex items-center justify-between mb-2">
                  <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${badge.className}`}>
                    {badge.text}
                  </span>
                  <span className="text-xs text-gray-400">
                    지원일 {formatDate(app.createdAt)}
                  </span>
                </div>
                {app.job ? (
                  <>
                    <h3 className="font-semibold text-sm">{app.job.title}</h3>
                    <div className="flex items-center gap-2 mt-1 text-xs text-gray-500">
                      <span>{app.job.category}</span>
                      <span>·</span>
                      <span className="text-accent-500 font-medium">
                        {app.job.dailyWage.toLocaleString()}원
                      </span>
                      <span>·</span>
                      <span>{app.job.location.address}</span>
                    </div>
                  </>
                ) : (
                  <p className="text-sm text-gray-400">삭제된 공고</p>
                )}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
