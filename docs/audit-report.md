# ildao 전수조사 리포트 (2026-06-19)

> 멀티에이전트 전수조사(파일영역 심층 7 + 횡단 관점 5 검토 → 발견별 적대적 검증 → 중복제거 종합).
> 발견 77건 → **확정 69 / 불확실 1 / 오탐 7 제거**, 중복 병합 후 distinct ≈55건. 치명적(critical) 0건.
> 루프 작업 추적은 `docs/TODO.md`, 규칙은 `loop.md`. 각 항목 끝의 `[자동가능]`/`[사용자필요]`는 루프 진행 가능 여부.
>
> 검증 기준: `npm run verify`(typecheck+build)는 **런타임/규칙/인덱스 동작을 증명하지 못한다.** `⚠️배포필요`가 붙은 항목은 코드 수정은 자동이나 Firestore 룰/인덱스 배포(사용자) 전까지 실효되지 않는다.

---

## 🔴 High (1)

### SEC-01 · 공개 프로필 문서 전체 노출로 전화번호(PII) 무차별 수집 가능 — `[사용자필요]`
- 위치: `firestore.rules:38-40`, `src/types/index.ts:40-41`
- `users` read 규칙이 `isPublic==true` 구직자 + **모든 employer 문서**를 비로그인 포함 누구에게나 통째로 허용. Firestore는 필드 단위 read 제한 불가 → UI가 `phone`을 안 그려도 `doc(db,'users',uid).data().phone`을 SDK로 직접 읽힘. "연락처는 수락 후 노출" 설계가 규칙에서 미강제.
- 수정: 공개필드/민감필드 컬렉션 분리(`publicProfiles`에 name/skills/region/desiredWage만 복제, `users`는 본인만). **데이터 모델·룰·마이그레이션 동반 → 사용자 설계 결정 필요.**

---

## 🟠 Medium (4)

### SEC-02 · 지원자 연락처(workerPhone)가 수락 전에도 구인자에 전량 노출 — `[사용자필요]`
- 위치: `firestore.rules:77-84`, `src/lib/firestore.ts:150`, `src/app/my-jobs/[id]/applicants/page.tsx:183`
- `applyToJob`가 `workerPhone`을 application 스냅샷에 저장, get/list 규칙은 `employerId==본인`이면 status 무관 전체 read 허용. UI는 `accepted`만 전화 버튼 노출하지만 `getApplicationsByJob` 응답엔 pending/rejected 연락처까지 평문 포함.
- 수정: `workerPhone`을 별도 하위 문서로 분리하고 `status=='accepted'`에만 read 허용(필드 제한 불가→문서 분리). **데이터 모델·룰 변경 → 사용자.**

### DATA-01 · 지도 선택 시 region이 '서울특별시'로 오염돼 지역 필터에서 누락 — `[자동가능]`(백필은 사용자)
- 위치: `src/app/jobs/create/page.tsx:214-219`, `src/lib/firestore.ts:59`
- KakaoMap `onSelect`가 지오코딩 첫 토큰(`'서울특별시'`)으로 `region`을 덮어써 `REGIONS`('서울')와 불일치 → `where('region','==','서울')`에서 영구 누락. 지도 클릭 시에만 발생.
- 수정(자동): `onSelect`에서 region 덮어쓰기 제거 또는 `'서울특별시'→'서울'` 정규화 매핑, `createJob` 전 `REGIONS` 포함 검증. 기존 오염 문서 백필은 사용자.

### CALC-01 · 구인자 홈 '대기중' 통계가 limit(10) 캡으로 과소집계 — `[자동가능]` ⚠️배포필요(인덱스)
- 위치: `src/components/home/EmployerHome.tsx:73`, `src/lib/firestore.ts:441-454`
- pending 수를 `limit(10)`된 `recentApplications`의 클라이언트 필터로 계산 → 지원 11건+면 최대 10까지만 표시. (firestore.ts:441 주석이 이미 같은 함정 경고.)
- 수정: `getEmployerStats`에 `where(employerId==)&&where(status=='pending')` `getCountFromServer` 추가→`pendingApplicants` 반환. **`applications` employerId+status 복합 인덱스 추가·배포 필요.**

### CFG-01 · `node_modules_old2`(≈19,804파일)가 `.vercelignore` 누락 — `[자동가능]`
- 위치: `.vercelignore:1-6`
- 직전 커밋이 파일수 초과 방지로 추가했으나 정작 이 폴더 누락. CLI 배포 시 업로드되어 Hobby 한도(~15,000) 위협.
- 수정: `.vercelignore`에 `node_modules_old2`(+`node_modules_*` 글롭) 추가. 근본적으로 루트의 백업 폴더 삭제 권장(별도 사용자 확인).

---

## 🟡 Low — 실제 동작 버그 (모두 `[자동가능]`)

- **UI-01** `src/app/workers/page.tsx:163` — `worker.experience &&` truthy 체크라 경력 0년(신입) 라벨 누락. `!= null`로 변경(applicants/favorites와 통일). ※VALID-03 동일 건 병합.
- **UI-02** `src/app/profile/page.tsx:62-79` — 프로필 보기가 `userProfile.profileImage` 미사용(`user.photoURL`만) → 편집 저장 사진 미반영. `profileImage || photoURL` 폴백(외부 URL이라 `unoptimized`).
- **DATA-02** `src/app/favorites/page.tsx:96-101` — 관심 공고 `getJob`에 `.catch` 부재 → 한 건 실패 시 목록 전체 에러. `.catch(()=>null)` 통일.
- **REACT-01** `src/components/home/EmployerHome.tsx:20-50` — 로드 effect에 `cancelled` 가드/cleanup 부재(다른 페이지는 전부 있음). ※HOME-01 동일 건 병합.
- **AUTH-01** `src/app/register/page.tsx` — 로그인 시 보존한 `next` 복귀 경로를 가입 단계에서 분실(항상 홈). `useSearchParams`로 `next` 읽어 내부경로 검증 후 복귀(login처럼 Suspense 경계).

## 🟡 Low — 조용한 실패 / 검증 / 일관성 (`[자동가능]`)

- **EMP-01** `src/app/my-jobs/page.tsx:54-73` — 마감/삭제 실패 시 사용자 알림 없음 + dead state `actionJobId` 미사용. `alert` 추가(applicants와 통일), dead state 제거 또는 처리중 disabled.
- **PROF-02** `src/app/profile/page.tsx:34-43` — 공개 토글 실패 피드백 없음. catch에서 알림.
- **UI-03** `src/components/home/EmployerHome.tsx:27-36` — 통계 로드 실패 시 0 표시(실제 0과 구분 불가). 로딩/에러 상태 분리.
- **VALID-01** `src/app/calculator/page.tsx:661,876,997` — 일당/경비 입력 상한 없음(jobs/create는 1천만원 제한). 상한+정수화, 공용 유틸화.
- **VALID-02** `src/app/jobs/create/page.tsx:259-266` — `workHours` 형식 검증·빈값 차단 없음. trim 검사 또는 정규식/시간 select.
- **CALC-03** `src/app/calculator/page.tsx:300-312` — 기간 합계 시작일>종료일 검증 없음→조용히 0 표시. `periodStart<=periodEnd` 검증 또는 input min/max 연동.
- **CALC-05** `src/app/calculator/page.tsx:244-289` — 전부 0인 빈 기록도 저장(잉여 문서). 의미있는 입력 검증.
- **CONST-01** `EmployerHome:138`, `my-jobs:114`, `jobs/[id]` — 인라인 삼항이 `completed`를 '진행중'으로 오표시. 공용 `jobStatusBadge` import로 통일(현재 데이터엔 미발현).
- **LIB-01** `src/lib/firestore.ts:205-216` — `getPublicWorkers`의 `region` 파라미터 dead(쿼리 미적용, 문서엔 '지역 필터'로 명시). 미지원이면 파라미터/문서 정리, 지원하면 where 추가(⚠️users 인덱스 배포필요).

## 🟡 Low — 접근성 / 성능 / 운영 (대부분 `[자동가능]`)

- **CFG-03** `src/app/layout.tsx:16-22` — `userScalable=false`로 핀치 줌 차단(WCAG 1.4.4 위반). 제거, iOS 자동확대 우려 시 입력 폰트 16px+. `[자동가능]`
- **PROF-01** `src/app/profile/page.tsx:153` — 공개 토글 `role="switch"`/`aria-checked` 없음 + 중복클릭 방지 없음. `[자동가능]`
- **CALC-04** `src/components/ui/BottomSheet.tsx:11-26` — Esc 닫기/포커스 트랩/`aria-modal`/배경 스크롤 잠금 부재. `[자동가능]`
- **EMP-03** `src/app/my-applications/page.tsx:35-44` — 공고 N+1 단건 조회. `documentId() in` 청크/`getJobsByIds`. `[자동가능]`
- **QUERY-01** `src/lib/firestore.ts:47-69` — `getJobs`가 region 단독/`employerId+dailyWage` 정렬 받을 수 있으나 복합 인덱스 부재→그런 호출 추가 시 런타임 에러(현 호출부는 안전). 함수 계약 화이트리스트로 제약(자동) 또는 인덱스 추가(⚠️배포필요). `[자동가능]`
- **CFG-02** `src/lib/firebase.ts:8-24` — env 누락 검증 없음(미설정 시 모호한 에러). 개발환경 가드. `[자동가능]`
- **SEC-03** `src/components/ui/KakaoMap.tsx:7,60` — 카카오 JS 키 노출(불가피)→콘솔 도메인 referer 제한. **외부 콘솔 → `[사용자필요]`**
- **DEP-01** `package.json:18` — `next-pwa@5.6.0` 유지보수 중단+workbox6 고정. `@ducanh2912/next-pwa`/`serwist` 검토. **npm install·아키텍처 → `[사용자필요]`**

## 🟡 Low — 게스트/전환 (`[자동가능]`)

- **GUEST-01** `src/components/home/GuestHome.tsx:45-53` — 직종 버튼/'더보기'가 `onClick`/`href` 없는 죽은 UI. `/login` Link로 감싸기 또는 hover 제거.
- **GUEST-02** `src/components/home/GuestHome.tsx:57-82` — '최신 구인'이 하드코딩 더미('D-1' 고정). `getJobs({status:'open',limitCount:3})` 실데이터 또는 '예시' 라벨.
- **JOBS-01** `src/app/jobs/[id]/page.tsx:314` — 비로그인엔 지원 CTA 미표시(전환 손실). '로그인하고 지원하기'(next 복귀) 노출.
- **UI-04** `src/app/profile/page.tsx` — 구직자 본인 프로필에 '선호 지역(region)' 행 누락(저장은 됨). InfoRow 추가.

---

## ⚪ Info — 예방적 / 문서화 / 정책 / 선택

- **NAV-01** `BottomNav.tsx:84-101` — 인증 로딩 중 게스트 메뉴 깜빡임. `loading` 가드. `[자동가능]`
- **NAV-02** `BottomNav.tsx:8,89` — 숨김 경로 정확일치→중첩 라우트 회귀 위험. `startsWith` 매칭. `[자동가능]`
- **FORMAT-01** `lib/format.ts:4-15` — Invalid Date에 'NaN/NaN' 가능(현 호출부는 안전). `isNaN` 가드. `[자동가능]`
- **LIB-02** `lib/firestore.ts:219-239` — `getUserProfile`가 `uid`를 docId로 미보강(jobs/applications와 비대칭). `uid: docSnap.id` 추가. `[자동가능]`
- **LIB-03** `lib/firestore.ts:101,242,417` — update 헬퍼 소유권 검증을 규칙에 위임. 주석 명시. `[자동가능]`
- **FIRESTORE-01 / CALC-08** `lib/firestore.ts:276,353` — 월별 상한 `'YYYY-MM-31'` 매직값이 사전식 비교 운에 의존(현 동작 정상). `< nextMonth-01` 경계로 의도 명확화. `[자동가능]`
- **REACT-02** `KakaoMap.tsx:87-140` — init effect 의존성 `[sdkLoaded]`뿐+cleanup 부재(현 소비처선 미발현). `onSelect` ref화·리스너 해제. `[자동가능]`
- **REACT-03 / REACT-05** `favorites/page.tsx:57-59` — `loadFavorites` `exhaustive-deps` 경고. 의존성 정리. `[자동가능]`
- **REACT-04** `jobs/[id]/page.tsx:37-82` — 상세 로드 취소 가드 없음(트리거 표면 좁음). 세대 카운터/cancelled. `[자동가능]`
- **CALC-06** `lib/calculator.ts:10-39` — 잔업/연장이 급여 미반영(공수로 산정하는 설계). '기록용(급여 미반영)' 명시 또는 기간합계에 일수 노출. `[자동가능]`
- **CALC-07** `calculator/page.tsx:408-423` — `memberName` 비정규화(현 화면은 live name 우선). 보조 캐시 주석. `[자동가능]`
- **CALC-02** `calculator/page.tsx:884-891` — 예상급여 보조라벨(공수×단일일당)이 기록별 일당 혼재 시 표시와 어긋남(실계산은 정확). 라벨 명료화. `[자동가능]`
- **JOBS-02** `jobs/create/page.tsx:44-104` — `addDoc` 비멱등(초고속 재클릭 이론상 중복). 현 disabled+push로 실질 차단. 영향 낮음. `[자동가능]`
- **JOBS-03** `jobs/[id]/page.tsx:111` — 지원 후 `applyMessage` 미초기화(노출 경로 없음). `setApplyMessage('')`. `[자동가능]`
- **JOBS-04** `jobs/page.tsx:140-161` — 목록에 프리미엄/마감임박 구분 없음. 정보성 보강(선택). `[자동가능]`
- **PROF-03** `profile/edit/page.tsx:157,180` — 저장 후 `router.back()`이 딥링크 진입 시 모호. `router.push('/profile')` 또는 history 폴백. `[자동가능]`
- **CFG-04** `public/manifest.json:46-52` — 단일 아이콘 'any maskable' 겸용+`id`/`scope` 부재. maskable/any 분리, `id`/`scope` 추가. `[자동가능]`
- **CFG-05** `.gitignore:31-42` — `.vercel` 중복 항목. 42행 제거. `[자동가능]`
- **SEO-01** `robots.ts:9-26` — sitemap/`metadataBase` 부재(도메인 미확정 보류). 배포 도메인 확정 후. `[사용자필요]`
- **SEC-04** `firestore.rules:104-107` — 지원 status 양방향 임의 전환 가능+worker 철회 권한 없음. 상태머신 제약/철회 규칙. **정책 → `[사용자필요]`**
- **SEC-05** `firestore.rules:90-101` — 지원 스냅샷 자기보고(프로필 일치 미검증). 규칙 강화 또는 서버 조회. **정책 → `[사용자필요]`**
- **SEC-06** `lib/firestore.ts:205-216` — 쿼리의 `isPublic==true` 제약이 규칙 통과의 암묵적 유일 근거. 제거 금지 주석. `[자동가능]`
- **EMP-02** `applicants/page.tsx:104` — 정원(numberOfWorkers) 초과 수락 무제한. 정원 도달 안내. **정책 → `[사용자필요]`**
- **EMP-04** `applicants/page.tsx:55-69` — 마감(closed) 공고도 수락/거절 가능+상태 뱃지 없음. **정책 → `[사용자필요]`**

---

## ✅ 검증으로 걸러낸 오탐 7건 (참고 — 수정 불필요)
- WorkerHome '님' 단독 렌더 — 부모 page.tsx 렌더 게이트로 userProfile 항상 로드됨.
- jobs highWage 정렬 오류 주장 — equality 필터+단일 orderBy로 정확, 인덱스 4종 존재(제목·본문 자기모순).
- 지원 stale 스냅샷(phone 빈값 저장) — register/edit가 전화번호 정규식 검증, 빈 phone 문서 생성 경로 없음.
- 필요 인원 빈값/소수 허용 — `Number.isInteger && 1..100` 검증이 모든 무효 차단.
- 좌표 (0,0) 저장→잘못된 위치 2건 — KakaoMap이 #49로 서울 폴백+주소 지오코딩 방어 이미 구현.
