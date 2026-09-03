/**
 * 근거 인용의 검산. (2026-09-02 심사 대비 [3][4])
 *
 * 이 화면은 "회신문의 이 문장 때문입니다"라고 말한다. 그것은 주장이다.
 * 주장이 참인지를 서버가 대조하고, 여기서 그 대조를 고정한다.
 *
 *  [A] 샘플 2종의 캐시된 인용이 **그 샘플 본문 안에 그대로 있는가**
 *      (샘플은 캐시라 서버를 타지 않는다. 여기서 안 잡으면 아무도 안 잡는다)
 *  [B] 지어낸 인용은 버려지는가 — 판정은 그대로 두고 인용만
 *  [C] 공문 껍데기를 씌운 뒤에도 캐시된 해석이 여전히 본문과 맞는가
 */
import { applyInterpretGuards, verifiedQuote } from '../api/interpret.js'
import { RESPONSE_SAMPLES } from '../src/data/response-samples.js'
import { RESPONSE_TYPE_IDS } from '../src/data/law.js'

let fail = 0
const ok = (name, cond, detail = '') => {
  if (cond) console.log('PASS  ' + name)
  else { fail++; console.log('FAIL  ' + name + (detail ? '\n   ' + detail : '')) }
}
const squash = (s) => String(s ?? '').replace(/\s+/g, '')

console.log('[A] 샘플의 캐시된 인용이 본문에 그대로 있는가')
for (const s of RESPONSE_SAMPLES) {
  const hay = squash(s.text)
  const ev = s.cached.coveredEvidence ?? {}
  for (const [id, quote] of Object.entries(ev)) {
    ok(`${s.id}/${id}: 본문에 그대로 있다`, hay.includes(squash(quote)), quote)
    ok(`${s.id}/${id}: covered 인 유형이다`, s.cached.covered.includes(id))
  }
  // 못 받은 유형에는 근거가 없어야 한다 — 없는 문장은 인용할 수 없다
  for (const id of s.cached.missing) {
    ok(`${s.id}/${id}: 못 받은 유형에 인용 없음`, !(id in ev))
  }
  ok(`${s.id}: 받은 유형마다 인용이 있다`,
    s.cached.covered.every((id) => !!ev[id]),
    `covered=${s.cached.covered} evidence=${Object.keys(ev)}`)
  // provisoText 도 인용이다. 본문과 대조한다.
  if (s.cached.provisoText) {
    ok(`${s.id}: provisoText 가 본문에 있다`, hay.includes(squash(s.cached.provisoText)))
  }
}

console.log('\n[C] 공문 껍데기를 씌운 뒤에도 캐시가 본문과 맞는가')
for (const s of RESPONSE_SAMPLES) {
  const hay = squash(s.text)
  ok(`${s.id}: 예시 문서 표시가 본문 안에 있다`,
    s.text.includes('실제 금융회사가 보낸 문서가 아닙니다'))
  // 라벨은 칸을 맞추려고 글자 사이를 벌려 놓았다(수    신). 눌러서 본다.
  ok(`${s.id}: 공문 머리(문서번호·수신·발신·제목)`,
    ['문서번호', '수신', '발신', '제목'].every((k) => hay.includes(k)),
    s.text.slice(0, 120))
  ok(`${s.id}: 담당부서`, s.text.includes('담당부서'))
  // ★ 실물로 오해받지 않도록 자리표시자만 쓴다
  ok(`${s.id}: 기관명은 자리표시자(○)`, /○○(카드|은행)/.test(s.text))
  ok(`${s.id}: 문서번호는 자리표시자`, s.text.includes('제2026-○○호'))
  // 캐시된 기초정보 항목의 값이 여전히 본문에 있다 (껍데기만 바꿨다는 증거)
  for (const it of s.cached.baseInfoItems) {
    ok(`${s.id}: 「${it.항목}」 값이 본문에 그대로`, hay.includes(squash(it.내용)), it.내용)
  }
}

console.log('\n[B] 지어낸 인용은 버린다 — 판정은 그대로')
const REPLY = `1. 자동화평가의 결과
평가일 기준 내부 신용평점은 600점입니다.
2. 주요 기준은 자체 가공 정보로 제공 대상에서 제외됩니다.`

const good = applyInterpretGuards({
  covered: ['result'],
  missing: ['criteria', 'baseInfo'],
  coveredEvidence: { result: '평가일 기준 내부 신용평점은 600점입니다.' },
  baseInfoItems: [],
  refused: false,
  excludedByProviso: true,
  provisoText: '주요 기준은 자체 가공 정보로 제공 대상에서 제외됩니다.',
}, REPLY)
ok('[B1] 원문에 있는 인용은 남는다', good.coveredEvidence.result === '평가일 기준 내부 신용평점은 600점입니다.', JSON.stringify(good.coveredEvidence))
ok('[B1] 원문에 있는 provisoText 는 남는다', good.provisoText.length > 0)

const bad = applyInterpretGuards({
  covered: ['result'],
  missing: ['criteria', 'baseInfo'],
  coveredEvidence: { result: '귀하의 성실성을 높이 평가하여 만점을 부여하였습니다.' },
  baseInfoItems: [],
  refused: false,
  excludedByProviso: true,
  provisoText: '당사는 모든 정보를 투명하게 공개하였습니다.',
}, REPLY)
ok('[B2] ★ 지어낸 인용은 버린다', bad.coveredEvidence.result === undefined, JSON.stringify(bad.coveredEvidence))
ok('[B2] ★ 지어낸 provisoText 도 버린다', bad.provisoText === '', bad.provisoText)
ok('[B2] ★ 판정(covered)은 그대로', JSON.stringify(bad.covered) === JSON.stringify(['result']))
ok('[B2] ★ 판정(missing)은 그대로', JSON.stringify(bad.missing) === JSON.stringify(['criteria', 'baseInfo']))
ok('[B2] ★ 판정(excludedByProviso)은 그대로', bad.excludedByProviso === true)

// 못 받았다고 판정한 유형의 인용은, 원문에 있어도 버린다 (판정과 모순된다)
const contra = applyInterpretGuards({
  covered: ['result'],
  missing: ['criteria', 'baseInfo'],
  coveredEvidence: {
    result: '평가일 기준 내부 신용평점은 600점입니다.',
    criteria: '2. 주요 기준은 자체 가공 정보로 제공 대상에서 제외됩니다.',
  },
  baseInfoItems: [],
}, REPLY)
ok('[B3] ★ missing 유형의 인용은 버린다', contra.coveredEvidence.criteria === undefined, JSON.stringify(contra.coveredEvidence))

// 거절→제외 이동 판정이 인용 검산보다 먼저 일어난다 (순서 고정)
const migrated = applyInterpretGuards({
  covered: RESPONSE_TYPE_IDS,
  missing: [],
  refused: true,
  refusalReasonText: '지어낸 거절 사유입니다.',
}, REPLY)
ok('[B4] ★ 인용이 가짜여도 판정 이동은 일어난다', migrated.excludedByProviso === true && migrated.refused === false)
ok('[B4] ★ 그 가짜 인용은 화면에 오르지 않는다', migrated.provisoText === '' && migrated.refusalReasonText === '')

// 길이 상한
const long = 'ㄱ'.repeat(500)
ok('[B5] 인용 상한 300자', verifiedQuote(long, long).length === 300)
// 원문이 없으면 대조할 수 없다
ok('[B6] 원문 없으면 인용 안 남긴다', verifiedQuote('아무 문장', '') === '')

console.log(fail ? `\n${fail} FAILED` : '\n모두 통과')
process.exit(fail ? 1 : 0)
