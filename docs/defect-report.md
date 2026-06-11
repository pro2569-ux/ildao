# 일다오(ildao) 코드 결함 보고서

> **작성일**: 2026-06-12
> **대상**: `C:\Project\ildao` 전체 코드베이스 (Next.js 14 + TypeScript + Firebase)
> **방법론**: 6개 관점(보안 룰, 데이터 레이어, 인증/권한, 화면별 로직, 입력 검증, 동시성)의 병렬 탐색 에이전트가 후보 64건을 발견 → 중복 병합으로 49건 확정 → 결함별 적대적 교차 검증(critical/high는 코드·악용가능성 2개 렌즈, medium/low는 코드 렌즈 1개, 총 66회 판정) 수행. 모든 인용 코드는 검증자가 원본 파일을 직접 읽어 대조함.
> **빌드 상태**: `tsc --noEmit` 통과 (타입 오류 0건)

---

## 1. 요약

| 심각도 | 건수 | 확정 | 이견 |
|---|---|---|---|
| 치명적 (Critical) | 5 | 5 | 0 |
| 높음 (High) | 12 | 9 | 3 |
| 중간 (Medium) | 19 | 19 | 0 |
| 낮음 (Low) | 12 | 12 | 0 |
| **합계** | **48** | **45** | **3** |

검증 과정에서 **기각(오탐) 처리된 항목 1건**은 부록 A에 기록했습니다. 워크플로우와 별개로 직접 확인한 **추가 결함 2건**(PWA 아이콘 404, git 저장소 손상)은 6장에 있습니다.

### 가장 시급한 리스크 — Firebase 보안 구성

이 프로젝트의 최대 리스크는 개별 버그가 아니라 **보안 경계 자체가 성립하지 않는 구조**입니다.

- `firestore.rules`는 `users` 컬렉션 규칙 하나만 정의하고, 앱이 사용하는 나머지 6개 컬렉션(jobs, applications, dailyWorks, teamDailyWorks, teams, favorites)에는 규칙이 전혀 없습니다(결함 #1).
- 그 하나뿐인 users 읽기 규칙조차 "본인 문서만 읽기"라서, 구직자 검색·공고 상세·즐겨찾기 등 타인 프로필을 읽는 모든 화면과 정면으로 모순됩니다(결함 #2).
- `firebase.json`/`.firebaserc`가 없어 이 룰 파일은 어떤 배포 파이프라인에도 연결되지 않은 죽은 파일입니다.
- 서버 API 계층(firebase-admin, API Route)이 전혀 없어 모든 권한 검증이 클라이언트 코드에만 존재합니다(결함 #3).

결과적으로 **룰이 배포되어 있으면 앱 핵심 기능 전체가 permission-denied로 불능**이고, **배포되어 있지 않으면(테스트 모드) 임금 기록·팀원 전화번호·지원 내역 등 PII가 전 세계에 읽기/쓰기로 노출**됩니다. 어느 쪽이든 치명적이므로, 다른 어떤 수정보다 먼저 전 컬렉션 보안 룰 작성과 배포 파이프라인 구축이 필요합니다. 이견(disputed) 처리된 #6, #7, #12 역시 모두 이 룰 상태에 결론이 좌우되는 항목입니다.

### 즉시 재현되는 기능 버그 (보안 외)

- **구인글 등록이 종료일 미입력 시 항상 실패** (#4 — `endDate: undefined`를 addDoc에 전달)
- **팀원 추가가 연락처/일당 미입력 시 항상 실패** (#13 — 같은 undefined 패턴)
- **소스 파일 2개의 한글 인코딩 손상이 화면에 그대로 노출** (#16, #30)
- **즐겨찾기 추가 경로가 코드에 존재하지 않아 즐겨찾기 화면이 영구 빈 상태** (#24)
- **구인자 대시보드 '총 지원자 수'가 최대 10으로 캡핑** (#23)

---

## 2. 치명적 (Critical) — 5건

서비스 운영 시 데이터 노출·전면 기능 불능·핵심 플로우 차단으로 직결되는 결함입니다.

### 1. firestore.rules에 users 외 6개 컬렉션(jobs, applications, dailyWorks, teamDailyWorks, teams, favorites) 규칙이 전부 부재

- **위치**: `firestore.rules:3-24`
- **심각도**: 치명적 (Critical)
- **검증**: ✅ 확정 — 2/2 실재 판정 (신뢰도 high·high)

**문제 설명**

룰 파일은 users 매치 블록 하나만 정의하고 끝난다. 반면 src/lib/firestore.ts는 jobs(18행), applications(100행), dailyWorks(218행), teams(281행), teamDailyWorks(297행), favorites(343행) 6개 컬렉션을 모두 읽고 쓴다. 이 룰이 배포된 상태라면 Firestore 기본 거부(deny-by-default)에 의해 구인글 작성/조회, 지원, 공수계산기, 즐겨찾기 등 앱의 핵심 기능 전부가 permission-denied로 실패한다. 반대로 배포되지 않았다면(테스트 모드 유지) Firebase 설정이 NEXT_PUBLIC_*으로 클라이언트 번들에 노출되므로 전 세계 누구나 SDK/REST로 임금 기록(dailyWorks), 팀원 전화번호(teams), 지원 내역 전체를 읽고 임의로 변조·삭제할 수 있다. 어느 쪽이든 치명적 결함이며, 프로젝트 루트에 firebase.json/.firebaserc가 없어 이 룰 파일은 어떤 배포 파이프라인에도 연결되지 않은 죽은 파일이다.

**근거 코드**

```
firestore.rules 전체:
  match /users/{userId} { ... }
  // 다른 사용자의 공개 프로필 읽기 (구인/구직 시 필요)
  // TODO: 추후 필요 시 ...
}  // jobs/applications/dailyWorks/teamDailyWorks/teams/favorites 매치 블록 없음

firestore.ts:18  await addDoc(collection(db, 'jobs'), {...})
firestore.ts:100 await addDoc(collection(db, 'applications'), {...})
firestore.ts:218 const docRef = doc(db, 'dailyWorks', docId);
firestore.ts:281 await setDoc(doc(db, 'teams', userId), {...})
firestore.ts:297 const docRef = doc(db, 'teamDailyWorks', docId);
firestore.ts:343 await addDoc(collection(db, 'favorites'), {...})
```

**수정 방안**

firestore.rules에 6개 컬렉션별 규칙을 추가하라. 예: jobs는 read 공개 + create/update/delete는 request.auth.uid == resource.data.employerId(생성 시 request.resource.data.employerId) 강제; applications는 create 시 request.auth.uid == request.resource.data.workerId, read는 workerId 또는 employerId 본인만; dailyWorks는 userId, teams는 docId == request.auth.uid, teamDailyWorks는 teamLeaderId, favorites는 userId 본인 문서만 read/write. 그리고 firebase.json을 만들어 "firestore": {"rules": "firestore.rules"}로 연결 후 firebase deploy --only firestore:rules로 실제 배포하고, 콘솔에서 테스트 모드 만료 여부를 확인하라.

---

### 2. users 읽기 규칙(본인만 허용)이 타인 프로필을 읽는 모든 화면(구직자 검색·공고 상세·즐겨찾기)과 정면 모순

- **위치**: `firestore.rules:9`
- **심각도**: 치명적 (Critical)
- **검증**: ✅ 확정 — 2/2 실재 판정 (신뢰도 high·high) · 검증자 심각도 재평가: High

**문제 설명**

룰은 'allow read: if request.auth.uid == userId'로 본인 문서만 읽기를 허용한다. 그러나 (1) workers 페이지는 getPublicWorkers로 users 컬렉션 전체를 쿼리하고(로그인 가드도 없어 비로그인 사용자도 접근 가능 — request.auth == null이라 무조건 거부), (2) 공고 상세는 구인자 프로필을, (3) 즐겨찾기는 대상 사용자 프로필을 getUserProfile로 읽는다. Firestore 규칙은 필터가 아니므로 isPublic==true 조건을 걸어도 쿼리 자체가 거부된다. 이 룰이 배포되면 구직자 검색, 공고 상세의 업체 정보, 즐겨찾기 목록이 모두 permission-denied로 깨진다(catch로 빈 목록/null 처리되어 조용히 오작동).

**근거 코드**

```
firestore.rules:9   allow read: if request.auth != null && request.auth.uid == userId;

firestore.ts:163-171 (getPublicWorkers)
  where('role', '==', 'worker'), where('isPublic', '==', true) ... query(collection(db, 'users'), ...)
workers/page.tsx:31  const data = await getPublicWorkers({...})  // 로그인 가드 없음
jobs/[id]/page.tsx:44  const employerData = await getUserProfile(jobData.employerId);
favorites/page.tsx:72  const worker = await getUserProfile(fav.targetId);
```

**수정 방안**

users 규칙을 'allow read: if request.auth != null && (request.auth.uid == userId || resource.data.isPublic == true || resource.data.role == "employer")' 형태로 확장하되, getPublicWorkers 쿼리가 통과하려면 쿼리 조건과 규칙 조건이 일치해야 한다(isPublic==true 필터 필수 유지). 비로그인에게도 구직자 검색을 열려면 request.auth != null 조건을 공개 분기에서 제거한다. 근본적으로는 phone/email을 제외한 공개 필드만 담는 publicProfiles 컬렉션(또는 서브컬렉션)으로 분리하는 것이 안전하다.

---

### 3. 공고 마감/삭제/수정·지원 생성·지원 상태 변경이 전부 클라이언트 검사만으로 보호됨 — 소유권/신원 위조 가능

- **위치**: `src/lib/firestore.ts:83-108`
- **심각도**: 치명적 (Critical)
- **검증**: ✅ 확정 — 2/2 실재 판정 (신뢰도 medium·high)

**문제 설명**

jobs/applications에 규칙이 전혀 없는 상태에서 쓰기 헬퍼들은 권한 검증이 없다. (1) updateJob/deleteJob은 jobId만 받으며 호출자(my-jobs 페이지)도 job.employerId === user.uid를 확인하지 않으므로, 브라우저 콘솔에서 SDK로 임의 jobId를 넘기면 남의 공고를 마감·삭제할 수 있다. (2) applyToJob은 workerId/employerId를 클라이언트 인자로 받아 그대로 저장하므로 타인(workerId) 명의의 지원을 위조하거나 employerId를 조작해 타 구인자의 대시보드 통계(getEmployerStats는 employerId 필드로 집계)를 오염시킬 수 있다. (3) updateApplicationStatus는 호출자가 해당 공고의 구인자인지 검증하지 않아 구직자가 자기 지원 문서를 직접 'accepted'로 바꿀 수 있다.

**근거 코드**

```
firestore.ts:83-94
  export async function updateJob(jobId: string, data: Partial<JobPost>) { ... await updateDoc(doc(db, 'jobs', jobId), {...}) }
  export async function deleteJob(jobId: string) { await deleteDoc(doc(db, 'jobs', jobId)); }

firestore.ts:99-106
  export async function applyToJob(jobId, workerId, employerId) {
    const docRef = await addDoc(collection(db, 'applications'), { jobId, workerId, employerId, status: 'pending', ... });

firestore.ts:152-154
  export async function updateApplicationStatus(applicationId, status) {
    await updateDoc(doc(db, 'applications', applicationId), { status });

my-jobs/page.tsx:54-57 handleClose는 confirm() 후 바로 updateJob(jobId, { status: 'closed' }) — 소유권 확인 없음
```

**수정 방안**

Firestore 규칙으로 강제하라: jobs update/delete는 'resource.data.employerId == request.auth.uid'; applications create는 'request.resource.data.workerId == request.auth.uid && request.resource.data.employerId == get(/databases/$(database)/documents/jobs/$(request.resource.data.jobId)).data.employerId'; applications update는 구인자만 status 필드 변경 허용(request.auth.uid == resource.data.employerId, 변경 필드를 status로 제한). 코드 차원에서도 applyToJob의 workerId 인자를 제거하고 내부에서 auth.currentUser.uid를 사용하도록 수정하라.

---

### 4. 종료일 미입력 시 endDate가 undefined로 addDoc에 전달되어 구인글 등록이 항상 실패

- **위치**: `src/app/jobs/create/page.tsx:70`
- **심각도**: 치명적 (Critical)
- **검증**: ✅ 확정 — 2/2 실재 판정 (신뢰도 high·high) · 검증자 심각도 재평가: High

**문제 설명**

구인글 작성 폼에서 종료일은 선택 입력인데, 비워두면 endDate: undefined가 객체 키로 포함된 채 createJob → addDoc으로 전달된다. Firestore Web SDK는 ignoreUndefinedProperties 옵션이 없으면(현재 firebase.ts는 옵션 없는 getFirestore(app) 사용) undefined 필드 값에 대해 'Unsupported field value: undefined (found in field endDate)' FirebaseError를 throw한다. 따라서 종료일을 입력하지 않는 가장 흔한 경로(단기/무기한 공고)에서 구인글 등록이 항상 실패하고 '저장에 실패했습니다'만 표시된다.

**근거 코드**

```
// jobs/create/page.tsx:69-70
startDate: new Date(startDate),
endDate: endDate ? new Date(endDate) : undefined,

// firestore.ts:18-19
const docRef = await addDoc(collection(db, 'jobs'), {
  ...data,

// firebase.ts:22
export const db = getFirestore(app);
```

**수정 방안**

createJob 호출 시 undefined 키를 아예 제거한다: `...(endDate && { endDate: new Date(endDate) })` 형태의 조건부 스프레드를 쓰거나 null을 저장한다. 또는 firebase.ts에서 `initializeFirestore(app, { ignoreUndefinedProperties: true })`로 초기화한다. 전자가 데이터 모델이 명확해 권장.

---

### 5. 구인글 작성 페이지(jobs/create)에 인증/역할 가드가 전혀 없어 구직자도 구인글 등록 가능

- **위치**: `src/app/jobs/create/page.tsx:27-54`
- **심각도**: 치명적 (Critical)
- **검증**: ✅ 확정 — 2/2 실재 판정 (신뢰도 high·high) · 검증자 심각도 재평가: High

**문제 설명**

CreateJobPage에는 비로그인 리다이렉트도, employer 역할 검사도 전혀 없다. 비로그인 사용자는 폼 전체를 보고 작성한 뒤 제출 시점에야 '로그인이 필요합니다' 에러를 받아 입력 내용을 잃는다. 더 심각한 것은 제출 시 검사도 `!user || !userProfile`뿐이라, 로그인한 구직자(worker)가 URL 직접 입력으로 접근하면 검사를 통과해 자신의 uid를 employerId로 한 구인글을 실제로 등록할 수 있다(역할 권한 우회). 등록된 공고의 employerId가 worker의 uid가 되어 공고 상세의 업체 정보 표시와 구인자 전용 흐름의 데이터 정합성이 깨지며, 로그아웃 후에도 이 페이지에 머물 수 있다.

**근거 코드**

```
export default function CreateJobPage() {
  const { user, userProfile } = useAuth();
  ...
  const handleSubmit = async () => {
    ...
    if (!user || !userProfile) { setError('로그인이 필요합니다.'); return; }
    ...
    await createJob({ employerId: user.uid, ... });
```

**수정 방안**

페이지 상단에 useEffect 가드를 추가: `if (!loading && !user) router.replace('/login')`, `if (!loading && userProfile && userProfile.role !== 'employer') router.replace('/')`. 가드 통과 전에는 스피너만 렌더하고, handleSubmit에서도 `userProfile.role === 'employer'`를 재검사한다. 아울러 Firestore 규칙에서 jobs create 시 요청자의 users 문서 role이 employer인지 검증해야 근본적으로 차단된다.

---

## 3. 높음 (High) — 12건

핵심 기능의 오동작, 데이터 정합성 훼손, 권한 우회에 해당하는 결함입니다.

### 6. isPublic=false여도 전화번호·이메일이 읽히는 경로 — isPublic이 직접 문서 조회에는 전혀 적용되지 않음

- **위치**: `src/lib/firestore.ts:184-193`
- **심각도**: 높음 (High)
- **검증**: ⚠️ 검증자 이견 — 1/2 실재 판정 (신뢰도 high·high)

**문제 설명**

isPublic은 getPublicWorkers의 쿼리 필터로만 쓰일 뿐, getUserProfile(uid)에는 어떤 검사도 없다. 따라서 (현재 규칙 미배포/완화 상태에서) uid만 알면 비공개 전환한 구직자의 phone, email, desiredWage 등 전체 프로필을 읽을 수 있다. 실제로 favorites 페이지는 한번 즐겨찾기된 근로자에 대해 isPublic 여부와 무관하게 getUserProfile로 전체 문서를 로드해 tel: 링크로 전화번호를 노출한다. 또한 getPublicWorkers도 문서 전체(phone, email 포함)를 클라이언트로 내려보내며 화면에서 렌더링만 안 할 뿐 네트워크 응답에는 포함된다. teams 문서(팀원 이름/전화번호/일당), dailyWorks(개인 임금 기록)도 규칙 부재 시 동일하게 노출된다.

**근거 코드**

```
firestore.ts:184-193 (getUserProfile)
  const docSnap = await getDoc(doc(db, 'users', uid));  // isPublic 검사 없이 전체 필드 반환

favorites/page.tsx:308-314
  {w.phone && (
    <a href={`tel:${w.phone}`} ... >연락하기</a>
  )}

firestore.ts:173-180 (getPublicWorkers)
  return snapshot.docs.map((doc) => { const data = doc.data(); return { ...data, ... } as UserProfile; });  // phone/email 포함 전체 전송
```

**수정 방안**

공개 노출용 필드(name, skills, experience, region, desiredWage, profileImage)만 담는 별도 공개 프로필 문서/컬렉션을 만들고, phone·email은 본인과 '수락된 지원 관계'가 있는 상대에게만 규칙으로 허용하라. 최소한 규칙에서 isPublic==false 문서의 타인 read를 차단하고, 즐겨찾기 화면은 isPublic이 꺼진 근로자의 연락처를 숨기도록 수정해야 한다. teams/dailyWorks는 본인 외 read를 전면 차단하라.

> **⚠️ 검증자 이견 정리**: 검증자 한 명은 코드 경로를 추적해 실재 결함으로 판정했습니다(예: 구직자가 프로필을 비공개로 전환해도 이미 즐겨찾기한 구인자에게 `tel:` 링크로 전화번호가 계속 노출됨). 다른 검증자는 커밋된 firestore.rules(본인 문서만 읽기 허용)가 실제로 배포되어 있다면 타인 문서 읽기 자체가 거부되므로 노출이 발생하지 않는다고 기각했습니다. **양쪽 모두 "isPublic이 직접 문서 조회에는 적용되지 않는다"는 코드 차원의 사실은 인정**하므로, 결함 #1·#2의 보안 룰 정비 시 이 항목(공개 필드 분리 또는 isPublic 룰 반영)을 반드시 함께 처리해야 합니다.

---

### 7. users update 규칙이 role·email·createdAt 등 불변 필드 변경을 허용 — 구직자가 스스로 employer로 역할 변조 가능

- **위치**: `firestore.rules:15-16`
- **심각도**: 높음 (High)
- **검증**: ⚠️ 검증자 이견 — 1/2 실재 판정 (신뢰도 high·high) · 검증자 심각도 재평가: Medium

**문제 설명**

update 규칙은 request.resource.data.uid == userId만 검사하므로, 사용자가 클라이언트 콘솔에서 updateDoc으로 자신의 role을 'worker'→'employer'로 바꾸거나 email, createdAt을 임의 값으로 덮어쓸 수 있다. 클라이언트 SDK 키는 공개되어 있으므로 앱의 모든 권한 분기(BottomNav, 홈 분기, 구인글 작성 등)가 의존하는 userProfile.role 검증이 무의미해진다. updateUserProfile 헬퍼도 Record<string, any>를 그대로 spread해 어떤 필드든 통과시켜 코드 차원의 방어도 없다.

**근거 코드**

```
firestore.rules:15-16
  allow update: if request.auth != null && request.auth.uid == userId
    && request.resource.data.uid == userId;

firestore.ts:395-400
  export async function updateUserProfile(uid: string, data: Record<string, any>) {
    await updateDoc(doc(db, 'users', uid), { ...data, updatedAt: serverTimestamp() });
```

**수정 방안**

update 규칙에 불변 필드 보호를 추가하라: 'request.resource.data.role == resource.data.role && request.resource.data.email == resource.data.email && request.resource.data.createdAt == resource.data.createdAt'. 역할 변경이 필요하면 별도 관리자 플로우(Cloud Function)로만 허용하고, 향후 프리미엄 필드(isPremium 등) 도입 시에도 클라이언트 쓰기 금지 목록에 포함시켜야 한다.

> **⚠️ 검증자 이견 정리**: 양쪽 검증자 모두 "룰이 role/email/createdAt 변경을 막지 않는다"는 사실은 인정합니다. 기각 측 논거는 가입 시 누구나 employer 역할을 자유롭게 선택할 수 있으므로(role은 자기신고 값) 역할 변조가 실질적 권한 상승이 아니라는 것입니다. 다만 향후 사업자 인증·프리미엄 결제가 도입되면 role이 실제 권한 경계가 되므로, 룰 정비 시 불변 필드 보호(`request.resource.data.role == resource.data.role` 등)를 미리 넣어두는 것이 안전합니다.

---

### 8. applyToJob에 중복·공고 상태·역할 검증 전무 — 동시/반복 지원으로 중복 문서 생성, 마감·삭제된 공고에도 지원 가능

- **위치**: `src/lib/firestore.ts:99-108`
- **심각도**: 높음 (High)
- **검증**: ✅ 확정 — 2/2 실재 판정 (신뢰도 high·high) · 검증자 심각도 재평가: Medium

**문제 설명**

applyToJob은 addDoc(자동 생성 문서 ID)으로 지원 문서를 만들며 job 문서의 현재 상태, 호출자의 역할, 기존 지원 여부를 전혀 확인하지 않는다. hasApplied 검사는 페이지 로드 시 1회 UI 표시용으로만 수행되고 read-then-write가 원자적이지 않아, 두 탭/두 기기에서 동시에 지원하면 같은 (jobId, workerId) 조합의 지원 문서가 여러 개 생성된다. 또 구직자가 상세 페이지를 열어둔 사이 구인자가 공고를 마감/삭제해도 stale한 화면에서 지원이 정상 생성되며, 구인자 계정으로도 지원 문서를 만들 수 있다. 결과적으로 지원자 수 집계(getApplicationCount)와 지원자 목록이 중복·오염되고, 구인자는 마감한 공고에 지원이 계속 쌓이는 것을 인지하지 못한다.

**근거 코드**

```
// firestore.ts:99-106
export async function applyToJob(jobId: string, workerId: string, employerId: string): Promise<string> {
  const docRef = await addDoc(collection(db, 'applications'), {
    jobId,
    workerId,
    employerId,
    status: 'pending' as ApplicationStatus,
    createdAt: serverTimestamp(),
  });

// jobs/[id]/page.tsx:60-65 — status/중복 재확인 없이 바로 쓰기
const handleApply = async () => {
  if (!user || !job) return;
  setApplying(true);
  try {
    await applyToJob(jobId, user.uid, job.employerId);
```

**수정 방안**

문서 ID를 결정적으로 `${jobId}_${workerId}`로 만들고 setDoc(create 전용) 또는 runTransaction으로 생성해 중복을 구조적으로 차단한다(dailyWorks가 이미 `${userId}_${date}` 패턴 사용 중). 트랜잭션 안에서 jobs/{jobId}의 존재 여부와 status === 'open'을 확인한 뒤에만 생성하고, 아니면 명시적 에러를 던져 UI에서 '마감된 공고입니다'를 안내한다. firestore.rules의 applications create 규칙에서도 request.auth.uid == workerId, 지원자 role == 'worker', get()으로 대상 job의 status == 'open'을 검증한다.

---

### 9. where+orderBy 복합 쿼리 다수에 복합 인덱스 필요 — firestore.indexes.json 부재로 미생성 환경에서 핵심 화면 전부 로드 실패

- **위치**: `src/lib/firestore.ts:41-51,112-116,127-131,245-251,324-330,377-383,420-425`
- **심각도**: 높음 (High)
- **검증**: ✅ 확정 — 2/2 실재 판정 (신뢰도 high·medium) · 검증자 심각도 재평가: Medium

**문제 설명**

구인공고 피드의 기본 쿼리(where status=='open' + orderBy createdAt desc), 일당순 정렬(status + orderBy dailyWage), 카테고리 필터(category + status + orderBy), 지원 내역(workerId == + orderBy createdAt), 공고별 지원 목록(jobId == + orderBy createdAt), 즐겨찾기(userId == [+ targetType ==] + orderBy createdAt), 대시보드(employerId == + orderBy createdAt), 공수 기록(userId/teamLeaderId == + date 범위 + orderBy date) 모두 Firestore 복합 인덱스가 필요하다. 프로젝트에 firestore.indexes.json이 없어 인덱스를 수동 생성하지 않은 환경에서는 failed-precondition 에러가 발생하고, 각 페이지는 catch에서 console.error만 남긴 채 '등록된 구인공고가 없습니다' 같은 빈 화면이나 계산기 에러 메시지만 보여줘 사용자는 원인을 알 수 없다.

**근거 코드**

```
// firestore.ts:41-47 — 피드 기본 경로부터 복합 인덱스 필요
if (filters?.category) constraints.push(where('category', '==', filters.category));
if (filters?.status) constraints.push(where('status', '==', filters.status));
if (filters?.employerId) constraints.push(where('employerId', '==', filters.employerId));
constraints.push(orderBy(filters?.sortBy || 'createdAt', filters?.sortDir || 'desc'));

// firestore.ts:245-251 — dailyWorks: userId == + date 범위 + orderBy(date)
const q = query(collection(db, 'dailyWorks'), where('userId', '==', userId), where('date', '>=', startDate), where('date', '<=', endDate), orderBy('date', 'asc'));

// jobs/page.tsx:42-43 — 실패 시 콘솔만 남고 빈 목록 표시
} catch (error) {
  console.error('구인 공고 로드 실패:', error);
```

**수정 방안**

필요한 복합 인덱스를 firestore.indexes.json으로 정의해 리포에 체크인하고 `firebase deploy --only firestore:indexes`로 배포한다(jobs: status+createdAt, status+dailyWage, category+status+createdAt, category+status+dailyWage, employerId+createdAt / applications: workerId+createdAt, jobId+createdAt, employerId+createdAt / favorites: userId+createdAt, userId+targetType+createdAt / dailyWorks: userId+date, teamDailyWorks: teamLeaderId+date). 각 페이지 catch에서 사용자에게 에러 상태를 표시한다.

---

### 10. 공고 상세 useEffect 의존성에 userProfile 누락 — 새로고침 진입 시 hasApplied 검사가 건너뛰어져 이미 지원한 공고에 '지원하기' 버튼 노출

- **위치**: `src/app/jobs/[id]/page.tsx:29-31,48-51`
- **심각도**: 높음 (High)
- **검증**: ✅ 확정 — 2/2 실재 판정 (신뢰도 high·high)

**문제 설명**

AuthContext는 onAuthStateChanged 콜백에서 setUser(firebaseUser) 후 await fetchUserProfile(...)을 수행하므로(AuthContext.tsx:72-79), user가 set된 렌더 시점에 userProfile은 아직 null이다. 공고 상세의 useEffect 의존성은 [jobId, user]뿐이라 user 변경 시 loadJobDetail이 실행되는데, 이때 `userProfile?.role === 'worker'` 조건이 false여서 hasApplied 검사가 건너뛰어진다. 이후 userProfile이 로드되어도 effect는 재실행되지 않으므로 applied가 false로 남고, 이미 지원한 구직자에게 '지원 완료' 대신 '지원하기' 버튼이 노출된다. 클릭하면 applyToJob의 중복 방지 부재와 결합해 중복 지원 문서가 실제로 생성된다. 공고 상세 URL로 직접 진입하거나 새로고침할 때마다 재현된다.

**근거 코드**

```
// jobs/[id]/page.tsx:29-31
useEffect(() => {
  loadJobDetail();
}, [jobId, user]);

// jobs/[id]/page.tsx:48-51
if (user && userProfile?.role === 'worker') {
  const alreadyApplied = await hasApplied(jobId, user.uid);
  setApplied(alreadyApplied);
}

// AuthContext.tsx:73-75
setUser(firebaseUser);
if (firebaseUser) {
  await fetchUserProfile(firebaseUser.uid);
```

**수정 방안**

useEffect 의존성 배열에 userProfile을 추가하거나(`[jobId, user, userProfile]`) 지원 여부 확인을 별도 effect로 분리하고, handleApply에서도 쓰기 직전 hasApplied를 재확인하거나 결정적 문서 ID(setDoc) 방식으로 전환해 근본적으로 중복을 차단한다.

---

### 11. 프로필 로드 실패가 '프로필 없음'과 동일 처리되어 기존 회원이 재가입 폼으로 유도되고 merge 없는 setDoc으로 프로필 전체가 덮어써짐

- **위치**: `src/app/register/page.tsx:132`
- **심각도**: 높음 (High)
- **검증**: ✅ 확정 — 2/2 실재 판정 (신뢰도 high·high)

**문제 설명**

AuthContext.fetchUserProfile은 getDoc이 일시적 네트워크 오류 등으로 실패하면 catch에서 userProfile을 null로 설정해 '미가입 사용자'와 구분이 불가능해진다. 이 상태에서 login 페이지는 user는 있고 userProfile이 null이면 자동으로 /register로 리다이렉트하고, register의 handleSubmit은 서버에서 기존 프로필 존재 여부를 재확인하지 않은 채 merge 없는 setDoc으로 users 문서를 통째로 교체한다. 즉 일시적 오류만으로 기존 회원의 role/skills/region/isPublic 등 기존 필드가 모두 소실되고 createdAt도 리셋되며, 다른 역할을 선택해 제출하면 기존 공고/지원 데이터와 역할 불일치도 발생한다. 또한 register의 렌더 게이트(144행)는 `loading || !user`만 검사해 userProfile이 있어도 리다이렉트 완료 전까지 폼이 노출되고, 홈(page.tsx:22)에서는 로그인 상태인데도 GuestHome이 표시되는 잘못된 화면 노출도 함께 발생한다.

**근거 코드**

```
// AuthContext.tsx:57-60
} catch (error) {
  console.error('프로필 로드 실패:', error);
  setUserProfile(null);
}
// login/page.tsx:25-28
} else {
  // 프로필 없으면 회원가입으로
  router.replace('/register');
}
// register/page.tsx:132
await setDoc(doc(db, 'users', user.uid), profileData);  // merge 없음, createdAt: serverTimestamp() 재설정
// register/page.tsx:144
if (loading || !user) { return ( <스피너> ); }
```

**수정 방안**

AuthContext에 profileError(또는 profileStatus: 'loaded' | 'missing' | 'error') 상태를 분리해 로드 실패와 문서 부재를 구분한다. login 페이지는 'error' 상태에서는 /register로 보내지 않고 재시도 UI를 보여준다. register의 handleSubmit에서 저장 직전 getDoc으로 기존 문서 존재를 확인해 존재하면 중단하고 홈으로 보내거나 setDoc(..., { merge: true })를 사용하고, Firestore 규칙에서 `allow create: if !exists(...)` 형태의 create 전용 규칙으로 서버에서도 차단한다. 렌더 게이트에 userProfile 존재 시 스피너 반환도 추가한다.

---

### 12. workers 페이지에 인증·역할 가드 전무 — 비로그인 사용자도 구직자 개인정보 목록 접근

- **위치**: `src/app/workers/page.tsx:18-26`
- **심각도**: 높음 (High)
- **검증**: ⚠️ 검증자 이견 — 1/2 실재 판정 (신뢰도 high·medium) · 검증자 심각도 재평가: Medium

**문제 설명**

구인자 전용으로 설계된 구직자 검색 페이지가 useAuth 자체를 사용하지 않아 비로그인 사용자, 구직자, 가입 미완료 사용자 모두 URL로 접근할 수 있다. 노출 정보는 이름, 경력, 보유 기술, 희망 일당, 지역, 프로필 사진 등 개인정보이며, 마운트 즉시 getPublicWorkers로 users 컬렉션을 조회한다. 인증 없는 크롤링으로 구직자 정보가 수집될 수 있는 구조다.

**근거 코드**

```
export default function WorkersPage() {
  const router = useRouter();
  const [workers, setWorkers] = useState<UserProfile[]>([]);
  ...
  useEffect(() => {
    loadWorkers();
  }, [selectedCategory]);
// useAuth 미사용, 가드 없음
```

**수정 방안**

useAuth를 도입해 `!loading && !user`면 /login으로, `userProfile?.role !== 'employer'`면 홈으로 리다이렉트하고, 가드 통과 전에는 데이터 로드를 시작하지 않는다. Firestore 규칙에서도 isPublic 프로필 읽기를 인증된 employer로 제한한다.

> **⚠️ 검증자 이견 정리**: 가드 부재 사실은 양쪽 모두 인정합니다. 기각 측 논거는 실제 데이터 접근 통제는 Firestore 보안 룰이며, Firebase 설정이 클라이언트에 공개된 이상 페이지 가드는 크롤링 방지에 실효성이 없다는 것입니다(룰이 느슨하면 SDK 직접 호출로 우회 가능). 결론적으로 개인정보 보호는 #1·#2의 룰에서 해결해야 하고, 이 항목은 다른 페이지(my-jobs 등)와의 일관성을 위한 UX 보완 과제로 보는 것이 타당합니다.

---

### 13. 팀원 추가 시 연락처 또는 일당을 비우면 undefined 필드 때문에 Firestore setDoc이 항상 실패함

- **위치**: `src/app/calculator/page.tsx:358-366`
- **심각도**: 높음 (High)
- **검증**: ✅ 확정 — 2/2 실재 판정 (신뢰도 high·high)

**문제 설명**

handleAddMember가 선택 입력란이 비어 있으면 phone과 dailyWage를 undefined로 채워 TeamMember 객체를 만들고 그대로 saveTeamMembers → setDoc에 전달합니다. firebase.ts가 기본 getFirestore(app)를 사용해 ignoreUndefinedProperties가 설정되지 않았으므로, 배열 내 객체에 undefined 값이 있으면 'Unsupported field value: undefined' 오류로 setDoc이 거부됩니다. 즉 연락처나 일당을 생략하고 팀원을 추가하는 가장 흔한 시나리오에서 팀원 추가가 100% 실패하고 '팀원 추가에 실패했습니다'만 표시됩니다. 같은 상태에서 handleDeleteMember도 기존 배열에 undefined 보유 멤버가 있으면 동일하게 실패합니다.

**근거 코드**

```
const newMember: TeamMember = {
  id: Date.now().toString(),
  name: newMemberName.trim(),
  phone: newMemberPhone.trim() || undefined,
  dailyWage: newMemberWage || undefined,
};
const updatedMembers = [...teamMembers, newMember];
await saveTeamMembers(user.uid, updatedMembers);
// firebase.ts:22 → export const db = getFirestore(app); (ignoreUndefinedProperties 미설정)
```

**수정 방안**

undefined 대신 필드를 아예 생략하도록 객체를 조건부로 구성하거나(`...(newMemberPhone.trim() ? { phone: newMemberPhone.trim() } : {})`), null/빈문자열·0 등 Firestore가 허용하는 값을 저장하라. 또는 firebase.ts에서 initializeFirestore(app, { ignoreUndefinedProperties: true })로 초기화를 바꿔도 되지만, 명시적 필드 생략이 더 안전하다.

---

### 14. 예상 급여 계산이 기록별로 저장된 일별 일당(dailyWage)을 무시하고 현재 입력값으로 일괄 곱셈함

- **위치**: `src/app/calculator/page.tsx:322,351`
- **심각도**: 높음 (High)
- **검증**: ✅ 확정 — 2/2 실재 판정 (신뢰도 high·high) · 검증자 심각도 재평가: Medium

**문제 설명**

각 DailyWorkRecord에는 저장 당시의 dailyWage가 일별로 기록되는데(타입 정의와 저장 로직 모두 존재), 월간 요약(estimatedWage)과 기간 합계(periodSummary)는 모든 기록을 합한 totalManDay에 '현재 화면의 dailyWageInput' 하나만 곱합니다. 일당이 기간 중에 변경된 근로자(예: 1~15일 15만원, 16일~ 17만원)의 급여 합계가 항상 틀리게 계산되며, 기간 합계 조회는 수개월 전 기록까지 현재 일당으로 환산해 보여줍니다. 일용직 정산 자료로 쓰이는 핵심 수치가 부정확해집니다.

**근거 코드**

```
// 월간 요약 (page.tsx:322)
const estimatedWage = totalManDay * dailyWageInput;
// 기간 합계 (page.tsx:351)
return { totalManDay, totalExpense, estimatedWage: totalManDay * dailyWageInput };
// 그러나 저장 시에는 일별 일당을 기록함 (page.tsx:277): dailyWage: dailyWageInput,
```

**수정 방안**

합산 시 레코드별 단가를 사용하라: `records.reduce((sum, r) => sum + r.manDay * (r.dailyWage ?? dailyWageInput), 0)` 형태로 변경하고, dailyWage가 없는 과거 레코드만 현재 입력값으로 폴백하라. 월간 요약과 기간 합계 모두 동일하게 적용해야 한다.

---

### 15. 팀원 삭제 시 teamDailyWorks 고아 레코드가 남고, 과거 달 팀 총합에서 삭제된 팀원의 공수·급여가 통째로 누락됨

- **위치**: `src/app/calculator/page.tsx:380-393,480-493`
- **심각도**: 높음 (High)
- **검증**: ✅ 확정 — 2/2 실재 판정 (신뢰도 high·high)

**문제 설명**

handleDeleteMember는 teams 문서의 members 배열에서만 제거하고 해당 memberId의 teamDailyWorks 기록은 삭제하지 않습니다. teamSummary는 현재 teamMembers 배열 기준으로만 합산하므로, 6월에 팀원을 삭제한 뒤 5월을 조회하면 5월에 실제로 일한 그 팀원의 공수와 급여가 '팀 월간 총합'에서 조용히 빠져 과거 정산 금액이 달라집니다. 같은 사람을 다시 추가해도 id가 Date.now() 기반 새 값이라 과거 기록과 영구히 분리되어 0공수로 보입니다. 또 일당은 member 객체에만 있고 기록에는 저장되지 않으므로(일당 수정 기능 부재로 삭제 후 재추가가 유일한 변경 수단) 과거 달 급여가 항상 현재 일당으로 소급 계산됩니다.

**근거 코드**

```
// 삭제: 기록 정리 없음 (page.tsx:382-385)
const updatedMembers = teamMembers.filter((m) => m.id !== memberId);
await saveTeamMembers(user.uid, updatedMembers);
// 팀 총합: 현재 멤버 목록 기준으로만 합산 (page.tsx:484-490)
teamMembers.forEach((member) => {
  const memberTotal = teamWorks.filter((w) => w.memberId === member.id).reduce((sum, w) => sum + w.manDay, 0);
  totalManDay += memberTotal;
  totalWage += memberTotal * (member.dailyWage || 0);
});
```

**수정 방안**

(1) 팀 총합은 teamMembers가 아니라 해당 월의 teamWorks 전체를 기준으로 합산하고(레코드의 memberName 표시), 급여 계산을 위해 saveTeamDailyWork 시 그 날의 적용 일당을 레코드에 함께 저장하라. (2) 팀원 삭제 시 해당 memberId의 teamDailyWorks를 함께 삭제할지(배치 삭제) 또는 보존할지 확인 다이얼로그를 제공하고, 보존한다면 총합 계산에 계속 포함되도록 하라. (3) 팀원 일당 편집 기능을 추가해 삭제+재추가로 인한 기록 단절을 막아라.

---

### 16. jobs/[id]/page.tsx 파일 자체가 인코딩 손상됨 — 깨진 한글 표시 및 whitespace-pre-wrap 등 Tailwind 클래스 파손

- **위치**: `src/app/jobs/[id]/page.tsx:122,150,161`
- **심각도**: 높음 (High)
- **검증**: ✅ 확정 — 2/2 실재 판정 (신뢰도 high·high)

**문제 설명**

공고 상세 페이지 소스 파일에 잘못된 UTF-8 바이트가 다수 포함되어 있음을 od 덤프로 확인했다(file 명령도 'data'로 판별). 122행은 일당 뒤 '원' 글자가 불완전 시퀀스로 깨져 사용자에게 �로 표시되고, 150행은 'text-gray-600 whitespace-pre-wrap' 사이 공백이 0xA0 단독 바이트로 깨져 className이 'text-gray-606�whitespace-pre-wrap' 한 덩어리가 되어 본문 색상이 적용되지 않고 whitespace-pre-wrap이 빠져 사용자가 입력한 상세 설명의 줄바꿈이 모두 무시된 채 한 덩어리로 표시된다. 161~162행은 'w-10'이 'w-u��'로 깨져 업체 아이콘 너비 클래스가 무효화된다. 그 외 109행 '모집터/진행터'(원래 모집중/진행중), 126행 '근워 기간', 129행 '근문 시간' 등 사용자에게 그대로 노출되는 한글 오염이 다수 존재하며, 빌드 도구에 따라 컴파일 실패 가능성도 있다.

**근거 코드**

```
122행: <InfoRow label="일당" value={`${job.dailyWage.toLocaleString()}�`} accent />  (od: } 354 233 020 ` — '원'의 3번째 바이트 손상)
150행: <p className="text-sm text-gray-606�whitespace-pre-wrap leading-relaxed">  (od: 6 0 6 240 w — 공백이 0xA0로 손상)
161행: <div className="w-u�� h-10 rounded-full ...">  (od: w - u 355 240 — 'w-10'의 '10'이 잘린 서러게이트 바이트)
```

**수정 방안**

파일 전체를 UTF-8로 재작성하라. 122행 '원', 150행 'text-gray-600 whitespace-pre-wrap', 161~162행 'w-10'/'w-5'를 복원하고, 109행 '모집중/진행중', 126행 '근무 기간', 129행 '근무 시간', 183행 주변 주석 등 손상된 한글 문자열을 모두 교정한다. iconv -f UTF-8 검사나 에디터의 인코딩 검증으로 잔여 불량 바이트가 없는지 확인할 것.

---

### 17. 근무 날짜 검증 부재: 종료일이 시작일보다 빨라도, 과거 날짜여도 등록됨

- **위치**: `src/app/jobs/create/page.tsx:53`
- **심각도**: 높음 (High)
- **검증**: ✅ 확정 — 2/2 실재 판정 (신뢰도 high·medium) · 검증자 심각도 재평가: Medium, Low

**문제 설명**

유효성 검사가 startDate 존재 여부만 확인한다. endDate < startDate인 역전된 기간, 수년 전 과거의 시작일도 그대로 Firestore에 저장된다. 잘못된 기간의 공고가 피드에 '모집중'으로 노출되어 구직자가 지원하는 오작동으로 이어진다. date input에 min 속성도 없어 UI 차원의 방어도 전무하다.

**근거 코드**

```
jobs/create/page.tsx:53  if (!startDate) { setError('근무 시작일을 선택해주세요.'); return; }
jobs/create/page.tsx:69-70  startDate: new Date(startDate),
  endDate: endDate ? new Date(endDate) : undefined,
```

**수정 방안**

제출 전 검증 추가: (1) endDate가 있으면 endDate >= startDate 확인, (2) startDate가 오늘 이전이면 경고/차단. date input에 min={오늘 날짜 문자열}을 지정하고, 종료일 input에는 min={startDate}를 지정해 UI에서도 방지하라.

---

## 4. 중간 (Medium) — 19건

특정 조건에서 발생하는 오동작, 데이터 품질 저하, 사용자 혼란을 유발하는 결함입니다.

### 18. 과거 날짜 기록을 수정만 해도 그 날의 dailyWage가 현재 일당 입력값으로 덮어써짐 (저장 데이터 손상)

- **위치**: `src/app/calculator/page.tsx:269-278`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

handleSavePersonal은 어떤 날짜를 저장하든 항상 dailyWage: dailyWageInput(화면 상단의 현재 일당)을 전달하고, saveDailyWork의 update 경로(firestore.ts:221-222)가 이를 그대로 덮어씁니다. 일당이 오른 뒤 과거 날짜의 메모나 날씨만 고쳐도 그 날 기록의 저장 일당이 현재 일당으로 바뀌어 원본 데이터가 손상됩니다. 모달에는 일당 항목이 표시되지 않아 사용자는 변경 사실을 알 수 없습니다. 현재는 급여 계산이 dailyWage를 무시하는 결함 때문에 증상이 가려져 있지만, 일별 일당 기반 계산으로 수정하는 즉시 이 손상이 금액 오류로 드러납니다.

**근거 코드**

```
await saveDailyWork(user.uid, selectedDate, {
  manDay: editManDay,
  ...
  dailyWage: dailyWageInput,   // 수정 시에도 항상 현재 입력값으로 덮어씀
});
// firestore.ts:221-222
if (existing.exists()) {
  await updateDoc(docRef, { ...data, updatedAt: serverTimestamp() });
}
```

**수정 방안**

openDayModal에서 기존 레코드가 있으면 그 레코드의 dailyWage를 모달 상태로 불러와 사용자에게 보여주고, 저장 시에는 모달에서 확인/수정한 값만 전달하라. 최소한 기존 레코드 수정 시에는 dailyWage 필드를 페이로드에서 제외해 기존 값을 보존해야 한다.

---

### 19. 공수계산기: 하드코딩된 초기 연/월(2026년 5월)로 인한 이중 로드와 월 전환 race로 다른 달 데이터가 표시될 수 있음

- **위치**: `src/app/calculator/page.tsx:68-69`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

currentYear/currentMonth가 2026/5로 하드코딩되어 마운트 직후 데이터 로드 effect(165~172행)가 5월 쿼리를 먼저 발사하고, 현재 날짜 보정 effect(113~117행)가 상태를 바꾸면 실제 달 쿼리가 한 번 더 나간다. 두 응답에 순서 보장이 없어 5월 응답이 나중에 도착하면 달력 헤더는 현재 달인데 monthlyRecords와 월간 요약/예상 급여는 5월 데이터로 계산된다. 같은 가드 부재로 ‹/› 버튼을 빠르게 눌러 월을 이동할 때도 이전 달 응답이 최신 달 화면을 덮어쓴다. 또한 하드코딩 값 때문에 마운트 직후 '2026년 5월'이 잠깐 표시되는 잘못된 화면 노출이 있고, 매 진입마다 불필요한 잘못된 달 조회가 1회 발생한다.

**근거 코드**

```
const [currentYear, setCurrentYear] = useState(2026);
const [currentMonth, setCurrentMonth] = useState(5);
...
useEffect(() => {
  const now = new Date();
  setCurrentYear(now.getFullYear());
  setCurrentMonth(now.getMonth() + 1);
}, []);
...
useEffect(() => {
  if (!user) return;
  if (activeTab === 'personal') { loadPersonalMonthly(); } else { loadTeamData(); }
}, [activeTab, currentYear, currentMonth, user, loadPersonalMonthly, loadTeamData]);
```

**수정 방안**

초기값을 lazy initializer로 현재 날짜에서 직접 계산한다: useState(() => new Date().getFullYear()), useState(() => new Date().getMonth() + 1). 이렇게 하면 보정 effect와 이중 로드 자체가 사라진다. 추가로 데이터 로드 effect에 ignore 플래그(cleanup에서 true) 또는 응답의 연/월이 현재 상태와 일치하는지 검사하는 가드를 넣어 월 빠른 이동 race를 차단한다.

---

### 20. 마감(closed)·삭제된 공고에도 지원 가능 — applyToJob에 상태 검증 부재가 stale 화면과 결합

- **위치**: `src/app/jobs/[id]/page.tsx:184`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

지원 버튼 노출은 `job.status === 'open'`이라는 클라이언트 렌더링 조건뿐이고, 구직자가 상세 페이지를 열어둔 사이 구인자가 공고를 마감(my-jobs의 handleClose)하거나 삭제하면 stale한 화면에서 지원하기를 눌러 마감/삭제된 공고에 대한 지원 문서가 정상 생성된다. firestore.rules에도 applications 규칙이 없어 서버측 방어가 전무하다. 구인자는 마감한 공고에 지원이 계속 쌓이는 것을 인지하지 못한다.

**근거 코드**

```
// jobs/[id]/page.tsx:60-65 — status 재확인 없이 바로 쓰기
const handleApply = async () => {
  if (!user || !job) return;
  setApplying(true);
  try {
    await applyToJob(jobId, user.uid, job.employerId);
```

**수정 방안**

applyToJob을 runTransaction으로 변경해 jobs/{jobId}를 읽어 존재 여부와 status === 'open'을 확인한 뒤에만 지원 문서를 생성하고, 아니면 명시적 에러를 던져 UI에서 '마감된 공고입니다'를 안내한다. firestore.rules의 applications create 규칙에서도 get(...jobs/$(jobId)).data.status == 'open'을 검증한다.

---

### 21. jobs.applicants[] 배열이 생성 후 한 번도 갱신되지 않음 — 스키마와 실제 데이터 불일치

- **위치**: `src/lib/firestore.ts:21`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high) · 검증자 심각도 재평가: Low

**문제 설명**

createJob은 applicants: []로 문서를 생성하지만, applyToJob은 applications 컬렉션에만 문서를 추가할 뿐 jobs.applicants에 arrayUnion 등으로 지원자 UID를 추가하는 코드가 코드베이스 어디에도 없다(grep으로 확인: applicants 등장 위치는 타입 정의와 생성 시 빈 배열뿐). 설계 문서(CLAUDE.md)상 applicants는 지원자 UID 목록인데 실제로는 영구히 빈 배열이라, 이후 이 필드를 신뢰하는 기능(모집 인원 충족 자동 마감, 지원자 표시 등)을 구현하면 항상 0명으로 오작동한다. 지원자 수도 매번 applications 전체 문서를 다운로드해 세는 우회 경로(getApplicationCount)로만 동작한다.

**근거 코드**

```
// firestore.ts:18-22
const docRef = await addDoc(collection(db, 'jobs'), {
  ...data,
  status: 'open',
  applicants: [],

// grep 결과: applicants 갱신 코드 없음
// src\types\index.ts:88: applicants: string[];
// src\lib\firestore.ts:21: applicants: [],
```

**수정 방안**

applyToJob에서 writeBatch 또는 runTransaction으로 application 문서 생성과 `updateDoc(jobRef, { applicants: arrayUnion(workerId) })`를 원자적으로 함께 수행한다(arrayUnion은 동시 지원에도 유실 없음). 이 필드를 쓰지 않을 계획이면 타입과 스키마에서 제거해 불일치를 없앤다.

---

### 22. deleteJob이 연관 applications/favorites를 정리하지 않아 고아 데이터 영구 잔존 및 통계 왜곡

- **위치**: `src/lib/firestore.ts:92-94`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

공고 삭제 시 jobs 문서만 지우고 해당 jobId를 참조하는 applications와 favorites(targetType 'job')는 그대로 남는다. 구직자 지원 내역과 즐겨찾기 화면은 '삭제된 공고' 플레이스홀더로 표시는 처리하지만 데이터는 영구 잔존하며 사용자가 수동으로 지울 때까지 목록을 차지한다. 더 중요한 것은 getEmployerStats의 totalApplicants/recentApplications가 employerId 기준 쿼리라 삭제된 공고의 지원 건이 대시보드 통계에 계속 집계된다는 점이다. 또한 잔존 application 때문에 같은 구인자가 유사 공고를 재등록해도 과거 지원 데이터가 섞여 정합성이 깨진다.

**근거 코드**

```
// firestore.ts:92-94
export async function deleteJob(jobId: string): Promise<void> {
  await deleteDoc(doc(db, 'jobs', jobId));
}

// my-applications/page.tsx:158 — 깨진 참조의 영구 노출
<p className="text-sm text-gray-400">삭제된 공고</p>
```

**수정 방안**

deleteJob에서 writeBatch로 `where('jobId','==',jobId)`인 applications와 `where('targetId','==',jobId), where('targetType','==','job')`인 favorites를 조회해 함께 삭제한다. 클라이언트 권한 문제(타 사용자 소유 favorites 삭제 불가)가 있으므로 실서비스에서는 Cloud Functions의 onDocumentDeleted 트리거로 정리하는 것이 안전하다. 최소한 통계 쿼리는 삭제된 공고의 지원을 제외하도록 보정한다.

---

### 23. getEmployerStats의 '총 지원자 수'가 limit(10) 쿼리의 snapshot.size라 최대 10으로 캡핑

- **위치**: `src/lib/firestore.ts:420-427`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

대시보드 통계용 totalApplicants를 limit(10)이 걸린 최근 지원 쿼리의 snapshot.size로 계산한다. 지원이 10건을 초과하면 총 지원자 수가 항상 10으로 표시되어 구인자 대시보드 통계가 부정확하다. 최근 지원 목록(recentApplications)과 총계가 같은 쿼리를 공유한 데서 생긴 결함이다.

**근거 코드**

```
// firestore.ts:420-427
const appsQuery = query(
  collection(db, 'applications'),
  where('employerId', '==', employerId),
  orderBy('createdAt', 'desc'),
  limit(10)
);
const appsSnap = await getDocs(appsQuery);
const totalApplicants = appsSnap.size;
```

**수정 방안**

총계는 limit 없는 별도 카운트로 분리한다. 문서 다운로드 없이 `getCountFromServer(query(collection(db,'applications'), where('employerId','==',employerId)))`를 사용하면 비용도 최소화된다. 같은 이유로 getApplicationCount(204-211행)도 전체 문서를 받아 size를 세는 대신 getCountFromServer로 바꾸는 것이 좋다.

---

### 24. 즐겨찾기 추가 경로가 코드 어디에도 없음 — favorites 화면은 항상 빈 상태, addFavorite 자체도 중복 방지 부재

- **위치**: `src/lib/firestore.ts:342-350`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

grep으로 전체 src를 확인한 결과 addFavorite와 isFavorited의 호출처가 한 곳도 없다(구직자 검색 페이지, 공고 상세 어디에도 즐겨찾기 추가 버튼이 연결되지 않음). 따라서 즐겨찾기 화면(favorites/page.tsx)은 데이터를 만들 방법이 없어 항상 빈 상태로 동작한다 — CLAUDE.md에 '추가/삭제/연락' 완료로 표시된 것과 다르다. 또한 addFavorite은 addDoc(자동 ID) 방식에 사전 존재 검사가 없어, 추후 UI를 연결하면 더블 탭/동시 호출로 같은 (userId, targetId) 즐겨찾기가 중복 생성될 수 있다(removeFavorite이 일괄 삭제로 우연히 수습할 뿐).

**근거 코드**

```
// firestore.ts:342-349 — auto-ID + 중복 검사 없음
export async function addFavorite(userId: string, targetId: string, targetType: 'user' | 'job'): Promise<string> {
  const docRef = await addDoc(collection(db, 'favorites'), {
    userId,
    targetId,
    targetType,
    createdAt: serverTimestamp(),
  });

// grep 결과: addFavorite/isFavorited는 firestore.ts 선언부 외 호출처 없음
```

**수정 방안**

문서 ID를 `${userId}_${targetId}` 결정적 키로 만들고 setDoc을 사용해 중복을 구조적으로 차단한다(removeFavorite/isFavorited도 쿼리 대신 직접 doc 참조로 단순화 가능). 구직자 검색(workers)과 공고 상세 페이지에 즐겨찾기 토글 버튼을 실제로 연결한다.

---

### 25. 구인공고 피드: 필터/정렬 빠른 전환 시 이전 요청 응답이 최신 결과를 덮어쓰는 race condition

- **위치**: `src/app/jobs/page.tsx:28-47`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high) · 검증자 심각도 재평가: Low

**문제 설명**

useEffect가 selectedCategory/sortBy 변경마다 loadJobs를 호출하지만 이전 요청을 취소하거나 무시하는 가드가 없다. 사용자가 '철근' → '전체'를 빠르게 클릭했을 때 '철근' 쿼리가 나중에 resolve되면 화면 필터는 '전체'인데 목록에는 철근 공고만 표시된다. 첫 요청의 finally가 setLoading(false)를 먼저 실행하면 두 번째 요청이 진행 중인데도 로딩 표시가 사라져 stale 목록이 확정된 것처럼 보인다.

**근거 코드**

```
  useEffect(() => {
    loadJobs();
  }, [selectedCategory, sortBy]);

  const loadJobs = async () => {
    setLoading(true);
    try {
      const data = await getJobs({ ... });
      setJobs(data);
    } ... finally {
      setLoading(false);
    }
  };
```

**수정 방안**

useEffect 내부에 let ignore = false 플래그를 두고 cleanup에서 ignore = true로 설정한 뒤, 응답 도착 시 if (!ignore) setJobs(data)처럼 가드한다(setLoading(false)도 동일하게 가드). 또는 요청 시퀀스 번호를 비교해 최신 요청의 결과만 반영한다.

---

### 26. 구직자 홈: 직종 필터 빠른 전환 시 stale 응답이 화면을 덮어쓰는 race condition

- **위치**: `src/components/home/WorkerHome.tsx:29-51`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high) · 검증자 심각도 재평가: Low

**문제 설명**

jobs/page.tsx와 동일한 패턴으로, selectedCategory 변경마다 loadData가 호출되지만 이전 요청 무시 가드가 없어 응답이 역순으로 도착하면 선택된 카테고리와 다른 카테고리의 공고 목록이 표시된다. getApplicationsByWorker도 매번 함께 재조회되어 동일한 race에 노출된다.

**근거 코드**

```
  useEffect(() => {
    loadData();
  }, [selectedCategory]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [jobsData, appsData] = await Promise.all([...]);
      setJobs(jobsData);
      setApplications(appsData);
    } ... finally {
      setLoading(false);
    }
  };
```

**수정 방안**

useEffect cleanup 기반의 ignore 플래그 또는 요청 시퀀스 비교로 마지막 요청의 결과만 상태에 반영한다. 지원 내역은 카테고리와 무관하므로 별도 effect(마운트 시 1회)로 분리하면 불필요한 재조회와 race 범위가 줄어든다.

---

### 27. 공수계산기: 팀원 추가 버튼 중복 제출 방지 없음 + Date.now() 기반 id 충돌 가능

- **위치**: `src/app/calculator/page.tsx:356-376`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high) · 검증자 심각도 재평가: Low

**문제 설명**

handleAddMember는 isSaving 같은 진행 중 가드가 없고 '추가' 버튼은 이름이 비어있을 때만 disabled라서, 저장(saveTeamMembers)이 완료되기 전 연타하면 두 호출 모두 stale한 teamMembers 클로저로 [...teamMembers, newMember]를 만들어 같은 팀원이 중복 등록되거나, setDoc 전체 덮어쓰기 특성상 마지막 쓰기만 남아 결과가 비결정적이 된다. 또한 id를 Date.now().toString()으로 생성하므로 같은 밀리초에 두 번 실행되면 id가 충돌해 리스트 key 충돌과 handleDeleteMember(filter 기준 id)에서 두 팀원이 동시에 삭제되는 문제로 이어진다.

**근거 코드**

```
  const handleAddMember = async () => {
    if (!user || !newMemberName.trim()) return;
    const newMember: TeamMember = {
      id: Date.now().toString(),
      ...
    };
    const updatedMembers = [...teamMembers, newMember];
    try {
      await saveTeamMembers(user.uid, updatedMembers);
      setTeamMembers(updatedMembers);
```

**수정 방안**

함수 진입 시 isSaving(또는 전용 isAddingMember) 상태를 true로 설정하고 버튼 disabled에 반영해 중복 호출을 차단한다. id는 crypto.randomUUID() 등 충돌 없는 값으로 생성하고, 가능하면 setTeamMembers((prev) => [...prev, newMember]) 형태로 함수형 업데이트를 사용해 stale 클로저를 피한다.

---

### 28. 즐겨찾기: 로그인했지만 프로필 미등록(userProfile=null)인 사용자는 무한 로딩 스피너에 갇힘

- **위치**: `src/app/favorites/page.tsx:50-58`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

리다이렉트는 !authLoading && !user일 때만, 데이터 로드는 user && userProfile일 때만 수행된다. Google 로그인 후 회원가입(프로필 생성)을 완료하지 않은 사용자가 하단 네비게이션의 '즐겨찾기'로 진입하면(비로그인용 defaultNav에 /favorites가 노출됨) user는 있고 userProfile은 null이라 loadFavorites가 영원히 호출되지 않고, 초기값 loading=true가 유지되어 233~237행의 스피너가 무한히 표시된다. AuthContext에서 프로필 로드가 일시적으로 실패한 경우에도 동일하게 발생하며, 탈출 경로(가입 유도, 에러 표시)가 전혀 없다.

**근거 코드**

```
  const [loading, setLoading] = useState(true);
  ...
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace('/login');
      return;
    }
    if (user && userProfile) {
      loadFavorites();
    }
  }, [user, userProfile, authLoading]);
  ...
  {loading && !error && (
    <div className="flex justify-center py-12">
```

**수정 방안**

effect에 user는 있으나 userProfile이 없는 분기를 추가해 /register로 리다이렉트하거나 '프로필 등록이 필요합니다' 안내 UI를 표시한다. 최소한 해당 분기에서 setLoading(false)를 호출해 무한 스피너를 방지한다.

---

### 30. 구인자 홈: 인코딩이 깨진 한글 문자열이 사용자 화면에 그대로 렌더링됨

- **위치**: `src/components/home/EmployerHome.tsx:74`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

파일 내 다수의 한글 리터럴이 인코딩 손상 상태로 저장되어 있어 구인자 홈 대시보드에 깨진 텍스트가 그대로 표시된다. 74행 통계 라벨 '� 지원자'(총 지원자), 155행 일당 단위 '{...toLocaleString()}�'(원), 158행 모집 인원 단위 '늨'(명), 120행 '전체냴기'(전체보기), 134행 '첫 구인 작응하기'(첫 구인글 작성하기), 95행 '새 공 등록'(새 공고 등록) 등이 모두 사용자에게 노출되는 실제 표시 결함이다.

**근거 코드**

```
          <p className="text-xs text-gray-500 mt-1">� 지원자</p>
...
                  <span className="text-xs text-accent-500 font-medium">
                    {job.dailyWage.toLocaleString()}�
                  </span>
                  <span className="text-xs text-gray-300">·</span>
                  <span className="text-xs text-gray-500">{job.numberOfWorkers}늨</span>
```

**수정 방안**

EmployerHome.tsx를 UTF-8로 다시 저장하면서 깨진 문자열을 모두 원문으로 복구한다: '총 지원자', '...원', '...명', '전체보기', '첫 구인글 작성하기', '새 공고 등록' 등. 주석부('통둲', '상닠', '버트')도 함께 정리하고, 다른 파일에도 동일한 손상이 있는지 일괄 검사한다.

---

### 31. my-jobs에 역할 가드 없음 — 구직자·가입 미완료 사용자 접근 가능, jobs/create 권한 우회로 연결

- **위치**: `src/app/my-jobs/page.tsx:24-30`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

비로그인만 /login으로 보내고 role 검사가 없어 구직자나 가입 미완료(userProfile=null) 사용자가 URL로 접근할 수 있다. 페이지에는 '+ 새 구인글', '첫 구인글 작성하기' 링크가 그대로 노출되어, 가드가 전혀 없는 jobs/create(critical 결함)로 구직자를 직접 안내하는 경로가 된다.

**근거 코드**

```
useEffect(() => {
  if (!authLoading && !user) {
    router.replace('/login');
    return;
  }
  if (user) loadJobs();
}, [user, authLoading]);
// userProfile.role 검사 없음
```

**수정 방안**

useEffect에 `if (!authLoading && user && userProfile?.role !== 'employer') router.replace('/')`를 추가하고, userProfile 로드 완료 전에는 스피너를 유지한다.

---

### 32. 일당 0원 허용 및 상한 부재

- **위치**: `src/app/jobs/create/page.tsx:51`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

일당 검증이 빈 문자열 여부만 본다. 사용자가 '0'을 입력하면 문자열 "0"은 truthy라 통과되어 일당 0원 공고가 등록되고, 자릿수 제한이 없어 999,999,999,999원 같은 비현실적 값도 저장된다. 0원/허위 고액 공고가 피드 정렬(dailyWage 정렬 지원)과 신뢰도를 해친다. register/profile edit의 desiredWage도 동일하게 0과 무제한 값을 허용한다.

**근거 코드**

```
jobs/create/page.tsx:51  if (!dailyWage) { setError('일당을 입력해주세요.'); return; }
jobs/create/page.tsx:60  const wageNumber = Number(dailyWage.replace(/,/g, ''));  // 0이어도 그대로 저장
```

**수정 방안**

wageNumber를 계산한 뒤 범위 검증을 추가하라. 예: if (!wageNumber || wageNumber < 10000 || wageNumber > 2000000) { setError('일당을 올바르게 입력해주세요.'); return; } formatWage에서 입력 자릿수도 제한(slice)할 것.

---

### 33. 필요 인원에 음수·극단값 저장 가능

- **위치**: `src/app/jobs/create/page.tsx:68`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high) · 검증자 심각도 재평가: Low

**문제 설명**

필요 인원은 `Number(numberOfWorkers) || 1`로 처리해 NaN과 0은 1로 대체하지만, '-5'를 직접 타이핑하면 -5는 truthy이므로 음수 인원이 그대로 저장된다. input의 min=1/max=100 속성은 스피너 버튼만 제한할 뿐 키보드 입력을 막지 못하며, '1e9' 같은 지수 표기로 10억 명 모집도 가능하다. 공고 상세에 '-5명' 등 비정상 값이 노출된다.

**근거 코드**

```
jobs/create/page.tsx:68  numberOfWorkers: Number(numberOfWorkers) || 1,
jobs/create/page.tsx:245-251  <input type="number" value={numberOfWorkers} ... min="1" max="100" ... />  // 타이핑 입력은 미차단
```

**수정 방안**

제출 시 정수 범위 검증을 추가하라. 예: const workers = Math.floor(Number(numberOfWorkers)); if (!Number.isFinite(workers) || workers < 1 || workers > 100) { setError('필요 인원은 1~100명 사이로 입력해주세요.'); return; }

---

### 34. 경력(년)에 음수·비현실 값 저장 가능 (register / profile edit 공통)

- **위치**: `src/app/register/page.tsx:124`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high) · 검증자 심각도 재평가: Low

**문제 설명**

경력 입력은 type=number에 min=0/max=50 속성만 있고 제출 시 검증이 없어, '-5'나 '5e3'(=5000년) 같은 값을 타이핑하면 Number() 결과가 그대로 Firestore에 저장된다. profile/edit/page.tsx:132도 동일한 코드다. 음수/수천 년 경력이 구직자 공개 프로필에 그대로 노출된다.

**근거 코드**

```
register/page.tsx:124  profileData.experience = experience ? Number(experience) : 0;
profile/edit/page.tsx:132  updateData.experience = experience ? Number(experience) : 0;
```

**수정 방안**

저장 전 검증 추가: const exp = Number(experience); if (experience && (!Number.isFinite(exp) || exp < 0 || exp > 50)) { setError('경력은 0~50년 사이로 입력해주세요.'); return; } 후 Math.floor(exp) 저장.

---

### 35. KakaoMap SDK 로드 실패/잘못된 키일 때 무한 로딩 스피너

- **위치**: `src/components/ui/KakaoMap.tsx:227`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

script.onerror에서 error 상태를 설정하지만, sdkLoaded가 false인 동안의 렌더 분기(227~239행)는 error를 전혀 확인하지 않고 무조건 '지도 로딩 중...' 스피너를 반환한다. error 메시지 표시는 지도 로드 성공 후의 분기(271행)에만 존재하므로 네트워크 차단 등으로 스크립트 로드가 실패하면 스피너가 영원히 돈다. 또한 API 키가 유효하지 않으면 스크립트는 로드되지만 window.kakao.maps가 정의되지 않아 onload 핸들러(63행)에서 TypeError가 발생하고 sdkLoaded가 영영 설정되지 않아 역시 무한 로딩에 빠진다.

**근거 코드**

```
KakaoMap.tsx:68-70  script.onerror = () => { setError('카카오맵 SDK 로드에 실패했습니다.'); };
KakaoMap.tsx:227-239  if (!sdkLoaded) { return ( ... <span>지도 로딩 중...</span> ... ); }  // error 미확인
KakaoMap.tsx:62-66  script.onload = () => { window.kakao.maps.load(() => { setSdkLoaded(true); }); };  // kakao.maps undefined 시 throw
```

**수정 방안**

로딩 분기 앞에 if (error && !sdkLoaded) { return <주소 텍스트 fallback UI>; }를 추가해 키 없음 fallback과 동일하게 처리하라. onload에서도 if (!window.kakao?.maps?.load) { setError(...); return; } 가드를 넣어 잘못된 키를 감지할 것.

---

### 36. 텍스트 입력 길이 제한 전무 — 초대형 문자열 저장 가능

- **위치**: `src/app/jobs/create/page.tsx:260`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high) · 검증자 심각도 재평가: Low

**문제 설명**

구인글 제목/상세설명/상세주소/근무시간, 프로필의 이름/자기소개/업체소개 등 모든 텍스트 입력에 maxLength와 제출 시 길이 검증이 없다. 수백 KB의 텍스트(예: 붙여넣기)도 그대로 Firestore에 저장되어 목록 조회(getJobs는 문서 전체를 가져옴) 페이로드가 비대해지고, 1MB 문서 한도를 넘기면 원인 불명의 저장 실패('저장에 실패했습니다')만 표시된다. 또한 제목이 공백+특수문자만으로 구성되어도 trim 후 1자만 있으면 통과한다.

**근거 코드**

```
jobs/create/page.tsx:113-119  <input type="text" value={title} ... />  // maxLength 없음
jobs/create/page.tsx:260-266  <textarea value={description} ... rows={4} ... />  // maxLength 없음
profile/edit/page.tsx:357-363  <textarea value={introduction} ... />  // maxLength 없음
```

**수정 방안**

각 입력에 maxLength 속성(제목 50, 주소 100, 설명/소개 1000~2000 등)을 지정하고, 제출 시에도 동일 한도를 검증하라. 제목은 최소 길이(2자 이상)도 함께 확인할 것.

---

### 37. 공고 상세 로드 실패 시 아무 안내 없는 빈 화면

- **위치**: `src/app/jobs/[id]/page.tsx:52`
- **심각도**: 중간 (Medium)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high) · 검증자 심각도 재평가: Low

**문제 설명**

loadJobDetail의 catch는 console.error만 호출하고 사용자에게 어떤 피드백도 주지 않는다. 네트워크 오류 등으로 getJob이 실패하면 loading만 해제되고 job이 null이므로 'if (!job) return null'에 걸려 완전히 빈 화면이 렌더링된다. 사용자는 오류인지 빈 공고인지 알 수 없고 재시도 수단도 없다.

**근거 코드**

```
jobs/[id]/page.tsx:52-56  } catch (error) { console.error('공고 로드 실패:', error); } finally { setLoading(false); }
jobs/[id]/page.tsx:88  if (!job) return null;
```

**수정 방안**

에러 상태(loadError)를 추가해 catch에서 설정하고, job이 null이면서 loadError면 '공고를 불러오지 못했습니다' 메시지와 재시도 버튼을 렌더링하라. router.replace('/jobs')로 보내는 것도 대안이다.

---

## 5. 낮음 (Low) — 12건

엣지 케이스이거나 영향 범위가 제한적인 결함입니다. 관련 화면을 수정할 때 함께 처리하면 됩니다.

### 38. 일당·경비·팀원 일당에 음수 입력이 허용되어 음수 급여/경비가 그대로 저장·표시됨

- **위치**: `src/app/calculator/page.tsx:704-710,931-937,1051-1057`
- **심각도**: 낮음 (Low)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

경비(editExpense), 일당(dailyWageInput), 팀원 일당(newMemberWage) 입력이 모두 type=number에 min 속성이나 검증 없이 Number(e.target.value)로 처리되어 음수가 통과합니다. 음수 경비는 Firestore에 그대로 저장되고, 음수 일당은 예상 급여를 음수 원화로 표시하며 월간/기간 합계까지 오염됩니다.

**근거 코드**

```
<input type="number" value={editExpense || ''}
  onChange={(e) => setEditExpense(Number(e.target.value) || 0)} ... />
// 일당: onChange={(e) => setDailyWageInput(Number(e.target.value) || 0)}
// 팀원 일당: onChange={(e) => setNewMemberWage(Number(e.target.value) || 0)}
```

**수정 방안**

onChange에서 `Math.max(0, Number(e.target.value) || 0)`로 클램프하고 input에 min="0"을 추가하라. 저장 직전(handleSavePersonal/handleAddMember)에도 음수 거부 검증을 한 번 더 수행하라.

---

### 39. 휴무(dayOff)와 공수>0, 잔업/연장 토글이 동시 저장 가능해 월간 요약 수치가 모순되게 집계됨

- **위치**: `src/app/calculator/page.tsx:265-303,307-325`
- **심각도**: 낮음 (Low)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

저장 시 dayOff=true이면서 manDay>0, overtime=true인 조합을 막는 검증이 없습니다. 이 경우 월간 요약에서 같은 날이 휴무 일수에 +1 되면서 동시에 총 공수와 예상 급여에도 합산되고 잔업 일수에도 잡혀, 정산 자료로 쓰이는 요약 수치가 자기모순적으로 표시됩니다. 반일 휴무 같은 의도적 사용이 아니라면 입력 실수가 그대로 금액에 반영됩니다.

**근거 코드**

```
monthlyRecords.forEach((record) => {
  totalManDay += record.manDay;      // 휴무 날의 공수도 무조건 합산
  if (record.overtime) overtimeCount++;
  if (record.dayOff) dayOffCount++;  // 같은 레코드가 휴무로도 집계
  ...
});
```

**수정 방안**

모달에서 휴무 토글 시 공수를 0으로 리셋하고 잔업/연장 토글을 비활성화하거나, 저장 시 dayOff && (manDay > 0 || overtime || extension) 조합을 경고/차단하라. 반일 휴무를 지원하려면 정책을 정의하고 요약 계산에 명시적으로 반영하라.

---

### 40. N+1 쿼리 패턴과 limit 없는 전체 컬렉션 fetch — 데이터 증가 시 화면 로드 지연 및 읽기 비용 급증

- **위치**: `src/app/my-jobs/page.tsx:40-44`
- **심각도**: 낮음 (Low)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

내 구인글은 공고 N개마다 getApplicationCount(각각 applications 문서 전체 다운로드), 지원 내역(my-applications/page.tsx:34-39)은 지원 N건마다 getJob, 즐겨찾기(favorites/page.tsx:70-99)는 항목 N개마다 getUserProfile/getJob을 개별 호출하는 N+1 패턴이다. 또 구인공고 피드(jobs/page.tsx:35-40)는 limitCount 없이 open 상태 전체 공고를 한 번에 가져오고 페이지네이션이 없다. 데이터가 수백 건 이상으로 늘면 첫 화면 로드가 수 초 이상 걸리고 Firestore 읽기 비용이 선형 이상으로 증가한다.

**근거 코드**

```
// my-jobs/page.tsx:40-44
await Promise.all(
  jobsData.map(async (job) => {
    counts[job.id] = await getApplicationCount(job.id);
  })
);

// jobs/page.tsx:35-40 — limitCount 미지정
const data = await getJobs({
  status: 'open',
  category: ...,
  sortBy: ...,
});
```

**수정 방안**

피드는 getJobs에 limitCount(예: 20)와 startAfter 커서 기반 페이지네이션을 적용한다. 지원자 수는 getCountFromServer로 대체하고, 지원 내역/즐겨찾기의 연관 문서 조회는 documentId() in 쿼리(10개 단위 chunk) 또는 비정규화(application 문서에 jobTitle/dailyWage 스냅샷 저장)로 N+1을 제거한다.

---

### 41. toDate 헬퍼의 fallback 로직 오류 — serverTimestamp 펜딩(null) 시 1970-01-01, undefined 시 Invalid Date 반환

- **위치**: `src/lib/firestore.ts:12`
- **심각도**: 낮음 (Low)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

`ts?.toDate?.() || new Date(ts) || new Date()`에서 ts가 null(serverTimestamp가 아직 서버 확정 전인 latency-compensation 스냅샷/오프라인 캐시)이면 new Date(null) = 1970-01-01 epoch가 truthy라 그대로 반환되고, ts가 undefined면 new Date(undefined) = Invalid Date 역시 객체(truthy)라 마지막 fallback `|| new Date()`에는 절대 도달하지 못한다. 결과적으로 등록일이 '1/1'로 표시되거나 formatDate에서 'NaN/NaN'이 노출될 수 있으며, createdAt 기준 정렬/표시 데이터가 오염된다.

**근거 코드**

```
// firestore.ts:12
const toDate = (ts: any): Date => ts?.toDate?.() || new Date(ts) || new Date();
```

**수정 방안**

명시적 분기로 교체한다: `const toDate = (ts: any): Date => { if (ts?.toDate) return ts.toDate(); const d = new Date(ts); return isNaN(d.getTime()) || ts == null ? new Date() : d; }`. 펜딩 serverTimestamp를 정확히 다루려면 스냅샷 옵션 `{ serverTimestamps: 'estimate' }` 사용도 고려한다.

---

### 42. onAuthStateChanged 콜백 내 비동기 프로필 fetch의 race로 로그아웃 후 stale 프로필이 복원될 수 있음

- **위치**: `src/contexts/AuthContext.tsx:71-83`
- **심각도**: 낮음 (Low)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 medium)

**문제 설명**

onAuthStateChanged 콜백은 async이고 fetchUserProfile을 await하지만, 인증 이벤트가 연속 발생하면(로그인 직후 로그아웃, 계정 전환 등) 이전 이벤트의 getDoc이 아직 진행 중인 상태에서 다음 이벤트가 setUserProfile(null)을 먼저 실행하고, 뒤늦게 완료된 이전 fetch가 로그아웃된 사용자의 프로필을 다시 setUserProfile로 덮어쓸 수 있다. BottomNav는 user 없이 userProfile?.role만으로 메뉴를 결정하므로(BottomNav.tsx:95) 로그아웃 상태에서 역할별 네비게이션이 표시되는 오작동이 가능하다.

**근거 코드**

```
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        await fetchUserProfile(firebaseUser.uid);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });
```

**수정 방안**

fetchUserProfile 호출 시점의 uid를 기억했다가 setUserProfile 전에 auth.currentUser?.uid와 일치하는지 확인하거나, 세대 카운터(let generation)를 두고 콜백마다 증가시켜 최신 세대의 결과만 상태에 반영한다.

---

### 43. my-applications에 역할 가드 없음 — 구인자도 접근 가능

- **위치**: `src/app/my-applications/page.tsx:21-27`
- **심각도**: 낮음 (Low)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

구직자 전용 지원 내역 페이지가 로그인 여부만 검사하고 role을 검사하지 않아 구인자가 URL로 접근할 수 있다. 구인자의 지원 내역은 비어 있어 실질 피해는 작지만, '구인공고 보러가기' 등 구직자 동선이 노출되고 역할별 화면 분리 원칙이 깨진다.

**근거 코드**

```
useEffect(() => {
  if (!authLoading && !user) {
    router.replace('/login');
    return;
  }
  if (user) loadApplications();
}, [user, authLoading]);
```

**수정 방안**

userProfile.role이 'worker'가 아니면 홈으로 리다이렉트하는 검사를 추가한다.

---

### 44. profile/edit: 가입 미완료 사용자에게 완전한 빈 화면(흰 화면) 표시

- **위치**: `src/app/profile/edit/page.tsx:168`
- **심각도**: 낮음 (Low)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

user는 있지만 userProfile이 null인(register 미완료) 사용자가 /profile/edit에 접근하면 비로그인 리다이렉트(54행)는 발동하지 않고 `if (!user || !userProfile) return null`에 걸려 아무 내용도 없는 빈 화면이 영구히 표시된다. 리다이렉트도 안내도 없어 사용자가 갇힌다.

**근거 코드**

```
useEffect(() => {
  if (!loading && !user) {
    router.replace('/login');
  }
}, [user, loading, router]);
...
if (!user || !userProfile) return null;
```

**수정 방안**

useEffect에 `if (!loading && user && !userProfile) router.replace('/register')` 분기를 추가해 가입 미완료 사용자를 회원가입으로 보낸다.

---

### 45. 로그인 후 원래 가려던 페이지로 복귀하지 않음 (returnUrl 미지원)

- **위치**: `src/app/login/page.tsx:20-30`
- **심각도**: 낮음 (Low)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

보호 페이지들(my-jobs, my-applications, favorites, profile 등)은 모두 `router.replace('/login')`으로 보내지만 출발지 정보를 전달하지 않고, login 페이지는 로그인 성공 시 무조건 '/'로 보낸다. 사용자가 /my-applications 링크를 통해 들어와 로그인해도 항상 홈으로 떨어져 원래 동선이 끊긴다.

**근거 코드**

```
useEffect(() => {
  if (!loading && user) {
    if (userProfile) {
      router.replace('/');
    } else {
      router.replace('/register');
    }
  }
}, [user, userProfile, loading, router]);
```

**수정 방안**

가드에서 `router.replace('/login?next=' + encodeURIComponent(pathname))`로 출발지를 넘기고, login 페이지에서 useSearchParams로 next를 읽어 로그인 성공 시 해당 경로로 복귀시킨다(오픈 리다이렉트 방지를 위해 내부 경로만 허용).

---

### 46. 가입 미완료 사용자가 홈에서 비로그인용 GuestHome을 보게 됨 — register 유도 부재

- **위치**: `src/app/page.tsx:22-24`
- **심각도**: 낮음 (Low)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

홈은 `!user || !userProfile`을 한 묶음으로 처리해, Google 로그인은 했지만 역할 선택을 마치지 않은 사용자에게 비로그인용 GuestHome(로그인 버튼, '로그인하고 더 많은 공고 보기')을 보여준다. 이미 로그인된 사용자에게 로그인 CTA가 표시되는 모순된 상태이며, /register로 직접 유도하는 경로가 홈에 없다(로그인 버튼을 한 번 더 눌러야 login 페이지가 /register로 우회시킴).

**근거 코드**

```
// 비로그인 → 게스트 홈
if (!user || !userProfile) {
  return <GuestHome />;
}
```

**수정 방안**

`if (user && !userProfile)` 분기를 추가해 /register로 리다이렉트하거나 '가입을 완료해주세요' 안내 화면을 렌더한다.

---

### 47. 전화번호 형식 검증 미흡 — 10자리 이상 아무 숫자나 통과

- **위치**: `src/app/register/page.tsx:92`
- **심각도**: 낮음 (Low)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

전화번호 검증이 '숫자 10자리 이상' 뿐이라 '999-9999-999', '000-0000-0000' 같은 실재하지 않는 번호도 통과한다. profile/edit/page.tsx:114도 동일하다. 이 번호는 즐겨찾기 연락 기능 등에서 그대로 사용되므로 잘못된 연락처가 유통된다.

**근거 코드**

```
register/page.tsx:92  if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
profile/edit/page.tsx:114  if (!phone.trim() || phone.replace(/\D/g, '').length < 10) {
```

**수정 방안**

한국 휴대폰/전화 패턴 정규식으로 검증하라. 예: const digits = phone.replace(/\D/g, ''); if (!/^01[016789]\d{7,8}$/.test(digits) && !/^0[2-6]\d{7,9}$/.test(digits)) { setError('올바른 전화번호를 입력해주세요.'); return; }

---

### 48. 프로필 이미지 onError 후 미리보기 영구 숨김 + URL 무검증 저장

- **위치**: `src/app/profile/edit/page.tsx:197`
- **심각도**: 낮음 (Low)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

이미지 로드 실패 시 DOM에 직접 style.display='none'을 설정하는데, 이는 React가 관리하지 않는 속성이라 이후 사용자가 올바른 URL로 수정해도 display가 복원되지 않아 미리보기가 계속 보이지 않는다(잘못된 URL을 한 번이라도 입력하면 그 세션에서 미리보기 기능이 죽음). 또한 type=url일 뿐 제출 시 URL 형식 검증이 없어 'abc' 같은 임의 문자열도 profileImage로 저장된다.

**근거 코드**

```
profile/edit/page.tsx:197-199  onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
```

**수정 방안**

imgError 같은 React 상태로 전환하라: onError={() => setImgError(true)}, profileImage 변경 시 setImgError(false)로 리셋하고, imgError ? 플레이스홀더 : <img>로 조건부 렌더링. 저장 전 new URL(profileImage)로 형식을 검증하고 http(s) 스킴만 허용할 것.

---

### 49. 좌표 없는 공고(fallback 입력)의 지도가 서울 시청 중심에 마커 없이 표시되어 위치 오인 유발

- **위치**: `src/components/ui/KakaoMap.tsx:80`
- **심각도**: 낮음 (Low)
- **검증**: ✅ 확정 — 1/1 실재 판정 (신뢰도 high)

**문제 설명**

카카오맵 키 없이 작성된 공고나 지도에서 위치를 찍지 않은 공고는 lat/lng가 0으로 저장된다(fallback onBlur가 lat:0, lng:0 전달, jobs/create의 초기값도 0). 공고 상세의 view 모드는 좌표가 0이면 기본 좌표(37.5665, 126.978 = 서울 시청)로 지도를 중심 표시하고 마커도 찍지 않으며, address로 지오코딩하는 보정 로직이 없다. 부산 공고인데 서울 지도가 떠 구직자가 위치를 오인할 수 있다.

**근거 코드**

```
KakaoMap.tsx:80-81  const defaultLat = lat && lat !== 0 ? lat : 37.5665;
  const defaultLng = lng && lng !== 0 ? lng : 126.978;
KakaoMap.tsx:214  onSelect?.({ address: searchQuery.trim(), lat: 0, lng: 0 });
```

**수정 방안**

view 모드에서 좌표가 0이고 address가 있으면 geocoder.addressSearch로 좌표를 구해 마커를 표시하고, 지오코딩도 실패하면 지도 대신 주소 텍스트 fallback UI를 렌더링하라. 좌표가 전혀 없으면 지도를 표시하지 않는 것이 안전하다.

---

## 6. 직접 검증으로 추가 확인된 결함 (워크플로우 외)

### 50. PWA manifest가 존재하지 않는 PNG 아이콘 8개를 참조 — 홈 화면 설치 불가

- **위치**: `public/manifest.json:10-52`, `public/icons/`
- **심각도**: 높음 (High)
- **검증**: ✅ 직접 확인 — `public/icons/` 디렉터리에는 `.svg` 파일만 존재하는데 manifest는 `/icons/icon-72x72.png` ~ `/icons/icon-512x512.png` 8개 PNG를 참조

**문제 설명**

manifest의 icons 배열 8개 항목이 전부 404입니다. 설치 가능한 PWA 요건(유효한 192px·512px 아이콘)을 충족하지 못해 Android/Chrome의 "홈 화면에 추가" 설치 프롬프트가 뜨지 않고, 설치해도 기본 아이콘이 표시됩니다. CLAUDE.md가 명시한 핵심 컨셉(PWA, 홈화면 추가)이 동작하지 않는 상태입니다.

**수정 방안**

기존 SVG를 8개 크기의 PNG로 렌더링해 배치하거나(sharp, pwa-asset-generator 등), manifest의 `src`/`type`을 실제 존재하는 SVG로 교체하십시오(단, 일부 Android 런처는 SVG 아이콘을 지원하지 않으므로 PNG 생성이 안전합니다). 수정 후 Chrome DevTools → Application → Manifest에서 오류가 없는지 확인하십시오.

---

### 51. .git 디렉터리 손상 — 버전 관리 부재 상태

- **위치**: `C:\Project\ildao\.git`
- **심각도**: 높음 (High, 프로세스 리스크)
- **검증**: ✅ 직접 확인 — `objects` 디렉터리 없음, 부분 작성된 `config`(2줄)와 오래된 `config.lock` 잔존, 모든 git 명령이 "not a git repository"로 실패

**문제 설명**

`git init`이 중간에 중단된 형태로 .git이 깨져 있어 프로젝트에 사실상 버전 관리가 없습니다. 커밋 이력이 전혀 없으므로 실수로 파일을 덮어쓰거나 삭제하면 복구 수단이 없고, 이번 감사에서 발견된 인코딩 손상(#16, #30) 같은 사고도 언제 발생했는지 추적할 수 없습니다. Vercel 배포(Git 연동) 전제 조건도 충족하지 못합니다.

**수정 방안**

손상된 `.git`을 제거하고 `git init` → 전체 커밋 → GitHub 원격 연결을 진행하십시오. `.gitignore`에 `.env.local`, `node_modules/`, `.next/`가 포함되는지 먼저 확인해야 합니다(특히 Firebase 키가 든 .env.local 커밋 방지).

---

## 부록 A. 검증에서 기각된 항목 (오탐 1건)

탐색 단계에서 보고되었으나 적대적 검증에서 실재하지 않는 것으로 판명된 항목입니다. 기록 목적으로 남깁니다.

### 29. KakaoMap: 지도 초기화 effect의 클린업·의존성 누락으로 StrictMode에서 지도/클릭 리스너 중복 생성, props 변경 미반영

- **위치**: `src/components/ui/KakaoMap.tsx:76-117`
- **심각도**: 중간 (Medium)
- **검증**: ❌ 기각(오탐) — 0/1 실재 판정 (신뢰도 high)

**문제 설명**

지도 초기화 effect가 [sdkLoaded]만 의존하고 cleanup을 반환하지 않는다. 프로젝트는 reactStrictMode: true(next.config.js:10)이므로 개발 모드에서 effect가 mount→unmount→mount로 두 번 실행되어 같은 div에 kakao.maps.Map이 두 번 생성되고 select 모드의 click 리스너도 2개 등록되어 한 번의 클릭에 onSelect가 중복 호출된다(구인글 작성에서 region/addressDetail/lat/lng가 두 번 설정됨). 또한 lat/lng/mode/onSelect가 의존성에 없어 마운트 이후 좌표 props가 바뀌어도 마커/중심이 갱신되지 않고, 클릭 리스너는 최초 렌더의 onSelect 클로저를 영구히 참조한다. 같은 파일 45~73행의 SDK 로드 effect도 cleanup이 없어 로드 완료 전 리마운트되면 script 태그가 중복 append된다.

**근거 코드**

```
  useEffect(() => {
    if (!sdkLoaded || !mapRef.current) return;
    ...
    const map = new kakao.maps.Map(mapRef.current, mapOption);
    mapInstanceRef.current = map;
    ...
    if (mode === 'select') {
      kakao.maps.event.addListener(map, 'click', (mouseEvent: any) => {
        ...
        onSelect?.({ address: addr, lat: latlng.getLat(), lng: latlng.getLng() });
      });
    }
  }, [sdkLoaded]);
```

**수정 방안**

effect에서 cleanup을 반환해 kakao.maps.event.removeListener로 클릭 리스너를 제거하고 mapInstanceRef/markerRef를 초기화하며, 재실행 시 mapRef.current.innerHTML 초기화 후 지도를 다시 생성한다. onSelect는 ref(useRef)에 최신 값을 보관해 리스너에서 ref.current를 호출하고, lat/lng 변경은 별도 effect로 setCenter/마커 갱신을 처리한다. SDK 로드 effect는 document.querySelector로 기존 script 존재 여부를 확인해 중복 append를 막는다.

> **❌ 기각 사유**: 검증자가 코드 추적으로 시나리오가 도달 불가능함을 입증했습니다. `sdkLoaded`가 `useState(false)`로 시작하므로 StrictMode의 마운트 시점 이중 실행에서는 두 번 모두 조기 반환되고, 지도 생성은 `setSdkLoaded(true)` 이후 의존성 변경에 의한 단일 재실행에서만 일어납니다. 따라서 지도/클릭 리스너 중복 생성은 발생하지 않습니다.

---

## 부록 B. 권장 수정 순서

1. **(보안) 전 컬렉션 Firestore 보안 룰 작성 + firebase.json 연결 + 배포** — #1, #2, #3, #6, #7, #12를 한 번에 해소. Firebase 콘솔에서 현재 룰 상태(테스트 모드 여부) 즉시 확인 필요.
2. **(프로세스) git 복구 및 첫 커밋** — #51. 이후 모든 수정의 안전망.
3. **(기능 차단 버그) undefined 필드 제거** — #4(구인글 endDate), #13(팀원 추가). 공통 헬퍼로 undefined 필드를 걸러내면 동일 패턴 재발도 방지.
4. **(표시 품질) 인코딩 손상 파일 복구** — #16(jobs/[id]/page.tsx), #30(EmployerHome.tsx).
5. **(PWA) manifest 아이콘 PNG 생성** — #50.
6. **(데이터 정합성) 계산기 dailyWage 덮어쓰기(#18), 통계 캡(#23), 고아 데이터(#15, #22), 중복 지원(#8)** 순으로 처리.
7. 나머지 Medium/Low는 해당 화면을 손볼 때 함께 처리.

> 개선 제안(기능 추가·아키텍처·성능·운영)은 별도 문서 `docs/improvement-report.md`를 참고하십시오.
