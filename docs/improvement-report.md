# 일다오(ildao) 개선 제안 보고서

> **작성일**: 2026-06-12
> **대상**: `C:\Project\ildao` (Next.js 14 + TypeScript + Firebase)
> **방법론**: 4개 관점(제품 기능, 아키텍처/코드 품질, 성능/SEO/PWA, 품질/운영)의 병렬 분석 에이전트가 코드베이스 전체를 읽고 도출한 제안 총 42건. 각 항목에 영향(impact) · 공수(effort) · 우선순위(P1~P5)를 부여했습니다.
> **전제**: 결함 수정(`docs/defect-report.md`)이 선행되어야 하는 항목은 본문에 명시했습니다.

---

## 1. 추진 로드맵 제안

### 0단계 — 결함 수정과 병행 (즉시, ~1주)
결함 보고서의 최우선 항목과 겹치는, 사실상 "수리"에 가까운 개선입니다.
- **Firestore 보안 룰 전 컬렉션 작성 + 배포 파이프라인 + 에뮬레이터 rules 테스트** (품질·운영 P1)
- **git 저장소 복구 + GitHub Actions CI(lint/typecheck/build) + Vercel 프리뷰 배포** (품질·운영 P1)
- **PWA manifest 아이콘 PNG 생성** (성능·SEO P1)
- **데이터 레이어 실결함 3건 수정** — toDate 1970 버그, 대시보드 지원자 수 캡, upsert 이중 왕복 (아키텍처 P1)

### 1단계 — 단기 (2~4주): 핵심 사용자 여정 완성
현재 앱은 "지원"까지만 되고 그 다음(지원자 확인 → 수락 → 연락)이 끊겨 있습니다. 매칭 플랫폼의 본질 기능부터 잇습니다.
- **지원자 관리 화면 신설** — 수락/거절 기능 연결 (제품 P1)
- **수락 후 연락 수단 제공** — 전화 연결 우선, 채팅은 후순위 (제품 P1)
- **지역 필드 분리 및 지역 필터** (제품 P1)
- **직종 카테고리 상수 단일화** (아키텍처 P2) / **쓰기 경로 원자성 보강** (아키텍처 P2)
- **구인공고 피드 페이지네이션** + **대시보드 getCountFromServer 전환** (성능 P2)
- **robots.ts / sitemap.ts** (성능 P2) / **환경변수 검증 + App Check** (운영 P2)

### 2단계 — 중기 (1~2개월): 성장 기반
- **FCM 푸시 알림** — 지원 발생/수락·거절 알림 (제품 P2, 로드맵 10번 미구현 항목)
- **공고 상세 서버 렌더링 + generateMetadata** — 검색 노출·카톡 공유 미리보기 (성능 P1)
- **calculator/page.tsx(1,206줄) 분할** (아키텍처 P1) + **TanStack Query 도입** (아키텍처 P2)
- **공수/급여 계산 순수 함수 추출 + Vitest 테스트** (운영 P2)
- **사업자등록번호 진위 확인 + 인증 뱃지** (제품 P2)
- **Sentry 에러 모니터링** + **Firestore 백업** (운영 P3)

### 3단계 — 장기 (분기 단위): 차별화·수익화
- **후기·평판 시스템** (제품 P3) / **구직자 스카웃 기능** (제품 P2)
- **출역 확인 ↔ 공수 계산기 자동 연동** (제품 P3 — 일다오만의 차별화 포인트)
- **프리미엄(상위 노출·끌어올리기·급구 뱃지) 수익화** (제품 P4, 로드맵 13번)
- **팀 단위 지원** (제품 P4) / **Next.js 15 + Serwist 전환** (아키텍처 P4)

---

## 2. 제품 기능 — 12건

| 우선순위 | 제안 | 영향 | 공수 |
|---|---|---|---|
| P1 | 지원자 관리 화면 신설 (수락/거절 기능 연결) | 높음 | 작음 |
| P1 | 수락 후 연락 수단 제공 (전화 연결 → 추후 채팅) | 높음 | 작음 |
| P1 | 지역(시/도) 필드 분리 및 지역 필터 구현 | 높음 | 작음 |
| P2 | FCM 푸시 알림 (지원 발생/수락·거절/관심 직종 신규 공고) | 높음 | 큼 |
| P2 | 구직자 상세 페이지 + 스카웃(일자리 제안) 기능 | 높음 | 중간 |
| P2 | 사업자등록번호 진위 확인 및 인증 뱃지 | 높음 | 작음 |
| P2 | 공고 자동 마감 + D-day/마감임박 표시 | 중간 | 작음 |
| P3 | 후기·평판 시스템 (양방향 평가) | 높음 | 중간 |
| P3 | 출역(출근) 확인 및 공수 계산기 자동 연동 | 높음 | 큼 |
| P4 | 프리미엄 기능: 상위 노출 + 끌어올리기 + 급구 뱃지 (수익화) | 중간 | 큼 |
| P4 | 팀 단위 지원 (팀장이 팀원 묶음으로 지원) | 중간 | 중간 |
| P5 | 신고 기능 + 게스트 홈 실데이터 전환 및 직종별 노임단가 가이드 | 중간 | 작음 |

### P1 · 지원자 관리 화면 신설 (수락/거절 기능 연결)

- **영향**: 높음 / **공수**: 작음 / **분류**: 사용자 여정 핵심 결함

현재 구인자는 지원자를 볼 방법이 전혀 없다. src/lib/firestore.ts:111의 getApplicationsByJob과 :152의 updateApplicationStatus가 정의만 되고 어떤 페이지에서도 import되지 않으며, my-jobs/page.tsx:149-151은 '지원자 N명' 숫자만 표시하고 클릭 동선이 없다. 즉 구직자의 지원 상태는 영원히 pending에 머물러 my-applications의 '수락됨/거절됨' 필터(src/app/my-applications/page.tsx:19)가 작동할 수 없는 상태다. 구현: /my-jobs/[id]/applicants 페이지를 신설해 getApplicationsByJob으로 지원 목록을 가져오고 각 workerId로 getUserProfile을 조인해 이름·기술·경력·희망일당 카드를 표시, 수락/거절 버튼으로 updateApplicationStatus 호출. 수락 시 jobs.applicants[] 배열도 갱신하고(현재 applyToJob이 배열을 채우지 않음, firestore.ts:99-108) 모집 인원(numberOfWorkers) 충족 시 마감 제안 모달을 띄운다. my-jobs 카드의 '지원자 N명'을 이 페이지 링크로 변경.

### P1 · 수락 후 연락 수단 제공 (전화 연결 → 추후 채팅)

- **영향**: 높음 / **공수**: 작음 / **분류**: 사용자 여정 핵심 결함

지원이 수락되어도 양측이 서로 연락할 방법이 없다. jobs/[id]/page.tsx의 업체 정보(157-175행)는 업체명·대표명만 보여주고 전화번호를 노출하지 않으며, Application 타입(src/types/index.ts:37-44)에는 메시지 필드조차 없다. users 컬렉션에 phone 필드가 이미 있으므로 1단계는 비용 제로다. 구현: (1) 지원 상태가 accepted가 되면 상호 전화번호를 노출하는 정책 — my-applications의 수락된 카드에 'tel:' 링크 전화 버튼, 지원자 관리 화면의 수락된 지원자 카드에도 전화 버튼. (2) 지원 시 한 줄 자기소개 메시지 필드(applications.message) 추가로 구인자의 판단 근거 제공. (3) 2단계로 chats/{chatId}/messages 서브컬렉션 + onSnapshot 실시간 채팅 도입(chatId: jobId_workerId). 일용직 시장 특성상 전화가 주 채널이므로 전화 우선, 채팅은 후순위.

### P1 · 지역(시/도) 필드 분리 및 지역 필터 구현

- **영향**: 높음 / **공수**: 작음 / **분류**: 검색/매칭 고도화

jobs/page.tsx 주석(18행)에는 '지역/직종/일당 필터'라고 적혀 있으나 실제 UI에는 직종 필터만 있다. getJobs의 region 파라미터(firestore.ts:33)는 시그니처에만 존재하고 where 절이 한 번도 적용되지 않으며, getPublicWorkers의 region(firestore.ts:161)도 동일하게 미사용이다. 근본 원인은 JobPost에 region 필드가 없고 작성 페이지가 지역을 주소 문자열로 합쳐버리기 때문(jobs/create/page.tsx:61 `${region} ${addressDetail}`). 일용직은 새벽 출근 특성상 '집 근처'가 일당보다 중요한 1순위 조건이다. 구현: (1) jobs 문서에 region 필드(시/도) 별도 저장 — 작성 폼은 이미 REGIONS 셀렉트를 갖고 있어 한 줄 추가로 끝남. (2) jobs 페이지 직종 칩 위에 지역 칩 추가, getJobs에 where('region','==',...) 적용 + (region, status, createdAt) 복합 인덱스. (3) users.region과 매칭해 WorkerHome 기본 필터를 내 지역으로 설정. (4) 기존 문서는 address 문자열 파싱 마이그레이션 스크립트로 백필.

### P2 · FCM 푸시 알림 (지원 발생/수락·거절/관심 직종 신규 공고)

- **영향**: 높음 / **공수**: 큼 / **분류**: 로드맵 미구현 (10번)

로드맵 10번 미구현. 현재 applyToJob(firestore.ts:99-108)은 문서만 생성하고 끝나서, 구인자는 앱을 열어보기 전까지 지원자가 온 줄 모르고 구직자도 수락 사실을 모른다. 당일·익일 출근이 일반적인 일용직 시장에서 알림 부재는 매칭 실패와 직결된다. 구현: (1) users 문서에 fcmTokens[] 필드 + 알림 권한 요청 UI(프로필 페이지 토글), firebase/messaging getToken 저장. (2) Cloud Functions onDocumentCreated('applications/{id}')로 구인자에게 '새 지원자' 푸시, onDocumentUpdated로 status 변경 시 구직자에게 '수락/거절' 푸시. (3) jobs 신규 생성 시 해당 region+category를 구독한 구직자에게 토픽 푸시(messaging topic: region_category). (4) 인앱 알림함 notifications 컬렉션 {userId, type, title, body, link, read, createdAt} 병행 — 푸시 미허용 사용자 커버. next-pwa가 이미 설정돼 있어 서비스워커 기반은 갖춰져 있다.

### P2 · 구직자 상세 페이지 + 스카웃(일자리 제안) 기능

- **영향**: 높음 / **공수**: 중간 / **분류**: 사용자 여정 빈틈

workers/page.tsx의 구직자 카드는 div(87행)라 클릭이 불가능하고, 구인자가 마음에 드는 인력을 발견해도 즐겨찾기 추가·연락·제안 등 아무 행동도 할 수 없다 — 인력 검색 기능이 '구경'에서 끝난다. 구현: (1) /workers/[id] 상세 페이지 신설 — introduction, skills, experience, region, desiredWage 전체 표시 + 즐겨찾기 버튼(addFavorite는 이미 구현됨, firestore.ts:342). (2) '내 공고 제안하기' 버튼: 구인자의 open 상태 공고 목록 중 선택해 offers 컬렉션 {jobId, employerId, workerId, status(pending/accepted/declined), createdAt} 생성 — 역방향 지원 흐름. (3) 구직자 홈/알림함에 받은 제안 표시, 수락 시 applications에 accepted 상태로 자동 생성. 이는 구인난이 심한 직종(철근·비계 등)에서 구인자 측 능동 매칭을 가능하게 하는 핵심 기능이다.

### P2 · 사업자등록번호 진위 확인 및 인증 뱃지

- **영향**: 높음 / **공수**: 작음 / **분류**: 신뢰/안전

UserProfile에 businessNumber 필드가 이미 존재하지만(src/types/index.ts:22) 어떤 검증도 하지 않아 누구나 구인자로 가입해 허위 공고를 올릴 수 있다. 임금체불·노쇼가 만연한 시장 특성상 업체 신뢰 표시는 구직자의 지원 결정에 직접적 영향을 준다. 구현: (1) 국세청 사업자등록 상태조회 API(공공데이터포털, 무료)를 Next.js Route Handler(/api/verify-business)로 프록시 호출 — API 키를 서버에 숨김. (2) 프로필 편집에서 사업자번호 입력 시 즉시 검증, users 문서에 businessVerified: boolean, businessVerifiedAt 저장. (3) jobs/[id] 업체 정보 카드(157-175행)와 공고 리스트 카드에 '인증업체' 체크 뱃지 표시. (4) 향후 미인증 업체의 공고 작성 제한 또는 노출 후순위 정책의 기반이 된다. API 연동이 단순해서 효과 대비 비용이 매우 낮다.

### P2 · 공고 자동 마감 + D-day/마감임박 표시

- **영향**: 중간 / **공수**: 작음 / **분류**: 사용자 여정 빈틈

현재 공고는 구인자가 수동으로 '마감'을 누르지 않는 한 startDate가 지나도 영원히 open 상태로 피드에 남는다(jobs/page.tsx는 status=='open'만 조회, 날짜 검사 없음). 죽은 공고가 쌓이면 구직자가 지원해도 응답이 없어 플랫폼 신뢰가 급락한다. GuestHome에는 이미 D-1 뱃지 디자인이 샘플로 존재하지만(GuestHome.tsx:70) 실데이터에는 미적용. 구현: (1) 클라이언트 즉시 개선 — getJobs 결과에서 startDate < 오늘인 공고를 필터링하거나 '지난 공고' 구분 표시, 공고 카드에 D-day 뱃지(시작일 기준) 추가. (2) 서버 측 — Cloud Functions scheduled(매일 0시) 또는 Vercel Cron으로 startDate가 지난 open 공고를 expired/closed로 일괄 변경. (3) 구인자에게는 마감 전날 '공고가 곧 시작됩니다. 인원이 찼나요?' 푸시로 연장/마감 선택 유도. 4번 FCM과 묶으면 시너지가 크다.

### P3 · 후기·평판 시스템 (양방향 평가)

- **영향**: 높음 / **공수**: 중간 / **분류**: 한국 일용직 시장 특화

현재 평판 데이터가 전무하다. JobStatus에 'completed'가 정의돼 있지만(src/types/index.ts:49) 어디서도 사용되지 않아 '일이 끝났다'는 상태 전이 자체가 없다. 일용직 시장의 양대 리스크(업체의 임금체불·구직자의 노쇼)는 평판 시스템 없이는 해소가 안 된다. 구현: (1) 공고 상태 흐름 완성: open → in_progress(시작일 도달) → completed(구인자가 완료 처리). (2) reviews 컬렉션 {jobId, reviewerId, targetId, role, rating(1-5), tags[], comment, createdAt} — 구직자→업체 태그('임금 제때 지급','공고와 조건 동일','현장 안전'), 업체→구직자 태그('시간 엄수','숙련도 우수','재고용 의향'). accepted 지원 관계가 있는 사용자만 작성 가능하도록 Firestore 규칙 제한. (3) users 문서에 ratingAvg, ratingCount 비정규화 저장(Functions 트리거로 집계)해 workers 목록·업체 정보 카드에 별점 노출. 1번(지원자 관리)이 선행돼야 accepted 관계가 생기므로 그 직후 착수.

### P3 · 출역(출근) 확인 및 공수 계산기 자동 연동

- **영향**: 높음 / **공수**: 큼 / **분류**: 한국 일용직 시장 특화

dailyWorks 컬렉션(docId: userId_date)으로 수기 공수 기록은 잘 구현돼 있으나(firestore.ts:216-238), 매칭된 일자리와 완전히 분리돼 있어 구직자가 매일 직접 입력해야 한다. 구현: (1) attendances 컬렉션 {jobId, workerId, employerId, date, checkInAt, checkInLat/Lng, method('gps'|'qr'|'manual')} — 수락된 지원자가 공고 상세에서 '출근 체크' 버튼, 현장 location.lat/lng(이미 jobs에 저장됨)과 GPS 거리 검증(예: 500m 이내). (2) 출근 체크 성공 시 saveDailyWork를 자동 호출해 해당일 manDay 1.0 + dailyWage(공고의 일당)를 공수 계산기에 자동 기입 — 기존 캘린더 UX 그대로 활용. (3) 구인자용 지원자 관리 화면에 일자별 출역 현황 표(누가 왔는지)를 제공해 팀장의 수기 출력일보를 대체. 이는 단순 구인 매칭을 넘어 '근태→정산' 락인을 만드는 차별화 기능으로, 공수 계산기라는 기존 자산과 결합되는 일다오만의 강점이 된다.

### P4 · 프리미엄 기능: 상위 노출 + 끌어올리기 + 급구 뱃지 (수익화)

- **영향**: 중간 / **공수**: 큼 / **분류**: 로드맵 미구현 (13번)

로드맵 13번 미구현. isPremium은 createJob에서 항상 false로 하드코딩되고(firestore.ts:22) 정렬·노출 어디에도 반영되지 않는다. 구현: (1) 노출 로직 먼저 — jobs 피드 상단에 '프리미엄 공고' 섹션(where('isPremium','==',true) 별도 쿼리 후 병합) 또는 orderBy를 isPremium desc, createdAt desc 복합으로 변경 + 카드에 'AD/프리미엄' 뱃지. (2) 상품 설계: (a) 프리미엄 공고(7일 상위 노출), (b) 끌어올리기(bump — updatedAt 갱신으로 최신순 재진입, 1일 N회 제한), (c) '급구' 강조 뱃지. jobs 문서에 premiumUntil: Timestamp를 두고 만료를 쿼리에서 처리(where('premiumUntil','>',now)). (3) 결제: 토스페이먼츠 결제위젯을 Next.js Route Handler로 연동, payments 컬렉션에 거래 기록, 결제 승인 webhook에서 jobs 필드 갱신. 핵심 여정(1~3번)이 완성돼 트래픽이 생긴 후에 도입해야 의미가 있으므로 우선순위는 중간.

### P4 · 팀 단위 지원 (팀장이 팀원 묶음으로 지원)

- **영향**: 중간 / **공수**: 중간 / **분류**: 한국 일용직 시장 특화

건설 일용직은 팀(반장+팀원) 단위 이동이 일반적이고, 공고도 numberOfWorkers로 복수 인원을 모집하지만(jobs/create/page.tsx:39) 지원은 1인 단위만 가능하다. 흥미롭게도 teams 컬렉션(docId: userId, members[])이 공수 계산기 팀장 모드용으로 이미 존재하므로(firestore.ts:280-292) 데이터 기반은 갖춰져 있다. 구현: (1) Application에 teamSize: number, teamMembers?: {name, phone}[] 필드 추가. (2) 공고 상세 지원 버튼을 '혼자 지원 / 팀으로 지원' 선택지로 확장 — 팀 지원 시 getTeamMembers로 기존 팀원 목록을 불러와 체크박스 선택. (3) 지원자 관리 화면(1번 제안)에서 '팀 3명' 뱃지로 표시하고 수락 시 모집 인원 카운트를 teamSize만큼 차감. GuestHome 샘플에도 '목공 팀 구합니다'(GuestHome.tsx:65)가 있을 만큼 시장에서 자연스러운 단위이며, 경쟁 서비스 대비 차별화 포인트다.

### P5 · 신고 기능 + 게스트 홈 실데이터 전환 및 직종별 노임단가 가이드

- **영향**: 중간 / **공수**: 작음 / **분류**: 신뢰/안전 + 전환율

세 가지 저비용 개선 묶음. (1) 신고: 공고 상세·구직자 프로필에 신고 버튼 — reports 컬렉션 {reporterId, targetType('job'|'user'), targetId, reason(허위공고/임금체불/욕설 등 선택지), detail, status, createdAt}. 누적 N회 신고 시 자동 비노출 플래그. 현재 악성 공고를 거를 수단이 전무하다. (2) 게스트 홈 실데이터: GuestHome.tsx:63-81이 하드코딩 샘플 3건을 보여주고 카테고리 버튼(36-53행)은 onClick이 없어 무동작이다. getJobs({status:'open', limitCount:3})로 실제 공고를 노출하고 카테고리 버튼을 /jobs?category=로 연결하면 비로그인 방문자의 가입 전환율이 오른다(jobs 피드는 이미 비로그인 접근 가능). (3) 노임단가 가이드: 대한건설협회 시중노임단가(공표 자료)를 직종별 상수로 두고, 구인글 작성의 일당 입력란 하단에 '철근공 평균 단가 26.5만원' 힌트, 구직자 프로필의 희망일당 입력에도 동일 적용 — 비현실적 일당 공고를 줄이고 정보 비대칭을 해소한다. 추후 4대보험·노무 안내 정적 콘텐츠 페이지(/guide)로 확장.

---

## 3. 아키텍처 · 코드 품질 — 11건

| 우선순위 | 제안 | 영향 | 공수 |
|---|---|---|---|
| P1 | calculator/page.tsx(1206줄) 분할: 탭별 컴포넌트 + 데이터 훅 + 날짜 유틸 추출 | 높음 | 중간 |
| P1 | 데이터 레이어 실결함 3건 수정: toDate 1970 버그, 대시보드 지원자 수 캡, upsert 이중 왕복 | 높음 | 작음 |
| P2 | 직종 카테고리 상수 단일화 — workers 페이지 '기타' 누락 등 실제 불일치 존재 | 높음 | 작음 |
| P2 | TanStack Query(react-query) 도입 — N+1 보조 데이터 로드, 탭 전환 재조회, Firestore 읽기 비용 절감 | 높음 | 중간 |
| P2 | withConverter + zod로 Firestore 문서-타입 경계의 `as` 단언 제거 | 중간 | 중간 |
| P2 | 쓰기 경로의 원자성 보강 — 중복 지원 방지와 즐겨찾기 결정적 docId | 중간 | 작음 |
| P3 | 공개 페이지(구인공고 피드/상세)의 서버 컴포넌트화 — SEO와 초기 로딩 개선 | 높음 | 큼 |
| P3 | 인증 가드 훅(useRequireAuth)과 날짜/통화 포맷 유틸 공통화 | 중간 | 작음 |
| P3 | 공용 UI 컴포넌트 정착 — 정의만 되고 사용처 0인 LoadingSpinner부터 | 중간 | 중간 |
| P4 | 실시간 구독(onSnapshot) 선별 도입 — 지원 상태 변경과 사용자 프로필 | 중간 | 중간 |
| P4 | Next.js 15 업그레이드 및 비유지보수 next-pwa 교체(Serwist) | 중간 | 중간 |

### P1 · calculator/page.tsx(1206줄) 분할: 탭별 컴포넌트 + 데이터 훅 + 날짜 유틸 추출

- **영향**: 높음 / **공수**: 중간 / **분류**: 코드 구조 / 유지보수성

C:/Project/ildao/src/app/calculator/page.tsx는 단일 컴포넌트에 useState가 약 30개(67~108행: 개인용 편집 상태 8개 + 팀용 편집 상태 11개 + 공통 상태) 몰려 있고, renderCalendar(517행), renderManDayStepper(586행), renderTogglePills(616행), renderPersonalDayModal(660행), renderTeamDayModal(763행)이 컴포넌트가 아닌 내부 render 함수로 정의되어 있다. 이 패턴은 어떤 상태가 바뀌어도(메모 한 글자 입력마다) 캘린더 42셀 전체가 리렌더되며, React.memo/가상 DOM 최적화가 불가능하다. 또한 68~69행 `useState(2026)`, `useState(5)`로 연/월 초기값이 하드코딩되어 있어 113~117행 useEffect가 보정하기 전 한 프레임 동안 잘못된 월이 노출되고, 인증이 이미 캐시된 경우 잘못된 월로 1회 + 보정 후 1회의 이중 Firestore fetch가 발생한다(165~172행 로드 effect가 currentYear/currentMonth 의존). 권장 분할: (1) components/calculator/PersonalCalculator.tsx, TeamCalculator.tsx — 탭별 분리로 상태 절반씩 격리, (2) hooks/useMonthlyWorks.ts, useTeamWorks.ts — 로드/저장/로컬 캐시 갱신 로직 추출, (3) 공용 컴포넌트 CalendarGrid, ManDayStepper, TogglePills, DayEditBottomSheet(개인/팀 모달은 경비·날씨 필드 유무만 다름 — props로 통합 가능), (4) lib/date.ts — getDaysInMonth/formatDateKey/DAY_LABELS, lib/format.ts — formatWon. 개인용 편집 상태 7개는 단일 `editForm` 객체 state 또는 useReducer로 묶으면 openDayModal(234~257행)의 7연속 setState도 제거된다. 초기값은 `useState(() => new Date().getFullYear())` 지연 초기화로 교체.

### P1 · 데이터 레이어 실결함 3건 수정: toDate 1970 버그, 대시보드 지원자 수 캡, upsert 이중 왕복

- **영향**: 높음 / **공수**: 작음 / **분류**: 데이터 레이어 / 버그

firestore.ts에 동작상 결함이 3건 있다. (1) C:/Project/ildao/src/lib/firestore.ts:12 `const toDate = (ts: any): Date => ts?.toDate?.() || new Date(ts) || new Date();` — ts가 null이면 `new Date(null)`이 1970-01-01을 반환하고(truthy), undefined면 Invalid Date를 반환하는데 Invalid Date도 객체라 truthy이므로 마지막 `|| new Date()`는 절대 도달하지 않는다. serverTimestamp가 아직 서버에서 해결되지 않은 로컬 스냅샷(글 작성 직후 목록 재조회)에서 createdAt이 null로 내려오면 화면에 '1970년' 또는 'NaN/NaN'이 표시된다. `ts instanceof Timestamp ? ts.toDate() : ...` 명시 분기 + Invalid Date 검사로 교체해야 한다. (2) firestore.ts:420~427 getEmployerStats — `limit(10)`을 건 쿼리의 `appsSnap.size`를 totalApplicants로 사용하므로 지원자가 10명을 넘으면 대시보드에 항상 '10'으로 캡되어 표시된다. `getCountFromServer(query(...))`로 카운트 쿼리를 분리해야 한다(읽기 비용도 1/1000). (3) saveDailyWork(216~238행)·saveTeamDailyWork(295~317행)는 getDoc으로 존재 확인 후 update/set을 분기하는 2회 왕복 구조인데, `setDoc(docRef, {...defaults, ...data, updatedAt: serverTimestamp()}, { merge: true })` 1회로 대체 가능하며 read-then-write 레이스도 제거된다. 추가로 모든 호출부의 에러 처리가 제각각이다: jobs/page.tsx:42~44는 console.error만 하고 사용자에게 에러 UI가 전혀 없고, favorites/page.tsx:102~107은 error state + 재시도 버튼, calculator는 배너만 표시한다. 데이터 레이어에서 도메인 에러로 정규화하고 호출부 에러 UI 패턴을 통일할 것.

### P2 · 직종 카테고리 상수 단일화 — workers 페이지 '기타' 누락 등 실제 불일치 존재

- **영향**: 높음 / **공수**: 작음 / **분류**: 중복 제거 / 상수 관리

JobCategory 13종 배열이 6개 파일에 하드코딩 중복되어 있다: src/app/jobs/page.tsx:9, src/app/workers/page.tsx:9, src/app/register/page.tsx:11, src/app/profile/edit/page.tsx:10, src/app/jobs/create/page.tsx:12, src/components/home/WorkerHome.tsx:10. 이미 불일치가 발생했다 — workers/page.tsx:10은 `'전체', '철근', ..., '비계', '잡역',`으로 끝나 '기타'가 빠져 있어, 회원가입(register)에서 '기타' 기술을 선택한 구직자를 구인자가 인력 검색에서 직종 필터로 찾을 수 없다. src/lib/constants.ts를 신설해 `export const JOB_CATEGORIES = ['철근', ...] as const` 단일 소스로 두고, types/index.ts의 JobCategory 타입도 `typeof JOB_CATEGORIES[number]`로 파생시키면 타입과 상수가 자동 동기화된다. WEATHER_OPTIONS(calculator/page.tsx:25), 공고 상태 뱃지 매핑(favorites/page.tsx:145 jobStatusBadge)도 같은 파일로 이동 대상.

### P2 · TanStack Query(react-query) 도입 — N+1 보조 데이터 로드, 탭 전환 재조회, Firestore 읽기 비용 절감

- **영향**: 높음 / **공수**: 중간 / **분류**: 데이터 페칭 전략

현재 모든 페이지가 useState+useEffect 수동 페칭이라 캐시가 전혀 없다. 구체적 비용 근거: (1) favorites/page.tsx:70~99 — 즐겨찾기 N건마다 getUserProfile/getJob을 개별 await하는 N+1 패턴으로, 즐겨찾기 50건이면 매 방문마다 Firestore 읽기 51회가 발생하고 캐시가 없어 탭을 오갈 때마다 반복된다. (2) calculator/page.tsx:165~172 — activeTab이 의존성에 있어 개인용↔팀장용 탭을 전환할 때마다 같은 달 데이터를 매번 재조회한다. (3) jobs/page.tsx:28~30 — 카테고리 필터를 눌렀다 되돌려도 전체 목록을 재요청한다. TanStack Query를 도입하면 queryKey(['monthlyWorks', uid, year, month] 등) 기반 캐시로 이런 중복 읽기가 제거되고, 현재 페이지마다 제각각인 loading/error/재시도 상태(favorites는 error+재시도, jobs는 에러 UI 없음)가 useQuery의 표준 상태로 통일된다. 저장 후 setMonthlyRecords로 수동 동기화하는 코드(calculator/page.tsx:280~295, 447~468)도 useMutation + invalidateQueries 또는 setQueryData로 단순화된다. Firestore는 읽기 횟수가 곧 과금이므로 직접적인 비용 절감 효과가 있다. 도입은 firestore.ts 함수 시그니처 변경 없이 호출부만 useQuery로 감싸면 되어 점진 적용 가능하다.

### P2 · withConverter + zod로 Firestore 문서-타입 경계의 `as` 단언 제거

- **영향**: 중간 / **공수**: 중간 / **분류**: 타입 안전성

firestore.ts는 모든 조회 함수가 `doc.data()`를 `as JobPost`, `as Application`, `as UserProfile` 등으로 강제 단언한다(63, 79, 122, 137, 179, 192, 257, 274, 336, 389, 432행 등 11곳 이상). 필드가 누락되거나 타입이 다른 레거시 문서가 있어도 컴파일러가 잡지 못하고 런타임에 `job.dailyWage.toLocaleString()`(jobs/page.tsx:131) 같은 곳에서 터진다. AuthContext.tsx:48~52도 동일하게 수동 변환 + `as UserProfile`로 firestore.ts의 getUserProfile(184~193행)과 변환 로직이 중복되어 있다. 개선: (1) 각 컬렉션에 `FirestoreDataConverter<T>`를 정의해 `collection(db,'jobs').withConverter(jobConverter)`로 Timestamp→Date 변환과 id 주입을 컨버터 한 곳에 집중 — 현재 함수마다 반복되는 `{...data, id: doc.id, createdAt: toDate(...)}` 보일러플레이트(6곳 반복)가 사라진다. (2) 외부 입력 경계(특히 사용자 작성 데이터인 jobs, users)는 zod 스키마로 `safeParse`해 깨진 문서를 목록에서 걸러내거나 기본값을 채운다. 클라이언트가 Firestore에 직접 쓰는 구조(보안 규칙만으로 스키마 강제 불가)이므로 읽기 시 런타임 검증의 가치가 일반 REST 백엔드보다 크다.

### P2 · 쓰기 경로의 원자성 보강 — 중복 지원 방지와 즐겨찾기 결정적 docId

- **영향**: 중간 / **공수**: 작음 / **분류**: 데이터 레이어 / 정합성

두 쓰기 경로가 비원자적 check-then-act 패턴이라 중복 데이터가 생길 수 있다. (1) 지원하기: applyToJob(firestore.ts:99~108)은 addDoc으로 무조건 새 문서를 만들고, 중복 방지는 호출부가 hasApplied(141~149행)를 먼저 조회하는 방식에 의존한다 — 더블탭이나 네트워크 재시도 시 같은 공고에 지원서 2건이 생기고, 이는 getApplicationCount(204~211행)와 구인자 대시보드 통계를 오염시킨다. dailyWorks가 이미 쓰는 결정적 docId 패턴(`${userId}_${date}`)을 동일하게 적용해 `setDoc(doc(db,'applications', `${jobId}_${workerId}`), ...)`로 바꾸면 문서 ID 수준에서 중복이 원천 차단되고 hasApplied도 getDoc 1회(쿼리 대비 저렴)로 단순해진다. (2) 즐겨찾기: addFavorite(342~350행)도 addDoc이라 빠른 연타 시 중복 문서가 생기며, removeFavorite(353~362행)이 쿼리 후 일괄 삭제로 보정하는 우회 구조다 — `${userId}_${targetId}` docId로 바꾸면 add/remove/isFavorited 모두 단건 연산이 된다. 두 변경 모두 firestore.rules의 create 조건을 docId 패턴 검증으로 강화할 수 있어 보안 규칙도 단단해진다.

### P3 · 공개 페이지(구인공고 피드/상세)의 서버 컴포넌트화 — SEO와 초기 로딩 개선

- **영향**: 높음 / **공수**: 큼 / **분류**: 아키텍처 / 렌더링 전략

src 하위 21개 파일 전부가 'use client'이고 페이지 레벨 컴포넌트도 예외가 없다(grep 확인). 구인공고 피드(src/app/jobs/page.tsx:1)와 상세(src/app/jobs/[id]/page.tsx:1)는 인증이 전혀 필요 없는 공개 데이터인데도 클라이언트에서 getJobs를 호출하므로(jobs/page.tsx:28~47), 검색엔진/카카오톡 미리보기에는 빈 스피너만 노출된다. 구인구직 플랫폼에서 공고 페이지의 검색 유입(SEO)과 링크 공유 미리보기는 핵심 성장 채널이므로 손실이 크다. 현실적 마이그레이션 경로: (1) firebase-admin SDK를 devDependency가 아닌 서버 전용으로 추가하고 src/lib/firestore-admin.ts를 분리(클라이언트 SDK firestore.ts는 그대로 유지), (2) jobs/page.tsx와 jobs/[id]/page.tsx만 서버 컴포넌트로 전환해 admin SDK로 fetch + `generateMetadata`로 공고 제목/일당을 OG 태그에 주입, 필터 칩·지원 버튼 등 인터랙션은 하위 클라이언트 컴포넌트로 내림, (3) 인증 필요 페이지(my-jobs, calculator 등)는 Firebase Auth가 클라이언트 상태라 무리하게 전환하지 않는 것이 현실적 — 전면 전환 대신 공개 2개 라우트만 하이브리드로 가져가는 것이 비용 대비 효과가 가장 크다. Vercel 배포이므로 ISR(`export const revalidate = 60`)을 걸면 Firestore 읽기 비용도 줄어든다.

### P3 · 인증 가드 훅(useRequireAuth)과 날짜/통화 포맷 유틸 공통화

- **영향**: 중간 / **공수**: 작음 / **분류**: 중복 제거 / 훅 추출

동일한 인증 가드 보일러플레이트 — `const { user, loading: authLoading } = useAuth(); useEffect(() => { if (!authLoading && !user) router.replace('/login'); }, ...)` + authLoading 스피너 분기 — 가 favorites/page.tsx:50~58·161~169, my-jobs/page.tsx:25~30·81, my-applications/page.tsx:22~27·73, profile/edit/page.tsx:55, profile/page.tsx:21 등 최소 5개 페이지에 복붙되어 있다. 반면 calculator/page.tsx:505~512는 리다이렉트 없이 안내 문구만 보여주는 등 페이지마다 거동이 다르다. `useRequireAuth({ redirectTo: '/login' })` 훅 하나로 통합하면 가드 누락·불일치를 구조적으로 방지한다. 날짜 포맷도 `const formatDate = (date) => ${d.getMonth()+1}/${d.getDate()}`가 7곳에 중복 정의되어 있다(WorkerHome.tsx:54, EmployerHome.tsx:51, my-jobs/page.tsx:76, favorites/page.tsx:132, jobs/page.tsx:50, my-applications/page.tsx:68, jobs/[id]/page.tsx:75). formatWage/formatWon도 3곳 중복(favorites:139, calculator:52, jobs/create:90). src/lib/format.ts로 추출하면 추후 '오늘/어제' 상대시간 표시 같은 개선을 한 곳에서 할 수 있다.

### P3 · 공용 UI 컴포넌트 정착 — 정의만 되고 사용처 0인 LoadingSpinner부터

- **영향**: 중간 / **공수**: 중간 / **분류**: UI 컴포넌트 / 디자인 시스템

src/components/ui/LoadingSpinner.tsx가 존재하지만 import하는 곳이 한 곳도 없고, 대신 인라인 `<div className="animate-spin rounded-full ..." />`가 22곳에 복붙되어 있다(grep 확인: login 3곳, favorites 2곳, calculator 2곳 등). 게다가 스타일도 갈라졌다 — 대부분 `border-2 ... border-t-transparent`인데 calculator/page.tsx:500·885만 `border-b-2` 방식, LoadingSpinner.tsx는 `border-4` 방식으로 3종이 공존한다. EmptyState는 favorites/page.tsx:489~530에 잘 만들어져 있지만 파일 로컬이라 jobs/page.tsx:107~114, workers 등 다른 페이지의 빈 상태는 단순 텍스트다. 에러 상태 UI도 favorites(재시도 버튼 있음)와 calculator(배너)가 제각각이다. 권장: components/ui/에 Spinner(기존 것 채택·전 페이지 교체), EmptyState(favorites 것 승격, 아이콘 prop화), ErrorState(메시지+재시도 콜백), BottomSheet(calculator의 모달 2개가 동일 구조), Button/Input(현재 `btn-primary`, `card` 등 globals.css 클래스와 인라인 Tailwind가 혼재)을 추출. 새 기능(FCM 알림, 프리미엄)이 로드맵에 남아 있어 지금 정착시키는 것이 누적 비용을 막는다.

### P4 · 실시간 구독(onSnapshot) 선별 도입 — 지원 상태 변경과 사용자 프로필

- **영향**: 중간 / **공수**: 중간 / **분류**: 데이터 페칭 전략

현재 전체 데이터 레이어가 getDocs/getDoc 단발 조회뿐이다(firestore.ts 전체에 onSnapshot 0건). 대부분 화면(공고 피드, 공수 캘린더)은 단발 fetch가 비용상 옳지만, 두 곳은 실시간이 제품 가치와 직결된다. (1) 구직자의 지원 내역(my-applications): 구인자가 수락/거절(updateApplicationStatus, firestore.ts:152~154)해도 구직자는 페이지를 새로 들어가야만 상태를 본다. 일용직 특성상 '오늘 일자리 수락 여부'는 분 단위로 중요하므로, 지원 내역 화면만이라도 `onSnapshot(query(applications, where('workerId','==',uid)))`로 전환할 가치가 크다(문서 수가 적어 비용 부담 낮음). (2) AuthContext.tsx:42~61의 fetchUserProfile은 getDoc 단발 + 수동 refreshProfile 패턴이라, 프로필 편집 후 refreshProfile 호출을 빠뜨리면 앱 전역이 stale 프로필을 본다 — `onSnapshot(doc(db,'users',uid))`로 바꾸면 refreshProfile 자체가 필요 없어지고 수동 동기화 누락 버그군이 사라진다. 반대로 jobs 피드 같은 다건 컬렉션은 onSnapshot 시 읽기 비용이 폭증하므로 단발 fetch+캐시(react-query) 유지가 맞다는 기준을 lib에 주석으로 명문화할 것.

### P4 · Next.js 15 업그레이드 및 비유지보수 next-pwa 교체(Serwist)

- **영향**: 중간 / **공수**: 중간 / **분류**: 의존성 / 플랫폼

설치 확인 결과 next 14.2.35, react 18.2, firebase 11.10.0, next-pwa 5.6.0이다(package.json:13~17, node_modules 실측). 시급한 보안 문제는 아니지만(14.2.35는 미들웨어 우회 CVE 패치 이후 버전) 두 가지 이유로 계획적 업그레이드를 권한다. (1) next-pwa 5.6.0은 수년간 유지보수가 중단된 패키지로 Next 15+와 webpack 설정 충돌이 알려져 있어, Next를 올리는 순간 빌드가 깨질 가능성이 높다 — 후속 프로젝트인 @serwist/next로 교체하면 동일한 dest/register/skipWaiting 설정을 거의 그대로 옮길 수 있고(next.config.js:1~6이 전부라 교체 범위가 작다), 로드맵 10번 FCM 푸시 알림 구현 시 서비스워커 커스터마이징(firebase-messaging-sw)이 필요한데 Serwist 쪽이 이를 지원하기 훨씬 수월하다. (2) 이 프로젝트는 전 페이지가 클라이언트 컴포넌트라 Next 15의 주요 파괴적 변경(async cookies/headers/params, fetch 캐시 기본값 변경)의 영향 표면이 거의 없어 지금이 업그레이드 비용이 가장 낮은 시점이다. 단, 6번 제안(서버 컴포넌트화)을 먼저 하면 비용이 올라가므로 '15 업그레이드 → 공개 페이지 서버화' 순서를 권장. Next 16은 React 19 + Cache Components 등 변화 폭이 커서 15 안정화 후 별도 판단.

---

## 4. 성능 · SEO · PWA — 10건

| 우선순위 | 제안 | 영향 | 공수 |
|---|---|---|---|
| P1 | 공고 상세 서버 렌더링 + generateMetadata 도입 (검색/카톡 미리보기 노출) | 높음 | 중간 |
| P1 | PWA 설치 불가 결함 수정: manifest가 존재하지 않는 PNG 아이콘을 참조 | 높음 | 작음 |
| P2 | robots.ts / sitemap.ts 추가 (검색엔진 인덱싱 기반 인프라 부재) | 높음 | 작음 |
| P2 | 구인공고 피드 페이지네이션 도입 (현재 전체 컬렉션 무제한 fetch) | 높음 | 중간 |
| P2 | 구인자 대시보드 통계를 getCountFromServer 집계 쿼리로 전환 (현재 부정확 + 과다 읽기) | 중간 | 작음 |
| P3 | Pretendard 폰트 실제 로드 추가 (현재 선언만 있고 로드 코드가 전무) | 중간 | 작음 |
| P3 | 오프라인 fallback 페이지 및 런타임 캐싱 전략 추가 (next-pwa 교체 검토 포함) | 중간 | 중간 |
| P4 | route 단위 loading.tsx + 스켈레톤 UI 도입 (현재 전 페이지 단일 스피너, 홈은 2단계 로딩) | 중간 | 작음 |
| P4 | 프로필 이미지 next/image 전환 및 외부 이미지 도메인 설정 | 낮음 | 작음 |
| P5 | 카카오맵 SDK 로더 중복 주입 가드 + preconnect 추가 (필요시 로드 전략은 유지) | 낮음 | 작음 |

### P1 · 공고 상세 서버 렌더링 + generateMetadata 도입 (검색/카톡 미리보기 노출)

- **영향**: 높음 / **공수**: 중간 / **분류**: SEO

현재 src/app/jobs/[id]/page.tsx:1이 'use client'이고 데이터를 useEffect(29-57행)에서 Firebase 클라이언트 SDK로 가져온다. generateMetadata가 없어 모든 공고가 src/app/layout.tsx:6-14의 동일한 정적 title/description('일다오 - 건설/일용직 구인구직')을 공유하고, openGraph 필드는 layout에 아예 없다. 결과적으로 (1) 카카오톡/문자로 공고 링크 공유 시 일당·지역·직종이 담긴 미리보기 카드가 뜨지 않고, (2) 검색엔진 크롤러는 스피너만 있는 빈 HTML(80-86행)을 본다. 구인구직 플랫폼에서 공고의 검색·공유 유입은 핵심 성장 경로다. 개선 방향: jobs/[id]/page.tsx를 서버 컴포넌트로 전환하고, 서버에서 Firestore REST API(https://firestore.googleapis.com/v1/projects/{projectId}/databases/(default)/documents/jobs/{id} — 공개 읽기 규칙이면 키 불필요) 또는 firebase-admin으로 공고를 fetch하여 generateMetadata에서 title(`${job.title} | 일당 ${dailyWage}원 - 일다오`), description(지역+직종+기간), openGraph를 생성한다. fetch에 next: { revalidate: 60 } 캐싱을 걸면 읽기 비용도 절감된다. 지원하기 버튼 등 인터랙티브 부분만 클라이언트 컴포넌트로 분리하면 된다. layout.tsx에 metadataBase 설정도 함께 필요하다.

### P1 · PWA 설치 불가 결함 수정: manifest가 존재하지 않는 PNG 아이콘을 참조

- **영향**: 높음 / **공수**: 작음 / **분류**: PWA

public/manifest.json:12-51은 /icons/icon-72x72.png ~ icon-512x512.png(type: image/png)를 선언하지만, 실제 public/icons/ 디렉토리에는 SVG 파일(icon-72x72.svg ~ icon-512x512.svg, 각 300~307바이트 플레이스홀더)만 존재한다. src/app/layout.tsx:10-13의 icon/apple도 '/icons/icon-192x192.png'를 참조해 전부 404다. Chrome의 PWA 설치 요건(유효한 192px+512px 아이콘)을 충족하지 못해 설치 배너/프롬프트가 아예 뜨지 않고, iOS 홈화면 추가 시 apple-touch-icon이 깨진다(iOS는 SVG 아이콘 미지원이므로 PNG 필수). 개선 방향: (1) 실제 브랜드 아이콘을 PNG로 생성(sharp/pwa-asset-generator로 일괄 변환)하여 manifest 경로와 일치시키고, (2) manifest.json:50의 'any maskable' 겸용 선언을 any용과 maskable용(safe zone 패딩 적용) 아이콘으로 분리하고, (3) layout metadata에 appleWebApp: { capable: true, statusBarStyle, title } 추가로 iOS standalone 모드를 활성화한다. 현재 PWA 핵심 기능이 사실상 전부 비활성 상태이므로 수정 비용 대비 효과가 가장 크다.

### P2 · robots.ts / sitemap.ts 추가 (검색엔진 인덱싱 기반 인프라 부재)

- **영향**: 높음 / **공수**: 작음 / **분류**: SEO

src/app과 public 어디에도 robots.txt, sitemap이 없다(Glob 검색 결과 0건, public에는 manifest.json과 icons만 존재). 공고 상세 SSR(제안 1)을 해도 크롤러가 공고 URL을 발견할 경로가 없으면 인덱싱이 되지 않는다. 개선 방향: (1) src/app/robots.ts 추가 — /profile, /my-jobs, /my-applications, /calculator, /favorites 등 개인화 페이지는 Disallow, /jobs는 Allow, (2) src/app/sitemap.ts 추가 — Firestore REST API로 status=='open'인 공고 목록을 가져와 /jobs/{id} URL을 동적 생성(lastModified는 updatedAt 사용), revalidate 캐싱 적용, (3) layout.tsx metadata에 metadataBase: new URL('https://배포도메인') 설정. 제안 1과 묶어서 진행해야 SEO 유입 파이프라인이 완성된다.

### P2 · 구인공고 피드 페이지네이션 도입 (현재 전체 컬렉션 무제한 fetch)

- **영향**: 높음 / **공수**: 중간 / **분류**: 성능/Firestore 비용

src/app/jobs/page.tsx:35-40에서 getJobs를 limitCount 없이 호출하고, src/lib/firestore.ts:49는 'if (filters?.limitCount) constraints.push(limit(...))'라서 필터가 없으면 limit 자체가 적용되지 않는다. 즉 open 상태 공고 전체를 매번 읽는다 — 공고가 1,000건이면 페이지 진입마다 1,000회 문서 읽기 과금 + 그만큼 느린 첫 화면. 게다가 useEffect 의존성(jobs/page.tsx:28-30)이 [selectedCategory, sortBy]라 카테고리 탭이나 정렬을 누를 때마다 전체 재조회가 발생한다(13개 카테고리를 한 번씩 눌러보면 읽기 13배). 개선 방향: (1) getJobs에 기본 limit(20) 적용 + Firestore startAfter 커서 기반 '더보기'/무한스크롤(getJobs가 마지막 DocumentSnapshot을 함께 반환하도록 시그니처 확장), (2) 카테고리/정렬 변경 시 이미 받은 데이터를 메모리 캐시(예: 키 `${category}_${sortBy}`)로 재사용하거나 SWR/TanStack Query 도입으로 중복 네트워크 제거. 사용자 증가 시 비용이 선형으로 폭증하는 구조라 조기에 잡아야 한다.

### P2 · 구인자 대시보드 통계를 getCountFromServer 집계 쿼리로 전환 (현재 부정확 + 과다 읽기)

- **영향**: 중간 / **공수**: 작음 / **분류**: 성능/Firestore 비용

src/lib/firestore.ts의 getEmployerStats(405-435행)에 두 가지 문제가 있다. (1) activeJobs(411-417행): 문서 전체를 getDocs로 받아 .size만 사용 — 공고 수만큼 문서 읽기 과금이 발생하는데 숫자 하나만 필요하다. (2) totalApplicants(420-427행): 'orderBy createdAt desc, limit(10)' 쿼리의 appsSnap.size를 '총 지원자 수'로 사용 — 지원이 10건을 넘으면 EmployerHome.tsx:73의 '총 지원자' 카드가 영원히 10으로 고정되는 동작 결함이다(대기중 카운트도 최근 10건 내에서만 계산됨, EmployerHome.tsx:77). 개선 방향: firebase/firestore의 getCountFromServer(집계 쿼리, 1,000문서당 1회 읽기 과금)로 activeJobs·totalApplicants·pending 카운트를 각각 count 쿼리로 교체하고, recentApplications만 limit(10) getDocs를 유지한다. 추가로 EmployerHome.tsx:18-23에서 loadMyJobs(getJobs employerId 쿼리)와 loadStats(getEmployerStats 내 jobs 쿼리)가 같은 jobs 컬렉션을 이중 조회하므로 한 번의 조회 결과를 공유하면 홈 진입 읽기를 더 줄일 수 있다.

### P3 · Pretendard 폰트 실제 로드 추가 (현재 선언만 있고 로드 코드가 전무)

- **영향**: 중간 / **공수**: 작음 / **분류**: 성능/폰트

src/app/globals.css:8에 font-family: 'Pretendard', system-ui, sans-serif로 선언되어 있지만, 프로젝트 전체에서 @font-face, CDN <link>, next/font 어느 것도 없다(grep 결과 'Pretendard' 언급이 이 한 줄뿐). 즉 CLAUDE.md 디자인 원칙의 Pretendard는 실제로 한 번도 적용된 적이 없고 모든 사용자가 system-ui 폴백으로 보고 있다. 개선 방향: next/font/local로 PretendardVariable.woff2(가변 폰트 1파일, 한국어 서브셋 버전 권장)를 self-host — next/font는 자동 preload + size-adjust 폴백 생성으로 CLS 없이 로드되며 외부 CDN 왕복도 없앤다. layout.tsx에서 const pretendard = localFont({ src: '...', display: 'swap', variable: '--font-pretendard' }) 후 <html className={pretendard.variable}>로 적용하고 tailwind.config.ts fontFamily에 변수로 연결한다. CDN 링크 방식(jsdelivr)보다 next/font가 렌더 차단·CLS 측면에서 우수하다.

### P3 · 오프라인 fallback 페이지 및 런타임 캐싱 전략 추가 (next-pwa 교체 검토 포함)

- **영향**: 중간 / **공수**: 중간 / **분류**: PWA

next.config.js:1-6은 dest/register/skipWaiting만 설정한 next-pwa 기본 구성이다. fallbacks 옵션(오프라인 시 보여줄 문서)이 없어, 건설현장처럼 네트워크가 불안정한 환경(이 서비스의 핵심 사용 환경)에서 미캐시 페이지로 이동하면 브라우저 기본 오류 화면이 뜬다. 또 모든 데이터가 Firestore SDK 경유(POST 채널)라 워크박스 기본 runtimeCaching으로는 공고 데이터가 캐시되지 않는다. 개선 방향: (1) /offline 페이지를 만들고 fallbacks: { document: '/offline' } 설정, (2) 카카오맵 SDK(dapi.kakao.com)·Google 프로필 이미지(lh3.googleusercontent.com)에 CacheFirst runtimeCaching 추가, (3) 자주 보는 데이터(공수 계산기 기록 등)는 Firestore SDK의 persistentLocalCache(IndexedDB 오프라인 캐시) 활성화로 보완 — src/lib/firebase.ts에서 initializeFirestore 옵션 한 줄로 가능하다. 참고로 package.json:15의 next-pwa ^5.6.0은 2022년 이후 미유지보수로 Next 14 App Router 공식 지원이 없으므로, 위 작업 시 활발히 유지되는 @serwist/next로의 이전을 함께 검토할 것.

### P4 · route 단위 loading.tsx + 스켈레톤 UI 도입 (현재 전 페이지 단일 스피너, 홈은 2단계 로딩)

- **영향**: 중간 / **공수**: 작음 / **분류**: 로딩 UX

app 디렉토리에 loading.tsx가 하나도 없고(Glob 결과 0건), 각 페이지가 수동 스피너를 렌더한다(src/app/jobs/page.tsx:103-105, src/app/jobs/[id]/page.tsx:80-86). 특히 홈(src/app/page.tsx:13-19)은 AuthContext의 onAuthStateChanged 완료(AuthContext.tsx:71-83, Firebase Auth 초기화 + 프로필 getDoc까지 대기)를 기다리는 전체 화면 스피너 후, EmployerHome/WorkerHome이 다시 자체 데이터 로딩 스피너를 보여주는 2단계 로딩이라 체감 대기가 길다. 개선 방향: (1) jobs/, jobs/[id]/ 등에 loading.tsx를 추가하고 실제 카드 레이아웃과 동일한 형태의 스켈레톤(회색 박스 + animate-pulse)으로 교체 — 콘텐츠 자리 이동(CLS) 없이 즉각적 피드백 제공, (2) 홈은 auth 확인 중에도 GuestHome의 정적 골격이나 스켈레톤을 먼저 보여주고, (3) 공고 상세는 제안 1의 서버 렌더 전환 시 정적 부분이 즉시 그려지므로 자연 해결된다. 모바일 우선 서비스에서 첫 체감 속도에 직접적 영향.

### P4 · 프로필 이미지 next/image 전환 및 외부 이미지 도메인 설정

- **영향**: 낮음 / **공수**: 작음 / **분류**: 성능/이미지

src/app/workers/page.tsx:92, src/app/profile/page.tsx:64, src/app/profile/edit/page.tsx:192에서 일반 <img> 태그로 Google 프로필 사진(lh3.googleusercontent.com)을 렌더링한다. 프로젝트 전체에 next/image 사용이 0건이다. 구직자 목록(workers)은 인력 검색 화면이라 이미지가 수십 개 나열될 수 있는데, 원본 크기 다운로드 + lazy loading 부재로 스크롤 성능과 데이터 사용량(현장 근로자의 모바일 데이터 환경)에 불리하다. 개선 방향: next/image로 교체하고 next.config.js의 nextConfig에 images.remotePatterns로 lh3.googleusercontent.com을 허용한다(현재 next.config.js:9-11에는 reactStrictMode만 있음). 아바타는 width/height 고정(40~80px)으로 지정하면 Vercel 이미지 최적화로 WebP/AVIF 자동 변환 + 적정 크기 서빙이 된다. Google 프로필 URL은 '=s96-c' 사이즈 파라미터 조정으로도 즉시 절감 가능하다.

### P5 · 카카오맵 SDK 로더 중복 주입 가드 + preconnect 추가 (필요시 로드 전략은 유지)

- **영향**: 낮음 / **공수**: 작음 / **분류**: 성능/외부 스크립트

src/components/ui/KakaoMap.tsx:45-73의 '컴포넌트 마운트 시 동적 로드' 전략 자체는 올바르다 — 지도가 없는 페이지(홈/피드/계산기)에서 SDK 비용이 0이므로 전역 로드로 바꿀 필요가 없다. 다만 두 가지 보완이 필요하다. (1) 중복 주입: 가드가 window.kakao 존재 여부(49행)뿐이라, 스크립트 로드가 완료되기 전에 두 번째 KakaoMap 인스턴스가 마운트되거나 사용자가 지도 페이지를 빠르게 재방문하면 동일 스크립트 태그가 document.head에 중복 삽입된다(58-72행, 기존 script 태그 존재 여부 미확인 + cleanup 없음). 모듈 레벨의 로딩 Promise 싱글톤(let kakaoLoaderPromise)으로 만들어 모든 인스턴스가 같은 Promise를 await하게 하면 해결된다. (2) 연결 지연: 공고 상세 진입 시 dapi.kakao.com에 대한 DNS/TLS 핸드셰이크가 스크립트 요청 시점에 시작되므로, layout.tsx <head>에 <link rel='preconnect' href='https://dapi.kakao.com' /> 한 줄을 추가하면 지도 첫 표시가 수백 ms 단축된다.

---

## 5. 품질 · 운영 — 9건

| 우선순위 | 제안 | 영향 | 공수 |
|---|---|---|---|
| P1 | Firestore Security Rules 전 컬렉션 작성 + 배포 파이프라인 + 에뮬레이터 기반 rules 테스트 | 높음 | 중간 |
| P1 | git 저장소 복구 + GitHub Actions CI(lint/typecheck/build) + Vercel 프리뷰 배포 | 높음 | 작음 |
| P2 | 환경변수 빌드 시 검증 + Firebase App Check 도입 | 높음 | 작음 |
| P2 | 공수/급여 계산 로직 순수 함수 추출 + Vitest 단위 테스트 (테스트 전략 1단계) | 높음 | 중간 |
| P3 | 에러 모니터링(Sentry) 도입 및 alert/console.error 일원화 | 높음 | 작음 |
| P3 | firestore.indexes.json 도입으로 복합 인덱스 코드 관리 | 중간 | 작음 |
| P3 | Firestore 백업(PITR + 정기 export) 및 데이터 마이그레이션 전략 수립 | 높음 | 작음 |
| P4 | 시니어 사용자 대상 접근성 개선: 최소 글자 크기·터치 영역·대비 기준 수립 | 중간 | 중간 |
| P5 | 애널리틱스(GA4/Firebase Analytics) 연동 및 핵심 퍼널 이벤트 추적 | 중간 | 작음 |

### P1 · Firestore Security Rules 전 컬렉션 작성 + 배포 파이프라인 + 에뮬레이터 기반 rules 테스트

- **영향**: 높음 / **공수**: 중간 / **분류**: 보안

현재 firestore.rules(7-24행)는 users 컬렉션만 다루고 jobs/applications/dailyWorks/teamDailyWorks/teams/favorites 규칙이 전무하다. 게다가 9행의 'allow read: if request.auth.uid == userId'(본인만 읽기)는 src/lib/firestore.ts:163-171의 getPublicWorkers(타인 users 문서 컬렉션 쿼리)와 모순되므로, 이 rules가 배포돼 있다면 앱 핵심 기능이 전부 permission-denied가 난다. 앱이 동작 중이라면 프로덕션 DB가 테스트 모드(전체 공개)라는 뜻이며, 누구나 타인의 급여 기록(dailyWorks)·연락처를 읽고 타인의 공고를 삭제·변조할 수 있는 상태다. 구현: (1) 컬렉션별 규칙 작성 — users는 isPublic==true이면 인증 사용자 읽기 허용, jobs는 status별 공개 읽기 + employerId==auth.uid만 쓰기, applications는 workerId==auth.uid만 생성·당사자(worker/employer)만 읽기, dailyWorks/teamDailyWorks는 docId 규칙(userId_date, leaderId_memberId_date)과 필드 일치 검증, favorites는 userId==auth.uid. (2) firebase.json + .firebaserc 추가 후 'firebase deploy --only firestore:rules'를 CI에 연결. (3) @firebase/rules-unit-testing + Firestore 에뮬레이터로 허용/거부 케이스 테스트를 작성해 회귀 방지. 출시 전 반드시 완료해야 할 최우선 항목.

### P1 · git 저장소 복구 + GitHub Actions CI(lint/typecheck/build) + Vercel 프리뷰 배포

- **영향**: 높음 / **공수**: 작음 / **분류**: CI/CD

.git 디렉터리에 objects가 없고 stale한 config.lock이 남아 있어 모든 git 명령이 'fatal: not a git repository'로 실패하며 추적 파일이 0개다. 즉 코드 전체가 버전관리 밖에 있어 실수 한 번이면 복구 불가능하다. .github/workflows도 없고 package.json scripts에 typecheck도 없다. 구현: (1) config.lock 제거 후 git init 재수행, .gitignore 확인(.env*.local은 이미 커버됨) 후 초기 커밋 + GitHub 원격 연결. (2) node_modules_broken/node_modules_old2 등 잔재 디렉터리 정리. (3) package.json에 "typecheck": "tsc --noEmit" 추가. (4) GitHub Actions 워크플로(push/PR 시 npm ci → lint → typecheck → next build, 빌드용 더미 NEXT_PUBLIC_* 시크릿 주입) 작성. (5) Vercel GitHub 연동으로 PR별 프리뷰 배포 자동화. 비용이 거의 들지 않으면서 모든 후속 작업의 전제가 되므로 rules와 함께 최우선.

### P2 · 환경변수 빌드 시 검증 + Firebase App Check 도입

- **영향**: 높음 / **공수**: 작음 / **분류**: 보안/인프라

src/lib/firebase.ts:8-15가 NEXT_PUBLIC_FIREBASE_* 6개를 아무 검증 없이 firebaseConfig에 넣는다. 변수 하나라도 누락되면 빌드는 통과하고 사용자 브라우저에서 auth/invalid-api-key 같은 난해한 런타임 에러로만 드러난다. 또한 App Check가 없어(firebase.ts에 app-check import 부재) Firebase 클라이언트 API를 봇/스크립트가 그대로 호출할 수 있다. 구현: (1) src/lib/env.ts에 zod 스키마(또는 단순 누락 체크 루프)로 6개 변수를 검증하고 next.config.js에서 빌드 시점에 import해 누락 시 빌드 실패시키기. (2) initializeAppCheck + ReCaptchaV3Provider를 firebase.ts에 추가하고 Firebase 콘솔에서 Firestore/Auth에 대해 App Check 시행(enforce) — rules 정비(우선순위 1) 후 시행 전환. 일용직 플랫폼 특성상 연락처 크롤링 시도가 많을 수 있어 어뷰징 방어 효과가 크다.

### P2 · 공수/급여 계산 로직 순수 함수 추출 + Vitest 단위 테스트 (테스트 전략 1단계)

- **영향**: 높음 / **공수**: 중간 / **분류**: 테스트

calculator/page.tsx는 1,206줄 단일 컴포넌트이며 월간 요약(307-325행: totalManDay 누적, estimatedWage = totalManDay * dailyWageInput), 기간 합계(348행), 팀원별 합계(395-400, 487행) 같은 돈 계산 로직이 UI에 섞여 있다. 프로젝트 전체에 테스트가 0개이고 package.json에 테스트 러너도 없다. 급여 계산 오류는 사용자 피해로 직결되므로 테스트 투자 대비 효과가 가장 큰 지점이다. 권장 순서: (1단계) src/lib/calculator.ts로 calculateMonthlySummary/calculatePeriodTotal/calculateTeamMemberTotal을 순수 함수로 추출하고 Vitest로 경계값(0.5공수, 빈 월, expense undefined, 부동소수점 합산) 테스트 — 즉시 가능. (2단계) Firestore rules 에뮬레이터 테스트(우선순위 1 항목과 연계). (3단계) Playwright E2E는 핵심 플로우(로그인→공고작성→지원)만 스모크 수준으로, Firebase Auth 에뮬레이터 연동이 선행돼야 하므로 출시 후로 미뤄도 된다. 1206줄 컴포넌트 분리는 추후 유지보수성에도 기여한다.

### P3 · 에러 모니터링(Sentry) 도입 및 alert/console.error 일원화

- **영향**: 높음 / **공수**: 작음 / **분류**: 운영/모니터링

현재 에러 처리는 14개 파일에 걸친 console.error/alert() 29곳이 전부라서(예: jobs/[id]/page.tsx 3곳, calculator/page.tsx 7곳) 프로덕션에서 발생하는 에러를 운영자가 알 방법이 전혀 없다. Firestore permission-denied나 인덱스 누락 에러도 사용자 콘솔에서만 사라진다. 구현: (1) @sentry/nextjs 설치 + Vercel Sentry 연동(소스맵 자동 업로드), app/global-error.tsx 추가로 React 렌더 에러 포착. (2) Firestore 헬퍼(src/lib/firestore.ts)의 catch 지점에 Sentry.captureException + 사용자용 한국어 토스트로 통일하고 alert() 제거. (3) permission-denied/failed-precondition(인덱스 누락) 에러 코드를 태그로 분류해 rules·인덱스 문제를 조기 감지. 출시 직전에 반드시 갖춰야 할 가시성 기반.

### P3 · firestore.indexes.json 도입으로 복합 인덱스 코드 관리

- **영향**: 중간 / **공수**: 작음 / **분류**: 운영/인프라

src/lib/firestore.ts에 복합 인덱스가 필요한 쿼리가 다수 존재한다 — 41-47행(category/status/employerId 등호 필터 + createdAt orderBy 조합), 114-115행(jobId + createdAt desc), 129-130행(workerId + createdAt desc), 164-168행(role + isPublic + skills array-contains), 247-250행(userId + date 범위 + date asc), 326-329행(teamLeaderId + date 범위), 422-423행(employerId + createdAt desc). 그런데 firestore.indexes.json과 firebase.json이 없어 인덱스가 콘솔 에러 링크 클릭으로만 임시 생성되는 구조다. 이러면 신규 환경(스테이징, 프로젝트 재생성) 구축 시 어떤 인덱스가 필요한지 재현 불가능하고, 누락 시 해당 쿼리가 failed-precondition으로 통째로 실패한다. 구현: 기존 콘솔 인덱스를 'firebase firestore:indexes'로 내보내 firestore.indexes.json으로 저장하고, firebase.json에 등록한 뒤 CI에서 rules와 함께 'firebase deploy --only firestore'로 배포. 필터 조합별 인덱스 매트릭스를 점검해 누락분을 선제 등록.

### P3 · Firestore 백업(PITR + 정기 export) 및 데이터 마이그레이션 전략 수립

- **영향**: 높음 / **공수**: 작음 / **분류**: 운영/데이터

dailyWorks는 일용직 근로자의 급여 정산 원장(공수·잔업·경비 기록)으로 유실 시 금전 분쟁으로 직결되는데, 현재 백업 장치가 전혀 없다(firebase.json·Cloud Functions·export 스케줄 부재). 또한 docId에 비즈니스 키가 인코딩돼 있어(dailyWorks: userId_date, teamDailyWorks: leaderId_memberId_date — CLAUDE.md 명세 및 firestore.ts 구현 확인) 스키마 변경 시 문서 전체 재작성이 필요한 구조라 마이그레이션 전략이 미리 필요하다. 구현: (1) Firebase 콘솔에서 PITR(Point-in-Time Recovery) 활성화 — 토글 한 번으로 7일 복구 확보. (2) gcloud firestore export를 Cloud Scheduler로 일 1회 GCS 버킷에 적재(수명주기 30일). (3) 문서에 schemaVersion 필드를 도입하고, 마이그레이션은 Admin SDK 스크립트(scripts/ 디렉터리) + 드라이런 모드로 작성하는 규약을 정립. 비용 대비 데이터 손실 방어 효과가 매우 크다.

### P4 · 시니어 사용자 대상 접근성 개선: 최소 글자 크기·터치 영역·대비 기준 수립

- **영향**: 중간 / **공수**: 중간 / **분류**: 접근성(a11y)

건설 일용직은 50~60대 사용자 비중이 높은데 현재 text-xs(12px)가 15개 파일 83곳에서 사용되고(favorites 13곳, EmployerHome 12곳, calculator 19곳), calculator/page.tsx:575에는 캘린더 공수 숫자가 text-[10px]로 표시된다 — 급여와 직결되는 핵심 숫자가 10px이면 시니어에게 사실상 판독 불가다. 캘린더 날짜 셀의 터치 영역도 44px 미만일 가능성이 높다. 구현: (1) 디자인 규칙 수립 — 본문 최소 text-sm(14px), 핵심 수치(공수·급여)는 text-base 이상, 보조 라벨만 text-xs 허용. tailwind.config.ts에 시맨틱 폰트 토큰 정의 후 일괄 치환. (2) 캘린더 셀·하단 네비 등 터치 타겟 최소 44x44px 보장. (3) eslint-plugin-jsx-a11y를 lint에 추가하고 CI에 Lighthouse 접근성 점수(90+) 체크 편입. (4) 회색 계열(text-gray-500 on white 등) 대비 4.5:1 검증. 타겟 사용자층 특성상 전환율·재방문율에 직접 영향을 주는 항목.

### P5 · 애널리틱스(GA4/Firebase Analytics) 연동 및 핵심 퍼널 이벤트 추적

- **영향**: 중간 / **공수**: 작음 / **분류**: 운영/분석

현재 어떤 분석 도구도 연동돼 있지 않다(src/lib/firebase.ts에 getAnalytics 미사용, GA/Mixpanel 패키지 부재). 출시 후 '공고 조회→지원 클릭' 전환율, 공수계산기 사용 빈도, 역할별(worker/employer) 활성도를 측정할 수단이 없으면 프리미엄 기능(로드맵 13번) 설계 근거도 확보할 수 없다. 구현: (1) 이미 설치된 firebase SDK의 Analytics(getAnalytics + logEvent)를 활성화 — 추가 패키지 불필요, isSupported() 가드로 SSR 안전 처리. (2) 핵심 이벤트 정의: job_view, apply_click, job_create, calculator_save, favorite_add + user_property로 role 세팅. (3) Vercel Analytics(Web Vitals)를 병행해 모바일 성능 지표 수집. 출시 전 1~2일 작업으로 충분하나 rules/CI/모니터링이 갖춰진 뒤에 진행해도 늦지 않다.

---

## 6. 맺음말

42건 중 어디서 시작할지 고민된다면 기준은 하나입니다: **"구인자가 공고를 올리고, 구직자가 지원하고, 구인자가 수락해 전화가 연결되는" 한 사이클이 안전한 데이터 위에서 끝까지 돌아가는가.** 0단계(보안 룰·git·CI)와 1단계(지원자 관리·연락 수단)가 정확히 그 경로이며, 나머지는 모두 그 위에 쌓는 항목입니다.
