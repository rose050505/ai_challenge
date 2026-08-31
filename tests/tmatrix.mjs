// [C-2] 사건 유형 × 업권 × (한도 종류) 전수 — 판정이 근거 조문과 모순되지 않는가.
//
// 지금까지의 시험은 대표 조합 몇 개만 봤다. 여기서는 **전부** 돈다.
// 브라우저가 필요 없다 — 판정은 순수 함수(resolveTransactionBasis)다.
//
// ★ 이 시험은 판정 결과를 바꾸지 않는다. 결과가 **스스로 모순되지 않는지**만 본다.
//   무엇이 모순인가:
//    - 특정됐다면서 근거가 상위 문구(chapeau)만 있는 경우
//    - 특정 못 했다면서 하위 호(가목 N)를 근거로 든 경우
//    - 화면에 보이는 이름(label)이 근거로 든 호의 이름과 다른 경우
//    - 위임 경로(basisChain)가 실제 근거 두 조문을 담지 않는 경우
//    - "더 물어봐야 한다"(needsMoreInfo)가 물어볼 질문이 없는 자리에서 뜨는 경우
import {
  CREDIT_RISK_TRANSACTIONS,
  CREDIT_RISK_TRANSACTIONS_BY_CODE,
  DELEGATED_TRANSACTION_BY_SECTOR,
  INSTITUTION_OPTIONS,
  LIMIT_KIND_QUESTION,
  RIGHTS,
  COUNTERPARTY_TYPES,
  needsLimitKind,
  resolveTransactionBasis,
} from '../src/data/law.js'
import { EVENT_TYPES } from '../src/data/events.js'

let pass = 0, fail = 0
const ok = (n, c, d = '') => { c ? pass++ : fail++; if (!c) console.log('  FAIL ' + n + (d ? ' — ' + d : '')) }

const EVENTS = EVENT_TYPES.map((e) => e.id)
const SECTORS = INSTITUTION_OPTIONS.map((s) => s.id)
const LIMITS = [null, ...LIMIT_KIND_QUESTION.options.map((o) => o.id), 'bogus']

console.log('[A] 전수 조합 — 판정이 스스로 모순되지 않는가')
let combos = 0
for (const e of [...EVENTS, null, 'bogusEvent']) {
  for (const s of [...SECTORS, '', null, 'bogusSector']) {
    for (const k of LIMITS) {
      combos++
      const r = resolveTransactionBasis(e, s, k)
      const tag = `${e}×${s}×${k}`
      ok(`${tag}: 객체를 돌려준다`, r && typeof r === 'object', JSON.stringify(r))
      if (!r) continue
      ok(`${tag}: 근거 문자열이 있다`, typeof r.basis === 'string' && r.basis.length > 0, r.basis)
      ok(`${tag}: 이름이 있다`, typeof r.label === 'string' && r.label.length > 0, r.label)

      if (r.resolved) {
        // 특정됐다 → 하위 호가 있어야 하고, 근거가 상위 문구만이어서는 안 된다
        ok(`${tag}: 특정됐으면 호가 있다`, !!r.item, JSON.stringify(r.item))
        ok(`${tag}: 특정됐으면 근거가 상위 문구가 아니다`,
           r.basis !== CREDIT_RISK_TRANSACTIONS.basis, r.basis)
        if (r.delegated) {
          // 가목 4) 위임 — 근거는 시행령 쪽이고, 경로가 두 조문을 다 담아야 한다
          ok(`${tag}: 위임은 가목 4)에서만 나온다`, r.item?.code === 4, String(r.item?.code))
          ok(`${tag}: 위임 근거가 시행령을 가리킨다`, /시행령/.test(r.basis), r.basis)
          ok(`${tag}: 위임 경로가 두 조문을 담는다`,
             typeof r.basisChain === 'string' &&
             r.basisChain.includes(CREDIT_RISK_TRANSACTIONS_BY_CODE[4].basis) &&
             r.basisChain.includes(r.basis), r.basisChain)
          ok(`${tag}: 이름이 위임 항목의 이름이다`, r.label === r.delegated.short, r.label)
        } else {
          ok(`${tag}: 근거가 그 호의 근거와 같다`, r.basis === r.item?.basis, `${r.basis} / ${r.item?.basis}`)
          ok(`${tag}: 이름이 그 호의 이름이다`, r.label === r.item?.short, `${r.label} / ${r.item?.short}`)
          ok(`${tag}: 위임이 아니면 경로를 만들지 않는다`, r.basisChain === undefined, r.basisChain)
        }
        ok(`${tag}: 특정됐으면 더 묻지 않는다`, !r.needsMoreInfo)
      } else {
        // 특정 못 했다 → 상위 문구만. 하위 호를 근거로 들면 안 된다
        ok(`${tag}: 못 정했으면 호가 없다`, r.item === null, JSON.stringify(r.item))
        ok(`${tag}: 못 정했으면 상위 문구가 근거다`,
           r.basis === CREDIT_RISK_TRANSACTIONS.basis, r.basis)
        ok(`${tag}: 못 정했으면 이름도 상위 문구다`,
           r.label === CREDIT_RISK_TRANSACTIONS.chapeauShort, r.label)
      }
    }
  }
}
console.log(`  (조합 ${combos}가지)`)

console.log('[B] "한 번 더 묻는다"가 뜨는 자리')
for (const e of EVENTS) for (const s of SECTORS) {
  const need = needsLimitKind(e, s)
  const r = resolveTransactionBasis(e, s, null)
  ok(`${e}×${s}: needsLimitKind 와 판정이 일치`, !!need === !!r.needsMoreInfo, `${need} / ${r.needsMoreInfo}`)
  if (need) {
    // 물어본 답이 실제로 판정을 끝내야 한다. 안 그러면 물어볼 이유가 없다
    for (const o of LIMIT_KIND_QUESTION.options) {
      const after = resolveTransactionBasis(e, s, o.id)
      ok(`${e}×${s}: [${o.label}] 을 고르면 판정된다`, after.resolved && !after.needsMoreInfo)
      ok(`${e}×${s}: [${o.label}] 이 가리키는 호가 맞다`,
         after.item?.code === o.transactionCode, `${after.item?.code} / ${o.transactionCode}`)
    }
  }
}

console.log('[C] 권리 5종 — 상대방별로 하나도 빠지거나 넘치지 않는가')
const CP_IDS = COUNTERPARTY_TYPES.map((c) => c.id)
for (const c of COUNTERPARTY_TYPES) {
  const mine = RIGHTS.filter((r) => r.counterparties.includes(c.id))
  ok(`${c.id}: 제1항 권리가 있다`, mine.some((r) => r.paragraph === 1))
  ok(`${c.id}: 제2항 권리가 있다`, mine.some((r) => r.paragraph === 2))
  for (const r of mine) {
    ok(`${c.id}/${r.id}: 근거 조문이 붙어 있다`, typeof r.basis === 'string' && r.basis.includes('제36조의2'), r.basis)
    ok(`${c.id}/${r.id}: 항 번호와 근거가 어긋나지 않는다`,
       r.basis.includes(`제${r.paragraph}항`), `${r.paragraph} / ${r.basis}`)
    // 대상 행위의 상대방 제한 — 화면(RightCard)은 "제한에 안 걸리는 상대방"에게
    // 그 행위를 "해당하지 않는 것"으로 표시한다. 제한 목록이 실재하는 상대방만
    // 가리켜야 그 표시가 뜻을 갖는다.
    for (const a of r.targetActs ?? []) {
      if (!a.counterpartyRestriction) continue
      ok(`${c.id}/${r.id}/${a.code}: 제한 목록이 실재하는 상대방만 가리킨다`,
         a.counterpartyRestriction.every((x) => CP_IDS.includes(x)),
         JSON.stringify(a.counterpartyRestriction))
      ok(`${c.id}/${r.id}/${a.code}: 제한이 전부를 배제하지 않는다`,
         a.counterpartyRestriction.length < CP_IDS.length,
         JSON.stringify(a.counterpartyRestriction))
      ok(`${c.id}/${r.id}/${a.code}: 제한된 행위에도 근거 조문이 붙어 있다`,
         typeof a.basis === 'string' && a.basis.includes('제36조의2'), a.basis)
    }
  }
}
// 상대방이 하나라도 못 쓰는 권리가 있으면 그것이 의도된 것인지 드러나야 한다
for (const r of RIGHTS) {
  ok(`${r.id}: 아무도 못 쓰는 권리가 아니다`, (r.counterparties ?? []).length > 0, JSON.stringify(r.counterparties))
  ok(`${r.id}: 상대방 목록이 실재하는 값이다`, (r.counterparties ?? []).every((x) => CP_IDS.includes(x)))
}

console.log('[D] 위임 매핑 — 업권 목록 안의 것만 가리키는가')
for (const [sid, d] of Object.entries(DELEGATED_TRANSACTION_BY_SECTOR)) {
  ok(`${sid}: 실재하는 업권이다`, SECTORS.includes(sid))
  ok(`${sid}: 근거가 시행령 제2조 제6항이다`, /시행령 제2조 제6항/.test(d.basis), d.basis)
  ok(`${sid}: 이름이 있다`, typeof d.short === 'string' && d.short.length > 0)
}

console.log(`\n통과 ${pass} / 실패 ${fail}`)
process.exit(fail ? 1 : 0)
