/**
 * 용어 풀이.
 *
 * ── 이 파일의 규칙 ──────────────────────────────────────────────
 * 1. **법조문 원문을 여기에 복사하지 않는다.** 법조문 텍스트는 src/data/law.js
 *    한 곳에만 존재한다. 원문이 필요하면 law.js 의 상수를 import 해서 참조한다.
 *    (CLAUDE.md 작업 원칙 — "법조문 텍스트는 src/data/law.js 한 곳에만 두고,
 *     어디서도 하드코딩 중복하지 않는다")
 * 2. plain(쉬운 말 풀이)은 **법령 정의를 옮긴 것**이어야 한다. 창작하지 않는다.
 *    각 항목에 어느 조문을 근거로 옮겼는지 basis 로 남긴다.
 * 3. 정의 조문이 이 프로젝트의 법령 문서(docs/law/)에 없는 용어는
 *    unverifiedNote 로 "어느 법 몇 조에 정의가 있는지"만 알리고,
 *    확인하지 않았다는 사실을 숨기지 않는다. (TODO 처리 원칙과 같다)
 * ────────────────────────────────────────────────────────────────
 *
 * 왜 필요한가:
 *   주 사용자는 금융이력 부족자다. 권리가 있어도 "자동화평가", "기초정보",
 *   "신용정보제공·이용자" 같은 말에서 막혀 행사하지 못한다.
 *   용어 장벽을 낮추는 것이 이 서비스의 실질적인 기능이다.
 */
import {
  DEFINITION_AUTOMATED_EVALUATION,
  DEFINITION_EVALUATOR,
  COUNTERPARTY_TYPES_BY_ID,
  RIGHTS_BY_ID,
  EXPLANATION_METHODS,
  EXERCISE_FORM_REQUIREMENT,
  BASE_INFO_CATEGORIES_BY_ID,
  FSC_ACT_ARTICLE_38_CLAUSES,
} from './law.js'

const method = (id) => EXPLANATION_METHODS.find((m) => m.id === id)

/**
 * @typedef {Object} GlossaryEntry
 * @property {string} id
 * @property {string} term            화면에 나타나는 표기
 * @property {string[]} [aliases]     같은 뜻으로 쓰이는 다른 표기
 * @property {string} plain           쉬운 말 풀이 (법령 정의를 옮긴 것)
 * @property {string} basis           풀이의 근거 조문
 * @property {string|null} statutory  법령 원문 (law.js 참조. 여기서 만들지 않는다)
 * @property {string} [unverifiedNote] 정의 조문을 직접 확인하지 못한 경우의 고지
 */

/** @type {GlossaryEntry[]} */
export const GLOSSARY = [
  {
    id: 'automatedEvaluation',
    term: '자동화평가',
    plain:
      '사람이 손대지 않고 컴퓨터만으로 매긴 평가입니다. 심사역이 서류를 보고 판단한 것이 ' +
      '아니라, 프로그램이 정보를 넣고 돌려서 결과를 낸 경우를 말합니다.',
    basis: DEFINITION_AUTOMATED_EVALUATION.basis,
    statutory: DEFINITION_AUTOMATED_EVALUATION.text,
    extra:
      '핵심은 "종사자가 평가 업무에 관여하지 아니하고"입니다. 사람이 개입한 심사라면 ' +
      '자동화평가가 아니어서 이 권리의 대상이 아닐 수 있습니다.',
  },
  {
    id: 'evaluator',
    term: '개인신용평가회사등',
    plain:
      '이 권리를 행사할 상대방입니다. 신용평점을 매기는 회사(CB사)와, 법이 정한 목록에 ' +
      '해당하는 금융회사를 함께 부르는 말입니다.',
    basis: DEFINITION_EVALUATOR.basis,
    statutory: DEFINITION_EVALUATOR.text,
  },
  {
    id: 'creditBureau',
    term: '개인신용평가회사',
    aliases: ['CB사'],
    plain:
      '개인의 신용점수·신용등급을 매기는 회사입니다. 금융회사가 아니라 이 회사가 만든 ' +
      '점수를 근거로 대출이 거절되는 경우가 많으므로, 금융회사와 별도로 이 회사에도 ' +
      '설명을 요구할 수 있습니다.',
    basis: COUNTERPARTY_TYPES_BY_ID.CB.basis,
    statutory: null,
    extra: COUNTERPARTY_TYPES_BY_ID.CB.description,
  },
  {
    id: 'creditInfoUser',
    term: '신용정보제공·이용자',
    plain:
      '고객의 신용정보를 받아서 쓰는 사업자를 말합니다. 이 권리에서는 아무나가 아니라 ' +
      '「금융위원회의 설치 등에 관한 법률」 제38조 각 호에 적힌 금융회사만 상대방이 됩니다. ' +
      `현재 그 목록은 ${FSC_ACT_ARTICLE_38_CLAUSES.length}개 호로 되어 있습니다.`,
    basis: COUNTERPARTY_TYPES_BY_ID.FI.basisChain,
    statutory: null,
    extra: COUNTERPARTY_TYPES_BY_ID.FI.description,
  },
  {
    id: 'baseInfo',
    term: '기초정보',
    plain:
      '자동화평가를 돌릴 때 재료로 들어간 내 정보입니다. 소득, 직업, 연체 이력, 대출 잔액 ' +
      '같은 것들입니다. 이 재료가 틀렸다면 결과도 틀린 것이므로, 고쳐 달라고 요구할 수 ' +
      '있습니다.',
    basis: RIGHTS_BY_ID.R4.basis,
    statutory: null,
    extra:
      '어떤 정보가 들어갔는지는 "기초정보의 개요"를 설명해 달라고 요구하면 알 수 있습니다.',
  },
  {
    id: 'baseInfoSummary',
    term: '기초정보의 개요',
    plain:
      '평가에 쓰인 정보의 목록을 알려주는 것입니다. 다만 금융회사가 밖에서 직접 받아온 ' +
      '정보만 해당하고, 그 정보를 회사가 스스로 가공하거나 추론해 만든 값은 빠질 수 ' +
      '있습니다.',
    basis: method('baseInfo').basis,
    statutory: method('baseInfo').text,
    extra: method('baseInfo').proviso,
  },
  {
    id: 'criteria',
    term: '자동화평가의 주요 기준',
    plain:
      '무엇을 얼마나 중요하게 봤는지입니다. 보통 "신용정보 종류별 반영 비중"(예: 신용도 ' +
      '판단정보 35%) 형태로 안내됩니다. 계산식 자체를 받는 것은 아닙니다.',
    basis: method('criteria').basis,
    statutory: method('criteria').text,
  },
  {
    id: 'recompute',
    term: '재산출',
    plain:
      '틀린 정보를 고친 뒤에 평가를 다시 돌려 달라고 요구하는 것입니다. 정보만 고치고 ' +
      '점수를 그대로 두면 의미가 없기 때문에, 법이 정정 요구와 함께 규정하고 있습니다.',
    basis: RIGHTS_BY_ID.R5.basis,
    statutory: RIGHTS_BY_ID.R5.summary,
    extra: RIGHTS_BY_ID.R5.requirement,
  },
  {
    id: 'correction',
    term: '정정·삭제',
    plain:
      '틀린 정보를 바로잡거나 지워 달라고 요구하는 것입니다. "정확하지 않거나 최신이 ' +
      '아니라고 판단되는 경우"에 요구할 수 있습니다.',
    basis: RIGHTS_BY_ID.R4.basis,
    statutory: RIGHTS_BY_ID.R4.summary,
  },
  {
    id: 'favorableInfo',
    term: '유리하다고 판단되는 정보',
    plain:
      '내 상환 능력을 보여주는데 평가에는 빠져 있던 자료입니다. 재직증명서, 소득금액증명, ' +
      '건강보험 납부내역 같은 것을 스스로 내밀 수 있습니다. 틀린 정보가 없어도 요구할 수 ' +
      '있다는 점이 정정 요구와 다릅니다.',
    basis: RIGHTS_BY_ID.R3.basis,
    statutory: RIGHTS_BY_ID.R3.summary,
    extra: RIGHTS_BY_ID.R3.requirement,
  },
  {
    id: 'capacityInfo',
    term: '신용거래능력 판단정보',
    plain:
      '갚을 능력이 되는지를 보여주는 정보입니다. 법이 직접 "직업, 재산, 채무, 소득의 총액, ' +
      '납세실적"을 들고 있습니다. 유리한 정보로 제출할 수 있는 범위가 바로 여기입니다.',
    basis: BASE_INFO_CATEGORIES_BY_ID.capacity.definitionBasis,
    statutory: null,
    extra: `법이 든 예: ${BASE_INFO_CATEGORIES_BY_ID.capacity.examples.join(', ')}`,
  },
  {
    id: 'creditworthinessInfo',
    term: '신용도 판단정보',
    plain:
      '약속을 지켰는지를 보여주는 정보입니다. 연체, 대위변제, 명의도용 피해 기록 등이 ' +
      '여기 들어갑니다. 명의도용 피해자가 자기 기록을 바로잡는 자리가 이 범주입니다.',
    basis: BASE_INFO_CATEGORIES_BY_ID.creditworthiness.definitionBasis,
    statutory: null,
    extra: `법이 든 예: ${BASE_INFO_CATEGORIES_BY_ID.creditworthiness.examples.join(', ')}`,
  },
  {
    id: 'transactionInfo',
    term: '거래내용 판단정보',
    plain:
      '어떤 거래를 해왔는지를 보여주는 정보입니다. 대출·카드·리스·할부의 종류와 기간, ' +
      '금액, 금리, 한도 등이 여기 들어갑니다.',
    basis: BASE_INFO_CATEGORIES_BY_ID.transaction.definitionBasis,
    statutory: null,
    extra: `법이 든 예: ${BASE_INFO_CATEGORIES_BY_ID.transaction.examples.join(', ')}`,
  },
  {
    id: 'creditExtension',
    term: '신용공여',
    plain:
      '돈을 빌려주거나 그에 준하는 신용을 제공하는 거래입니다. 이 서비스에서 대출 거절, ' +
      '한도 축소, 금리 인상은 대체로 여기에 해당합니다.',
    basis: '법 제2조 제1호의3 가목 1) 및 3)',
    statutory: null,
    unverifiedNote:
      '정의 조문은 은행의 경우 「은행법」 제2조제7호, 금융투자업자의 경우 ' +
      '「자본시장과 금융투자업에 관한 법률」 제72조제1항·제342조제1항에 있습니다. ' +
      '이 서비스는 해당 조문의 원문을 직접 확인하지 않았습니다.',
  },
  {
    id: 'concurrentCreditBusiness',
    term: '겸영여신업자',
    plain:
      '여신전문금융업(카드·할부·리스 등)을 본업이 아니라 겸해서 하는 사업자입니다. ' +
      '은행이 카드업을 함께 하는 경우가 대표적입니다.',
    basis: FSC_ACT_ARTICLE_38_CLAUSES.find((c) => c.clause === 6).basis,
    statutory: null,
    unverifiedNote:
      '정의 조문은 「여신전문금융업법」에 있습니다. 이 서비스는 그 조문의 원문을 직접 ' +
      '확인하지 않았습니다. 이 서비스가 확인한 것은 이 사업자가 금융위원회법 제38조 ' +
      '제6호에 포함된다는 사실까지입니다.',
  },
  {
    id: 'noticedForm',
    term: '고시 서식',
    plain:
      '금융위원회가 정해서 알린 정해진 양식입니다. 직접 만든 편지로는 요건을 채우지 ' +
      '못하므로, 이 서비스는 고시 서식을 그대로 재현해 인쇄해 드립니다.',
    basis: EXERCISE_FORM_REQUIREMENT.basis,
    statutory: EXERCISE_FORM_REQUIREMENT.text,
    extra: EXERCISE_FORM_REQUIREMENT.note,
  },
  {
    id: 'dataSubject',
    term: '신용정보주체',
    plain:
      '그 신용정보가 누구 것인지의 그 사람, 즉 본인입니다. 이 권리는 "개인인 신용정보주체"에게 ' +
      '주어지므로 회사가 아니라 개인이 행사합니다.',
    basis: '법 제36조의2 제1항',
    statutory: null,
  },
]

export const GLOSSARY_BY_ID = Object.fromEntries(GLOSSARY.map((g) => [g.id, g]))

/** 표기(term)와 별칭(aliases)으로도 찾을 수 있게 한다 */
export const GLOSSARY_BY_TERM = Object.fromEntries(
  GLOSSARY.flatMap((g) => [g.term, ...(g.aliases ?? [])].map((t) => [t, g])),
)
