'use client';

import Link from 'next/link';

/** 비로그인 사용자 홈 화면 */
export default function GuestHome() {
  return (
    <div className="px-4 pt-6 pb-24">
      {/* 상단 헤더 */}
      <header className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-primary-500">일다오</h1>
        <Link
          href="/login"
          className="py-1.5 px-4 bg-primary-500 text-white text-sm font-medium rounded-lg hover:bg-primary-600 transition-colors"
        >
          로그인
        </Link>
      </header>

      {/* 앱 소개 배너 */}
      <div className="bg-gradient-to-r from-primary-500 to-blue-600 rounded-2xl p-5 mb-6 text-white">
        <h2 className="text-lg font-bold mb-1">건설·일용직 구인구직</h2>
        <p className="text-sm opacity-90 mb-3">일자리를 빠르게 찾아보세요</p>
        <Link
          href="/login"
          className="inline-block py-2 px-4 bg-white text-primary-500 text-sm font-semibold rounded-lg"
        >
          시작하기
        </Link>
      </div>

      {/* 카테고리 빠른 접근 */}
      <section className="mb-6">
        <h2 className="text-lg font-semibold mb-3">직종별 구인</h2>
        <div className="grid grid-cols-4 gap-3">
          {[
            { name: '철근', icon: '🔩' },
            { name: '목공', icon: '🪵' },
            { name: '설비', icon: '🔧' },
            { name: '전기', icon: '⚡' },
            { name: '도장', icon: '🎨' },
            { name: '용접', icon: '🔥' },
            { name: '타일', icon: '🧱' },
            { name: '더보기', icon: '➕' },
          ].map((category) => (
            <Link
              key={category.name}
              href="/login"
              className="flex flex-col items-center gap-1 p-3 bg-white rounded-xl border border-gray-100 hover:border-primary-300 transition-colors"
            >
              <span className="text-2xl">{category.icon}</span>
              <span className="text-xs font-medium text-gray-700">{category.name}</span>
            </Link>
          ))}
        </div>
      </section>

      {/* 최신 구인 목록 (샘플) */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold">최신 구인</h2>
        </div>
        <div className="space-y-3">
          {[
            { title: '철근공 3명 급구', location: '서울 강남구', wage: '25만', date: '내일~' },
            { title: '목공 팀 구합니다', location: '경기 수원시', wage: '28만', date: '5/7~' },
            { title: '설비 배관공 모집', location: '인천 남동구', wage: '27만', date: '5/8~' },
          ].map((job, i) => (
            <div key={i} className="card flex items-center gap-3">
              <div className="w-12 h-12 bg-primary-50 rounded-lg flex items-center justify-center">
                <span className="text-primary-500 font-bold text-sm">D-1</span>
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm truncate">{job.title}</h3>
                <p className="text-xs text-gray-500 mt-0.5">{job.location} · {job.date}</p>
              </div>
              <div className="text-right">
                <span className="text-accent-500 font-bold text-sm">{job.wage}</span>
                <p className="text-xs text-gray-400">일당</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-center">
          <Link href="/login" className="text-sm text-primary-500 font-medium">
            로그인하고 더 많은 공고 보기 →
          </Link>
        </div>
      </section>
    </div>
  );
}
