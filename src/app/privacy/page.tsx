import BackButton from '@/components/ui/BackButton';

export const metadata = {
  title: '개인정보처리방침 | 일다오',
};

/**
 * 개인정보처리방침 페이지 (P3-6)
 * - 수집 항목·이용 목적·보관 기간 등 골자 (정적 페이지)
 * - 페르소나 기준: 본문 text-base, 쉬운 한국어
 */
export default function PrivacyPage() {
  return (
    <div className="px-4 pt-4 pb-24">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-6">
        <BackButton className="-ml-2" />
        <h1 className="text-xl font-bold text-ink">개인정보처리방침</h1>
      </div>

      <div className="card p-5 space-y-6 text-base text-ink-soft leading-relaxed">
        <Section title="1. 수집하는 개인정보">
          일다오는 서비스 제공을 위해 아래 정보를 수집합니다.
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>필수: 이름, 이메일, 연락처(전화번호)</li>
            <li>구직자: 활동 지역, 보유 기술, 경력, 희망 일당, 자기소개</li>
            <li>구인자: 업체명, 대표자명, 주요 직종, 업체 소개</li>
            <li>자동 수집: 로그인 기록 등 서비스 이용 기록</li>
          </ul>
        </Section>

        <Section title="2. 개인정보를 사용하는 목적">
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>회원 가입, 본인 확인, 계정 관리</li>
            <li>구인공고와 구직자 프로필 연결(매칭)</li>
            <li>지원 내역 관리와 구인자·구직자 간 연락</li>
            <li>문의 응대와 공지사항 전달</li>
          </ul>
        </Section>

        <Section title="3. 프로필 공개 범위">
          구직자가 &quot;프로필 공개&quot;를 켜면 이름, 연락처, 보유 기술, 경력,
          희망 일당이 구인자에게 보입니다. 공개를 끄면 다른 회원이 내 프로필을
          볼 수 없습니다.
        </Section>

        <Section title="4. 보관 기간">
          <ul className="list-disc pl-5 mt-1 space-y-1">
            <li>회원 정보: 탈퇴 시 바로 삭제됩니다.</li>
            <li>
              구인공고·지원 기록: 임금 분쟁 등에 대비해 탈퇴 후에도 관계 법령이
              정한 기간(최대 3년) 동안 보관 후 삭제됩니다.
            </li>
          </ul>
        </Section>

        <Section title="5. 제3자 제공">
          법령에 따른 요청이 있는 경우를 제외하고, 회원의 동의 없이 개인정보를
          외부에 제공하지 않습니다. 서비스 운영을 위해 Google Firebase(인증,
          데이터 보관)를 이용합니다.
        </Section>

        <Section title="6. 회원의 권리">
          회원은 언제든지 내 정보 화면에서 개인정보를 확인·수정할 수 있고,
          회원탈퇴로 삭제를 요청할 수 있습니다.
        </Section>

        <Section title="7. 문의처">
          개인정보 관련 문의는 아래로 연락해주세요.
          <p className="mt-2 font-medium text-ink">
            이메일: pro2569@gmail.com
          </p>
        </Section>

        <p className="text-sm text-ink-soft pt-2">시행일: 2026년 7월 10일</p>
      </div>
    </div>
  );
}

/** 방침 섹션 컴포넌트 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-ink mb-2">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
