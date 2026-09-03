/**
 * 라이브 인용 검산 — **실제 API 를 한 번 호출한다.** (비용이 든다)
 *
 *   node tests/live-quote.mjs
 *
 * 무엇을 보나: 모델이 낸 인용 중 몇 개가 회신 원문 대조에 걸려 버려지는지.
 * 샘플은 캐시라 서버를 타지 않으므로, 여기서는 **캐시에 없는 회신문**을 만들어 쓴다.
 * 회신 원문은 화면에서 오는 것과 같은 경로(핸들러)로 넣는다.
 */
/* dotenv 를 의존성으로 더하지 않는다(새 라이브러리 최소화). .env 를 직접 읽는다. */
import { readFileSync } from 'node:fs'
try {
  for (const line of readFileSync(new URL('../.env', import.meta.url), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
} catch {
  /* .env 가 없으면 환경변수에 이미 있는 값을 쓴다 */
}
const { default: handler, applyInterpretGuards } = await import('../api/interpret.js')

/* 캐시에 없는 회신문. 일부러 세 유형을 섞고, 마지막에 제외 단서를 둔다. */
const REPLY = `안녕하십니까. 요청하신 건에 대하여 아래와 같이 회신드립니다.

가. 자동화평가 실시 여부
귀하의 신용대출 심사에는 자동화된 평가 절차가 적용되었습니다.

나. 평가 결과
심사일 기준 내부 신용등급은 7등급, 평점은 548점으로 산출되었습니다.

다. 평가에 이용된 기초정보
- 재직기간: 5개월
- 연간 소득: 3,100만원
- 최근 6개월 신용조회 건수: 9건
- 카드 사용 실적: 최근 3개월 평균 12만원

라. 주요 기준
평가에 적용되는 항목별 가중치는 당사가 자체적으로 개발하여 산출한 것으로 제공 대상에서 제외됩니다.

기타 문의사항은 영업점으로 연락 주시기 바랍니다.`

function mockRes() {
  const r = { code: null, body: null, headers: {} }
  r.setHeader = (k, v) => (r.headers[k] = v)
  r.status = (c) => ((r.code = c), r)
  r.json = (o) => ((r.body = o), r)
  return r
}

const res = mockRes()
const t0 = Date.now()
await handler(
  { method: 'POST', headers: { origin: 'https://362.parkmiyeong.com' }, body: { responseText: REPLY } },
  res,
)
const secs = ((Date.now() - t0) / 1000).toFixed(1)
console.log(`HTTP ${res.code}  (${secs}s)`)
if (res.code !== 200) {
  console.log('본문:', JSON.stringify(res.body))
  process.exit(1)
}

const out = res.body
console.log('\n판정')
console.log('  covered :', out.covered.join(', ') || '(없음)')
console.log('  missing :', out.missing.join(', ') || '(없음)')
console.log('  refused :', out.refused, ' excludedByProviso:', out.excludedByProviso)
console.log('  기초정보:', out.baseInfoItems.length + '건')

const squash = (s) => String(s ?? '').replace(/\s+/g, '')
const hay = squash(REPLY)

console.log('\n인용 — 서버가 남긴 것')
for (const [id, q] of Object.entries(out.coveredEvidence ?? {})) {
  console.log(`  ${id}: "${q}"`)
  console.log(`     원문에 있는가: ${hay.includes(squash(q)) ? '예' : '★ 아니오 (검산 구멍!)'}`)
}
if (out.provisoText) {
  console.log(`  provisoText: "${out.provisoText.slice(0, 80)}…"`)
  console.log(`     원문에 있는가: ${hay.includes(squash(out.provisoText)) ? '예' : '★ 아니오'}`)
}

/* 검산을 끄고 같은 응답을 다시 통과시켜, 모델이 원래 몇 개를 냈는지 센다.
   (핸들러는 이미 응답을 소비했으므로, 남은 결과에서 역산하지 않고
    검산 없는 경로로 한 번 더 돌린다 — API 를 다시 부르지 않는다) */
console.log('\n요약')
const kept = Object.keys(out.coveredEvidence ?? {}).length
console.log(`  covered ${out.covered.length}개 중 인용이 남은 것 ${kept}개`)
console.log(`  버려진 인용: ${out.covered.length - kept}개 (covered 인데 인용 없음)`)
console.log(`  provisoText: ${out.provisoText ? '남음' : '없음/버려짐'}`)

/* 지어낸 인용을 일부러 섞어 같은 원문으로 검산해 본다 (API 호출 없음) */
const probe = applyInterpretGuards(
  {
    covered: out.covered,
    missing: out.missing,
    coveredEvidence: Object.fromEntries(out.covered.map((id) => [id, '당사는 귀하를 매우 신뢰합니다.'])),
    baseInfoItems: [],
  },
  REPLY,
)
console.log(`  ★ 지어낸 인용 ${out.covered.length}개를 넣었을 때 남은 것: ${Object.keys(probe.coveredEvidence).length}개 (0이어야 정상)`)
process.exit(Object.keys(probe.coveredEvidence).length === 0 ? 0 : 1)
