/**
 * 심사자 체험용 샘플 시나리오 3종 (CLAUDE.md "샘플 시나리오 3종")
 *
 * 법령 내용이 아니다. 법조문·서식 문구는 이 파일에 두지 않는다. (전부 src/data/law.js)
 * 여기 값은 /diagnose 의 입력을 미리 채우기 위한 것뿐이다.
 *
 * ★ 세 시나리오는 **서로 다른 코드 경로**를 태운다.
 *   버튼 3개를 눌러도 같은 화면이 나오면 심사자에게 보여줄 것이 없다.
 *     newcomer   → 상대방 CB사. 업권 선택 단계가 사라지고 R1 나목 적용제외가 표시되는 경로
 *     freelancer → 금융회사 + 라우팅 own. R3(유리한 정보 제출) 중심, 단일 단계 제출
 *     returner   → 금융회사 + 라우팅 unknown. 서식 1 선행 → 서식 2 의 **2단계 경로**
 *                  (2단계 흐름을 보여주는 유일한 샘플이다)
 *
 * counterpartyId       → law.js COUNTERPARTY_TYPES id
 * institutionSectorId  → law.js INSTITUTION_SECTORS id
 * routingBranchId      → law.js CORRECTION_ROUTING.branches id
 */
export const SAMPLE_SCENARIOS = [
  {
    id: 'newcomer',
    title: '사회초년생 김OO (26세)',
    summary: '첫 신용대출 신청, 거절. 금융이력이 거의 없음.',
    /** 이 샘플이 무엇을 보여주는지 — 화면에 표시해 심사자가 차이를 알아채게 한다 */
    demonstrates: 'CB사 경로 — 업권 선택이 없고, 금융회사에만 적용되는 대상 행위가 구분됩니다.',
    eventId: 'loanRejected',
    counterpartyId: 'CB',
    institutionSectorId: null,
    routingBranchId: null,
    reason:
      '첫 직장에 입사한 지 8개월 됐고 신용카드나 대출을 써본 적이 없습니다. ' +
      '연체한 적도 없는데 신용대출이 거절됐습니다. 거래 이력이 없어서 점수가 낮게 나온 것 같습니다.',
  },
  {
    id: 'freelancer',
    title: '프리랜서 이OO (34세)',
    summary: '연소득 5천만원대이나 카드 한도 대폭 축소. 소득 증빙 형태가 비정형.',
    demonstrates:
      '유리한 정보 제출(R3) 중심 — 정보 출처가 분명해 이 회사에 바로 제출하는 경로입니다.',
    eventId: 'limitReduced',
    counterpartyId: 'FI',
    institutionSectorId: 'creditFinance',
    routingBranchId: 'own',
    reason:
      '프리랜서로 일하며 연 5천만원 정도를 법니다. 4대보험 가입 직장인이 아니라 ' +
      '소득 증빙이 사업소득 원천징수영수증뿐입니다. 이 카드사와만 거래해 왔는데 ' +
      '갑자기 카드 한도가 크게 줄었습니다.',
  },
  {
    id: 'returner',
    title: '경력단절 후 재취업 박OO (41세)',
    summary: '재취업 6개월차, 카드 발급 거절. 공백기 이력이 반영된 것으로 추정.',
    demonstrates:
      '2단계 경로 — 정보 출처를 모르므로 서식 1로 먼저 확인한 뒤 서식 2를 제출합니다.',
    eventId: 'cardRejected',
    counterpartyId: 'FI',
    institutionSectorId: 'creditFinance',
    routingBranchId: 'unknown',
    reason:
      '육아로 5년간 일을 쉬었다가 6개월 전 재취업했습니다. 현재는 정규직이고 ' +
      '급여도 안정적인데 카드 발급이 거절됐습니다. 예전에 다른 은행과 거래한 기록이 ' +
      '남아 있는 것 같은데, 어느 회사 정보가 반영된 것인지 모르겠습니다.',
  },
]

export const SAMPLE_SCENARIOS_BY_ID = Object.fromEntries(
  SAMPLE_SCENARIOS.map((s) => [s.id, s]),
)
