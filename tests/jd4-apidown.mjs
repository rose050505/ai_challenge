/**
 * 심사 당일 [4] — API 가 죽은 상태로 전 경로.
 *
 * 심사 기간에 키 만료·한도 초과·함수 장애가 일어날 수 있다. 그때 화면이
 * 무엇을 말하고 사용자가 어디서 막히는지 본다. CDP Fetch 로 /api/* 를 가로채
 * 상태 코드를 강제한다 (실제 API 는 한 번도 부르지 않는다 — 비용 0).
 *
 * 경우: 503(JSON) 502(HTML 오류 페이지) 504(빈 본문) 429(JSON)
 *       연결 실패, 무응답(클라이언트 25초 타임아웃)
 */
const BASE = process.argv[2] || process.env.APP_URL || 'http://localhost:4400'
const CDP = process.env.CDP || 'http://127.0.0.1:9444'
const t = (await (await fetch(CDP + '/json/list')).json()).find(x => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r)
let id = 0; const pend = new Map(); const evq = []
ws.onmessage = e => {
  const m = JSON.parse(e.data)
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return }
  if (m.method === 'Fetch.requestPaused') evq.push(m.params)
}
const send = (m, p = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const sleep = ms => new Promise(r => setTimeout(r, ms))
const b64 = s => Buffer.from(s, 'utf8').toString('base64')
let pass = 0, fail = 0, calls = 0
const ok = (c, m) => { if (c) { pass++; console.log('    ✔ ' + m) } else { fail++; console.log('    ✘ ' + m) } }

await send('Page.enable'); await send('Runtime.enable')
await send('Fetch.enable', { patterns: [{ urlPattern: '*/api/*' }] })

/** 지금 걸 고장 */
let MODE = null
const drain = async () => {
  while (evq.length) {
    const p = evq.shift(); calls++
    const m = MODE
    if (!m) { await send('Fetch.continueRequest', { requestId: p.requestId }); continue }
    if (m.kind === 'fail') { await send('Fetch.failRequest', { requestId: p.requestId, errorReason: 'ConnectionRefused' }); continue }
    if (m.kind === 'hang') { continue } // 응답하지 않는다 — 클라이언트 타임아웃을 본다
    await send('Fetch.fulfillRequest', {
      requestId: p.requestId, responseCode: m.code,
      responseHeaders: [{ name: 'Content-Type', value: m.ctype }],
      body: b64(m.body),
    })
  }
}
const pump = setInterval(drain, 60)

const click = async txt => { const r = await ev(`(()=>{const e=[...document.querySelectorAll('button,a')].reverse().find(e=>e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(e)e.click();return !!e})()`); await sleep(1000); return r }
const text = async () => await ev(`document.querySelector('main').innerText`)
const seed = async (journey, path) => {
  const { identifier } = (await send('Page.addScriptToEvaluateOnNewDocument',
    { source: `try{localStorage.setItem('wae:journey:state', ${JSON.stringify(JSON.stringify(journey))});localStorage.setItem('wy-tour-v1','done')}catch(e){}` })).result
  await send('Page.navigate', { url: BASE + path }); await sleep(1300)
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
}
const J = (d = {}) => ({
  schemaVersion: 1, updatedAt: new Date().toISOString(),
  diagnosis: { eventId: 'cardRejected', counterpartyId: 'FI', institutionSectorId: 'creditFinance', reason: '프리랜서로 3년 일했는데 카드 발급이 거절됐습니다.', ...d },
  strategy: { notice: null, candidates: [], picked: [], source: null }, form: {}, response: {}, milestones: {},
})

const CASES = [
  { name: '503 (키 없음 — JSON)', kind: 'body', code: 503, ctype: 'application/json', body: JSON.stringify({ error: 'api_unavailable', reason: 'not_configured' }), expectS: 'AI 연결이 일시적으로 어려워', expectR: 'AI 연결이 일시적으로 어려워' },
  { name: '502 (HTML 오류 페이지)', kind: 'body', code: 502, ctype: 'text/html', body: '<html><body><h1>502 Bad Gateway</h1></body></html>', expectS: '기본 목록을 보여드립니다', expectR: '직접 분류 모드로 전환했습니다' },
  { name: '504 (빈 본문)', kind: 'body', code: 504, ctype: 'text/plain', body: '', expectS: '기본 목록을 보여드립니다', expectR: '직접 분류 모드로 전환했습니다' },
  { name: '429 (한도 초과)', kind: 'body', code: 429, ctype: 'application/json', body: JSON.stringify({ error: 'rate_limited' }), expectS: '요청이 많아', expectR: '요청이 많아' },
  { name: '연결 실패', kind: 'fail', expectS: 'AI 연결이 일시적으로 어려워', expectR: 'AI 연결이 일시적으로 어려워' },
]

await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 1, mobile: true })

for (const c of CASES) {
  console.log(`\n── ${c.name} ──`)
  MODE = c

  // (가) /strategy — 사용자가 직접 쓴 서술 (샘플 아님)
  await seed(J(), '/strategy')
  const before = calls
  await click('제출할 정보 후보 만들기'); await sleep(1200)
  let tx = await text()
  ok(calls > before, `  API 를 실제로 불렀다 (${calls - before}회)`)
  ok(tx.includes(c.expectS), `  /strategy 가 왜 폴백했는지 말한다 — "${c.expectS}"`)
  ok(/제출하면 유리|제출할 정보/.test(tx), '  /strategy 목록이 그래도 나온다')
  const items = await ev(`document.querySelectorAll('main input[type=checkbox]').length`)
  ok(items >= 3, `  고를 수 있는 항목이 있다 (${items}개)`)
  ok(await click('를 서식에 넣기'), '  여기서 서식으로 넘어갈 수 있다')
  await sleep(1200)
  ok((await text()).includes('설명요구서') || (await text()).includes('요청서'), '  서식이 만들어진다')
  ok(!/오류|실패했습니다|Error/.test(tx), '  "오류"라는 말로 끝나지 않는다')

  // (나) /response — 사용자가 붙여넣은 회신 (샘플 아님)
  await seed(J(), '/response')
  await ev(`(()=>{const ta=document.querySelector('main textarea');
    const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
    set.call(ta,'귀하의 신용평가는 자동화평가로 이루어졌습니다. 주요 기준은 연체 이력과 소득 안정성입니다.');
    ta.dispatchEvent(new Event('input',{bubbles:true}))})()`)
  await sleep(400)
  await click('회신 해석하기'); await sleep(1500)
  tx = await text()
  ok(tx.includes(c.expectR), `  /response 가 왜 수동인지 말한다 — "${c.expectR}"`)
  ok(/직접 분류|직접 고르/.test(tx), '  직접 분류 모드로 이어진다')
  const inputs = await ev(`document.querySelectorAll('main input[type=checkbox],main input[type=radio],main select').length`)
  ok(inputs >= 3, `  직접 고를 수단이 화면에 있다 (${inputs}개)`)

  // (다) 샘플 경로 — API 를 아예 안 부른다
  const s0 = calls
  await seed({ schemaVersion: 1, updatedAt: null, diagnosis: {}, strategy: {}, form: {}, response: {}, milestones: {} }, '/diagnose?sample=returner')
  await sleep(600)
  await send('Page.navigate', { url: BASE + '/strategy' }); await sleep(1100)
  await click('제출할 정보 후보 만들기'); await sleep(900)
  tx = await text()
  ok(calls === s0, `  샘플은 API 를 부르지 않는다 (${calls - s0}회)`)
  ok((tx.match(/이걸 고른 이유/g) || []).length >= 3, '  샘플 선정이유가 그대로 나온다')
}

// ── 무응답(타임아웃) — 한 번만. 25초 걸린다 ──────────────────
console.log(`\n── 무응답 (클라이언트 25초 타임아웃) ──`)
MODE = { kind: 'hang' }
await seed(J(), '/strategy')
const t0 = Date.now()
await click('제출할 정보 후보 만들기')
let waited = 0, tx = ''
/* ★ '기본 목록'으로 끊으면 안 된다. 8초쯤에 뜨는 안심 문구가 그 말을 이미 담고 있다
   ("25초 안에 응답이 없으면 기본 목록으로 넘어가니 …"). 실제 폴백 문구로 끊는다. */
let calm = null
while (waited < 32000) {
  await sleep(1000); waited = Date.now() - t0; tx = await text()
  if (!calm && /조금 더 걸리고 있습니다/.test(tx)) calm = Math.round(waited / 1000)
  if (tx.includes('기본 목록을 보여드립니다')) break
}
ok(calm !== null, `  기다리는 동안 안심 문구가 뜬다 (${calm}초)`)
ok(tx.includes('응답이 지연되어'), `  지연이라고 사실대로 말한다 (${Math.round(waited / 1000)}초)`)
ok(waited < 30000, `  30초 안에 폴백한다 (${Math.round(waited / 1000)}초)`)
ok(/제출하면 유리|제출할 정보/.test(tx), '  목록이 나온다')
const busy = await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>/후보 만들기|만드는 중/.test(b.textContent));return b?b.textContent.trim():null})()`)
ok(!/만드는 중/.test(busy || ''), `  단추가 "만드는 중"에 갇히지 않는다 (${busy})`)

clearInterval(pump)
MODE = null
await send('Fetch.disable')
await send('Emulation.clearDeviceMetricsOverride')
console.log(`\n────────────────────────`)
console.log(`통과 ${pass} / 실패 ${fail}   (가로챈 API 호출 ${calls}회, 실제 API 호출 0회)`)
ws.close(); process.exit(fail ? 1 : 0)
