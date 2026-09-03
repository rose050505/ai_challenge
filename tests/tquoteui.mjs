/**
 * 근거 인용이 **화면에 실제로 보이는가**. (2026-09-02 심사 대비 [3])
 *
 * tquote.mjs 는 데이터와 서버 가드를 본다. 여기서는 심사위원이 보게 될 것을 본다.
 *   - 샘플 2종에서 "받음" 줄마다 회신문의 문장이 인용돼 있는가
 *   - "못 받음" 줄에는 인용이 붙지 않는가 (없는 문장은 인용할 수 없다)
 *   - 새로고침해도 인용이 살아남는가 (저장소 정규화가 버리지 않는가)
 *   - 공문 껍데기가 붙은 뒤에도 판정·다음 행동이 그대로인가
 */
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t = (await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json())
  .find((x) => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pend = new Map()
const errs = []
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.method === 'Runtime.exceptionThrown')
    errs.push((m.params.exceptionDetails?.exception?.description || '').slice(0, 140))
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
}
const send = (m, p = {}) =>
  new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
await send('Page.enable'); await send('Runtime.enable')
const ev = async (x) =>
  (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ' + n) } else { fail++; console.log('  FAIL ' + n + (d ? ' — ' + d : '')) } }
const go = async (path) => {
  const { identifier } = (await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try{localStorage.clear();localStorage.setItem('wy-tour-v1','done')}catch(e){}`,
  })).result
  await send('Page.navigate', { url: BASE + path })
  await sleep(1800)
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
}
const body = () => ev(`document.body.innerText.replace(/\\s+/g,' ')`)

const { RESPONSE_SAMPLES_BY_ID } = await import('../src/data/response-samples.js')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })

/** "받음" 줄 안에 있는 인용만 모은다 (줄 밖의 blockquote 는 세지 않는다) */
const quotesInRows = () => ev(`(()=>{
  const rows=[...document.querySelectorAll('li')].filter(li=>/받음|못 받음/.test(li.innerText));
  return JSON.stringify(rows.map(li=>({
    got: !/못 받음/.test(li.innerText),
    label: li.innerText.split('\\n').filter(Boolean)[1]||'',
    quote: (li.querySelector('blockquote')?.innerText||'').trim(),
    lead: /회신문의 이 문장 때문입니다/.test(li.innerText)
  })))})()`)

for (const sid of ['full', 'partial']) {
  const sample = RESPONSE_SAMPLES_BY_ID[sid]
  console.log(`\n[${sid}] 샘플 딥링크로 해석까지`)
  await go(`/response?sample=${sid}&run=1`)
  const b = (await body()) || ''
  ok('해석 결과가 떴다', b.includes('무엇을 받았나요'), b.slice(0, 70))

  const rows = JSON.parse((await quotesInRows()) || '[]')
  ok('세 유형 줄이 모두 있다', rows.length === 3, String(rows.length))

  const covered = sample.cached.covered
  const evidence = sample.cached.coveredEvidence
  const gotRows = rows.filter((r) => r.got)
  ok(`받음 줄 수 = ${covered.length}`, gotRows.length === covered.length, JSON.stringify(rows.map((r) => r.got)))
  ok('★ 받음 줄마다 인용이 있다', gotRows.every((r) => r.quote.length > 10), JSON.stringify(gotRows.map((r) => r.quote.slice(0, 20))))
  ok('★ 받음 줄마다 안내 문구가 있다', gotRows.every((r) => r.lead))
  ok('★ 못 받음 줄에는 인용이 없다',
    rows.filter((r) => !r.got).every((r) => !r.quote),
    JSON.stringify(rows.filter((r) => !r.got).map((r) => r.quote)))

  // 화면의 인용이 캐시의 인용과 같고, 그것이 회신 본문에 그대로 있는가
  const hay = sample.text.replace(/\s+/g, '')
  const allInText = gotRows.every((r) => hay.includes(r.quote.replace(/[“”"]/g, '').replace(/\s+/g, '')))
  ok('★ 화면의 인용이 회신 본문에 그대로 있다', allInText, JSON.stringify(gotRows.map((r) => r.quote.slice(0, 30))))
  ok('캐시에 적힌 문장과 같다',
    Object.values(evidence).every((q) => (b || '').includes(q.slice(0, 20))),
    Object.values(evidence).map((q) => q.slice(0, 20)).join(' | '))

  // 공문 껍데기가 판정을 바꾸지 않았는가
  if (sid === 'full') {
    ok('판정 그대로 — 확인이 끝났습니다', b.includes('확인이 끝났습니다'))
    ok('판정 그대로 — 제외 미적용', !b.includes('이번 회신에 적용된 제외입니다'))
    ok('기초정보 5건이 그대로', (await ev(`document.querySelectorAll('select').length`)) >= 5)
  } else {
    ok('판정 그대로 — 누락 재요구', b.includes('설명되지 않은 항목을 다시 요구하세요'))
    ok('판정 그대로 — 제외 적용 강조', b.includes('이번 회신에 적용된 제외입니다'))
    ok('제외 원문 인용 유지', b.includes('자체적으로 개발·가공하여 생성한 정보에'))
  }

  console.log(`[${sid}] 새로고침 후에도 인용이 남는가`)
  await send('Page.navigate', { url: BASE + '/response' })
  await sleep(1700)
  const b2 = (await body()) || ''
  ok('이전 해석을 불러왔다', b2.includes('이전에 해석한 결과를 불러왔습니다'), b2.slice(0, 70))
  const rows2 = JSON.parse((await quotesInRows()) || '[]')
  ok('★ 새로고침 뒤에도 인용이 남는다',
    rows2.filter((r) => r.got).every((r) => r.quote.length > 10),
    JSON.stringify(rows2.map((r) => r.quote.slice(0, 18))))
}

console.log('\n[공문 껍데기] 붙여넣기 칸에서도 예시임을 밝히는가')
await go('/response?sample=full')
const ta = await ev(`document.querySelector('textarea')?.value || ''`)
ok('★ 회신 본문 안에 예시 표시가 있다', (ta || '').includes('실제 금융회사가 보낸 문서가 아닙니다'), (ta || '').slice(0, 40))
ok('공문 머리가 보인다', (ta || '').includes('문서번호') && (ta || '').includes('담당부서'))
ok('기관명은 자리표시자', /○○(카드|은행)/.test(ta || ''))

ok('미처리 예외 없음', errs.length === 0, [...new Set(errs)].join(' | '))
console.log(`\n통과 ${pass} / 실패 ${fail}`)
ws.close()
process.exit(fail ? 1 : 0)
