/**
 * 신용정보법 제36조의2 / 시행령 제31조의2 법령 상수 모듈
 *
 * 출처: docs/law/law-reference.md, docs/law/form-spec.md
 *
 * ── 이 파일의 규칙 ──────────────────────────────────────────────
 * 1. 법조문 텍스트는 **이 파일에만** 존재한다. 다른 파일에 복사하지 않는다.
 * 2. LLM이 생성하지 않는다. 전부 하드코딩 상수다.
 * 3. docs/law/law-reference.md 에 없는 내용은 채우지 않는다.
 *    미확인 항목은 빈 배열 / null + TODO 주석으로 남긴다.
 * ────────────────────────────────────────────────────────────────
 *
 * 법률   신용정보의 이용 및 보호에 관한 법률
 *        [시행 2026. 8. 13.] [법률 제21646호, 2026. 5. 12., 일부개정]
 *        (본조신설 2020. 2. 4.)
 * 시행령 신용정보의 이용 및 보호에 관한 법률 시행령
 *        [시행 2026. 8. 13.] [대통령령 제36574호, 2026. 8. 11., 일부개정]
 *        (본조신설 2020. 8. 4.)
 * 소관   금융위원회 금융데이터정책과
 */

/** 법령 판본 정보 — 화면 하단 출처 표기에 사용 */
export const LAW_META = {
  act: {
    name: '신용정보의 이용 및 보호에 관한 법률',
    /** 통용되는 약칭. 배지 링크(basisLink)가 이 형태를 조문 주소로 풀어 준다. */
    shortName: '신용정보법',
    article: '제36조의2',
    effectiveDate: '2026-08-13',
    revision: '법률 제21646호, 2026. 5. 12., 일부개정',
  },
  decree: {
    name: '신용정보의 이용 및 보호에 관한 법률 시행령',
    article: '제31조의2',
    effectiveDate: '2026-08-13',
    revision: '대통령령 제36574호, 2026. 8. 11., 일부개정',
  },
  competentAuthority: '금융위원회 금융데이터정책과',
  /**
   * 다른 법률. 상대방 판정에 쓰이는 검사 대상 기관 목록이 여기서 온다.
   * 판본: docs/law/law-reference-addendum.md
   */
  fscAct: {
    name: '금융위원회의 설치 등에 관한 법률',
    article: '제38조',
    effectiveDate: '2026-01-02',
    revision: '법률 제21065호, 2025. 10. 1., 타법개정',
  },
  /**
   * 거절 이후의 구제 경로에서 인용한다 (docs/law/remedies-research.md §2-3).
   * 이 서비스의 판정에는 쓰이지 않는다.
   */
  consumerAct: {
    name: '금융소비자 보호에 관한 법률',
    article: '제36조',
  },
  /**
   * 서식이 실린 금융위원회 고시.
   * 판본 확인 2026-08-30 (국가법령정보센터 행정규칙 원문).
   * 제40조의5 ① 영 제31조의2제6항의 서식 = 별지 제15호의2·제15호의3 서식 (우리 서식 1·2)
   *          ② 영 제31조의2제7항의 서식 = 별지 제15호의4 서식 (사업자가 회신할 때 쓰는 서식)
   */
  supervisionRule: {
    name: '신용정보업감독규정',
    article: '제40조의5',
    effectiveDate: '2026-08-13',
    revision: '금융위원회고시 제2026-37호, 2026. 8. 13., 일부개정',
  },
}

/* ============================================================
 * 0-2. 법령 원문 링크
 *
 * ★ 이 서비스의 주장은 "법에 근거한다"는 것이다. 심사자든 사용자든
 *   그 자리에서 원문을 확인할 수 있어야 주장이 완성된다.
 *
 * 국가법령정보센터는 `/법령/{법령명}/제N조의M` 형태의 조문 단위 딥링크를 지원한다.
 *   확인 2026-08-26 — 위 주소가 실제로 해당 조문(joNo/joBrNo)으로 해석된다.
 *   예) .../신용정보의이용및보호에관한법률/제36조의2 → joNo=0036&joBrNo=02
 * 행정규칙(고시)은 조문 단위 해석이 되지 않아 **규정 단위까지만** 건다.
 *   조문 번호는 배지 글자에 이미 들어 있으므로 함께 보인다.
 * ============================================================ */

const LAW_GO_KR = 'https://www.law.go.kr'

export const LAW_SOURCES = {
  act: {
    label: LAW_META.act.name,
    url: `${LAW_GO_KR}/법령/신용정보의이용및보호에관한법률`,
    articleLink: true,
  },
  decree: {
    label: LAW_META.decree.name,
    url: `${LAW_GO_KR}/법령/신용정보의이용및보호에관한법률시행령`,
    articleLink: true,
  },
  fscAct: {
    label: LAW_META.fscAct.name,
    url: `${LAW_GO_KR}/법령/금융위원회의설치등에관한법률`,
    articleLink: true,
  },
  consumerAct: {
    label: LAW_META.consumerAct.name,
    url: `${LAW_GO_KR}/법령/금융소비자보호에관한법률`,
    articleLink: true,
  },
  supervisionRule: {
    label: LAW_META.supervisionRule.name,
    url: `${LAW_GO_KR}/행정규칙/신용정보업감독규정`,
    // 행정규칙은 조문 단위로 열리지 않는다 (확인 2026-08-26)
    articleLink: false,
  },
}

/** 근거 문자열에서 어느 법령을 가리키는지 찾는다. 먼저 나오는 쪽이 이긴다. */
const SOURCE_MATCHERS = [
  { id: 'decree', keys: ['시행령'] },
  { id: 'fscAct', keys: ['금융위원회의 설치 등에 관한 법률'] },
  { id: 'consumerAct', keys: ['금융소비자 보호에 관한 법률'] },
  { id: 'supervisionRule', keys: ['신용정보업감독규정'] },
  /**
   * ★ 정식명칭도 받는다.
   *   랜딩의 "근거 신용정보의 이용 및 보호에 관한 법률 제36조의2" 배지가
   *   '법 제' 에도 '신용정보법 제' 에도 걸리지 않아 **링크 없이** 나가고 있었다.
   *   (2026-08-30 배포본 전수 조사에서 확인)
   *
   *   다만 정식명칭 뒤에 '시행령'이 붙으면 그건 시행령이므로 이 키로 잡지 않는다.
   *   그 처리는 matchSource() 가 한다.
   */
  { id: 'act', keys: ['법 제', '신용정보법 제'], fullName: '신용정보의 이용 및 보호에 관한 법률' },
]

/** 근거 문자열에서 키가 처음 나오는 위치. 없으면 -1 */
function keyIndex(basis, m) {
  let at = -1
  for (const k of m.keys) {
    const i = basis.indexOf(k)
    if (i >= 0 && (at < 0 || i < at)) at = i
  }
  if (m.fullName) {
    const i = basis.indexOf(m.fullName)
    // '…법률 시행령' 은 시행령이다. 이 키로 가져가지 않는다.
    if (i >= 0 && !basis.startsWith(m.fullName + ' 시행령', i)) {
      if (at < 0 || i < at) at = i
    }
  }
  return at
}

/**
 * 근거 배지 문자열 → 국가법령정보센터 주소.
 *
 * @param {string} basis 예: '법 제36조의2 제2항 제2호 나목'
 * @returns {{href: string, label: string, article: string|null}|null}
 *          연결할 곳이 없으면 null (고시 서식 자체 등)
 */
export function basisLink(basis) {
  if (typeof basis !== 'string' || !basis) return null
  let best = null
  for (const m of SOURCE_MATCHERS) {
    const i = keyIndex(basis, m)
    if (i < 0) continue
    if (!best || i < best.at) best = { id: m.id, at: i }
  }
  if (!best) return null
  const src = LAW_SOURCES[best.id]
  const m = /제(\d+)조(?:의(\d+))?/.exec(basis.slice(best.at))
  const article = m ? (m[2] ? `제${m[1]}조의${m[2]}` : `제${m[1]}조`) : null
  const href = src.articleLink && article ? `${src.url}/${article}` : src.url
  return { href, label: src.label, article }
}

/* ============================================================
 * 1. 용어 정의
 * ============================================================ */

/** 자동화평가 — 법 제2조제14호 */
export const DEFINITION_AUTOMATED_EVALUATION = {
  term: '자동화평가',
  basis: '법 제2조제14호',
  text:
    '제15조제1항에 따른 신용정보회사등의 종사자가 평가 업무에 관여하지 아니하고 ' +
    '컴퓨터 등 정보처리장치로만 개인신용정보 및 그 밖의 정보를 처리하여 ' +
    '개인인 신용정보주체를 평가하는 행위',
  /**
   * ★ 핵심 요건은 "종사자가 평가 업무에 관여하지 아니하고"다.
   *   심사역이 개입한 결정은 자동화평가가 아니므로 이 권리의 대상이 아닐 수 있다.
   *   R1(실시 여부 확인)이 왜 첫 단계인지의 근거가 여기 있다.
   */
  keyRequirement: '종사자가 평가 업무에 관여하지 아니하고',
  whyR1First:
    '사람이 심사에 개입했다면 자동화평가가 아니어서 이 권리의 대상이 아닐 수 있습니다. ' +
    '그래서 먼저 "자동화평가를 했는지"부터 묻습니다.',
}

/**
 * 개인신용평가회사등 — 법 제36조의2제1항
 * = 개인신용평가회사 + 대통령령으로 정하는 신용정보제공·이용자
 *
 * 시행령 제31조의2제1항:
 *   "대통령령으로 정하는 신용정보제공·이용자"란
 *   「금융위원회의 설치 등에 관한 법률」 제38조 각 호의 자를 말한다.
 */
export const DEFINITION_EVALUATOR = {
  term: '개인신용평가회사등',
  basis: '법 제36조의2제1항, 시행령 제31조의2제1항',
  text:
    '개인신용평가회사 및 「금융위원회의 설치 등에 관한 법률」 제38조 각 호에 해당하는 ' +
    '신용정보제공·이용자',
}

/* ------------------------------------------------------------
 * 1-2. 권리 행사의 상대방 — 2계층 구조
 *
 * 법 제36조의2 제1항의 "개인신용평가회사등"은 두 종류다.
 *   (A) 개인신용평가회사(CB사)
 *       → 법 조문에 직접 명시. 금융위원회법 제38조 목록과 무관하게 언제나 상대방이 된다.
 *   (B) 대통령령으로 정하는 신용정보제공·이용자 (금융회사)
 *       → 시행령 제31조의2제1항 → 「금융위원회의 설치 등에 관한 법률」 제38조 각 호
 *
 * ★ 대출 거절 시 사용자는 (A)와 (B) **양쪽에 각각** 권리를 행사할 수 있다.
 *   이것이 진단 로직의 핵심 분기다. 두 계층을 절대 하나로 합치지 않는다.
 * ------------------------------------------------------------ */

export const COUNTERPARTY_TYPES = [
  {
    id: 'CB',
    label: '개인신용평가회사 (CB사)',
    // 근거: 법 제36조의2 제1항 — 조문에 직접 명시된 상대방
    basis: '법 제36조의2 제1항',
    basisChain: '법 제36조의2 제1항 (조문에 직접 명시)',
    description:
      '개인신용평가를 수행하는 회사. 법 조문이 직접 명시하고 있으므로 ' +
      '「금융위원회의 설치 등에 관한 법률」 제38조 각 호 목록과 무관하게 상대방이 됩니다.',
    /** 기관 목록 조회가 필요 없다 (조문상 상대방이 확정) */
    requiresInstitutionLookup: false,
  },
  {
    id: 'FI',
    label: '금융회사 (대통령령으로 정하는 신용정보제공·이용자)',
    // 근거: 법 제36조의2 제1항 → 시행령 제31조의2 제1항 → 금융위원회법 제38조 각 호
    basis: '법 제36조의2 제1항, 시행령 제31조의2 제1항',
    basisChain:
      '법 제36조의2 제1항 → 시행령 제31조의2 제1항 → ' +
      '「금융위원회의 설치 등에 관한 법률」 제38조 각 호',
    description:
      '대출·카드 등 금융거래를 심사한 금융회사. 해당 기관이 금융위원회법 제38조 각 호에 ' +
      '해당해야 상대방이 됩니다.',
    /** FSC_ACT_ARTICLE_38_CLAUSES / INSTITUTION_SECTORS 로 해당 여부를 확인해야 한다 */
    requiresInstitutionLookup: true,
  },
]

export const COUNTERPARTY_TYPES_BY_ID = Object.fromEntries(
  COUNTERPARTY_TYPES.map((c) => [c.id, c]),
)

/**
 * 「금융위원회의 설치 등에 관한 법률」 제38조 각 호 — 법 원문 계층.
 * 시행령 제31조의2제1항이 이 목록을 그대로 인용한다.
 *
 * TODO-1 해소 (2026-08-23, docs/law/law-reference-addendum.md): 10개 호 전부 원문 확인 완료.
 * 출처: 「금융위원회의 설치 등에 관한 법률」 제38조(검사 대상 기관)
 *       [시행 2026. 1. 2.] [법률 제21065호, 2025. 10. 1., 타법개정]
 */
export const FSC_ACT_ARTICLE_38_CLAUSES = [
  {
    clause: 1,
    basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제1호',
    text: '「은행법」에 따른 인가를 받아 설립된 은행',
    verified: true,
  },
  {
    clause: 2,
    basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제2호',
    text:
      '「자본시장과 금융투자업에 관한 법률」에 따른 금융투자업자, 증권금융회사, ' +
      '종합금융회사 및 명의개서대행회사(名義改書代行會社)',
    verified: true,
  },
  {
    clause: 3,
    basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제3호',
    text: '「보험업법」에 따른 보험회사',
    verified: true,
  },
  {
    clause: 4,
    basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제4호',
    text: '「상호저축은행법」에 따른 상호저축은행과 그 중앙회',
    verified: true,
  },
  {
    clause: 5,
    basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제5호',
    text: '「신용협동조합법」에 따른 신용협동조합 및 그 중앙회',
    verified: true,
  },
  {
    clause: 6,
    basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제6호',
    text: '「여신전문금융업법」에 따른 여신전문금융회사 및 겸영여신업자(兼營與信業者)',
    verified: true,
  },
  {
    clause: 7,
    basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제7호',
    text: '「농업협동조합법」에 따른 농협은행',
    verified: true,
  },
  {
    clause: 8,
    basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제8호',
    text: '「수산업협동조합법」에 따른 수협은행',
    verified: true,
  },
  {
    clause: 9,
    basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제9호',
    text: '다른 법령에서 금융감독원이 검사를 하도록 규정한 기관',
    verified: true,
    catchAll: true,
  },
  {
    clause: 10,
    basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제10호',
    text: '그 밖에 금융업 및 금융 관련 업무를 하는 자로서 대통령령으로 정하는 자',
    verified: true,
    catchAll: true,
  },
]

/**
 * /diagnose 기관 선택용 — **업권 단위** 옵션.
 * 호수 단위가 아니라 사용자가 자기 거래처를 알아볼 수 있는 업권 단위로 쪼갠다.
 *
 * clauseNo / basis 는 **확인된 항목에만** 붙인다.
 * verified: false 인 항목은 UI에서 정상 표시하되 **근거 조문 배지만 숨긴다.**
 *
 * shortLabel 은 **서식 원문의 기관명 자리에 넣을 짧은 업권명**이다.
 * 라벨 전체("여신전문금융회사 (카드사·캐피탈·리스 등)")를 문장에 넣으면 어색하므로 분리한다.
 * 매핑 근거: docs/law/form-spec-2.md §기관명 치환 규칙
 */
export const INSTITUTION_SECTORS = [
  { id: 'bank', shortLabel: '은행', label: '은행', clauseNo: 1, basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제1호', verified: true },
  { id: 'investment', shortLabel: '증권사', label: '금융투자업자 (증권·자산운용 등)', clauseNo: 2, basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제2호', verified: true },
  { id: 'securityFinance', shortLabel: '증권사', label: '증권금융회사', clauseNo: 2, basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제2호', verified: true },
  { id: 'merchantBank', shortLabel: '증권사', label: '종합금융회사', clauseNo: 2, basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제2호', verified: true },
  { id: 'transferAgent', shortLabel: '증권사', label: '명의개서대행회사', clauseNo: 2, basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제2호', verified: true },
  { id: 'insurance', shortLabel: '보험회사', label: '보험회사', clauseNo: 3, basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제3호', verified: true },
  /**
   * 제4호·제5호 확정 (docs/law/law-reference-addendum.md).
   * ⚠️ 새마을금고는 제38조 각 호에 명시되어 있지 않다.
   *   9호 해당 여부는 별도 확인이 필요하므로 이 라벨에 임의로 포함시키지 말 것.
   *   5호는 신용협동조합(신협)과 그 중앙회로 정확히 표기한다.
   */
  { id: 'savingsBank', shortLabel: '저축은행', label: '상호저축은행', clauseNo: 4, basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제4호', verified: true },
  { id: 'mutualCredit', shortLabel: '신협', label: '신용협동조합', clauseNo: 5, basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제5호', verified: true },
  { id: 'creditFinance', shortLabel: '카드사', label: '여신전문금융회사 (카드사·캐피탈·리스 등)', clauseNo: 6, basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제6호', verified: true },
  { id: 'concurrentCredit', shortLabel: '카드사', label: '겸영여신업자', clauseNo: 6, basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제6호', verified: true },
  { id: 'nonghyupBank', shortLabel: '은행', label: '농협은행', clauseNo: 7, basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제7호', verified: true },
  { id: 'suhyupBank', shortLabel: '은행', label: '수협은행', clauseNo: 8, basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제8호', verified: true },
  {
    id: 'fssExamined', shortLabel: '금융회사',
    label: '그 밖에 금융감독원 검사 대상 기관',
    clauseNo: 9,
    basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제9호',
    verified: true,
    catchAll: true,
  },
  {
    id: 'decreeDesignated', shortLabel: '금융회사',
    label: '그 밖에 금융업·금융 관련 업무를 하는 자로서 대통령령으로 정하는 자',
    clauseNo: 10,
    basis: '「금융위원회의 설치 등에 관한 법률」 제38조 제10호',
    verified: true,
    catchAll: true,
  },
]

/**
 * 드롭다운 마지막에 둔다.
 * 제38조 각 호는 모두 확인됐으나, 9호·10호처럼 열거되지 않은 기관이 있고
 * 새마을금고처럼 해당 여부가 확인되지 않은 기관도 있으므로 직접 입력 경로를 남긴다.
 * 법령 항목이 아니므로 근거 호수를 붙이지 않는다.
 */
export const INSTITUTION_OTHER_OPTION = {
  id: 'other',
  label: '목록에 없음 / 직접 입력',
  /** 서식 본문 치환값. 수신 기관 입력값을 여기에 쓰지 않는다. */
  shortLabel: '금융회사',
  clauseNo: null,
  basis: null,
  verified: false,
  statutory: false,
  uiNote: '목록에서 찾지 못한 기관은 여기에 직접 입력하세요.',
}

/** 드롭다운에 그대로 넣을 수 있는 최종 옵션 목록 */
export const INSTITUTION_OPTIONS = [...INSTITUTION_SECTORS, INSTITUTION_OTHER_OPTION]

/* ============================================================
 * 2. 권리 5종 (R1 ~ R5)
 *    진단 로직은 이 5종 분류를 그대로 따른다.
 * ============================================================ */

export const RIGHTS = [
  {
    id: 'R1',
    /** 상대방 2계층: (A) CB사 / (B) 금융회사 — 양쪽에 각각 행사 가능 */
    counterparties: ['CB', 'FI'],
    // 근거: 법 제36조의2 제1항 제1호
    label: '자동화평가 실시 여부 설명 요구',
    basis: '법 제36조의2 제1항 제1호',
    paragraph: 1,
    summary: '해당 행위에 자동화평가를 하는지 여부를 설명하도록 요구할 수 있습니다.',
    /**
     * 행사 요건: 아래 대상 행위 중 하나에 해당해야 한다.
     * 가목·나목·다목은 법 제36조의2 제1항 제1호 각 목.
     */
    requirement:
      '개인인 신용정보주체일 것. 요구 대상이 아래 대상 행위(가·나·다목) 중 하나에 해당할 것.',
    targetActs: [
      {
        // 법 제36조의2 제1항 제1호 가목
        code: 'a',
        basis: '법 제36조의2 제1항 제1호 가목',
        text: '개인신용평가',
      },
      {
        // 법 제36조의2 제1항 제1호 나목
        code: 'b',
        basis: '법 제36조의2 제1항 제1호 나목',
        text: '대통령령으로 정하는 금융거래의 설정 및 유지 여부, 내용의 결정',
        note: '대통령령으로 정하는 신용정보제공·이용자에 한정된다.',
        /** 이 대상 행위만 상대방이 (B) 금융회사로 한정된다 */
        counterpartyRestriction: ['FI'],
      },
      {
        // 법 제36조의2 제1항 제1호 다목 + 시행령 제31조의2 제4항
        code: 'c',
        basis: '법 제36조의2 제1항 제1호 다목, 시행령 제31조의2 제4항',
        text:
          '그 밖에 컴퓨터 등 정보처리장치로만 처리하면 개인신용정보 보호를 저해할 우려가 ' +
          '있는 경우로서 대통령령으로 정하는 행위',
        decreeText:
          '시행령 제31조의2 제2항에 따른 거래에 관한 계약의 청약 또는 승낙 여부의 결정',
      },
    ],
  },
  {
    id: 'R2',
    /** 상대방 2계층: (A) CB사 / (B) 금융회사 — 양쪽에 각각 행사 가능 */
    counterparties: ['CB', 'FI'],
    // 근거: 법 제36조의2 제1항 제2호
    label: '자동화평가 내용 설명 요구',
    basis: '법 제36조의2 제1항 제2호',
    paragraph: 1,
    summary:
      '자동화평가를 하는 경우, 그 결과·주요 기준·기초정보의 개요 등을 설명하도록 요구할 수 있습니다.',
    requirement: '해당 행위에 자동화평가가 실시되었어야 합니다.',
    items: [
      // 법 제36조의2 제1항 제2호 가목
      { code: 'a', basis: '법 제36조의2 제1항 제2호 가목', text: '자동화평가의 결과' },
      // 법 제36조의2 제1항 제2호 나목
      { code: 'b', basis: '법 제36조의2 제1항 제2호 나목', text: '자동화평가의 주요 기준' },
      // 법 제36조의2 제1항 제2호 다목
      {
        code: 'c',
        basis: '법 제36조의2 제1항 제2호 다목',
        text: '자동화평가에 이용된 기초정보의 개요',
      },
      // 법 제36조의2 제1항 제2호 라목
      {
        code: 'd',
        basis: '법 제36조의2 제1항 제2호 라목',
        /** ★ 원문 그대로. "가목부터 다목까지의 규정에서 정한 사항과"가 빠져 있었다. */
        text: '그 밖에 가목부터 다목까지의 규정에서 정한 사항과 유사한 사항으로서 대통령령으로 정하는 사항',
      },
    ],
  },
  {
    id: 'R3',
    /** 상대방 2계층: (A) CB사 / (B) 금융회사 — 양쪽에 각각 행사 가능 */
    counterparties: ['CB', 'FI'],
    // 근거: 법 제36조의2 제2항 제1호
    label: '유리한 정보의 제출',
    basis: '법 제36조의2 제2항 제1호',
    paragraph: 2,
    summary:
      '자동화평가 결과의 산출에 유리하다고 판단되는 정보를 제출할 수 있습니다.',
    requirement:
      '제출하려는 정보가 자동화평가 결과의 산출에 유리하다고 판단되는 정보여야 합니다. ' +
      '(별도의 사실 부정확·최신성 요건은 없습니다.)',
  },
  {
    id: 'R4',
    /** 상대방 2계층: (A) CB사 / (B) 금융회사 — 양쪽에 각각 행사 가능 */
    counterparties: ['CB', 'FI'],
    // 근거: 법 제36조의2 제2항 제2호 가목
    label: '기초정보의 정정·삭제 요구',
    basis: '법 제36조의2 제2항 제2호 가목',
    paragraph: 2,
    summary: '기초정보를 정정하거나 삭제할 것을 요구할 수 있습니다.',
    requirement:
      '기초정보의 내용이 정확하지 아니하거나 최신의 정보가 아니라고 판단되는 경우여야 합니다. ' +
      '(법 제36조의2 제2항 제2호 본문)',
  },
  {
    id: 'R5',
    /** 상대방 2계층: (A) CB사 / (B) 금융회사 — 양쪽에 각각 행사 가능 */
    counterparties: ['CB', 'FI'],
    // 근거: 법 제36조의2 제2항 제2호 나목
    label: '자동화평가 결과의 재산출 요구',
    basis: '법 제36조의2 제2항 제2호 나목',
    paragraph: 2,
    summary: '자동화평가 결과를 다시 산출할 것을 요구할 수 있습니다.',
    requirement:
      '기초정보의 내용이 정확하지 아니하거나 최신의 정보가 아니라고 판단되는 경우여야 합니다. ' +
      '(R4와 동일. 법 제36조의2 제2항 제2호 본문)',
  },
]

/** RIGHTS 를 id 로 조회 */
export const RIGHTS_BY_ID = Object.fromEntries(RIGHTS.map((r) => [r.id, r]))

/**
 * 시행령 제31조의2 제2항이 참조하는 "법 제2조 제1호의3 가목 1)~4)의 거래".
 * TODO-2 해소 (docs/law/law-reference-addendum.md).
 */
export const CREDIT_RISK_TRANSACTIONS = {
  basis: '법 제2조 제1호의3 가목',
  /** 각 목에 공통으로 걸리는 상위 문구. 하위 호를 특정할 수 없을 때 이것만 표시한다. */
  chapeau:
    '신용정보제공ㆍ이용자에게 신용위험이 따르는 거래로서 다음 각각의 거래의 ' +
    '종류, 기간, 금액, 금리, 한도 등에 관한 정보',
  chapeauShort: '신용위험이 따르는 거래',
  items: [
    {
      code: 1,
      basis: '법 제2조 제1호의3 가목 1)',
      text: '「은행법」 제2조제7호에 따른 신용공여',
      short: '신용공여',
    },
    {
      code: 2,
      basis: '법 제2조 제1호의3 가목 2)',
      text:
        '「여신전문금융업법」 제2조제3호ㆍ제10호 및 제13호에 따른 ' +
        '신용카드, 시설대여 및 할부금융 거래',
      short: '신용카드·시설대여·할부금융',
    },
    {
      code: 3,
      basis: '법 제2조 제1호의3 가목 3)',
      text:
        '「자본시장과 금융투자업에 관한 법률」 제34조제2항, 제72조, 제77조의3제4항 및 ' +
        '제342조제1항에 따른 신용공여',
      short: '신용공여',
    },
    {
      code: 4,
      basis: '법 제2조 제1호의3 가목 4)',
      text: '1)부터 3)까지와 유사한 거래로서 대통령령으로 정하는 거래',
      short: '유사 거래',
    },
  ],
}

export const CREDIT_RISK_TRANSACTIONS_BY_CODE = Object.fromEntries(
  CREDIT_RISK_TRANSACTIONS.items.map((i) => [i.code, i]),
)

/**
 * 가목 4)가 위임한 거래 — **시행령 제2조 제6항**.
 * TODO-5 해소 (원문 확인 2026-08-27, docs/law/remedies-research.md §1).
 *
 * ★ sectorIds 는 **우리 업권 선택지(INSTITUTION_SECTORS)와 직접 대응하는 것만** 채운다.
 *   대응하는 선택지가 없는 호는 상수로만 기록하고 판정에 쓰지 않는다.
 *   제7호는 기관 40개 목이라 범위가 넓고 검증 비용이 커서 매핑하지 않는다.
 *   → 매핑하지 않은 호를 판정에 끌어들이면, 확인하지 않은 것을 확인한 것처럼 표시하게 된다.
 */
export const DELEGATED_CREDIT_TRANSACTIONS = {
  parentBasis: '법 제2조 제1호의3 가목 4)',
  basis: '시행령 제2조 제6항',
  items: [
    {
      no: 1,
      basis: '시행령 제2조 제6항 제1호',
      text: '「상호저축은행법」 제2조제6호에 따른 신용공여',
      short: '신용공여',
      sectorIds: ['savingsBank'],
    },
    {
      no: 2,
      basis: '시행령 제2조 제6항 제2호',
      text: '「신용협동조합법」 제2조제5호에 따른 대출등',
      short: '대출등',
      sectorIds: ['mutualCredit'],
    },
    {
      no: 3,
      basis: '시행령 제2조 제6항 제3호',
      text: '「새마을금고법」 제28조제1항제1호나목에 따른 대출',
      short: '대출',
      // 새마을금고는 금융위원회법 제38조 각 호 해당 여부가 확인되지 않아 업권 선택지에 없다
      sectorIds: [],
    },
    {
      no: 4,
      basis: '시행령 제2조 제6항 제4호',
      text: '「대부업 등의 등록 및 금융이용자 보호에 관한 법률」 제6조에 따른 대부계약',
      short: '대부계약',
      sectorIds: [],
    },
    {
      no: 5,
      basis: '시행령 제2조 제6항 제5호',
      text:
        '「보험업법」 제2조제13호에 따른 신용공여 및 같은 법 제100조제1항제1호에 따른 대출등',
      short: '신용공여·대출등',
      sectorIds: ['insurance'],
    },
    {
      no: 6,
      basis: '시행령 제2조 제6항 제6호',
      text:
        '「온라인투자연계금융업 및 이용자 보호에 관한 법률」 제2조제1호에 따른 연계대출',
      short: '연계대출',
      sectorIds: [],
    },
    {
      no: 7,
      basis: '시행령 제2조 제6항 제7호',
      text:
        '그 밖에 제1호부터 제6호까지의 규정에 따른 거래와 유사한 거래로서 ' +
        '다음 각 목 및 제21조제2항 각 호의 기관이 수행하는 거래',
      short: '유사 거래',
      sectorIds: [],
      note: '기관 40개 목을 열거한다. 범위가 넓어 업권 매핑 대상에서 제외했다.',
    },
  ],
}

/** 업권 id → 시행령 제2조 제6항의 호. 매핑된 것만 들어 있다. */
export const DELEGATED_TRANSACTION_BY_SECTOR = Object.fromEntries(
  DELEGATED_CREDIT_TRANSACTIONS.items.flatMap((i) => i.sectorIds.map((sid) => [sid, i])),
)

/**
 * 사건 유형 × 업권 조합 → 법 제2조 제1호의3 가목의 어느 호인지 판정한다.
 *
 * ★ 단순 매핑이 아니다. 같은 "대출 거절"도 은행이면 1), 증권사면 3)이다.
 *   조합이 애매하면 **하위 호를 특정하지 않고** 상위 문구(chapeau)만 표시한다.
 *   근거: docs/law/law-reference-addendum.md §사건 유형 → 조문 매핑
 *
 * 사건 id 는 src/data/events.js 의 EVENT_TYPES 와 맞춘다.
 */
const BANK_LIKE = ['bank', 'nonghyupBank', 'suhyupBank']
const SECURITIES_LIKE = ['investment', 'securityFinance', 'merchantBank', 'transferAgent']
const CARD_LIKE = ['creditFinance', 'concurrentCredit']

/**
 * 하위 질문 — 이 조합에서만 띄운다.
 * 은행의 "한도 축소"는 신용대출 한도(가목 1))인지 카드 한도(가목 2))인지에 따라 근거가 갈린다.
 * 사용자는 어떤 한도였는지 알고 있으므로 회피하지 말고 한 번 더 묻는다.
 * 다른 조합에는 일괄 적용하지 않는다.
 */
export const LIMIT_KIND_QUESTION = {
  question: '어떤 한도가 줄었나요?',
  options: [
    { id: 'loan', label: '대출 한도', transactionCode: 1 },
    { id: 'card', label: '카드 한도', transactionCode: 2 },
  ],
  /** 이 조합에서만 노출한다 */
  appliesTo: { eventId: 'limitReduced', sectorIds: BANK_LIKE },
}

/** 하위 질문을 띄워야 하는 조합인지 */
export function needsLimitKind(eventId, sectorId) {
  return (
    eventId === LIMIT_KIND_QUESTION.appliesTo.eventId &&
    LIMIT_KIND_QUESTION.appliesTo.sectorIds.includes(sectorId)
  )
}

/**
 * @param {string|null} limitKind 'loan' | 'card' — needsLimitKind 가 true 일 때만 쓰인다
 * @returns {{resolved: boolean, item: object|null, basis: string, label: string, caveat: string|null, needsMoreInfo?: boolean}}
 */
export function resolveTransactionBasis(eventId, sectorId, limitKind = null) {
  const ambiguous = (caveat = null) => ({
    resolved: false,
    item: null,
    basis: CREDIT_RISK_TRANSACTIONS.basis,
    label: CREDIT_RISK_TRANSACTIONS.chapeauShort,
    caveat,
  })
  const pick = (code, caveat = null) => ({
    resolved: true,
    item: CREDIT_RISK_TRANSACTIONS_BY_CODE[code],
    basis: CREDIT_RISK_TRANSACTIONS_BY_CODE[code].basis,
    label: CREDIT_RISK_TRANSACTIONS_BY_CODE[code].short,
    caveat,
  })
  /**
   * 가목 4) → 시행령 제2조 제6항 제N호 로 특정한다 (TODO-5 해소).
   * 매핑된 업권(저축은행·신협·보험)에만 쓰인다. 그 밖은 여전히 상위 문구만 표시한다.
   */
  const pickDelegated = (sid) => {
    const d = DELEGATED_TRANSACTION_BY_SECTOR[sid]
    if (!d) return null
    const parent = CREDIT_RISK_TRANSACTIONS_BY_CODE[4]
    return {
      resolved: true,
      item: parent,
      delegated: d,
      basis: d.basis,
      basisChain: `${parent.basis} → ${d.basis}`,
      label: d.short,
      caveat: null,
    }
  }

  if (!eventId) return ambiguous()

  // 카드 발급 거절은 발급 주체가 여신전문금융회사이거나 겸영여신업자이므로
  // 업권과 무관하게 여신전문금융업법상 신용카드 거래에 해당한다.
  if (eventId === 'cardRejected') return pick(2)

  // 리스·할부는 시설대여·할부금융으로 2)에 해당한다.
  if (eventId === 'leaseRejected') return pick(2)

  if (eventId === 'loanRejected' || eventId === 'rateRaised') {
    if (BANK_LIKE.includes(sectorId)) return pick(1)
    if (SECURITIES_LIKE.includes(sectorId)) return pick(3)
    if (CARD_LIKE.includes(sectorId)) return pick(2)
    // 저축은행·신협·보험은 가목 4)의 위임 목록(시행령 제2조 제6항)으로 특정된다
    const delegated = pickDelegated(sectorId)
    if (delegated) return delegated
    /**
     * 저축은행·신협·보험 등.
     * 가목 1)의 신용공여는 「은행법」 제2조제7호에 따른 것이므로 은행법상 은행에 적용되고,
     * 가목 3)은 자본시장법상 금융투자업자에 적용된다.
     * 따라서 이 업권의 대출은 가목 1)~3) 어디에도 직접 해당하지 않는다.
     * 가목 4)의 위임 목록(시행령 제2조 제6항)은 확인했으나, 여기까지 내려온 업권은
     * 그 목록에도 대응하는 호가 없다. → 회피가 아니라 정확한 판단이다. 상위 문구만 표시한다.
     */
    return ambiguous(
      '「은행법」상 신용공여(가목 1))나 자본시장법상 신용공여(가목 3))에 직접 해당하지 ' +
        '않는 업권입니다. 가목 4)가 위임한 시행령 제2조 제6항의 목록에도 이 업권에 ' +
        '대응하는 호가 없어, 하위 호를 특정하지 않고 상위 문구만 표시합니다.',
    )
  }

  if (eventId === 'limitReduced') {
    // 카드사·증권사는 상품이 하나로 정해지므로 바로 판정된다.
    if (CARD_LIKE.includes(sectorId)) return pick(2)
    if (SECURITIES_LIKE.includes(sectorId)) return pick(3)
    // 은행은 대출 한도인지 카드 한도인지 한 번 더 묻는다 (LIMIT_KIND_QUESTION).
    if (BANK_LIKE.includes(sectorId)) {
      const opt = LIMIT_KIND_QUESTION.options.find((o) => o.id === limitKind)
      if (opt) return pick(opt.transactionCode)
      return { ...ambiguous(), needsMoreInfo: true }
    }
    /**
     * 저축은행·신협·보험의 한도 축소.
     * 축소된 것은 그 거래(신용공여·대출등)의 "한도"이므로 같은 호로 특정된다.
     * 가목의 상위 문구가 "거래의 종류, 기간, 금액, 금리, **한도** 등에 관한 정보"이기 때문이다.
     */
    const delegated = pickDelegated(sectorId)
    if (delegated) return delegated
    return ambiguous()
  }

  return ambiguous()
}

/* ============================================================
 * 3. 거절 사유 4종
 *    법 제36조의2 제3항 제1호·제2호 + 시행령 제31조의2 제5항 제1호·제2호
 *    (법 제3항 제3호는 시행령으로의 위임 조항이므로 실체 사유에서 제외)
 * ============================================================ */

export const REFUSAL_GROUNDS = [
  {
    id: 'D1',
    source: 'act', // 법
    basis: '법 제36조의2 제3항 제1호',
    /** 근거 체인 — 화면에 위임 경로까지 표시한다 */
    basisChain: '법 제36조의2 제3항 제1호',
    text:
      '이 법 또는 다른 법률에 특별한 규정이 있거나 법령상 의무를 준수하기 위하여 불가피한 경우',
    description:
      '다른 법령이 정보 제공을 제한하거나, 법령상 의무를 지키기 위해 요구에 응할 수 없는 경우입니다.',
  },
  {
    id: 'D2',
    source: 'act', // 법
    basis: '법 제36조의2 제3항 제2호',
    /** 근거 체인 — 화면에 위임 경로까지 표시한다 */
    basisChain: '법 제36조의2 제3항 제2호',
    text:
      '해당 신용정보주체의 요구에 따르게 되면 금융거래 등 상거래관계의 설정 및 유지 등이 곤란한 경우',
    description:
      '요구를 그대로 들어주면 해당 금융거래 자체를 설정하거나 유지하기 어려워지는 경우입니다.',
  },
  {
    id: 'D3',
    source: 'decree', // 시행령 (법 제3항 제3호의 구체화)
    basis: '시행령 제31조의2 제5항 제1호 (법 제36조의2 제3항 제3호의 구체화)',
    /** 근거 체인 — 위임 경로를 그대로 화면에 드러낸다 */
    basisChain: '법 제36조의2 제3항 제3호 → 시행령 제31조의2 제5항 제1호',
    text: '개인인 신용정보주체가 정정 또는 삭제 요청한 내용이 사실과 다른 경우',
    description:
      '정정·삭제를 요청한 내용 자체가 사실과 다르면 사업자가 요구를 거절할 수 있습니다.',
  },
  {
    id: 'D4',
    source: 'decree', // 시행령 (법 제3항 제3호의 구체화)
    basis: '시행령 제31조의2 제5항 제2호 (법 제36조의2 제3항 제3호의 구체화)',
    /** 근거 체인 — 위임 경로를 그대로 화면에 드러낸다 */
    basisChain: '법 제36조의2 제3항 제3호 → 시행령 제31조의2 제5항 제2호',
    text:
      '정당한 사유 없이 동일한 금융거래 등에 대해 3회 이상 반복적으로 ' +
      '법 제36조의2제1항 및 제2항에 따른 권리를 행사하는 경우',
    description:
      '"정당한 사유 없이"가 요건에 붙어 있습니다. 횟수만으로 무조건 거절되는 것이 아니라, ' +
      '정당한 사유 없는 반복 행사인 경우에 한합니다.',
    /** UI 경고: "3회까지만 가능"으로 단정하지 말 것 (law-reference.md §3) */
    uiCaution:
      '화면에서 "3회까지만 가능"이라고 단정적으로 표기하지 말 것. "정당한 사유 없이"가 요건이다.',
  },
]

/**
 * 거절당한 뒤에 남은 경로.
 *
 * ★ 조사에서 **조문으로 확인한 것만** 담는다 (docs/law/remedies-research.md §2).
 *   확인하지 못한 것은 담지 않고, 확인하지 못했다는 사실만 남긴다.
 *
 * ★ 가장 조심할 지점 — 과태료는 **제1항(설명 요구) 위반에만** 있다.
 *   제2항(유리한 정보 제출·정정·삭제·재산출) 위반에는 과태료도 벌칙도 없다.
 *   제52조·제50조 전문을 조문 단위로 확인한 결과다.
 *   이걸 뭉뚱그리면 사용자가 헛된 기대를 갖는다.
 *
 * ★ 이 서비스는 법률자문을 하지 않는다. 각 항목은 조문의 존재를 알릴 뿐,
 *   개별 사안에 적용되는지는 판단하지 않는다.
 */
export const POST_REFUSAL_PATHS = {
  /** 섹션 전체에 붙는 고지. 이 선을 넘지 않는다. */
  disclaimer:
    '이 안내는 법령 조문에 근거한 것이며, 개별 사안의 법적 판단이 아닙니다. ' +
    '실제 대응은 전문가와 상의하시기 바랍니다.',
  items: [
    {
      id: 'fine',
      title: '과태료 — 설명 요구를 무시한 경우에 한합니다',
      basis: '법 제52조 제3항 제7호의2',
      text: '제36조의2제1항을 위반하여 설명을 하지 아니한 자',
      amount: '3천만원 이하의 과태료',
      /** ★ 반드시 함께 표시한다. 빼면 거짓이 된다. */
      scopeWarning:
        '이 과태료는 제1항(설명 요구)을 무시한 경우에만 적용됩니다. ' +
        '제2항(유리한 정보 제출·정정·삭제·재산출 요구)을 들어주지 않은 것에 대해서는 ' +
        '법률에도 시행령에도 과태료나 벌칙 규정이 없습니다.',
      note: '과태료는 국가가 사업자에게 부과하는 것이며, 신고인에게 지급되지 않습니다.',
    },
    {
      id: 'damages',
      title: '손해배상 — 손해를 증명하지 못해도 청구할 수 있습니다',
      basis: '법 제43조, 법 제43조의2',
      text:
        '신용정보회사등이 이 법을 위반하여 손해를 가한 경우 배상 책임이 있고, ' +
        '손해액을 증명하는 대신 300만원 이하의 범위에서 법정손해배상을 청구할 수도 있습니다.',
      highlight:
        '두 조문 모두 고의 또는 과실이 없음을 회사가 증명하지 못하면 책임을 면할 수 없다고 ' +
        '정하고 있습니다. 입증 책임이 회사 쪽에 있습니다.',
      note: '"이 법을 위반"이 전제입니다. 위반에 해당하는지는 이 서비스가 판단하지 않습니다.',
    },
    {
      id: 'mediation',
      title: '금융감독원 분쟁조정 — 금융회사를 상대로 할 때',
      basis: '「금융소비자 보호에 관한 법률」 제36조 제1항',
      text:
        '금융소비자 및 그 밖의 이해관계인은 금융과 관련하여 분쟁이 있을 때에는 ' +
        '금융감독원장에게 분쟁조정을 신청할 수 있습니다.',
      scopeBasis: '「금융소비자 보호에 관한 법률」 제33조',
      scopeText:
        '조정 대상이 되는 기관은 「금융위원회의 설치 등에 관한 법률」 제38조 각 호의 기관입니다. ' +
        '이 서비스가 앞에서 판정한 그 목록과 같습니다.',
      /** ★ CB사 포함 여부는 조문으로 단정할 수 없다 */
      unconfirmed:
        '개인신용평가회사(CB사)가 이 목록에 포함되는지는 조문만으로 확인되지 않았습니다. ' +
        '이 서비스는 확인하지 못한 것을 확인한 것처럼 적지 않습니다.',
    },
  ],
  /** 우리가 확인하지 못한 것 — 있는 그대로 남긴다 */
  unexplored:
    '이 밖에 다른 경로가 있을 수 있으나 이 서비스는 확인하지 못했습니다. ' +
    '조문만으로 관할이나 적용 여부를 단정할 수 없는 경로는 적지 않았습니다.',
}

/**
 * 거절 시 사업자의 안내 의무 — 시행령 제31조의2 제9항
 * 사용자가 거절당하더라도 "왜 거절했는지"를 안내받을 권리가 있다.
 */
export const REFUSAL_NOTICE_DUTY = {
  basis: '시행령 제31조의2 제9항',
  /** ★ 원문 그대로. */
  text:
    '개인신용평가회사등은 법 제36조의2제3항에 따라 개인인 신용정보주체의 요구를 거절한 경우 ' +
    '거절의 근거 및 사유를 서면, 전자우편, 인터넷 홈페이지 또는 어플리케이션 등을 통해 ' +
    '안내해야 한다.',
}

/* ============================================================
 * 4. 행사 채널 4종 — 시행령 제31조의2 제6항
 * ============================================================ */

/**
 * 시행령 제31조의2 제6항:
 *   개인인 신용정보주체는 법 제36조의2 제1항 및 제2항에 따른 권리를
 *   서면, 전자우편, 인터넷 홈페이지 또는 어플리케이션 등을 통해
 *   금융위원회가 정하여 고시하는 서식에 따라 행사해야 한다.
 *
 * ★ 제2항 권리(R3~R5)도 고시 서식 대상이다.
 *   자체 양식으로 제출하면 요건을 충족하지 못한다. 자체 문서 대안을 만들지 않는다.
 */
export const EXERCISE_CHANNELS = [
  { id: 'written', label: '서면', basis: '시행령 제31조의2 제6항' },
  { id: 'email', label: '전자우편', basis: '시행령 제31조의2 제6항' },
  { id: 'website', label: '인터넷 홈페이지', basis: '시행령 제31조의2 제6항' },
  { id: 'app', label: '어플리케이션', basis: '시행령 제31조의2 제6항' },
]

/** 행사 시 서식 요건 — 시행령 제31조의2 제6항 */
export const EXERCISE_FORM_REQUIREMENT = {
  basis: '시행령 제31조의2 제6항',
  /**
   * ★ 원문 그대로다(2026-08-30 국가법령정보센터 대조). 줄이거나 어순을 바꾸지 않는다.
   *   전에는 "법 제36조의2 제1항 및 제2항에 따른 권리를 …서식에 따라 행사해야 한다."로
   *   주어와 채널 열거를 빼고 어순을 바꿔 두었는데, 화면에는 "법령 원문"으로 표시되고 있었다.
   *   조문 번호의 띄어쓰기도 원문을 따른다(제36조의2제1항). 배지 표기와는 별개다.
   */
  text:
    '개인인 신용정보주체는 서면, 전자우편, 인터넷 홈페이지 또는 어플리케이션 등을 통해 ' +
    '금융위원회가 정하여 고시하는 서식에 따라 법 제36조의2제1항 및 제2항에 따른 권리를 ' +
    '행사해야 한다.',
  note:
    '임의 양식이 아니라 고시 서식이어야 합니다. 제1항 권리와 제2항 권리에 모두 적용됩니다.',
  /** 조문이 "제1항 및 제2항"을 함께 규정하므로 자체 양식 대안은 성립하지 않는다 */
  appliesToParagraphs: [1, 2],
}

/** 사업자의 회신 의무 — 시행령 제31조의2 제7항 */
export const RESPONSE_DUTY = {
  basis: '시행령 제31조의2 제7항',
  /** ★ 원문 그대로. 주어(개인신용평가회사등)를 빼면 누가 하는 의무인지가 사라진다. */
  text:
    '개인신용평가회사등은 법 제36조의2제1항 및 제2항에 따른 권리를 행사한 신용정보주체에게 ' +
    '설명ㆍ정정ㆍ삭제 등 필요조치를 하고 그 결과를 서면, 전자우편, 인터넷 홈페이지 또는 ' +
    '어플리케이션 등을 통해 금융위원회가 정하여 고시하는 서식에 따라 해당 신용정보주체에게 ' +
    '설명해야 한다.',
}

/**
 * 회신에 쓰는 법정 서식 — 신용정보업감독규정 제40조의5 제2항.
 *
 * ★ 회신에도 서식이 정해져 있다.
 *   시행령 제31조의2 제7항은 "금융위원회가 정하여 고시하는 서식에 따라" 설명하라고만 하고,
 *   그 서식이 무엇인지는 고시(감독규정)가 지정한다. 그 지정이 제40조의5 제2항이다.
 *   사용자에게 이건 하나의 축이 된다 — 금융회사가 아무 형태로나 답해도 되는 것이 아니다.
 *
 * ★ 확인한 것과 확인하지 못한 것을 나눈다.
 *   확인한 것: 규정 원문(2026-08-30 국가법령정보센터 행정규칙 원문)과
 *             별지 목록에 실린 이름("[별지 15의 4] 자동화평가 결과 안내서").
 *   확인하지 못한 것: **서식의 본문**. 별지 서식은 고시의 첨부 파일로만 제공되는데
 *             그 파일을 받지 못했다(다운로드 식별자 미상). 서식이 존재한다는 것과
 *             그 서식이 무엇을 담는지는 다른 문제다. 담는 내용을 지어내지 않는다.
 *
 * ★ 위법 단정 금지.
 *   회신이 이 서식을 따르지 않았다고 해서 위법이라고 말하지 않는다.
 *   실무 관행을 확인하지 않았다. "법정 서식이 있다"까지가 우리가 말할 수 있는 전부다.
 */
export const RESPONSE_FORM = {
  basis: '신용정보업감독규정 제40조의5 제2항',
  /** 이 서식을 부르는 상위 근거 */
  relatedBasis: '시행령 제31조의2 제7항',
  /** ★ 규정 원문 그대로 */
  ruleText:
    '영 제31조의2제7항에서 "금융위원회가 정하여 고시하는 서식"이란 별지 제15호의4 서식을 말한다.',
  formNo: '별지 제15호의4',
  /** 고시 별지 목록에 실린 이름 (목록 표기: [별지 15의 4]) */
  formName: '자동화평가 결과 안내서',
  effectiveDate: LAW_META.supervisionRule.effectiveDate,
  revision: LAW_META.supervisionRule.revision,
  /** 화면 한 줄 */
  notice:
    '금융회사는 시행령 제31조의2 제7항과 감독규정에 따라 금융위원회가 정한 서식으로 회신해야 합니다.',
  /** ★ 미확인 고지. 이 문장을 빼고 서식 내용을 설명하지 않는다. */
  contentsUnverified:
    '이 서식이 어떤 항목을 담는지는 확인하지 못했습니다. 별지 서식의 본문은 고시의 첨부 파일로만 ' +
    '제공되는데 그 파일을 받지 못했습니다. 여기서 말씀드릴 수 있는 것은 "그런 법정 서식이 있다"까지입니다.',
  /** ★ 단정 금지 고지 */
  noVerdictNote:
    '받으신 회신이 이 서식의 모양과 다르더라도 그것만으로 위법이라고 단정할 수 없습니다. ' +
    '실무에서 어떻게 운용되는지는 이 서비스가 확인하지 않았습니다.',
}

/**
 * ⚠️ TODO-3 — 처리 기한.
 *
 * **법률에도 시행령에도 처리 기한 규정이 없다** (docs/law/law-reference.md §4, TODO-3 조사 결과).
 * 신용정보업감독규정(금융위 고시) 제40조의5 부근에 있을 가능성이 있으나 원문 미확인.
 *
 * → 임의의 일수를 넣지 않는다. statutoryDeadlineDays 는 확인될 때까지 null 로 유지한다.
 * → 화면에 "○일 이내 회신" 형태로 단정하는 문구를 절대 넣지 않는다.
 */
export const PROCESSING_DEADLINE = {
  /** 법령상 확인된 기한. 확인 전까지 null. 임의의 숫자를 넣지 말 것. */
  statutoryDeadlineDays: null,
  verified: false,
  basis: null,
  /** 화면 표기는 이 문구 수준으로만 한다 (law-reference.md TODO-3 조사 결과가 지정한 표현) */
  uiNotice:
    '법령상 기한 규정은 없으며, 금융회사에 따라 10일 내외로 안내하는 경우가 있습니다.',
  uiCaution: '"10일 이내 회신됩니다"라고 단정하지 말 것.',
}

/* ============================================================
 * 5. 사업자의 설명 방식 3종 — 시행령 제31조의2 제8항
 *    사용자가 어떤 형태의 답변을 받게 될지 미리 알리는 "기대치 조정"용.
 * ============================================================ */

export const EXPLANATION_METHODS = [
  {
    id: 'result',
    // 시행령 제31조의2 제8항 제1호 (법 제36조의2 제1항 제2호 가목에 대응)
    basis: '시행령 제31조의2 제8항 제1호',
    relatedRightBasis: '법 제36조의2 제1항 제2호 가목',
    label: '자동화평가의 결과',
    /** ★ 원문 그대로. "(백분율 포함)"으로 줄여 적고 있었다. */
    text:
      '개인인 신용정보주체의 별도 요청이 없으면 요구 시점에서 가장 최근에 실시한 ' +
      '자동화평가의 결과로서, 개인신용평가회사등이 자체적으로 정한 신용등급 또는 ' +
      '점수(백분율을 포함한다) 등으로 표시할 수 있다.',
  },
  {
    id: 'criteria',
    // 시행령 제31조의2 제8항 제2호 (법 제36조의2 제1항 제2호 나목에 대응)
    basis: '시행령 제31조의2 제8항 제2호',
    relatedRightBasis: '법 제36조의2 제1항 제2호 나목',
    label: '자동화평가의 주요 기준',
    /**
     * ★ 원문 그대로. 괄호 안 열거(신용거래 판단정보 …)를 빼고, 원문에 없는 쉼표를
     *   "안내하거나," 에 넣어 두고 있었다. 이 괄호가 곧 우리 5분류의 출처다.
     */
    text:
      '자동화평가시 법 제2조제1호에서 정하고 있는 신용정보의 종류별' +
      '(신용거래 판단정보, 신용도 판단정보, 신용거래능력 판단정보 등) 반영 비중을 ' +
      '안내하거나 또는 각 금융권역 협회에서 마련한 양식에 따라 안내할 수 있다.',
    /** 법 제2조제1호의 신용정보 종류 (law-reference.md §5 제2호에 열거된 범위) */
    creditInfoTypes: ['신용거래 판단정보', '신용도 판단정보', '신용거래능력 판단정보'],
  },
  {
    id: 'baseInfo',
    // 시행령 제31조의2 제8항 제3호 (법 제36조의2 제1항 제2호 다목에 대응)
    basis: '시행령 제31조의2 제8항 제3호',
    relatedRightBasis: '법 제36조의2 제1항 제2호 다목',
    label: '기초정보의 개요',
    /** ★ 원문 그대로. "설명을 요구한 본인"으로 줄여 적고 있었다. */
    text:
      '설명을 요구한 개인인 신용정보주체 본인, 종합신용정보집중기관 및 ' +
      '개인신용평가회사등으로부터 금융회사 등이 직접 입수한 신용정보를 안내할 수 있다.',
    /** ★ 제3호 단서 — 이 제도의 실질적 한계 */
    proviso:
      '다만, 금융회사 등이 기초정보를 자체적으로 가공하여 생성 또는 추론한 정보는 제외할 수 있다.',
    limitationNote:
      '"직접 입수한 정보"는 받을 수 있으나 "가공·추론한 정보"(모델 내부 로직)는 받지 못할 수 있다. ' +
      '이 한계를 정직하게 밝히는 것이 신뢰 포인트다.',
  },
]

/**
 * 회신 해석(/response)의 판정 축.
 *
 * ★ 새로 만들지 않는다. 시행령 제31조의2 제8항의 3유형(EXPLANATION_METHODS)을 그대로 쓴다.
 *   id 는 result / criteria / baseInfo 로, 서식 1의 요청 항목(FORM_REQUEST_ITEMS)과 같다.
 *   따라서 "누락된 유형 → 서식 1 재요구" 연결이 id 하나로 성립한다.
 */
export const RESPONSE_TYPES = EXPLANATION_METHODS

export const RESPONSE_TYPE_IDS = EXPLANATION_METHODS.map((m) => m.id)

export const RESPONSE_TYPES_BY_ID = Object.fromEntries(
  EXPLANATION_METHODS.map((m) => [m.id, m]),
)

/**
 * ★ 제도의 한계 — 시행령 제31조의2 제8항 제3호 단서.
 * 회신을 받은 사용자가 "왜 이것밖에 안 알려주지"라고 느끼는 지점의 근거다.
 * 우리 서비스의 결함이 아니라 제도의 설계이므로 정면으로 밝힌다.
 */
export const RESPONSE_LIMITATION = {
  basis: '시행령 제31조의2 제8항 제3호 단서',
  proviso: EXPLANATION_METHODS.find((m) => m.id === 'baseInfo').proviso,
  explanation:
    '금융회사가 종합신용정보집중기관·개인신용평가회사 등으로부터 직접 입수한 신용정보는 ' +
    '설명받을 수 있습니다. 그러나 금융회사가 그 정보를 자체적으로 가공하거나 추론해 만든 ' +
    '정보는 제외할 수 있습니다.',
  consequence:
    '따라서 평가 모델이 각 정보를 어떻게 조합해 점수를 냈는지, 그 내부 로직 자체는 ' +
    '받을 수 없습니다. 회신이 부실해 보인다면 상당 부분은 이 단서 때문입니다.',
  /** 회신에 이 단서가 실제로 적용된 것으로 판정된 경우에만 덧붙인다 */
  appliedNotice: '이번 회신에는 이 제외가 실제로 적용됐습니다.',
  /** ★ 제외를 거절로 오해하지 않게 하는 문장 (아래 RESPONSE_DISPOSITIONS 참조) */
  notRefusalNote:
    '이것은 요구를 거절한 것이 아닙니다. 요구에는 응하면서, 법이 제외를 허용한 범위만큼 ' +
    '설명의 폭을 줄인 것입니다. 따라서 거절에 대한 대응(법 제36조의2 제3항)이 아니라 ' +
    '받은 내용을 가지고 다음 단계로 진행하시면 됩니다.',
}

/**
 * ★ 회신의 두 가지 결말을 구분한다.
 *
 * 실제 API 호출에서 AI가 이 둘을 혼동했다.
 * "자체 개발·가공한 정보라 제공 대상에서 제외"라는 문장을 거절로 판정했다.
 * 사례 기록: docs/cases/refusal-vs-proviso.md
 *
 *   A. 거절            — 요구 자체에 응하지 않은 것.
 *   B. 설명 범위의 법정 제외 — 요구에는 응했으나 가공·추론 정보를 뺀 것. 정상 회신이다.
 *
 * "제외", "제공 대상이 아님", "자체 개발·가공" 이라는 표현은 B이지 A가 아니다.
 * B를 거절로 취급하면 사용자를 잘못된 대응 경로로 보내게 된다.
 */
export const RESPONSE_DISPOSITIONS = [
  {
    id: 'refused',
    label: '거절',
    basis: '법 제36조의2 제3항',
    detailBasis: '법 제36조의2 제3항 각 호 및 시행령 제31조의2 제5항 각 호',
    text: '요구 자체에 응하지 아니한 경우입니다. 법령이 정한 사유에 한합니다.',
  },
  {
    id: 'excludedByProviso',
    label: '설명 범위의 법정 제외',
    basis: '시행령 제31조의2 제8항 제3호 단서',
    detailBasis: '시행령 제31조의2 제8항 제3호 단서',
    text:
      '요구에는 응하였으나, 기초정보를 자체적으로 가공하여 생성 또는 추론한 정보를 ' +
      '설명에서 제외한 경우입니다. 이는 거절이 아닙니다.',
  },
]

export const RESPONSE_DISPOSITIONS_BY_ID = Object.fromEntries(
  RESPONSE_DISPOSITIONS.map((d) => [d.id, d]),
)

/* ============================================================
 * 6. 서식
 * ============================================================ */

/**
 * 서식 1 — 「자동화평가 결과에 대한 설명요구서」
 * 근거: 금융위원회 고시 서식 (신용정보업감독규정 제40조의5제1항 관련)
 * 대응 권리: R1, R2 (법 제36조의2 제1항)
 * 명세: docs/law/form-spec.md
 */
/**
 * 서식 1 의 [섹션 3] 신청자 인적사항 칸.
 * 명세: docs/law/form-spec.md §[섹션 3]
 *
 * ★ 주민등록번호는 입력받지 않는다. 서식에는 칸이 있으므로 공란으로 출력하고
 *   "출력 후 직접 기재" 안내를 붙인다. (CLAUDE.md 민감정보 처리 원칙)
 */
export const FORM1_APPLICANT_FIELDS = [
  { id: 'name', label: '성명', input: true },
  {
    id: 'residentNumber',
    label: '주민등록번호',
    /** 입력 UI를 만들지 않는다 */
    input: false,
    /** 서식상 표기 형태 */
    placeholderMark: '        -        ',
    note: '출력 후 직접 기재하세요 — 이 서비스는 주민등록번호를 입력받지 않습니다.',
  },
  { id: 'phone', label: '휴대폰', input: true },
  { id: 'email', label: '이메일', input: true },
]

/**
 * 서식 1 의 고정 문구.
 * 고시 서식의 문구다. 화면에서 다시 쓰지 않고 여기서만 읽어간다.
 * 명세: docs/law/form-spec.md
 */
export const FORM1_TEXTS = {
  /** [섹션 1] 신용평가주체의 대응권 개요 — 고정 안내문 */
  overviewTitle: '신용평가주체의 대응권 개요',
  overviewBody:
    '개인인 신용정보주체는 신용정보법 제36조의2 제1항·제2항 및 하위법령에 따라 ' +
    '개인신용평가회사 및 대통령령으로 정하는 신용정보제공·이용자에 대하여 자동화평가 ' +
    '실시 여부, 그 결과·주요기준·기초정보의 개요 등의 설명을 요구할 수 있으며, ' +
    '유리하다고 판단되는 정보의 제출, 기초정보의 정정·삭제 및 자동화평가 결과의 ' +
    '재산출을 요구할 수 있습니다.',
  refusalLead: '다만 아래의 경우 금융회사가 요청을 거부할 수 있습니다.',

  /** [섹션 2] 요청 내용 리드 문장. {성명} 자리에 사용자 입력이 들어간다. */
  requestSectionTitle: '요청 내용',
  requestLeadBefore: '(성명) 은(는) 귀 사의 상기 설명 내용을 듣고 이해하였으며, ',
  requestLeadAfter: '이에 따라 아래 내용에 대해 설명을 요구합니다.',

  /** [섹션 3] */
  applicantSectionTitle: '신청자 인적사항',

  /** [섹션 4] 개인신용정보 제공 동의 — 고정 문구 + 체크박스 */
  consentText:
    '※ 이와 관련, 본인은 귀 사가 신용정보집중기관 또는 개인신용평가회사, ' +
    '개인사업자신용평가회사 또는 기업신용조회회사 등으로부터 본인의 개인신용정보를 ' +
    '제공받는 것에 동의합니다.',
  consentAgreeLabel: '동의',
  consentDisagreeLabel: '비동의',
  /** 기본값을 우리가 정하지 않는다. 둘 다 비워둔 상태로 출력해도 무방하다. */
  consentDefault: null,
}

/** [섹션 5] 서명란 — 서식 1·2 공통. 날짜는 자동 채움 가능하되 서명란은 반드시 공란. */
export const FORM_SIGNATURE_TEXTS = {
  dateMark: '20\u00a0\u00a0\u00a0.\u00a0\u00a0\u00a0.\u00a0\u00a0\u00a0.',
  applicantLabel: '신청인 :',
  signatureMark: '(서명 또는 인)',
}

/**
 * ★ 정본 미대조 고지 — 서식 1·2 공통.
 *
 * 우리 재현본은 금융회사가 공개한 실물(BC카드·HB저축은행)을 보고 만들었다.
 * 고시의 **별지 서식 원본**과는 대조하지 못했다. 별지 서식은 고시의 첨부 파일로만
 * 제공되는데 그 파일을 받지 못했다(별지 제15호의4 와 같은 사정이다 — RESPONSE_FORM 참조).
 *
 * ★ 확인한 것과 확인하지 못한 것을 섞지 않는다.
 *   확인한 것: 별지 제15호의2 서식의 개정 이력에 **금융위원회고시 제2026-37호(2026. 8. 13.)**가
 *             있다는 것. 국가법령정보센터의 별지 목록에서 직접 봤다
 *             (2026-08-30, docs/law-audit.md §원문을 확보하지 못해 검증하지 못한 것).
 *   확인하지 못한 것: **서식 본문**과, 우리가 본 기관 공개본이 그 개정 **뒤**의 판본인지.
 *             본문은 HWP 첨부로만 제공되는데 다운로드 식별자(flSeq)를 알아내지 못했다
 *             (별지 제15호의4 와 같은 사정이다 — RESPONSE_FORM 참조).
 *
 * 이 고지는 화면(서식 출처 상자)과 docs/facts.md 에 함께 적는다.
 */
export const FORM_ORIGINAL_UNVERIFIED = {
  basis: '신용정보업감독규정 (금융위원회고시 제2026-37호, 2026. 8. 13., 일부개정)',
  note:
    '다만 고시의 별지 서식 원본과는 대조하지 못했습니다. 별지 서식 본문은 고시의 첨부 파일로만 ' +
    '제공되는데 그 파일을 받지 못했습니다. 이 서식의 원본은 2026-08-13 개정됐는데(금융위원회고시 ' +
    '제2026-37호), 저희가 본 실물이 그 개정 뒤의 판본인지는 확인하지 못했습니다. ' +
    '항목 구조나 문구가 원본과 다를 가능성이 남아 있습니다.',
}

export const FORM_EXPLANATION_REQUEST = {
  id: 'explanationRequest',
  title: '자동화평가 결과에 대한 설명요구서',
  /** 좁은 자리(그림 상자 등)에서 쓰는 줄임 이름. 공식 제목을 줄인 것이지 다른 서식이 아니다. */
  shortTitle: '설명요구서',
  subtitle: '(제40조의5제1항 관련)',
  basis: '신용정보업감독규정 제40조의5제1항 관련 (금융위원회 고시 서식)',
  coveredRights: ['R1', 'R2'],
  available: true,
  /** 어느 실물을 보고 재현했는지 — docs/law/form-spec.md */
  source: 'BC카드 공개본',
  sourceNote:
    '금융위원회 고시 별지 서식을 금융회사가 각자 비치합니다. 기관마다 표 모양이 조금씩 다를 수 있으나 항목 구조와 요구 문구는 같습니다.',
}

/**
 * 서식 1 의 [섹션 1] "신용평가주체의 대응권 개요" 중 거절 사유 안내 부분.
 * 고시 서식의 고정 안내문이다. **문구 수정 금지 — 원문 그대로 렌더링한다.**
 * 명세: docs/law/form-spec.md §[섹션 1]
 */
export const FORM_SECTION1_REFUSAL_NOTICE = {
  basis: '고시 서식 「자동화평가 결과에 대한 설명요구서」 [섹션 1]',
  /** true = 렌더링 시 문구를 다듬지 않는다 */
  verbatim: true,
  items: [
    '다른 법령 등에 특별한 규정이 있는 경우',
    '요구에 따르면 금융거래 등 상거래관계의 설정 및 유지 등이 곤란한 경우',
    '정정·삭제 요청 내용이 사실과 다른 경우',
    '동일한 금융거래에 대해 3회 이상 반복적으로 권리를 행사하는 경우',
  ],
}

/**
 * ★ 고시 서식 안내문과 시행령 원문의 불일치.
 *
 * 서식 [섹션 1]의 네 번째 항목에는 시행령 제31조의2 제5항 제2호의 요건인
 * "정당한 사유 없이"가 **빠져 있다**.
 *
 * 처리 방침 (의도적 설계):
 *   - 서식 렌더링 영역: 원문 그대로 둔다. 문구를 고치지 않는다.
 *   - 서식 **밖** 안내 영역: 아래 correction 문구로 보정한다.
 *   - 이 불일치는 의도적으로 화면에 드러낸다. 숨기거나 삭제하지 않는다.
 */
export const FORM_SECTION1_DISCREPANCY = {
  formItemIndex: 3, // FORM_SECTION1_REFUSAL_NOTICE.items[3]
  relatedRefusalGroundId: 'D4',
  basisChain: '법 제36조의2 제3항 제3호 → 시행령 제31조의2 제5항 제2호',
  correction:
    "고시 서식의 안내문에는 생략되어 있으나, 시행령 제31조의2 제5항 제2호는 " +
    "'정당한 사유 없이' 3회 이상 반복한 경우로 한정하고 있습니다.",
  /** 서식 내부 렌더링에는 절대 끼워 넣지 않는다 */
  renderOutsideFormOnly: true,
}

/**
 * 서식 1 의 [섹션 2] 요청 내용 — 선택 항목 3종 (다중 선택 가능)
 * 명세: docs/law/form-spec.md §서식 구조 / [섹션 2]
 */
export const FORM_REQUEST_ITEMS = [
  {
    id: 'result',
    marker: '①',
    label: '자동화평가의 결과',
    // 근거: 법 제36조의2 제1항 제2호 가목
    basis: '법 제36조의2 제1항 제2호 가목',
    /** 부기란: 서식 원문 문구. 임의로 다듬지 말 것. */
    annotationLabel: '신청인 희망 신용평가 결과',
    annotationHint: '금융회사 안내를 받아 기재',
    /** 작성 시점에 모를 수 있는 항목이므로 필수 입력으로 만들지 않는다 (form-spec.md) */
    required: false,
    uiNote: '모르면 비워두고 창구 안내를 받아 기재하도록 안내한다.',
  },
  {
    id: 'criteria',
    marker: '②',
    label: '자동화평가의 주요 기준',
    // 근거: 법 제36조의2 제1항 제2호 나목
    basis: '법 제36조의2 제1항 제2호 나목',
    required: false,
  },
  {
    id: 'baseInfo',
    marker: '③',
    label: '자동화평가에 이용된 기초정보의 개요',
    // 근거: 법 제36조의2 제1항 제2호 다목
    basis: '법 제36조의2 제1항 제2호 다목',
    required: false,
  },
]

/**
 * 기초정보 5분류 — 서식 2 [섹션 2] "구 분" 행 (5종 고정)
 * 명세: docs/law/form-spec-2.md §[섹션 2]
 *
 * 이 5분류는 시행령 제31조의2 제8항 제2호가 언급하는
 * "신용거래 판단정보, 신용도 판단정보, 신용거래능력 판단정보 등"과 대응한다.
 * R2(주요 기준 설명)에서 받게 될 답변의 분류 체계와 같으므로 두 화면의 분류를 일치시킨다.
 */
/**
 * ★ 이 5분류는 법 제2조 제1호 가~마목을 그대로 가져온 것이다.
 *   법이 각 분류의 내용을 구체적으로 정의하므로 사용자에게 법정 예시를 제시할 수 있다.
 *   출처: docs/law/law-reference-addendum.md §신용정보 5분류
 *
 *   examples 는 "신용도 판단정보에 뭘 적지"에서 막히는 것을 막기 위한 힌트다.
 *   서식에 인쇄되는 내용이 아니라 화면 힌트로만 쓴다.
 */
export const BASE_INFO_CATEGORIES = [
  {
    id: 'identity',
    label: '식별정보',
    lawBasis: '법 제2조 제1호 가목',
    definitionBasis: '법 제2조 제1호의2',
    examples: ['성명·주소·전화번호', '개인식별번호', '생체변환정보'],
  },
  {
    id: 'transaction',
    label: '거래내용 판단정보',
    lawBasis: '법 제2조 제1호 나목',
    definitionBasis: '법 제2조 제1호의3',
    examples: [
      '신용공여·신용카드·시설대여·할부금융의 종류·기간·금액·금리·한도',
      '금융거래',
      '보험계약',
      '금융투자상품',
      '상거래',
    ],
  },
  {
    id: 'creditworthiness',
    label: '신용도 판단정보',
    lawBasis: '법 제2조 제1호 다목',
    definitionBasis: '법 제2조 제1호의4',
    examples: [
      '채무 불이행·대위변제',
      '명의도용',
      '보험사기·전기통신금융사기',
      '허위자료 제출',
      '대출금 유용',
    ],
    /** R4 의 주 타겟. 명의도용 피해자가 자기 정보를 바로잡는 전형적 상황이 여기다. */
    primaryTargetOf: 'R4',
  },
  {
    id: 'capacity',
    label: '신용거래능력 판단정보',
    /**
     * ★ 서식 2 원문은 이 한 분류만 붙여 쓴다("신용거래능력판단정보").
     *   서식에 인쇄되는 라벨만 이것을 쓰고, 화면 용어·회신 해석의 분류 라벨은 label 을 쓴다.
     *   서식 원문 재현과 우리 화면 용어는 별개다. 나머지 네 분류는 formLabel 이 없다.
     */
    formLabel: '신용거래능력판단정보',
    lawBasis: '법 제2조 제1호 라목',
    definitionBasis: '법 제2조 제1호의5',
    examples: ['개인의 직업', '재산', '채무', '소득의 총액', '납세실적'],
    /** R3 의 주 타겟. 서식 2의 예시(건강보험 납부실적)가 이 범주다. */
    primaryTargetOf: 'R3',
  },
  {
    id: 'other',
    label: '기타 정보',
    lawBasis: '법 제2조 제1호 마목',
    definitionBasis: '법 제2조 제1호의6',
    examples: ['재판·행정처분', '조세·국가채권', '채무조정', '개인신용평점'],
  },
]

export const BASE_INFO_CATEGORIES_BY_ID = Object.fromEntries(
  BASE_INFO_CATEGORIES.map((c) => [c.id, c]),
)

/**
 * 기초정보 분류의 명백한 오분류만 코드로 바로잡는다.
 *
 * 배경: 실제 API 호출에서 AI가 "직업"을 식별정보로 분류했다.
 *   법 제2조 제1호의5는 "개인의 직업ㆍ재산ㆍ채무ㆍ소득의 총액 및 납세실적"을
 *   신용거래능력 판단정보로 정의하므로 직업은 여기 속한다.
 *   식별정보(법 제2조 제1호의2)는 성명·주소·전화번호·개인식별번호·생체정보뿐이다.
 *   "건강보험 납부실적"도 서식 2가 R3 예시로 직접 든 항목이므로 같은 범주다.
 *
 * ★ 과하게 하드코딩하지 않는다. 법이 조문에 직접 열거한 단어만 넣는다.
 *   여기서 걸러지지 않는 항목은 AI 분류를 그대로 둔다.
 *   보정 결과는 화면에서 사용자가 바꿀 수 있어야 한다.
 *   분류는 정정 요구의 근거가 되므로 최종 판단은 사용자 몫이다.
 *
 * 순서가 의미를 가진다. 위에서부터 먼저 맞는 규칙을 적용한다.
 *   "채무 불이행"은 신용도(1호의4), "채무"는 신용거래능력(1호의5)이므로 신용도를 먼저 본다.
 */
/**
 * ★ 5분류가 겹치는 항목.
 *
 * 같은 "대출 잔액"이 두 분류에 모두 걸린다.
 *   - 법 제2조 제1호의3 가목 1) : 신용공여의 종류ㆍ기간ㆍ금액ㆍ금리ㆍ한도 → 거래내용 판단정보
 *   - 법 제2조 제1호의5 가목    : 개인의 직업ㆍ재산ㆍ채무ㆍ소득의 총액 및 납세실적 → 신용거래능력 판단정보
 *
 * 중복 규정이 아니라 관점의 차이다. 전자는 **거래 이력**, 후자는 **상환 능력**을 본다.
 * 따라서 어느 쪽이 맞다고 코드가 정할 수 없다. 보정 규칙(BASE_INFO_KEYWORD_RULES)에
 * 넣지 않고, 화면에서 두 근거를 모두 보여준 뒤 사용자가 고르게 한다.
 * 분류는 정정 요구의 근거가 되므로 최종 판단은 사용자 몫이다.
 *
 * ※ 표시 전용이다. 판정 로직(api/interpret.js 의 가드)은 이 상수를 쓰지 않는다.
 */
export const AMBIGUOUS_CATEGORY_ITEMS = {
  /** 어느 쪽으로도 볼 수 있는 항목을 알아보는 말 (항목 이름만 본다) */
  keywords: [
    '대출 잔액',
    '대출잔액',
    '대출 건수',
    '대출건수',
    '카드 이용액',
    '카드이용액',
    '할부 잔액',
    '리스 잔액',
    '채무 잔액',
    '한도',
  ],
  candidates: [
    {
      categoryId: 'transaction',
      basis: '법 제2조 제1호의3 가목 1)',
      perspective: '거래 이력으로 보는 관점',
    },
    {
      categoryId: 'capacity',
      basis: '법 제2조 제1호의5 가목',
      perspective: '상환 능력으로 보는 관점',
    },
  ],
  notice:
    '이 항목은 거래내용 판단정보(법 제2조 제1호의3 가목 1))와 ' +
    '신용거래능력 판단정보(법 제2조 제1호의5 가목)에 모두 해당할 수 있습니다. ' +
    '정정을 요구하실 내용에 맞는 쪽을 선택하세요.',
}

/** 항목 이름이 겹치는 항목인지 (표시 전용) */
export function isAmbiguousCategoryItem(name) {
  const n = String(name ?? '')
  return AMBIGUOUS_CATEGORY_ITEMS.keywords.some((k) => n.includes(k))
}

export const BASE_INFO_KEYWORD_RULES = [
  {
    categoryId: 'creditworthiness',
    // 법 제2조 제1호의4 — 채무 불이행, 대위변제, 명의도용
    basis: '법 제2조 제1호의4',
    keywords: ['채무 불이행', '채무불이행', '연체', '대위변제', '명의도용', '명의 도용'],
  },
  {
    categoryId: 'capacity',
    // 법 제2조 제1호의5 — 개인의 직업ㆍ재산ㆍ채무ㆍ소득의 총액 및 납세실적
    // 건강보험 납부실적은 서식 2(정정·삭제 요구서)가 든 예시다.
    basis: '법 제2조 제1호의5',
    keywords: ['직업', '재산', '채무', '소득', '납세', '건강보험'],
  },
  {
    categoryId: 'identity',
    // 법 제2조 제1호의2 — 성명, 주소, 전화번호, 개인식별번호, 생체정보
    basis: '법 제2조 제1호의2',
    keywords: ['성명', '주소', '전화번호', '생년월일', '개인식별번호', '생체'],
  },
]

/**
 * R3(유리한 정보 제출)의 법적 범주.
 * 법이 정한 "신용거래능력 판단정보"(법 제2조 제1호의5) 안에서만 후보를 제시한다.
 *
 * ★ /strategy 의 LLM 프롬프트 가드로 쓴다.
 *   범주 밖 제안(예: 성격, 학력)은 걸러낸다.
 */
export const R3_SCOPE = {
  rightId: 'R3',
  rightBasis: '법 제36조의2 제2항 제1호',
  categoryId: 'capacity',
  categoryLabel: '신용거래능력 판단정보',
  definitionBasis: '법 제2조 제1호의5',
  definition: '개인의 직업ㆍ재산ㆍ채무ㆍ소득의 총액 및 납세실적',
  /**
   * 서식 2 [섹션 3]에 실린 예시. 이 결을 따른다.
   * ★ 원문 그대로다(2026-08-30 원본 대조). 작은따옴표는 U+2019, 물결은 U+223C 다.
   *   ASCII 의 ' 나 ~ 로 바꾸지 마라. 서식의 예시 행이 이 값을 그대로 인쇄한다.
   */
  formExample: {
    infoName: '건강보험 납부실적',
    detail: '’xx년 x월 x일∼’◊◊년 ◊월 ◊일까지 연체없이 납부',
  },
  /** 출력 형식: 정보명 / 세부 내용(기간·실적을 구체적 수치로) */
  outputShape: ['정보명', '세부 내용 (기간·실적을 구체적 수치로)'],
  outOfScopeNote:
    '위 정의(직업·재산·채무·소득의 총액·납세실적) 밖의 항목은 제안하지 않는다. ' +
    '예: 성격, 학력.',
  /**
   * 범주 밖이 명백한 표현. 서버에서 후보를 버리는 데 쓴다.
   * 신용거래능력 판단정보(법 제2조 제1호의5)의 정의에 포함될 수 없는 것들이다.
   */
  deniedTerms: [
    '성격', '인성', '성실성', '태도', '의지', '노력', '평판', '인맥', '인간관계',
    '학력', '학벌', '출신학교', '전공',
    '가족관계', '혼인', '종교', '정치', '성별', '나이', '연령', '외모', '건강상태', '병력',
  ],
  /**
   * 선정이유(사용자 서술의 어느 대목 때문에 골랐는지)에서 근거로 삼을 수 없는 표현.
   *
   * ★ deniedTerms 와 따로 둔다. deniedTerms 는 "제안 항목"을 거르는 목록이라
   *   여기에 '성실'을 넣으면 '성실상환 이력' 같은 정당한 항목까지 사라진다.
   *   반대로 선정이유에 "성실해 보이셔서"가 오면 그건 법정 범주 밖의 근거이므로
   *   그 항목을 통째로 버린다. (직업·재산·채무·소득·납세실적이 아닌 것을 근거로 삼았다)
   */
  reasonDeniedTerms: [
    '성실해', '성실하', '성실히', '착실', '열심', '노력하', '의지가', '인상',
    '느낌', '보이셔서', '보여서', '딱해', '안타까', '불쌍', '사람됨', '됨됨이',
  ],
  /** 최대 후보 수 */
  maxCandidates: 5,
}

/**
 * ★★ 정정 요청 상대방 라우팅 규칙 — 이 서비스의 실질 가치.
 * 근거: 서식 2 [섹션 1] 제도 안내문 (고정 문구)
 *
 * 정정 대상 정보의 **출처**에 따라 요청 상대방이 달라진다.
 * 사용자는 이 판단을 스스로 할 수 없으므로 서비스가 분기를 물어봐야 한다.
 *
 * unknown 분기에서는 **서식 1(R2)이 서식 2의 선행 단계가 된다.**
 * steps 배열이 "먼저 A, 답변 후 B" 순서를 데이터로 표현한다.
 */
export const CORRECTION_ROUTING = {
  basis: '고시 서식 「기초정보 정정·삭제 및 자동화평가 재산출 요청서」 [섹션 1]',
  /** 원문. 문구 수정 금지. */
  ruleText:
    '다만 해당 기초정보가 당사가 직접 수집한 정보가 아니라 신용정보집중기관 또는 ' +
    '개인신용평가회사, 개인사업자신용평가회사 또는 기업신용조회회사로부터 수집한 ' +
    '타 금융회사의 정보인 경우에는 해당 금융회사에 정정·삭제를 요청하여야 합니다.',
  /**
   * ★ 묻는 방식만 바꿨다. 판정은 그대로다. (2026-08-31 사용자 지적)
   *   앞선 질문은 "정정하려는 정보는 어디에서 만들어진 것인가요?"였다.
   *   법조문(“당사가 직접 수집한 정보가 아니라 … 타 금융회사의 정보인 경우”)의
   *   말을 그대로 옮긴 것이라, 받은 사람의 반응이 "이게 무슨 소리지"였다.
   *   사용자는 "정보의 출처"를 생각해 본 적이 없다. 아는 것은
   *   **"내가 그 회사와 거래한 적이 있나"** 정도다. 그래서 그 하나만 묻는다.
   *   갈래(own/other/unknown)와 제출처 판정은 하나도 바뀌지 않았다.
   */
  question: '고치려는 내용이 이 회사와의 거래에서 생긴 것인가요?',
  /** 질문 아래 한 줄. 왜 이걸 묻는지 */
  questionWhy: '답에 따라 요청서를 낼 회사가 달라집니다. 상대를 잘못 고르면 요청이 반려됩니다.',
  branches: [
    {
      id: 'own',
      label: '예 — 이 회사와 거래하면서 생긴 기록입니다',
      /** 그림 상자용 두 줄. 화면의 선택지 문구와 같은 말이되 짧게 끊는다. */
      chartLabel: ['예 — 이 회사와', '거래하면서 생긴 기록'],
      /** ★ 예시가 없으면 사용자는 자기 경우가 어디에 드는지 못 고른다 */
      example: '이 회사에서 받은 대출의 연체 기록, 이 회사 카드의 결제·한도 기록처럼 이 회사와 주고받으며 생긴 것',
      /** 지금 상대하고 있는 그 금융회사 */
      submitTo: 'thisInstitution',
      submitToLabel: '이 회사에 제출',
      requiresPrecedingStep: false,
      steps: [
        {
          order: 1,
          formId: 'correctionRequest',
          rights: ['R3', 'R4', 'R5'],
          description: '이 회사에 서식 2를 제출합니다.',
        },
      ],
    },
    {
      id: 'other',
      label: '아니요 — 다른 회사와 거래하면서 생긴 기록입니다',
      chartLabel: ['아니요 — 다른 회사와', '거래하면서 생긴 기록'],
      example: '다른 은행의 대출 기록, 다른 카드사의 연체 기록처럼 이 회사가 아닌 곳에서 생긴 것',
      /** 정보가 발생한 원 금융회사 */
      submitTo: 'originatingInstitution',
      submitToLabel: '정보가 발생한 그 금융회사에 제출',
      requiresPrecedingStep: false,
      /**
       * 수신처가 지금 상대하는 회사와 달라지므로 서식 2에 "수신 기관"을 따로 받아야 한다.
       * 서식 원문에는 없는 칸이다. /document 에서 서식 상단 입력란으로 구현한다.
       */
      requiresRecipientInput: true,
      note:
        '지금 거절한 회사가 아니라, 그 정보가 만들어진 금융회사에 제출해야 합니다. ' +
        '상대를 잘못 고르면 요청이 반려됩니다.',
      steps: [
        {
          order: 1,
          formId: 'correctionRequest',
          rights: ['R3', 'R4', 'R5'],
          description: '정보가 발생한 금융회사에 서식 2를 제출합니다.',
        },
      ],
    },
    {
      id: 'unknown',
      label: '모르겠습니다',
      chartLabel: ['모르겠습니다'],
      example: '어느 회사에서 생긴 기록인지 짚이지 않거나, 여러 곳의 기록이 섞여 있는 경우',
      submitTo: null,
      submitToLabel: '먼저 출처를 확인해야 합니다',
      /** ★ 서식 1이 서식 2의 선행 단계가 되는 경로 */
      requiresPrecedingStep: true,
      steps: [
        {
          order: 1,
          formId: 'explanationRequest',
          rights: ['R2'],
          /** 서식 1의 ③ 기초정보의 개요 항목만 선택하면 된다 */
          requestItemIds: ['baseInfo'],
          description:
            '먼저 서식 1로 기초정보의 개요 설명을 요구해 그 정보의 출처를 확인합니다.',
        },
        {
          order: 2,
          formId: 'correctionRequest',
          rights: ['R3', 'R4', 'R5'],
          dependsOnStep: 1,
          description:
            '답변으로 출처가 확인되면 정보의 출처에 따라 어느 쪽인지 다시 판단해 서식 2를 제출합니다.',
        },
      ],
    },
  ],
}

export const CORRECTION_ROUTING_BY_ID = Object.fromEntries(
  CORRECTION_ROUTING.branches.map((b) => [b.id, b]),
)

/**
 * 서식 2 — 「기초정보 정정·삭제 및 자동화평가 재산출 요청서」
 * 대응 권리: R3, R4, R5 (법 제36조의2 제2항)
 * 명세: docs/law/form-spec-2.md
 *
 * ★ **서식 2 한 장이 제2항 권리 3종을 모두 담는다.** 서식을 3개 만들지 않는다.
 *   섹션 단위 on/off 로 어떤 권리를 행사할지 정한다.
 *   서식 [섹션 3]에 "해당 사항이 없는 경우 본란 삭제"가 명시되어 있으므로
 *   섹션을 켜고 끄는 UI는 서식의 취지에 부합한다.
 *
 * 시행령 제31조의2 제6항이 법 제36조의2 제1항 및 제2항의 권리를 모두
 * 고시 서식 대상으로 규정하므로, 자체 양식 대안은 여전히 성립하지 않는다.
 */
export const FORM_CORRECTION_REQUEST = {
  id: 'correctionRequest',
  title: '기초정보 정정ㆍ삭제 및 자동화평가 재산출 요청서',
  /** 좁은 자리(그림 상자 등)에서 쓰는 줄임 이름 */
  shortTitle: '정정ㆍ재산출 요청서',
  subtitle: null,
  basis: '신용정보법 시행령 제31조의2 제6항 (금융위원회가 정하여 고시하는 서식)',
  coveredRights: ['R3', 'R4', 'R5'],
  available: true,
  /** 한 장으로 R3+R4+R5 를 모두 처리한다 */
  singleSheet: true,

  /**
   * ⚠️ 출처 주의 — 이 명세는 HB저축은행 공개본 기준이다.
   * 금융위 고시 별지 서식의 정본과 기관별 변형본 사이에 차이가 있을 수 있으나,
   * 복수 기관이 동일한 명칭·구조로 비치하고 있어 실무 표준으로 취급한다.
   */
  source: 'HB저축은행 공개본 (고객용)',
  sourceCaveat:
    '금융위 고시 별지 서식의 정본과 기관별 변형본 사이에 차이가 있을 수 있다. ' +
    '복수 기관이 동일한 명칭·구조로 비치하고 있어 실무 표준으로 취급한다.',
  /** 화면에 그대로 보이는 문장 (sourceCaveat 는 개발자용 주석에 가깝다) */
  sourceNote:
    '금융위원회 고시 별지 서식을 금융회사가 각자 비치합니다. 여러 기관이 같은 명칭과 구조로 ' +
    '비치하고 있어 실무 표준으로 다룹니다.',

  /** 서식 1과의 차이 — 개인정보 최소화 (docs/law/form-spec-2.md §서식 1과의 차이) */
  collectsResidentNumber: false,
  hasCreditInfoConsent: false,
  /** 인적사항은 성명만 (서식 1과 달리 주민등록번호·연락처 칸이 없다) */
  applicantFields: [{ id: 'applicantName', label: '신청자 성명', type: 'text', required: true }],

  sections: [
    {
      id: 's1',
      order: 1,
      title: '제도 안내',
      /** 고정 문구. 사용자 입력 없음. 문구 수정 금지. */
      fixed: true,
      verbatim: true,
      toggleable: false,
      right: null,
      basis: null,
      /**
       * 섹션 1 원문 전문 (2026-08-23 확보, 2026-08-30 원본 대조 완료). 문구 수정 금지.
       * "저축은행" 2회는 substitution 규칙에 따라 업권 shortLabel 로 치환한다.
       * "당사"는 서식 발행 주체를 가리키므로 치환하지 않는다.
       */
      verbatimText:
        '저축은행은 고객의 요청에 따라 자동화평가 결과, 자동화평가의 주요 기준 및 ' +
        '자동화평가에 이용된 기초정보의 개요를 설명하고 있으며, 기초정보가 정확하지 않은 ' +
        '경우 해당 정보에 대한 정정ㆍ삭제 및 수정된 정보를 활용하여 자동화평가 결과를 ' +
        '재산출하여 줄 것을 저축은행에 요청할 수 있습니다. 다만, 해당 기초정보가 당사가 ' +
        '직접 수집한 정보가 아니라 신용정보집중기관 또는 개인신용평가회사, ' +
        '개인사업자신용평가회사 또는 기업신용조회회사로부터 수집한 타 금융회사의 정보인 ' +
        '경우에는 해당 금융회사에 정정ㆍ삭제를 요청하여야 합니다.',
      /**
       * 원본 대조 완료 여부. false 인 동안 화면에 "원본 대조 전" 경고를 띄운다.
       * 2026-08-30 PDF 를 레이아웃 보존 방식으로 재추출해 원문과 대조했다.
       * 이때 섹션 3 헤더 어순, 섹션 4 쉼표, 예시 행 문장부호, "신용거래능력판단정보"
       * 붙여쓰기, 붙임·서명란 공백 다섯 군데를 교정했다.
       */
      verbatimVerified: true,
      summary: [
        '금융회사는 고객 요청에 따라 자동화평가 결과, 주요 기준, 기초정보의 개요를 설명한다.',
        '기초정보가 정확하지 않은 경우 정정·삭제 및 수정된 정보를 활용한 재산출을 요청할 수 있다.',
      ],
      /** 이 섹션이 CORRECTION_ROUTING 의 근거 조항이다 */
      routingRuleRef: 'CORRECTION_ROUTING',
      /**
       * 원문의 기관명 표현만 **기관 중립적으로 치환**해서 렌더링한다.
       * 나머지 문구는 수정하지 않는다.
       */
      neutralizeInstitutionName: true,
      substitution: {
        /** 치환 대상은 이 문자열뿐이다. 섹션 1에 2회, 섹션 2 리드에 2회, 총 4곳. */
        targets: ['저축은행'],
        /**
         * 업권 라벨 전체가 아니라 INSTITUTION_SECTORS[].shortLabel 을 넣는다.
         * ⚠️ other 분기의 "수신 기관" 입력값은 쓰지 않는다.
         *    서식 원문의 그 자리는 회사명이 아니라 업권명 자리다.
         */
        useShortLabel: true,
        /** 업권 선택이 없을 때의 기본값 */
        fallbackLabel: '금융회사',
        /** ★ "당사"는 치환하지 않는다. 서식 발행 주체를 가리키는 표현이다. */
        doNotSubstitute: ['당사'],
        /**
         * 치환된 기관명 **바로 뒤에 붙은 조사만** 받침에 맞게 고친다.
         * 원문이 "저축은행은"(받침 있음)이라 "카드사은"처럼 깨지기 때문이다.
         * 조사 외의 문구는 일절 건드리지 않는다.
         * 끄려면 false 로 두면 된다 — 그 경우 원문 조사가 그대로 남는다.
         */
        adjustParticles: true,
      },
    },
    {
      id: 's2',
      order: 2,
      title: '기초정보 정정·삭제 요구',
      right: 'R4',
      basis: '법 제36조의2 제2항 제2호 가목',
      toggleable: true,
      /**
       * 리드 문장. 밑줄이 사용자 입력(신청자 성명). 문구 수정 금지.
       * 화면에서 문자열을 잘라 쓰지 않도록 자리표시자 앞뒤를 미리 나눠 둔다.
       */
      leadPlaceholder: '______(신청자 성명)______',
      /** "저축은행" 2회는 substitution 규칙에 따라 치환한다. */
      leadRest:
        ' 은(는) 기초정보 정정ㆍ삭제 및 자동화평가 결과 재산출과 관련하여 귀 저축은행의 ' +
        '상기 설명을 읽고 이해하였으며, 저축은행이 보유하고 있는 본인의 기초정보 중 ' +
        '정확하지 않거나 최신의 정보가 아닌 내용이 있어 아래와 같이 정정 및 삭제를 ' +
        '요구합니다.',
      /** 이 섹션도 기관명 치환 대상이다 */
      neutralizeInstitutionName: true,
      table: {
        columns: [
          { id: 'category', label: '구 분' },
          { id: 'current', label: '현행 정보' },
          { id: 'correction', label: '정정 또는 삭제 내용' },
        ],
        /** "구 분" 행은 5종 고정. 해당 없는 분류는 비워둔다. */
        rowsRef: 'BASE_INFO_CATEGORIES',
        rowsOptional: true,
      },
    },
    {
      id: 's3',
      order: 3,
      title: '유리한 정보 제출',
      right: 'R3',
      basis: '법 제36조의2 제2항 제1호',
      toggleable: true,
      /** 헤더 고정 문구. 문구 수정 금지. */
      headerText:
        '다음과 같이 자동화평가 결과의 산출에 유리하다고 판단되는 정보를 제출합니다.',
      headerNote: '(해당 사항이 없는 경우 본란 삭제)',
      table: {
        columns: [
          { id: 'infoName', label: '정보명' },
          { id: 'detail', label: '세부 내용' },
        ],
        /**
         * 서식에 실린 예시 행. R3의 성격(비금융 정보로 신용 보강)을 규정한다.
         * ★ 문자열을 여기 다시 적지 않는다. R3_SCOPE.formExample 이 원문 단일 출처다.
         */
        example: R3_SCOPE.formExample,
      },
      /** /strategy 의 LLM 출력이 이 섹션으로 흘러 들어간다 */
      filledBy: 'strategy',
    },
    {
      id: 's4',
      order: 4,
      title: '재산출 요구',
      right: 'R5',
      basis: '법 제36조의2 제2항 제2호 나목',
      toggleable: true,
      /** 고정 문구. 사용자 입력 없음. 체크 여부만 결정. */
      fixedText:
        '상기 오류정보를 정정 또는 삭제하고, 수정된 정보를 활용하여 ' +
        '본인에 대한 개인신용평가 결과를 재산출하여 줄 것을 요구합니다.',
      userInput: false,
      /**
       * 섹션 4는 섹션 2에 의존한다.
       * 정정할 내용이 없으면 재산출 요구도 성립하지 않는다.
       */
      dependsOn: {
        sectionId: 's2',
        condition: 'nonEmpty',
        message: '정정·삭제할 기초정보를 먼저 입력해야 재산출을 요구할 수 있습니다.',
      },
    },
  ],

  /** 붙임 — 파일 첨부가 아니라 "무엇을 함께 내야 하는지" 안내로 처리한다 */
  attachment: {
    label: '붙 임 : 증빙자료',
    guidanceOnly: true,
    rationale:
      '법 제36조의2 제2항 제2호의 전제가 "정확하지 아니하거나 최신의 정보가 아니라고 ' +
      '판단되는 경우"이므로, 그 판단의 근거 자료를 붙이는 것이 실효성을 높인다.',
  },

  /**
   * 서명란 — 날짜는 자동 채움 가능, 서명은 반드시 공란.
   * signatureMark 는 이 서식의 원문 표기다(2026-08-30 원본 대조). 공백까지 원문 그대로다.
   * 서식 1은 원본 대조를 하지 않았으므로 공용 FORM_SIGNATURE_TEXTS 를 그대로 쓴다.
   */
  signature: { dateAutoFill: true, signatureBlank: true, signatureMark: '(서명 / 인)' },

  /** 자체 양식 대체가 불가한 이유 (시행령 제31조의2 제6항) — 서식 확보 후에도 유효 */
  noSubstituteReason:
    '시행령 제31조의2 제6항은 법 제36조의2 제1항 및 제2항의 권리를 모두 ' +
    '금융위원회가 정하여 고시하는 서식에 따라 행사하도록 규정하므로, ' +
    '자체 양식으로는 요건을 충족하지 못한다.',
}

/** 권리 id → 해당 권리를 담는 서식 */
export const FORM_BY_RIGHT = {
  R1: FORM_EXPLANATION_REQUEST.id,
  R2: FORM_EXPLANATION_REQUEST.id,
  R3: FORM_CORRECTION_REQUEST.id,
  R4: FORM_CORRECTION_REQUEST.id,
  R5: FORM_CORRECTION_REQUEST.id,
}

export const FORMS = [FORM_EXPLANATION_REQUEST, FORM_CORRECTION_REQUEST]

export const FORMS_BY_ID = Object.fromEntries(FORMS.map((f) => [f.id, f]))
