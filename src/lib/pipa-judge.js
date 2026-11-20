/**
 * 개인정보 보호법 제37조의2 — 어떤 권리를 쓸 수 있는가 (확장 범위, 2026-11-20)
 *
 * ★ 이 함수가 권리 유무를 정하는 **유일한** 곳이다. AI 응답은 여기에 끼어들지 않는다.
 *   조문 문장은 src/data/law.js 의 PIPA_JUDGE_NOTES 에만 있고, 여기서는 고르기만 한다.
 *
 * 판정 규칙 (원문 2026-11-20)
 *   거부   제37조의2 제1항 — 완전히 자동화된 결정 + 권리·의무에 중대한 영향
 *          단, 제15조제1항제1호(동의)·제2호(법률)·제4호(계약)에 따른 결정이면 안 된다
 *   설명   제37조의2 제2항 — 자동화된 결정이면 된다 (중대한 영향 요건 없음)
 *          중대하지 않으면 기관은 공개한 기준으로 갈음할 수 있다 (시행령 제44조의3 제2항 단서)
 *   검토   시행령 제44조의2 제2항 제2호 — 설명과 같은 조건
 *
 * 「모르겠어요」는 불리하게 읽지 않는다. 모르는 요건은 요구서에서 기관에 묻게 하고,
 * 그 요건이 충족됐을 때 쓸 수 있는 권리까지 함께 적는다.
 */
import { PIPA_JUDGE_NOTES } from '../data/law.js'

/**
 * @param {{auto?: string, big?: string, basis?: string}} a
 *   auto  'no' | 'unk' | 'yes'           사람이 직접 검토했나
 *   big   'yes' | 'unk' | 'no'           중대한 영향이 있었나
 *   basis 'unk' | 'consent' | 'contract' | 'law'
 * @returns {{
 *   complete: boolean,       세 질문(사람이 판단했으면 하나)에 다 답했나
 *   applies: boolean,        제37조의2 권리가 생기나
 *   refuse: boolean, explain: boolean, review: boolean,
 *   askAutomated: boolean,   요구서에서 자동화 여부부터 물을지
 *   notes: {id: string, text: string, basis: string}[]
 * }}
 */
export function judgePipa(a = {}) {
  const note = (id) => ({ id, ...PIPA_JUDGE_NOTES[id] })
  const r = {
    complete: false,
    applies: false,
    refuse: false,
    explain: false,
    review: false,
    askAutomated: false,
    notes: [],
  }

  if (a.auto === 'yes') {
    r.complete = true
    r.notes.push(note('humanInvolved'))
    return r
  }
  if (!a.auto || !a.big || !a.basis) return r

  r.complete = true
  r.applies = true
  r.explain = true
  r.review = true
  r.askAutomated = a.auto === 'unk'
  if (r.askAutomated) r.notes.push(note('autoUnknown'))

  const basisAllowsRefusal = a.basis === 'unk'
  const impactAllowsRefusal = a.big === 'yes' || a.big === 'unk'
  r.refuse = basisAllowsRefusal && impactAllowsRefusal

  if (!basisAllowsRefusal) r.notes.push(note('basisExcludesRefusal'))
  if (a.big === 'no') r.notes.push(note('minorImpact'))
  if (r.refuse && (a.big === 'unk' || a.basis === 'unk')) r.notes.push(note('refuseUncertain'))
  if (r.refuse) r.notes.push(note('refuseProcedure'))
  return r
}

/**
 * 회신 점검 — 법정 설명 4항목 중 무엇이 빠졌나, 기한은 어떤가.
 * ★ 항목이 「있다」는 판단의 최종 결정권은 사람(체크박스)에게 있다.
 *   AI 는 체크를 미리 해 줄 뿐이고, 그 체크도 원문 인용이 확인된 것만이다.
 *
 * @param {Record<string, boolean>} present  항목 id → 들어 있나
 * @param {'in'|'ext'|'none'|null} timing
 * @param {string[]} itemIds  법정 항목 id 순서
 */
export function checkReply(present = {}, timing = null, itemIds = []) {
  const missing = itemIds.filter((id) => !present[id])
  return {
    missing,
    complete: missing.length === 0,
    overdue: timing === 'none',
    extended: timing === 'ext',
  }
}
