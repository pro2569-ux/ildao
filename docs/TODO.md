# ildao TODO (개선 백로그)

> 결함 51건은 전건 완료(`docs/defect-report.md`). 이 파일은 `docs/improvement-report.md`의 잔여 개선 항목과
> **2026-06-19 전수조사(`docs/audit-report.md`, 확정 ≈55건)** 백로그를 추적한다.
> 진행 현황 메모리: `improvement-campaign.md`, `full-audit-2026-06-19.md`. 루프는 `loop.md` 규칙을 따른다.
>
> 표시 규칙:
> - `[자동가능]` — 루프가 진행 가능(코드 한정·되돌릴 수 있음·외부 자격증명 불필요)
> - `[사용자필요]` — 자격증명/외부 서비스/의존성·아키텍처 결정이 필요 → 사용자가 직접 지시할 때만

## ✅ 완료
- [x] P1 지원자 관리 화면(`/my-jobs/[id]/applicants`) + 수락/거절 + 수락 후 상호 연락처 + 지원 메시지
- [x] P1 지역(region) 필드 분리 + 피드 지역 필터 + 복합 인덱스 4종
- [x] #163 직종 상수(JOB_CATEGORIES) 단일화 + workers '기타' 누락 버그
- [x] #193 날짜/통화 포맷 유틸(`lib/format.ts`) 추출
- [x] #199 공용 Spinner/PageLoader·EmptyState·ErrorState 추출 (BottomSheet/Button은 잔여)
- [x] #316 일부 — `package.json`에 `typecheck` 스크립트(`tsc --noEmit`) 추가 (typecheck/build 검증 통과)
- [x] #157 `saveDailyWork`/`saveTeamDailyWork`를 단일 `setDoc(merge)`로 (getDoc 분기·race 제거, createdAt→updatedAt 일원화)
- [x] #163 잔여 — `WEATHER_OPTIONS`·`jobStatusBadge`를 `lib/constants.ts`로 이동 (calculator/favorites 공용화)
- [x] #282 프로필 이미지 next/image 전환 + remotePatterns(lh3) — profile은 최적화, 임의 URL(workers/edit)은 unoptimized로 회귀 방지
- [x] #246 일부 — `src/app/robots.ts` 추가 (개인화/개인정보 경로 Disallow, 공개 경로 Allow). sitemap은 도메인 필요로 잔여
- [x] #328 일부 — 공수/급여 계산 순수함수를 `lib/calculator.ts`로 추출 + calculator 리팩터 (테스트 가능 구조, verify 통과)
- [x] #199 잔여(일부) — 공용 `BottomSheet` 추출 (calculator 모달 2개 래퍼 공용화, slide-up 키프레임 globals.css로 이동)
- (결함 캠페인 부산물: PWA PNG 아이콘, 지원·즐겨찾기 결정적 docId, 룰/인덱스 작성, useRequireAuth, toDate/대시보드 캡 등)

## 🔎 2026-06-19 전수조사 백로그 (audit-report.md) — 자동가능 (우선순위 순)
> 한 반복=한 ID. 상세·근거는 `docs/audit-report.md`. `⚠️배포필요`는 코드 수정 후 룰/인덱스 배포(사용자) 전까지 실효 안 됨.

### A. 실제 동작 버그 (먼저)
- [x] [자동가능] **UI-01** 경력 0년 미표시 — `workers/page.tsx:163` `experience && `→`experience != null &&`(신입 0년 표시, VALID-03 동일 해소). verify 통과
- [x] [자동가능] **UI-02** 프로필 보기 `profileImage` 미반영 — `profile/page.tsx` `profileImage||photoURL` 폴백 + `unoptimized` + onError 플레이스홀더 폴백(편집 #48 패턴). verify 통과
- [x] [자동가능] **DATA-02** 즐겨찾기 공고 로드 `.catch` 부재 — `favorites/page.tsx:98` `getJob().catch(()=>null)` (프로필 로드와 동일 패턴, 한 건 실패가 목록 전체 깨뜨리지 않음). verify 통과
- [x] [자동가능] **REACT-01** EmployerHome stale 가드 부재 — `EmployerHome.tsx:20-50` 두 로드 함수를 effect 안으로 이동+`cancelled` 가드+cleanup(WorkerHome 패턴 통일, HOME-01 동일 해소). verify 통과
- [x] [자동가능] **AUTH-01** 가입 시 `next` 복귀 경로 분실 — login이 `/register?next=`로 전달, register가 `useSearchParams`로 next 읽어(내부경로 검증) 가입 완료 시 복귀, Suspense 경계 추가. verify 통과
- [x] [자동가능] **DATA-01** region 오염(지도 선택) — `constants.ts`에 `normalizeRegion`('서울특별시'→'서울', 충청/전라/경상 별칭) 추가, `jobs/create` onSelect가 이를 거쳐 표준 약칭만 저장(실패 시 select값 유지). verify 통과. ⚠️기존 오염 문서 백필은 사용자

### B. 조용한 실패 / 검증 / 일관성
- [x] [자동가능] **EMP-01** 마감/삭제 실패 알림 없음+dead state — `my-jobs/page.tsx` 실패 시 alert(applicants와 일관)+미사용 actionJobId를 처리 중 버튼 disabled에 활용. verify 통과
- [x] [자동가능] **PROF-02** 공개 토글 실패 피드백 — `profile/page.tsx` catch에 alert 추가(중복클릭 방지·aria는 PROF-01). verify 통과
- [x] [자동가능] **UI-03** 통계 로드 실패 시 0 표시 — `EmployerHome.tsx` statsLoading/statsError/retryKey 추가, 로딩·실패 시 대시(–) 표시 + 재시도 버튼(0과 구분). verify 통과
- [x] [자동가능] **VALID-01** 계산기 입력 상한 없음 — `calculator/page.tsx` clampMoney(0~1천만+Math.floor) 헬퍼로 경비/일당/팀원일당 통일 + max 속성(jobs/create 상한과 일치). verify 통과
- [x] [자동가능] **VALID-02** workHours 형식 미검증 — `jobs/create/page.tsx` handleSubmit에 HH:MM~HH:MM 정규식 검증(빈값 차단)+저장 시 trim. verify 통과
- [x] [자동가능] **CALC-03** 기간 합계 시작>종료 미검증 — `calculator/page.tsx` handlePeriodQuery에 periodStart>periodEnd 차단 + 시작일 max/종료일 min 연동. verify 통과
- [x] [자동가능] **CALC-05** 빈 기록 저장 — `calculator` 의미있는 입력(공수>0||휴무||경비>0||메모) 검증, 빈 입력 시 기존 기록 삭제(deleteDailyWork 헬퍼 추가)·없으면 미저장. verify 통과
- [x] [자동가능] **CONST-01** 상태 뱃지 인라인 삼항(completed 오표시) — EmployerHome·my-jobs·jobs/[id] 3곳을 공용 jobStatusBadge로 통일(completed→'완료', in_progress→파랑 정상화). verify 통과

### C. 접근성 / 성능 / 게스트 전환
- [x] [자동가능] **CFG-03** 핀치 줌 차단(WCAG 1.4.4) — `layout.tsx` `maximumScale:1`·`userScalable:false` 제거(확대 허용). verify 통과
- [x] [자동가능] **PROF-01** 공개 토글 aria + 중복클릭 — `profile/page.tsx` role="switch"/aria-checked/aria-label + togglingPublic으로 await 중 disabled. verify 통과
- [x] [자동가능] **CALC-04** BottomSheet a11y — `BottomSheet.tsx` 'use client'+Escape 닫기·role="dialog"/aria-modal·배경 스크롤 잠금·초기 포커스(마운트 기준, onClose ref로 재구독 방지). verify 통과
- [x] [자동가능] **GUEST-01** 죽은 직종 버튼 — `GuestHome.tsx` 8개 직종 button을 /login Link로 전환(게스트 CTA 일관). verify 통과
- [ ] [자동가능] **GUEST-02** '최신 구인' 하드코딩 더미 — `GuestHome.tsx:57` `getJobs` 실데이터 또는 '예시' 라벨
- [ ] [자동가능] **JOBS-01** 비로그인 지원 CTA 미표시 — `jobs/[id]/page.tsx:314`
- [ ] [자동가능] **UI-04** 프로필에 선호 지역 행 누락 — `profile/page.tsx`
- [ ] [자동가능] **EMP-03** 내 지원내역 N+1 — `my-applications/page.tsx:35` `documentId() in` 청크

### D. 예방적 / 위생 (info)
- [ ] [자동가능] **NAV-01** 인증 로딩 중 게스트 메뉴 깜빡임 — `BottomNav.tsx:84` `loading` 가드
- [ ] [자동가능] **NAV-02** 숨김 경로 `startsWith` 매칭 — `BottomNav.tsx:8,89`
- [ ] [자동가능] **FORMAT-01** Invalid Date 가드 — `format.ts:4`
- [ ] [자동가능] **LIB-02** `uid: docSnap.id` 보강 — `firestore.ts:219`
- [ ] [자동가능] **FIRESTORE-01** 월별 상한 `-31` 매직값 → `< nextMonth-01` — `firestore.ts:276,353`(CALC-08 동일)
- [ ] [자동가능] **REACT-02/03/04** effect 의존성/cleanup/취소 가드 — `KakaoMap`·`favorites`·`jobs/[id]`
- [ ] [자동가능] **CALC-02** 예상급여 보조라벨 명료화 — `calculator/page.tsx:884`
- [ ] [자동가능] **JOBS-03** 지원 후 메시지 초기화 — `jobs/[id]/page.tsx:111`
- [ ] [자동가능] **PROF-03** 저장 후 `router.push('/profile')` — `profile/edit/page.tsx:157,180`
- [ ] [자동가능] **CFG-04** manifest maskable/any 분리+id/scope — `manifest.json`
- [ ] [자동가능] **CFG-05** `.gitignore` `.vercel` 중복 제거 — 42행
- [ ] [자동가능] **CFG-01** `.vercelignore`에 `node_modules_old2` 추가
- [ ] [자동가능] **CFG-02** firebase env 누락 가드 — `firebase.ts:8`
- [ ] [자동가능] **SEC-06** `getPublicWorkers` isPublic 제약 '제거 금지' 주석 — `firestore.ts:205`
- [ ] [자동가능] **LIB-03** update 헬퍼 '검증은 규칙 담당' 주석 — `firestore.ts:101,242,417`
- [ ] [자동가능] **CALC-06/07** 잔업/연장 '급여 미반영' 명시·memberName 캐시 주석
- [ ] [자동가능] **JOBS-04** 목록 프리미엄/마감임박 구분(선택)

### E. 코드는 자동·실효는 배포필요 (인덱스/함수계약)
- [ ] [자동가능] ⚠️배포필요 **CALC-01** '대기중' 서버 집계 — `getEmployerStats`에 employerId+status `getCountFromServer`+복합 인덱스(`firestore.indexes.json`)
- [ ] [자동가능] ⚠️배포필요 **QUERY-01** `getJobs` 인덱스/계약 일치 — 화이트리스트 제약(자동) 또는 인덱스 추가
- [ ] [자동가능] **LIB-01** `getPublicWorkers` region dead param 정리(미지원이면 제거, 지원이면 ⚠️인덱스 배포필요)

## ⏳ 자동 진행 가능 (기존 잔여)
- [ ] [자동가능] 피드 `startAfter` 커서 페이지네이션 (현재 `limitCount`만 적용 / 커서 동작은 build 검증 불가 — 주의)
- [ ] [자동가능?] #199 잔여2 — Button/Input 컴포넌트 추출 (`btn-primary`·`card` 등 전 페이지 대규모 스윕 + 시각 검증 불가 → 사용자 오버사이트 권장)

## 🔒 사용자 필요 (루프가 건드리지 않음)
- [ ] [사용자필요] Firestore 룰/인덱스 배포 — `npx firebase-tools login` → `npx firebase-tools deploy --only firestore` (프로젝트 ildao-fcbf6) ※CALC-01/QUERY-01/LIB-01 인덱스, SEC-01/02 룰 변경 후 필수
- [ ] [사용자필요] **SEC-01** 공개 프로필 PII 분리 — `publicProfiles` 컬렉션 분리+룰+마이그레이션 (데이터 모델 설계 결정)
- [ ] [사용자필요] **SEC-02** 지원자 연락처 수락 후 노출 — `workerPhone` 별도 문서+조건부 룰 (데이터 모델 변경)
- [ ] [사용자필요] **SEC-03** 카카오 JS 키 도메인 referer 제한 (개발자 콘솔 설정)
- [ ] [사용자필요] **DEP-01** `next-pwa`→`@ducanh2912/next-pwa`/`serwist` 마이그레이션 (npm install·아키텍처)
- [ ] [사용자필요] **SEC-04/05·EMP-02/04** 지원 상태머신·철회·정원초과·마감후수락 — 정책 확정 후 적용
- [ ] [사용자필요] #316 GitHub 원격 연결 + GitHub Actions CI (현재 원격 미연결)
- [ ] [사용자필요] FCM 푸시(#79, Cloud Functions), Firebase App Check(#322), Sentry(#334), GA4(#358)
- [ ] [사용자필요] 공고 상세 SSR + generateMetadata(#234, firebase-admin 도입), TanStack Query(#169)
- [ ] [사용자필요] #246 잔여 — `sitemap.ts` + layout `metadataBase` (배포 도메인 확정 필요)
- [ ] [사용자필요] #328 잔여 — Vitest 설치(`npm install -D vitest`)+`lib/calculator` 단위 테스트. install이 권한 프롬프트라 무인 루프 부적합 → 설치 후 `verify`에 `vitest run` 합류
- [ ] [사용자필요] Pretendard 폰트 self-host(#264, 폰트 에셋), 시니어 접근성 정책(#352)
