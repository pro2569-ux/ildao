# 일다오(ildao) 배포 가이드 — Vercel + Firebase

> 작성일: 2026-06-19 · 최신 커밋: `77abb54`
> 목적: 외부(폰)에서 접속 가능한 공개 URL 만들기.
> ⚠️ 로그인(브라우저 인증)·콘솔 등록은 **본인 계정 작업**이라 직접 하셔야 합니다. 그 외는 준비 완료(빌드 통과).

## 현재 상태
- Vercel CLI: 미설치 / 미로그인 / 미링크
- 빌드: `npm run verify` 통과 → 배포 가능
- 환경변수(`.env.local`): Firebase 6 + Kakao 1 = **7개** 모두 설정됨(코드와 이름 일치)

---

## A. Vercel 배포 (공개 URL 만들기)

> 본인 터미널(또는 이 세션에서 `! 명령` 형태)에서 실행.

1. **CLI 설치**
   ```bash
   npm i -g vercel
   ```
2. **로그인** (브라우저 인증)
   ```bash
   vercel login
   ```
3. **첫 배포 = 프로젝트 생성/링크** (프로젝트 폴더 `C:\Project\ildao`에서)
   ```bash
   vercel
   ```
   - 프롬프트: scope 선택 → `Set up and deploy? Y` → `Link to existing project? N`(새로) → 프로젝트 이름(예: ildao) → 디렉토리 `./` → 설정 자동감지(Next.js) 기본값 Enter
   - 끝나면 **preview URL**(`https://ildao-xxxx.vercel.app`)이 나옵니다.
4. **환경변수 7개 등록** *(필수 — 안 하면 배포본에서 Firebase가 동작 안 함)*
   - Vercel 대시보드 → 프로젝트 → **Settings → Environment Variables**
   - `.env.local`의 아래 7개를 **그대로 복사**해 추가(환경: Production·Preview 모두 체크):
     - `NEXT_PUBLIC_FIREBASE_API_KEY`
     - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
     - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
     - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
     - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
     - `NEXT_PUBLIC_FIREBASE_APP_ID`
     - `NEXT_PUBLIC_KAKAO_MAP_API_KEY`
   - (모두 `NEXT_PUBLIC_`이라 클라이언트에 노출되는 공개 값 — 그대로 넣어도 됨)
5. **프로덕션 재배포** (env 반영)
   ```bash
   vercel --prod
   ```
   → 출력의 `https://<프로젝트>.vercel.app` 가 **최종 공개 주소**.

---

## B. Firebase 백엔드 (로그인·데이터 동작 — 필수)

1. **Firestore 룰 + 인덱스 배포** *(미배포 상태 — 안 하면 지역필터·지원이 에러)*
   ```bash
   npx firebase-tools login
   npx firebase-tools deploy --only firestore
   ```
   - 프로젝트는 `.firebaserc`의 `ildao-fcbf6`로 자동 지정됨.
   - 이번 세션에서 추가된 **지역 복합 인덱스 4종 + 지원 스냅샷 룰**이 함께 배포됩니다.
2. **인증 도메인 추가** *(없으면 배포 사이트에서 Google 로그인 실패)*
   - Firebase 콘솔 → **Authentication → Settings → Authorized domains** → `<프로젝트>.vercel.app` 추가.

---

## C. 카카오 지도 (선택 — 없어도 주소 텍스트 fallback)
- 카카오 개발자 콘솔 → 내 앱 → **플랫폼 → Web → 사이트 도메인**에 `https://<프로젝트>.vercel.app` 추가.
- 미등록이면 배포본에서도 지도 대신 주소 텍스트만 표시됨(앱은 정상).

---

## 내일 확인 체크리스트 (폰)
1. `https://<프로젝트>.vercel.app` 접속
2. Google 로그인 → 회원가입(구인자/구직자)
3. 구인자: 공고 작성 → 내 구인글 → 지원자 관리
4. 구직자: 공고 피드(지역/직종 필터) → 지원 → 지원 내역
5. 안 되는 게 있으면: 대부분 **B(룰 배포) 또는 인증 도메인 미등록**이 원인.

> 막히면 `vercel logs <url>` 또는 브라우저 콘솔(F12) 에러를 알려주시면 진단합니다.
