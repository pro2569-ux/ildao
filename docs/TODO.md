# ildao TODO (개선 백로그)

> 결함 51건은 전건 완료(`docs/defect-report.md`). 이 파일은 `docs/improvement-report.md`의 잔여 개선 항목을 추적한다.
> 진행 현황 메모리: `improvement-campaign.md`. 루프는 `loop.md` 규칙을 따른다.
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
- (결함 캠페인 부산물: PWA PNG 아이콘, 지원·즐겨찾기 결정적 docId, 룰/인덱스 작성, useRequireAuth, toDate/대시보드 캡 등)

## ⏳ 자동 진행 가능 (우선순위 순)
- [ ] [자동가능] #163 잔여 — `WEATHER_OPTIONS`(calculator)·`jobStatusBadge`(favorites) 매핑을 `lib/constants.ts`로 이동
- [ ] [자동가능] #282 프로필/구직자 이미지 `next/image` 전환 + `next.config.js` `images.remotePatterns`(lh3.googleusercontent.com)
- [ ] [자동가능] #246 `src/app/robots.ts` 추가 (개인화 경로 Disallow / `/jobs` Allow). sitemap은 배포 도메인 필요 → 부분
- [ ] [자동가능] #328 Vitest 도입 + 공수/급여 계산 순수함수(`lib/calculator.ts`) 추출·단위 테스트 → 이후 `npx vitest run`이 검증에 포함됨
- [ ] [자동가능] #199 잔여 — BottomSheet(calculator 모달 2개 동일 구조)·Button/Input 컴포넌트 추출
- [ ] [자동가능] 피드 `startAfter` 커서 페이지네이션 (현재 `limitCount`만 적용)

## 🔒 사용자 필요 (루프가 건드리지 않음)
- [ ] [사용자필요] Firestore 룰/인덱스 배포 — `npx firebase-tools login` → `npx firebase-tools deploy --only firestore` (프로젝트 ildao-fcbf6)
- [ ] [사용자필요] #316 GitHub 원격 연결 + GitHub Actions CI (현재 원격 미연결)
- [ ] [사용자필요] FCM 푸시(#79, Cloud Functions), Firebase App Check(#322), Sentry(#334), GA4(#358)
- [ ] [사용자필요] 공고 상세 SSR + generateMetadata(#234, firebase-admin 도입), TanStack Query(#169)
- [ ] [사용자필요] Pretendard 폰트 self-host(#264, 폰트 에셋), 시니어 접근성 정책(#352)
