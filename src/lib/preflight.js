/**
 * 제출 전 검토.
 *
 * ★ 경고만 한다. 진행을 막지 않는다.
 *   비워 두는 것이 사용자의 선택일 수 있다 — 성명을 출력 후 손으로 쓰겠다거나,
 *   정정 내용을 종이에서 채우겠다거나. 우리가 대신 판단하지 않는다.
 *   그래서 어떤 경우에도 [이대로 인쇄하기] 가 항상 있다.
 *
 * ★ 여기에 법령 판단은 없다. 빈칸을 세는 일뿐이다. 근거 조문을 붙이지 않는다.
 */

const blank = (v) => !String(v ?? '').trim()

/**
 * @returns {{id: string, text: string, hint?: string}[]}
 */
export function preflightIssues({
  isForm1,
  personal = {},
  selectedItems = [],
  rows = {},
  favorable = [],
  enabled = {},
  needsRecipient = false,
  recipient = '',
  categoryLabel = (id) => id,
}) {
  const issues = []

  if (blank(personal.name)) {
    issues.push({
      id: 'name',
      text: '신청인 성명이 비어 있습니다.',
      hint: '출력한 뒤 손으로 적으셔도 됩니다.',
    })
  }

  if (isForm1) {
    if (selectedItems.length === 0) {
      issues.push({
        id: 'items',
        text: '요구할 항목을 하나도 고르지 않으셨습니다.',
        hint: '아무것도 체크되지 않은 서식이 인쇄됩니다.',
      })
    }
    return issues
  }

  // ── 서식 2 ────────────────────────────────────────────────
  if (needsRecipient && blank(recipient)) {
    issues.push({
      id: 'recipient',
      text: '받는 기관을 적지 않으셨습니다.',
      hint: '출력한 뒤 손으로 적으셔도 됩니다.',
    })
  }

  if (enabled.s2 !== false) {
    for (const [catId, row] of Object.entries(rows)) {
      const hasCurrent = !blank(row?.current)
      const hasCorrection = !blank(row?.correction)
      if (hasCurrent && !hasCorrection) {
        issues.push({
          id: `row-${catId}-correction`,
          text: `${categoryLabel(catId)} — 현행 정보만 적혀 있고 정정·삭제 내용이 비어 있습니다.`,
          hint: '무엇을 어떻게 고쳐 달라는 것인지가 이 칸입니다.',
        })
      } else if (!hasCurrent && hasCorrection) {
        issues.push({
          id: `row-${catId}-current`,
          text: `${categoryLabel(catId)} — 정정·삭제 내용만 적혀 있고 현행 정보가 비어 있습니다.`,
          hint: '지금 어떻게 기록돼 있는지를 함께 적어야 대조가 됩니다.',
        })
      }
    }
  }

  if (enabled.s3 !== false) {
    favorable.forEach((r, i) => {
      const hasName = !blank(r?.infoName)
      const hasDetail = !blank(r?.detail)
      if (hasName && !hasDetail) {
        issues.push({
          id: `fav-${i}`,
          text: `유리한 정보 ${i + 1}번 — 정보명만 있고 세부 내용이 비어 있습니다.`,
          hint: '어떤 값인지(금액·기간 등)를 적어야 반영을 요구할 수 있습니다.',
        })
      }
    })
  }

  return issues
}
