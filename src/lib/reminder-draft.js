/**
 * 회신 재요청(재촉) 문안 생성.
 *
 * ── 규칙 ────────────────────────────────────────────────────────
 * 1. 본문의 법령 문구는 전부 src/data/law.js 상수를 참조한다. 하드코딩 금지.
 * 2. **기한을 만들지 않는다.** 법률에도 시행령에도 처리 기한 규정이 없다.
 *    "○일이 지났으므로 위법입니다" 같은 문장은 쓰지 않는다. 근거가 없다.
 *    쓸 수 있는 것은 "제출한 지 ○일이 지났다"는 사실과 회신 의무 조문뿐이다.
 * 3. 반복 행사 제한(시행령 제31조의2 제5항 제2호)을 사용자에게 함께 알린다.
 *    재요청이 반복으로 계산될지는 법령에 정해져 있지 않다. 단정하지 않는다.
 *    대신 "앞선 요구에 회신을 받지 못했다"는 사실을 본문에 남긴다 —
 *    그 조항의 요건이 "정당한 사유 없이"이기 때문이다.
 * ────────────────────────────────────────────────────────────────
 */
import { LAW_META, RESPONSE_DUTY, REFUSAL_GROUNDS, FORMS_BY_ID } from '../data/law.js'

/** 반복 행사 제한 조항 (D4) — 화면과 문안이 같은 상수를 본다 */
export const REPEAT_LIMIT = REFUSAL_GROUNDS.find((g) => g.id === 'D4')

/**
 * @param {Object} input
 * @param {string} input.formId
 * @param {{name?: string}} input.personal
 * @param {string} [input.submittedAt]  제출일 (YYYY-MM-DD) — 없으면 자리표시자
 * @param {number|null} [input.days]    제출한 지 지난 날 수 (사실만 적는다)
 * @param {string} [input.recipientOrg]
 * @returns {{subject: string, body: string}}
 */
export function buildReminderDraft({
  formId,
  personal = {},
  submittedAt = '',
  days = null,
  recipientOrg = '',
}) {
  const form = FORMS_BY_ID[formId] ?? Object.values(FORMS_BY_ID)[0]
  const name = (personal.name ?? '').trim() || '(성명)'
  const org = (recipientOrg ?? '').trim() || '(회사명)'
  const when = (submittedAt ?? '').trim() || '(제출일)'

  const subject = `[회신 요청] ${form.title} — ${name}`

  const L = []
  L.push(`${org} 담당자님께,`)
  L.push('')
  L.push(
    `${when}에 「${form.title}」을(를) 제출한 ${name}입니다.` +
      (days != null ? ` 제출한 지 ${days}일이 지났습니다.` : ''),
  )
  L.push('아직 회신을 받지 못하여 처리 상황을 문의드립니다.')
  L.push('')
  L.push(`${LAW_META.decree.name} ${RESPONSE_DUTY.basis}은 다음과 같이 정하고 있습니다.`)
  L.push(`  "${RESPONSE_DUTY.text}"`)
  L.push('')
  L.push('위 규정에 따라 처리 결과를 회신하여 주시기 바랍니다.')
  L.push('이미 회신을 보내셨다면 발송 일자와 방법을 알려 주시면 확인하겠습니다.')
  L.push('')
  L.push('※ 이 문의는 새로운 요구가 아니라, 위 제출 건에 대한 회신을 기다리는 중임을 알리는 것입니다.')
  L.push('')
  L.push(`${name} 드림`)

  return { subject, body: L.join('\n') }
}
