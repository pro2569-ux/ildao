import BackButton from '@/components/ui/BackButton';

export const metadata = {
  title: '이용약관 | 일다오',
};

/**
 * 이용약관 페이지 (P3-6)
 * - 구인구직 플랫폼 표준 수준의 약관 골자 (정적 페이지)
 * - 페르소나 기준: 본문 text-base, 쉬운 한국어
 */
export default function TermsPage() {
  return (
    <div className="px-4 pt-4 pb-24">
      {/* 헤더 */}
      <div className="flex items-center gap-2 mb-6">
        <BackButton className="-ml-2" />
        <h1 className="text-xl font-bold text-ink">이용약관</h1>
      </div>

      <div className="card p-5 space-y-6 text-base text-ink leading-relaxed">
        <Section title="제1조 (목적)">
          이 약관은 일다오(이하 &quot;서비스&quot;)가 제공하는 건설·일용직 구인구직
          중개 서비스의 이용 조건과 절차, 회사와 회원의 권리·의무를 정하는 것을
          목적으로 합니다.
        </Section>

        <Section title="제2조 (서비스 내용)">
          서비스는 다음 기능을 제공합니다.
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>구인공고 등록 및 조회</li>
            <li>구직자 프로필 등록 및 검색</li>
            <li>공고 지원 및 지원 관리</li>
            <li>공수(근무일) 계산 등 부가 기능</li>
          </ul>
          서비스는 구인자와 구직자를 연결하는 중개 플랫폼이며, 근로계약의
          당사자가 아닙니다. 임금·근로조건 등은 구인자와 구직자가 직접
          협의하고 책임집니다.
        </Section>

        <Section title="제3조 (회원 가입과 계정)">
          회원은 본인 명의로 가입해야 하며, 가입 시 입력한 정보(이름, 연락처
          등)는 사실이어야 합니다. 계정은 본인만 사용할 수 있고, 타인에게
          빌려주거나 양도할 수 없습니다. 회원은 언제든지 내 정보 화면에서
          탈퇴할 수 있습니다.
        </Section>

        <Section title="제4조 (게시물에 대한 책임)">
          구인공고, 프로필 등 회원이 올린 게시물의 내용에 대한 책임은 작성한
          회원에게 있습니다. 다음과 같은 게시물은 사전 통지 없이 삭제될 수
          있습니다.
          <ul className="list-disc pl-5 mt-2 space-y-1">
            <li>거짓 정보 또는 과장된 근로조건</li>
            <li>법령을 위반하거나 타인의 권리를 침해하는 내용</li>
            <li>구인구직과 무관한 광고·홍보</li>
          </ul>
        </Section>

        <Section title="제5조 (서비스 이용 제한)">
          회원이 약관을 위반하거나 다른 회원에게 피해를 주는 경우, 서비스
          이용이 일시 정지되거나 계정이 삭제될 수 있습니다.
        </Section>

        <Section title="제6조 (면책)">
          서비스는 회원 간 거래(채용, 임금 지급 등)에서 발생한 분쟁에 개입하지
          않으며, 이에 대한 법적 책임을 지지 않습니다. 다만 분쟁 해결을 위해
          필요한 범위에서 관련 기록을 제공할 수 있습니다.
        </Section>

        <Section title="제7조 (약관의 변경)">
          약관이 바뀌는 경우 서비스 화면에 미리 안내합니다. 변경된 약관에
          동의하지 않는 회원은 탈퇴할 수 있습니다.
        </Section>

        <Section title="문의처">
          약관에 대해 궁금한 점은 아래로 문의해주세요.
          <p className="mt-2 font-medium text-ink">
            이메일: pro2569@gmail.com
          </p>
        </Section>

        <p className="text-sm text-ink-soft pt-2">시행일: 2026년 7월 10일</p>
      </div>
    </div>
  );
}

/** 약관 섹션 컴포넌트 */
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-lg font-bold text-ink mb-2">{title}</h2>
      <div>{children}</div>
    </section>
  );
}
