# 일다오 (ildao) - 건설/일용직 구인구직 플랫폼

## 프로젝트 개요
건설현장 및 일용직 근로자와 업체를 연결하는 모바일 우선 웹 플랫폼.
ildao.com 클론 프로젝트로, 구인/구직/공수계산/즐겨찾기 등 핵심 기능을 구현.

## 기술 스택
- **프레임워크**: Next.js 14 (App Router) + TypeScript
- **스타일링**: Tailwind CSS (모바일 우선 반응형)
- **백엔드**: Firebase (Auth, Firestore, Storage, FCM)
- **PWA**: next-pwa (서비스워커, 오프라인 지원, 홈화면 추가)
- **지도**: 카카오맵 API (현장 위치 표시)
- **배포**: Vercel

## 폴더 구조
```
ildao/
├── public/
│   ├── icons/           # PWA 아이콘 (72~512px)
│   └── manifest.json    # PWA 매니페스트
├── src/
│   ├── app/             # Next.js App Router 페이지
│   │   ├── layout.tsx   # 루트 레이아웃 (하단 네비게이션 포함)
│   │   ├── page.tsx     # 홈 (역할별 분기: Guest/Employer/Worker)
│   │   ├── login/       # 로그인
│   │   ├── register/    # 회원가입 (프로필 설정)
│   │   ├── jobs/        # 구인구직 게시판
│   │   │   ├── page.tsx       # 구인공고 피드 (필터/정렬)
│   │   │   ├── [id]/page.tsx  # 공고 상세 + 지원하기
│   │   │   └── create/page.tsx # 구인글 작성 (구인자)
│   │   ├── workers/     # 구직자 목록 (구인자용 인력 검색)
│   │   ├── my-jobs/     # 내 구인글 관리 (구인자)
│   │   ├── my-applications/ # 내 지원 내역 (구직자)
│   │   ├── calculator/  # 공수 계산기 (개인용/팀장용)
│   │   ├── favorites/   # 즐겨찾기 (역할별 탭)
│   │   └── profile/     # 내 정보
│   │       └── edit/    # 프로필 상세 편집
│   ├── components/
│   │   ├── home/        # 역할별 홈 컴포넌트
│   │   │   ├── GuestHome.tsx    # 비로그인 홈
│   │   │   ├── EmployerHome.tsx # 구인자 홈
│   │   │   └── WorkerHome.tsx   # 구직자 홈
│   │   ├── layout/      # 레이아웃 컴포넌트
│   │   │   └── BottomNav.tsx    # 역할별 하단 네비게이션
│   │   └── ui/          # 공용 UI 컴포넌트
│   │       ├── LoadingSpinner.tsx
│   │       └── KakaoMap.tsx     # 카카오맵 (view/select 모드, fallback 포함)
│   ├── lib/
│   │   ├── firebase.ts  # Firebase 초기화 및 서비스 인스턴스
│   │   └── firestore.ts # Firestore CRUD 헬퍼 함수
│   ├── contexts/
│   │   └── AuthContext.tsx # 인증 상태 관리 (AuthProvider)
│   ├── hooks/
│   │   └── useAuth.ts   # 인증 상태 추적 훅
│   └── types/
│       └── index.ts     # TypeScript 타입 정의
├── .env.local.example   # 환경변수 템플릿
├── next.config.js       # Next.js + PWA 설정
├── tailwind.config.ts   # Tailwind 커스텀 설정
└── tsconfig.json        # TypeScript 설정
```

## Firestore 컬렉션 구조
- **users**: uid, email, role, name, phone, skills[], experience, region, desiredWage, companyName, representativeName, mainJobCategories[], isPublic, createdAt, updatedAt
- **jobs**: employerId, title, category, dailyWage, numberOfWorkers, startDate, endDate, workHours, location{address,lat,lng}, description, status, applicants[], isPremium, createdAt, updatedAt
- **applications**: jobId, workerId, employerId, status(pending/accepted/rejected), createdAt
- **dailyWorks**: userId, date, manDay, overtime, dayOff, extension, expense, memo, weather, dailyWage, createdAt (docId: userId_date)
- **teamDailyWorks**: teamLeaderId, memberId, memberName, date, manDay, overtime, dayOff, extension, memo, createdAt (docId: leaderId_memberId_date)
- **teams**: members[{id, name, phone, dailyWage}], updatedAt (docId: userId)
- **favorites**: userId, targetId, targetType(user/job), createdAt

## 핵심 기능 (구현 로드맵)
1. ✅ 프로젝트 초기 세팅
2. ✅ 회원가입/로그인 (Firebase Auth - Google 로그인, 역할 선택)
3. ✅ 역할별 홈 화면 분기 (구인자/구직자/비로그인)
4. ✅ 구인글 작성/관리 (구인자: 작성, 목록, 마감, 삭제)
5. ✅ 구인공고 피드 (구직자: 필터, 정렬, 상세보기, 지원)
6. ✅ 지원 시스템 (지원하기, 지원 내역, 상태 표시)
7. ✅ 구직자 검색 (구인자: 공개 프로필 조회, 직종 필터)
8. ✅ 프로필 공개 토글 (구직자: isPublic 설정)
9. ✅ 역할별 하단 네비게이션
10. ⬜ 푸시 알림 (FCM)
11. ✅ 공수 계산기 (개인용/팀장용, 캘린더, 기간합계, 급여계산)
12. ✅ 즐겨찾기 관리 (역할별 탭, 추가/삭제/연락)
13. ⬜ 프리미엄 기능
14. ✅ 카카오맵 API 연동 (구인글 작성/상세, graceful fallback)
15. ✅ 프로필 상세 편집 (구직자/구인자 전용 필드)
16. ✅ 구인자 대시보드 통계 (진행중 공고, 지원자 수, 대기중)

## 개발 명령어
```bash
npm run dev     # 개발 서버 (http://localhost:3000)
npm run build   # 프로덕션 빌드
npm run start   # 프로덕션 서버
npm run lint    # 코드 검사
```

## 환경 설정
1. `.env.local.example`을 `.env.local`로 복사
2. Firebase 콘솔에서 프로젝트 생성 후 키 입력
3. 카카오 개발자 센터에서 지도 API 키 발급 → `.env.local`에 `NEXT_PUBLIC_KAKAO_MAP_KEY` 추가 (없으면 주소 텍스트만 표시)

## 디자인 원칙
- **모바일 우선**: max-w-lg (512px) 기준, 하단 네비게이션
- **브랜드 컬러**: Primary(파랑 #2563eb), Accent(주황 #f97316)
- **폰트**: Pretendard (한국어 최적화)
- **UX**: 큰 터치 영역, 직관적 아이콘, 빠른 로딩
