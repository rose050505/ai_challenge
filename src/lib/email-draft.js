/**
 * 이메일 제출 초안 생성.
 *
 * 근거: 시행령 제31조의2 제6항 — 권리는 서면·**전자우편**·인터넷 홈페이지·어플리케이션
 *       등을 통해 금융위원회가 정하여 고시하는 서식에 따라 행사할 수 있다.
 *
 * ── 규칙 ────────────────────────────────────────────────────────
 * 1. 본문에 들어가는 법령 문구는 **전부 src/data/law.js 상수를 참조**한다.
 *    이 파일에 조문 텍스트를 하드코딩하지 않는다.
 * 2. **수신 주소를 추정하지 않는다.** 금융회사 이메일 주소를 우리가 채워 넣지 않는다.
 *    사용자가 직접 확인해 넣는다.
 * 3. 이메일만으로는 요건이 충족되지 않는다. 고시 서식(출력물)을 첨부해야 하고
 *    서명 또는 날인이 필요하다. 그 사실을 본문에 명시한다.
 * 4. 주민등록번호는 어디에도 넣지 않는다.
 * ────────────────────────────────────────────────────────────────
 */
import {
  LAW_META,
  RIGHTS_BY_ID,
  FORM_EXPLANATION_REQUEST,
  FORM_CORRECTION_REQUEST,
  FORM_REQUEST_ITEMS,
  EXERCISE_CHANNELS,
  EXERCISE_FORM_REQUIREMENT,
  RESPONSE_DUTY,
  PROCESSING_DEADLINE,
  BASE_INFO_CATEGORIES_BY_ID,
  FORM_SIGNATURE_TEXTS,
} from '../data/law.js'

/** 메일 제목 앞머리. 조문 텍스트가 아니라 분류용 표지다. */
const SUBJECT_TAG = {
  [FORM_EXPLANATION_REQUEST.id]: '자동화평가 설명요구',
  [FORM_CORRECTION_REQUEST.id]: '기초정보 정정·삭제 및 자동화평가 재산출 요구',
}

const emailChannel = EXERCISE_CHANNELS.find((c) => c.id === 'email')

const line = (...parts) => parts.filter(Boolean).join('')

/**
 * @param {Object} input
 * @param {string} input.formId          FORM_EXPLANATION_REQUEST.id | FORM_CORRECTION_REQUEST.id
 * @param {{name?:string, phone?:string, email?:string}} input.personal
 * @param {string[]} [input.selectedItems]  서식 1에서 고른 요청 항목 id
 * @param {Object} [input.rows]             서식 2 섹션 2 (분류별 현행/정정 내용)
 * @param {{infoName:string, detail:string}[]} [input.favorable] 서식 2 섹션 3
 * @param {{s2?:boolean, s3?:boolean, s4?:boolean}} [input.enabled] 서식 2에서 켠 섹션
 * @param {string} [input.recipientOrg]   수신 기관명(사용자 입력). 없으면 자리표시자.
 * @returns {{subject: string, body: string}}
 */
export function buildEmailDraft({
  formId,
  personal = {},
  selectedItems = [],
  rows = {},
  favorable = [],
  enabled = {},
  recipientOrg = '',
}) {
  const isForm1 = formId === FORM_EXPLANATION_REQUEST.id
  const form = isForm1 ? FORM_EXPLANATION_REQUEST : FORM_CORRECTION_REQUEST
  const name = (personal.name ?? '').trim() || '(성명)'
  const org = (recipientOrg ?? '').trim() || '(회사명)'

  const subject = `[${SUBJECT_TAG[form.id]}] ${name}`

  const L = []

  L.push(`${org} 담당자님께,`)
  L.push('')
  L.push(
    `${LAW_META.act.name}(이하 "신용정보법") ${LAW_META.act.article}에 따라 ` +
      '아래와 같이 요구드립니다.',
  )
  L.push(
    `${LAW_META.decree.name} ${emailChannel.basis}은 ${emailChannel.label}을 통한 ` +
      '권리 행사를 허용하고 있습니다.',
  )
  L.push('')

  /* ── 요구 사항 ─────────────────────────────────────────────── */
  L.push('■ 요구 사항')
  if (isForm1) {
    const picked = FORM_REQUEST_ITEMS.filter((it) => selectedItems.includes(it.id))
    const items = picked.length > 0 ? picked : FORM_REQUEST_ITEMS
    for (const it of items) {
      L.push(`  ${it.marker} ${it.label}  (${it.basis})`)
    }
    if (picked.length === 0) {
      L.push('  ※ 위 항목 중 필요한 것만 남기고 나머지는 지우세요.')
    }
  } else {
    if (enabled.s2 !== false) {
      const filled = Object.entries(rows).filter(
        ([, v]) => (v?.current ?? '').trim() || (v?.correction ?? '').trim(),
      )
      L.push(`  · ${RIGHTS_BY_ID.R4.label}  (${RIGHTS_BY_ID.R4.basis})`)
      for (const [catId, v] of filled) {
        const cat = BASE_INFO_CATEGORIES_BY_ID[catId]
        L.push(
          line(
            `    - ${cat ? cat.label : catId}: `,
            (v.current ?? '').trim().replace(/\n/g, ' / ') || '(현행 정보)',
            ' → ',
            (v.correction ?? '').trim().replace(/\n/g, ' / ') || '(정정 또는 삭제 내용)',
          ),
        )
      }
    }
    if (enabled.s3 !== false) {
      const picked = favorable.filter((r) => (r.infoName ?? '').trim())
      L.push(`  · ${RIGHTS_BY_ID.R3.label}  (${RIGHTS_BY_ID.R3.basis})`)
      for (const r of picked) {
        L.push(`    - ${r.infoName}${r.detail ? `: ${r.detail}` : ''}`)
      }
    }
    if (enabled.s4 !== false) {
      L.push(`  · ${RIGHTS_BY_ID.R5.label}  (${RIGHTS_BY_ID.R5.basis})`)
    }
  }
  L.push('')

  /* ── 첨부 ──────────────────────────────────────────────────── */
  L.push('■ 첨부')
  L.push(`  「${form.title}」 ${form.subtitle ?? ''}`.trimEnd())
  L.push('  ※ 출력한 서식을 첨부하세요. 서명 또는 날인이 필요합니다.')
  L.push(`  ※ ${EXERCISE_FORM_REQUIREMENT.text} (${EXERCISE_FORM_REQUIREMENT.basis})`)
  L.push('')

  /* ── 회신 ──────────────────────────────────────────────────── */
  L.push('■ 회신')
  L.push(`  ${RESPONSE_DUTY.text} (${RESPONSE_DUTY.basis})`)
  L.push(`  ※ ${PROCESSING_DEADLINE.uiNotice}`)
  const contact = [
    personal.phone?.trim() && `휴대폰 ${personal.phone.trim()}`,
    personal.email?.trim() && `이메일 ${personal.email.trim()}`,
  ].filter(Boolean)
  L.push(
    contact.length > 0
      ? `  회신은 ${contact.join(' / ')} 로 부탁드립니다.`
      : '  회신받을 연락처: (휴대폰 또는 이메일을 직접 적어 주세요)',
  )
  L.push('')

  L.push(FORM_SIGNATURE_TEXTS.dateMark)
  L.push(`${name} 드림`)

  return { subject, body: L.join('\n') }
}

/** mailto: 링크. 수신 주소는 비워 둔다 — 사용자가 채운다. */
export function mailtoHref({ to = '', subject, body }) {
  return `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(
    subject,
  )}&body=${encodeURIComponent(body)}`
}
