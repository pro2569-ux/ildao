# 일다오(ildao) 런칭 플랜

> 작성일: 2026-07-20 · 목표: 이번 주 내 실서비스 런칭
> 근거: 7개 영역 병렬 심층 감사(37 에이전트, 전 소스 코드 대조 검증) + 인프라 실측(Vercel/Firebase/GitHub)
> 진행 방법: 항목 앞 체크박스로 관리. Claude에게 "A1 진행해줘"처럼 번호로 지시.

---

## 한 줄 총평

**"51개 UX 개선은 끝났지만, 그 코드가 프로덕션에 배포된 적이 없고, 보안 규칙에 개인정보 유출·권한 위조 구멍이 있어 지금 상태로는 런칭 불가."**

- 현재 프로덕션(ildao.vercel.app)은 **64일 전 빌드**를 서빙 중 — P0~P3 개선 51건이 하나도 반영되지 않았다.
- `firestore.rules`에 **로그인만 하면 전 회원 전화번호를 긁을 수 있는 구멍**, **타 업체 사칭 공고 작성**, **지원 상태 위조**가 있다. 돈이 오가는 40~60대 대상 서비스에서 이건 실피해로 직결된다.
- rules와 클라이언트 코드가 어긋나 **회원탈퇴(법적 필수)가 100% 실패**, **즐겨찾기 페이지가 전면 에러**, **비로그인 첫 화면이 고장난 앱처럼 보인다**.
- 다행히 대부분 수정이 규칙 몇 줄 + 쿼리 2곳 + 파일 몇 개 수준이라 **A 파트(차단 요소)는 하루 안에 해소 가능**하다.

## 인프라 실측 결과 (감사가 몰랐던 부분 — 직접 확인)

| 항목 | 상태 |
|------|------|
| 프로덕션 배포 | ❌ 64일 전 빌드. 현재 main 미반영 |
| main→프로덕션 자동배포 | ❌ 미동작 (어제 push에도 프로덕션 배포 안 생김). `vercel --prod` 수동 배포 필요 |
| Firestore 인덱스 20종 | ✅ 프로덕션 배포 완료·로컬과 일치 |
| Vercel 프로덕션 env — Firebase admin 3종 | ✅ FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY 등록됨 (카카오 로그인 admin OK) |
| Vercel 프로덕션 env — KAKAO_REST_API_KEY, NEXT_PUBLIC_KAKAO_JS_KEY | ✅ 등록됨 |
| Vercel 프로덕션 env — 카카오맵 키 | ⚠️ `NEXT_PUBLIC_KAKAO_MAP_API_KEY`(낡은 이름)만 있고 코드가 읽는 `NEXT_PUBLIC_KAKAO_MAP_KEY` 없음 → **지도 미표시(주소 폴백)** |
| Vercel 프로덕션 env — VAPID | ❌ 없음 → 푸시 알림 비활성 (의도적으로 둘 수 있음) |
| GitHub 저장소 | ⚠️ **PUBLIC** — 상용 런칭이면 private 검토 |

> 참고: 감사는 ".env.local.example 템플릿대로 Vercel에 넣으면 다 죽는다"고 경고했지만, **실제 Vercel 프로덕션에는 이미 코드 기준 이름으로 대부분 올바르게 등록**돼 있다. 실질 미스매치는 카카오맵 키 이름 하나뿐. 다만 템플릿(.env.local.example)은 여전히 낡아서 정비 필요(B5).

---

# 파트 A — 런칭 차단 요소 (코드/규칙, 반드시 먼저) ⭐

> 전부 Claude가 로컬에서 수정 가능. rules 변경은 클라이언트 쿼리 동반 수정이 얽혀 있어 순서 중요.

- [x] **A1-①. applications 당사자 한정 + 쿼리 수정** ✅완료 [BLOCKER · M]
  - `firestore.rules` applications read를 당사자(workerId/employerId) 한정으로 변경. `getApplicationsByJob`·`getApplicationCount`·`getApplicantCounts`·`getApplicationsByJobWithProfiles`·`subscribeToApplicationsByJob`에 employerId 인자 추가, `my-jobs`·`applicants` 호출부에 `user.uid` 전달. → 전 회원 지원이력·uid 대량 조회 통로 차단.
- [ ] **A1-②. phone/email/fcmTokens 서브컬렉션 분리** ⚠️미완 — 런칭 전 강력 권장 [BLOCKER · M]
  - 남은 위험: users get이 여전히 로그인 필수뿐이라, jobs.applicants(uid 배열) + users get 조합으로 임의 uid의 전화번호를 조회할 여지가 남음(A1-①로 주 통로인 applications 전체 list는 막힘).
  - 완전 차단: phone/email/fcmTokens를 `users/{uid}/private` 서브컬렉션으로 옮기고 본인+관계자(해당 공고 구인자/지원자)만 read.
  - 범위가 큼: register·profile/edit 저장, 공고상세·지원자목록·인력검색의 전화번호 읽기, fcm 토큰 저장 위치, 기존 데이터 마이그레이션 — **전화 연결(앱 핵심 가치)을 건드려 실기기 검증 필요. 어설픈 일괄 수정은 오히려 위험하므로 별도 세션에서 진행.**

- [x] **A2. Storage 보안 규칙 신설** ✅완료(배포 대기) [BLOCKER · S]
  - 문제: `storage.rules` 파일 자체가 없고 `firebase.json`에도 storage 타깃 없음 → 프로필 사진 업로드가 콘솔 기본 규칙에 방치. 타인 경로 덮어쓰기/무제한 업로드 or 업로드 전면 실패.
  - 수정: `storage.rules` 작성 — `profile-images/{uid}`는 본인만 write + 5MB + image/* 제한, 그 외 deny. `firebase.json`에 `"storage": { "rules": "storage.rules" }` 추가. `firebase deploy --only storage`.

- [x] **A3. 지원 상태 위조 차단 (applications create)** ✅완료(배포 대기) [BLOCKER · S]
  - 문제: `firestore.rules:71-74` create가 employerId를 검증 안 함 → 지원자가 employerId를 자기 uid로 넣어 만든 뒤 스스로 'accepted'로 위조. 구인자 화면에 '수락됨'으로 표시되고 실제 수락/거절은 permission-denied.
  - 수정: create에 `&& request.resource.data.employerId == get(/databases/$(database)/documents/jobs/$(request.resource.data.jobId)).data.employerId` 추가(공고 실존 검증 겸함). 클라이언트는 이미 job.employerId 전달 중이라 앱 코드 변경 불필요.

- [x] **A4. 타 업체 명의 공고 작성 차단 (jobs create)** ✅완료(배포 대기) [BLOCKER · S]
  - 문제: `firestore.rules:57` create가 `request.auth != null`뿐 → 남의 uid를 employerId로 넣어 실존 업체 사칭 공고 게시(그 업체 전화번호 달고). 피해 업체 '내 공고'에도 나타남. isPremium 임의 세팅도 가능.
  - 수정: `allow create: if request.auth != null && request.resource.data.employerId == request.auth.uid && request.resource.data.status == 'open' && request.resource.data.applicants.size() == 0 && request.resource.data.isPremium == false`. 앱은 이미 employerId: user.uid로 씀.

- [x] **A5. 비로그인 공고 열람 허용** ✅완료 — 게스트 공개(A안) 채택, jobs read `if true` [BLOCKER · S]
  - 문제: `firestore.rules:56` jobs read 로그인 필수인데 UI는 게스트 열람 전제(게스트홈 최신공고, 공유링크 상세, '로그인하고 지원하기' CTA). 비로그인 첫 방문자 전원이 '공고를 불러오지 못했어요' 에러를 봄 → 신규 유입 퍼널 전멸.
  - 수정(권장 A안): `match /jobs`의 read를 `if true`로 개방(공고는 공개 게시물, 연락처는 users에 있어 여전히 로그인 필요). 크롤링 우려는 App Check + limit으로 완화. → GuestHome 최신공고도 함께 복구.
  - 대안 B안: 게스트 열람 포기하고 /jobs·/jobs/[id]에서 비로그인 시 로그인 유도. **제품 결정 필요** — 권장은 A.

- [x] **A6. 회원탈퇴 동작 복구** ✅완료(배포 대기) — rules delete 허용 + 관련 컬렉션 정리 확장. 서버 라우트 근본해결은 D 파트 [BLOCKER · M]
  - 문제: `firestore.rules:26` `allow delete: if false` → 탈퇴 시 users 문서 삭제가 항상 permission-denied. 법적 필수 기능 전면 불능. 추가로 dailyWorks/teams(팀원 전화번호 포함)/favorites가 탈퇴 후 영구 잔존(개인정보 파기의무 위반 소지).
  - 수정: rules를 `allow delete: if request.auth != null && request.auth.uid == userId`로. **삭제 순서는 현행 유지**(Firestore 문서 먼저 → user.delete() 나중; 뒤집으면 auth 소멸 후 문서가 고아가 됨). 삭제 전 재인증으로 requires-recent-login 반쪽탈퇴 예방. `deleteUserAccount`를 dailyWorks·teams/{uid}·teamDailyWorks·favorites까지 배치 삭제로 확장(writeBatch 500건 청크 분할).
  - 근본(권장): `/api/account/delete` 서버 라우트에서 ID 토큰 검증 후 Admin SDK로 일괄 처리(firebase-admin.ts 이미 있음).

- [x] **A7. 즐겨찾기 페이지 복구 (getUsersByIds)** ✅완료 [BLOCKER · S]
  - 문제: `firestore.ts:439` `where(documentId(),'in',chunk)` list 쿼리가 users list 규칙(본인/isPublic)을 증명 못 해 항상 permission-denied → 즐겨찾기가 하나라도 있으면 페이지 전면 에러(구인자/구직자 양쪽). 100% 재현.
  - 수정: 내부를 `Promise.all(uniqueIds.map(id => getDoc(doc(db,'users',id))))` 개별 get으로 전환(단건 get은 규칙 허용). 존재하지 않는 문서는 `exists()==false`로 걸러 기존 계약 유지. getJobsByIds는 수정 불필요.

- [x] **A8. applications 필드 화이트리스트 + jobs update 필드 잠금** ✅완료(배포 대기) [MEDIUM · S]
  - A1·A3 손보는 김에 함께: applications create에 `keys().hasOnly([...])`, jobs 소유자 update에 employerId/createdAt 변경 금지 diff 추가.

- [x] **A9. /jobs/create 순수작성 모드 가드** ✅완료 — 비로그인 리다이렉트 + 구직자 안내 [MEDIUM · S]
  - 문제: 순수 작성 모드에 비로그인·역할 가드 없음 → 게스트가 폼 다 채우고 제출 시점에야 에러, 구직자도 URL 직접진입으로 공고 등록 가능.
  - 수정: authLoading 후 !user면 `/login?returnUrl=/jobs/create`, role!=='employer'면 안내. (rules는 A4에서 이미 employerId 검증하므로 서버 방어는 확보됨.)

---

# 파트 B — 배포 전 콘솔/환경 세팅 (대부분 사용자 작업)

- [x] **B1. Firebase Auth 승인된 도메인 등록** ✅완료 (2026-07-20 사용자 확인) [BLOCKER · S · 사용자]
  - Firebase 콘솔 > Authentication > Settings > 승인된 도메인에 프로덕션 도메인(ildao.vercel.app 및 커스텀 도메인) 추가. **미등록 시 구글 로그인이 auth/unauthorized-domain으로 즉사**(카카오는 커스텀토큰이라 무관 → 구글만 조용히 죽음).

- [x] **B2. 카카오 개발자 콘솔 Redirect URI + 플랫폼 도메인 등록** ✅완료 (2026-07-20 사용자 확인) [BLOCKER · S · 사용자]
  - 카카오 로그인 > Redirect URI에 `https://<프로덕션도메인>/auth/kakao/callback` 정확히 등록(미등록 시 KOE006 즉시 실패). 앱 설정 > 플랫폼 > Web에 프로덕션 도메인 등록(지도 SDK·JS SDK 로드 허용). www/apex 둘 다 쓰면 둘 다.
  - ⚠️ Vercel 프리뷰 URL(*-*.vercel.app)은 매번 바뀌어 카카오 로그인 테스트 불가 — 정상. 프로덕션 도메인에서만 테스트.

- [x] **B3. 카카오맵 키 정합** ✅완료 (코드 폴백 방식으로 변경) [HIGH · S]
  - 1차 시도(Vercel env 등록)는 실패 — **CLI로 추가한 env가 Sensitive 타입으로 강제되고, Sensitive는 빌드타임에 노출되지 않아 NEXT_PUBLIC 인라인이 빈 값이 됨**(캐시 없는 강제 재배포로 검증). 
  - 최종 해법: KakaoMap.tsx가 `NEXT_PUBLIC_KAKAO_MAP_KEY || NEXT_PUBLIC_KAKAO_JS_KEY` 폴백 — JS 키는 정상 인라인됨(같은 카카오 앱·같은 값). 별도 지도 앱 분리 시에만 MAP_KEY 사용.
  - ⚠️ 추가 발견: dapi.kakao.com이 ildao.vercel.app referer에 **403**(미등록 도메인은 401) → 도메인 등록은 됐고 **카카오맵 서비스 '사용 설정'이 꺼져 있을 가능성** — 카카오 디벨로퍼스 > 해당 앱 > 카카오맵 > 사용 설정 ON 필요(사용자).

- [x] **B4. Firebase 요금제(Blaze) + Storage 버킷 + 예산 알림** ✅완료 — 버킷 생성됨(ildao-fcbf6.firebasestorage.app), storage.rules 배포 완료, env 정합 확인(로컬·Vercel 모두 일치). 예산 알림 설정은 권장 잔여 [HIGH · S · 사용자]
  - **2026-07-20 확인됨: Storage가 프로젝트에 아예 미설정(버킷 없음)** — `firebase deploy --only storage` 시도 시 "Firebase Storage has not been set up" 에러. 즉 프로필 사진 업로드는 현재 어느 환경에서도 동작한 적 없음(클라이언트는 "사진 올리기에 실패했습니다" 표시).
  - 할 일(사용자): Firebase 콘솔 > Storage > 시작하기(신규 프로젝트는 Blaze 요금제 필요) → 완료 후 Claude에게 알리면 `firebase deploy --only storage`로 규칙 배포. Blaze 전환 시 GCP 예산 알림(일/월 한도) 설정 권장.

- [x] **B5. .env.local.example 코드 기준 재작성** ✅완료 (A파트 커밋에 포함) [BLOCKER(문서) · S]
  - FIREBASE_SERVICE_ACCOUNT_KEY → FIREBASE_PROJECT_ID/CLIENT_EMAIL/PRIVATE_KEY, NEXT_PUBLIC_KAKAO_JAVASCRIPT_KEY → _JS_KEY, NEXT_PUBLIC_KAKAO_MAP_API_KEY → _MAP_KEY, KAKAO_REST_API_KEY·VAPID·REDIRECT_URI(선택) 추가. NEXT_PUBLIC_FIREBASE_* 6종은 그대로 유지. → 재발 방지.

- [x] **B6. 하드코딩 카카오 JS 키 폴백 제거** ✅완료 (커밋 66b6d67) [LOW · S]
  - `AuthContext.tsx:109`·`KakaoSDK.tsx:5`의 `|| '80b8cae0...'` 폴백 제거(env 미설정을 은폐, 공개 저장소에 키 노출). env 없으면 콘솔 에러 + 버튼 비활성.

---

# 파트 C — 런칭 배포 & 스모크 테스트 (당일)

> **⚠️ 2026-07-20부터 main push = 프로덕션 자동배포가 동작함** (이날 push가 프로덕션 배포를 트리거해 확인).
> 이후 main에는 배포 가능한 상태의 커밋만 push할 것. 미완성 작업은 브랜치 사용.

- [x] **C1. rules 배포** ✅부분완료 (2026-07-20)
  - firestore.rules 배포 완료 + REST 스모크 테스트 통과(게스트 jobs 읽기 허용 / users·applications 비로그인 차단 확인).
  - storage.rules는 **B4(Storage 미설정) 해소 후** `firebase deploy --only storage` 필요.
- [x] **C2. 프로덕션 배포** ✅완료 (2026-07-20)
  - main push가 프로덕션 자동배포를 트리거 — ildao.vercel.app이 현재 main(P0~P3 + A파트 + B6, 카카오맵 키 포함 빌드)을 서빙 중. 새 rules와 정합.
- [x] **C3. 실기기 스모크 테스트** ✅대부분 통과 (2026-07-20 1차)
  - ✅ 게스트 열람 / 구글 로그인 / 카카오 로그인 / 프로필 사진 업로드·표시 / 지원→수락→전화 / 회원탈퇴
  - ⏳ 지도: 카카오맵 사용 승인 대기(코드·키는 완료). 승인 후 재확인.
  - **테스트 중 발견·수정한 버그 6건** (모두 배포됨):
    1. 카카오맵 키 빈 값 — Vercel Sensitive env 빌드 미노출 → JS 키 폴백 (commit 86b448f)
    2. 프로필 사진 업로드 에러 원인 은폐 → Firebase 에러 코드 노출 (7bfa1df)
    3. **프로필 수정 저장 버튼이 하단 네비에 가려짐** — z-index 누락 (e74d73e)
    4. **내 정보에서 업로드 사진 미표시** — user.photoURL만 읽음 → profileImage 우선 (a405895)
    5. **모든 신규 지원 실패** — A1① applications read 규칙이 존재하지 않는 문서 getDoc을 거부 → get/list 분리 (a27d4d5) ⚠️치명적
    6. 프로필 공개 토글 손잡이 위치 깨짐 — left 명시 (5556146)
- [x] **C4. 비로그인 첫 화면** ✅통과 — 게스트 홈·피드·상세 정상(A5).

---

# 파트 D — 런칭 직후 (첫 주 내)

- [ ] **D1. 에러 모니터링(Sentry 무료 티어)** [HIGH] — 감사가 찾은 문제 다수가 '무음 실패'인데 프로덕션에 감지 수단 0. error.tsx:18에 자리표시 주석만 있음. 반나절.
- [ ] **D2. 프로필 사진 클라이언트 리사이즈** [HIGH · M] — 원본(최대 5MB) 그대로 업로드 → 구인자가 지원자 10명 목록 열면 수십 MB. canvas로 512px/jpeg 0.8 축소(사진당 30~80KB). 구형 Safari 폴백 포함.
- [ ] **D3. 피드/구직자목록 서버 limit** [MEDIUM] — getJobs 클라필터 경로·getPublicWorkers·getRecentApplicationsByEmployer에 limit 없음. 공고 쌓이면 Spark 일 5만 read 근접. limit + 더보기, 또는 인덱스 활용 서버 쿼리 전환.
- [ ] **D4. PWA 아이콘 PNG 생성** [HIGH · M] — manifest 아이콘 8개가 전부 PNG를 참조하나 실제는 SVG뿐 → **전부 404**. Android 설치배너(beforeinstallprompt) 미발화, iOS 홈화면·파비콘 깨짐. icon-512 SVG에서 72~512 PNG + 180 apple-touch + maskable 생성.
- [ ] **D5. 카카오 로그인 이메일 충돌 처리** [HIGH · S] — 같은 이메일 구글 가입자가 카카오 로그인 시 email-already-exists → 500 '서버 오류'. 409 + '구글 로그인을 이용해주세요' 안내(콜백 페이지도 함께). ※ B의 카카오 비즈앱 전환 여부와 순서 맞출 것.
- [ ] **D6. /api/notify 인가 강화** [HIGH · M] — 로그인만 하면 누구에게나 임의 푸시 발송 가능(피싱 벡터). url을 '/'내부경로만 허용(즉효), 발신자 uid로 관계 검증 + rate limit. 푸시를 안 켜도 최소 url 제한은 선반영.
- [ ] **D7. OG 메타 + 공고별 generateMetadata** [HIGH] — layout에 openGraph/twitter 없음 → 카톡 공유 미리보기 빈약(주 유입경로). jobs/[id] 서버컴포넌트化 + 공고별 OG.
- [ ] **D8. 문의 채널 실연결** [MEDIUM] — 현재 개인 Gmail mailto뿐(profile:337 TODO). tel: 또는 카카오채널로.
- [ ] **D9. 공고 삭제 문구/동작 정합** [MEDIUM] — '지원자 정보도 삭제' 안내와 달리 jobs 문서만 삭제. 문구 수정 or 소프트삭제(closed).
- [ ] **D10. 역할 변경 데이터 정합** [MEDIUM] — 구인자→구직자 전환 시 모집중 공고 잔존 + '내 공고' 탭 소실로 관리 단절. 전환 전 마감 유도.
- [ ] **D11. 잔여 정합/무음실패** [MEDIUM~LOW] — Android 포그라운드 푸시 showNotification 전환(fcm.ts:150), WorkerHome 구독 onError, global-error.tsx, robots.ts/sitemap.ts, 인앱브라우저 iOS 설치안내 분기, vercel.json regions:['icn1'].

---

# 파트 E — 사업/법무 (런칭 일정에 직접 영향, 사용자 확인)

- [ ] **E1. 직업정보제공사업 신고 여부 확인** [HIGH · 사용자·법무] — 구인·구직 정보 제공은 직업안정법상 신고 대상일 수 있고 미신고 영업은 처벌 조항. 처리에 수일 소요 가능 → **이번 주 일정에 직접 영향**. 관할 고용노동청 확인.
- [ ] **E2. 개인정보처리방침 법정 필수기재 보완** [HIGH] — 개인정보 보호책임자(성명·연락처), 운영자 명의, 카카오/구글 수집출처, 푸시 토큰 수집 추가. (문의처가 개인 Gmail뿐)
- [ ] **E3. 약관에 운영 주체 표기** [MEDIUM] — 상호·대표자·연락처·사업자등록번호.
- [ ] **E4. 가입 시 명시적 개인정보 동의 절차** [MEDIUM] — register에 [필수] 수집·이용 동의 체크박스(현재 '간주 동의'뿐, 보호법 15조).
- [ ] **E5. 신고 기능(최소안)** [HIGH] — 허위·임금사기 공고 대응 수단이 이메일뿐. 공고/프로필에 '신고하기' → reports 컬렉션 + 콘솔 수동 처리.
- [ ] **E6. 카카오 비즈앱 전환 여부 결정** [MEDIUM] — 미전환 시 카카오 가입자 전원 email 공란(식별=전화번호뿐). 전환 시 D5 충돌 발생 시작 → 순서 조율.
- [ ] **E7. 백업(PITR) + Vercel 플랜 + 콘텐츠 시딩** [MEDIUM] — 공수기록(임금 근거) 단일사본 → PITR/주간 export. Vercel Hobby는 상업이용 금지 → Pro 검토. 런칭 직후 빈 화면 방지용 실제 공고 5~10건 시딩 + 구직자 빈상태 CTA.

---

# 권장 실행 순서

```
Day 1  A1~A9 코드/rules 전부 수정 → 로컬 빌드 → 커밋 (Claude)
Day 1  B1 B2 B4 콘솔 세팅 (사용자, 병행 가능)
Day 2  C1 rules 배포 → C2 프로덕션 배포 → C3 C4 실기기 스모크
       ⇒ 여기까지 통과하면 소프트 런칭 가능
Day 2~ E1 신고의무 확인(가장 먼저 착수 — 리드타임 김), E2~E5 법무/운영
1주차  D1(모니터링) D2(사진) D4(아이콘) D5 D7 우선
```

## 런칭 판단 기준

- **A 파트 전부 + B1/B2/B3/B5 + C 전부 + E1/E2** 완료 = 소프트 런칭 가능선.
- D·나머지 E는 실사용자를 받으며 첫 주에 따라와도 되는 개선.
- "완벽하면 바로 런칭"은 지금 불가 — 최소 A(보안·핵심 플로우)와 B(로그인 도메인)를 넘기 전에는 개인정보 유출/로그인 불능 상태로 나가게 된다.
