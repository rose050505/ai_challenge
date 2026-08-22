/**
 * 심사자 체험용 샘플 시나리오 3종 (CLAUDE.md "샘플 시나리오 3종")
 *
 * 법령 내용이 아니다. 법조문·서식 문구는 이 파일에 두지 않는다. (전부 src/data/law.js)
 * 여기 값은 /diagnose 의 입력을 미리 채우기 위한 것뿐이다.
 *
 * institutionSectorId 는 src/data/law.js 의 INSTITUTION_SECTORS id 를 참조한다.
 */
export const SAMPLE_SCENARIOS = [
  {
    id: 'newcomer',
    title: '사회초년생 김OO (26세)',
    summary: '첫 신용대출 신청, 거절. 금융이력이 거의 없음.',
    eventId: 'loanRejected',
    counterpartyId: 'FI',
    institutionSectorId: 'bank',
    reason:
      '첫 직장에 입사한 지 8개월 됐고 신용카드나 대출을 써본 적이 없습니다. ' +
      '연체한 적도 없는데 신용대출이 거절됐습니다. 거래 이력이 없어서 점수가 낮게 나온 것 같습니다.',
  },
  {
    id: 'freelancer',
    title: '프리랜서 이OO (34세)',
    summary: '연소득 5천만원대이나 카드 한도 대폭 축소. 소득 증빙 형태가 비정형.',
    eventId: 'limitReduced',
    counterpartyId: 'FI',
    institutionSectorId: 'creditFinance',
    reason:
      '프리랜서로 일하며 연 5천만원 정도를 법니다. 4대보험 가입 직장인이 아니라 ' +
      '소득 증빙이 사업소득 원천징수영수증뿐입니다. 갑자기 카드 한도가 크게 줄었습니다.',
  },
  {
    id: 'returner',
    title: '경력단절 후 재취업 박OO (41세)',
    summary: '재취업 6개월차, 카드 발급 거절. 공백기 이력이 반영된 것으로 추정.',
    eventId: 'cardRejected',
    counterpartyId: 'FI',
    institutionSectorId: 'creditFinance',
    reason:
      '육아로 5년간 일을 쉬었다가 6개월 전 재취업했습니다. 현재는 정규직이고 ' +
      '급여도 안정적인데 카드 발급이 거절됐습니다. 공백기 기록이 아직 반영돼 있는 것 같습니다.',
  },
]

export const SAMPLE_SCENARIOS_BY_ID = Object.fromEntries(
  SAMPLE_SCENARIOS.map((s) => [s.id, s]),
)
