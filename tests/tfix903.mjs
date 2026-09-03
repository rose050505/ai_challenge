/**
 * 2026-09-03 감사 결함 8건의 회귀 시험.
 *
 * 각 항목은 **옛 코드에서 실패**하는 것을 확인하고 넣었다.
 *   [1] /document 를 열기만 해도 가짜 "진행 중인 기록"이 생기고 둘러보기가 안 열린다
 *   [2] 수동 분류 모드에서 앞 행을 지우면 체크가 다른 항목을 가리킨다
 *   [4] 수동 분류 표가 새로고침에 사라진다
 *   [5] 샘플을 지우면 "저장됨"이 남는다
 *   [6] 자가진단 버튼이 넘기지도 않을 것을 약속한다
 *   [7] 탭 전환만 해도 빈 여정이 저장된다
 * ([3] maxRetries·[8] 잔가지는 브라우저로 잴 것이 아니어서 여기 없다 — 아래 주석 참조)
 */
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t = (await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json())
  .find((x) => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pend = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
}
const send = (m, p = {}) =>
  new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
await send('Page.enable')
await send('Runtime.enable')
const ev = async (x) =>
  (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++ } else { fail++; console.log('  FAIL', n) } }

/** 저장소를 비우고 그 주소로 간다. localStorage.clear() 만으로는 부족하다 (README 주의). */
const fresh = async (url) => {
  const { identifier } = (await send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{localStorage.clear()}catch(e){}',
  })).result
  await send('Page.navigate', { url })
  await sleep(1600)
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
}
const go = async (url, ms = 1600) => { await send('Page.navigate', { url }); await sleep(ms) }
const journey = async () => JSON.parse((await ev(`localStorage.getItem('wae:journey:state')`)) || 'null')
const text = async () => await ev('document.body.innerText')
const click = (label) =>
  ev(`(()=>{const b=[...document.querySelectorAll('button,a')].find(x=>x.textContent.includes(${JSON.stringify(label)}));if(!b)return 'NOT_FOUND';b.click();return 'ok'})()`)
/** React 가 제어하는 입력칸에 값을 넣는다 */
const type = (sel, i, v) =>
  ev(`(()=>{const e=[...document.querySelectorAll(${JSON.stringify(sel)})][${i}];
    if(!e) return 'NOT_FOUND';
    const proto = e.tagName==='TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(e, ${JSON.stringify(v)});
    e.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'})()`)

/* ── [1] /document 마운트 시 가짜 저장 ───────────────────────── */
console.log('[1] /document 를 열기만 해서는 아무것도 저장되지 않는다')
await fresh(BASE + '/document')
await sleep(2600)
ok('열기만 하면 여정이 저장되지 않는다', (await journey()) === null)

await go(BASE + '/')
const land = await text()
ok('가짜 "진행 중인 기록"이 없다', !land.includes('진행 중인 기록이 있습니다'))
ok('가짜 "저장됨"이 없다', !land.includes('저장됨'))
// ★ 이것이 이 결함의 실제 피해다 — 심사자가 [서식]을 먼저 보면 투어를 못 만난다
ok('둘러보기가 자동으로 열린다', await ev(`!!document.querySelector('[data-tour-panel]')`))
await click('건너뛰기')
await sleep(300)

console.log('[1b] 실제로 손대면 그때 저장된다')
await go(BASE + '/document')
await type('input[data-field="name"]', 0, '홍길동')
await sleep(2200)
const j1 = await journey()
ok('이름을 적으면 저장된다', j1?.form?.personal?.name === '홍길동')
await go(BASE + '/')
const land2 = await text()
ok('그때는 "진행 중인 기록"이 뜬다', land2.includes('진행 중인 기록이 있습니다'))
ok('그때는 "저장됨"이 뜬다', land2.includes('저장됨'))

/* ── [5] 샘플을 지우면 "저장됨"이 남지 않는다 ────────────────── */
console.log('[5] 샘플을 지우면 빈 상태와 같아진다')
await fresh(BASE + '/diagnose?sample=newcomer')
await sleep(1200)
ok('[지우고 내 상황으로] 단추가 있다', (await click('지우고 내 상황으로')) === 'ok')
await sleep(1300)
const jd = await journey()
ok('eventId 가 null 이다 (빈 문자열이 아니다)', jd?.diagnosis?.eventId === null)
ok('counterpartyId 가 null 이다', jd?.diagnosis?.counterpartyId === null)
await go(BASE + '/')
const land3 = await text()
ok('지운 뒤 "저장됨"이 없다', !land3.includes('저장됨'))
ok('지운 뒤 "진행 중인 기록"도 없다', !land3.includes('진행 중인 기록이 있습니다'))

/* ── [6] 자가진단 버튼은 하지 않을 일을 약속하지 않는다 ──────── */
console.log('[6] 자가진단 버튼 라벨')
await click('건너뛰기')
await sleep(300)
await ev(`(()=>{const c=[...document.querySelectorAll('input[type=checkbox]')];c[0]?.click();c[1]?.click()})()`)
await sleep(400)
const btn = await ev(
  `(()=>{const a=[...document.querySelectorAll('a')].find(x=>x.textContent.includes('진단 시작하기'));return a?a.textContent.trim():'NONE'})()`,
)
ok('체크해도 라벨은 "진단 시작하기" 하나다', btn === '진단 시작하기')

/* ── [7] 탭 전환(보이게 될 때)은 저장하지 않는다 ─────────────── */
console.log('[7] visibilitychange')
await fresh(BASE + '/')
await sleep(1200)
await click('건너뛰기')
await sleep(300)
await ev(`document.dispatchEvent(new Event('visibilitychange'))`)
await sleep(600)
ok('보이는 상태의 visibilitychange 로는 저장하지 않는다', (await journey()) === null)

/* ── [2][4] 수동 분류 모드 ───────────────────────────────────── */
console.log('[2][4] 수동 분류 모드 — 열쇠 기반 선택 · 저장')
// 미리보기 서버에는 /api 가 없다 → interpret-client 가 수동 모드로 넘어간다
await fresh(BASE + '/response')
await sleep(1200)
await type('#responseText', 0, '회신 원문 예시입니다.')
await sleep(300)
ok('[회신 해석하기] 를 누른다', (await click('회신 해석하기')) === 'ok')
await sleep(3200)
ok('수동 분류 모드로 넘어갔다', (await text()).includes('직접 분류하기'))
// run() 이 여정을 한 번 밀어 넣으므로 파일 자체는 생긴다. 담긴 내용이 없어야 한다.
const j0 = await journey()
ok('빈 표는 저장하지 않는다', !j0?.response?.manual && !j0?.response?.interpretation)

await click('행 추가')
await sleep(300)
await type('table input', 0, 'A항목')
await type('table input', 1, 'A값')
await sleep(200)
await type('table input', 2, 'B항목')
await type('table input', 3, 'B값')
await sleep(700)
const listed = async () =>
  JSON.parse(
    await ev(`JSON.stringify([...document.querySelectorAll('li')]
      .filter(x=>x.textContent.includes('사실과 다'))
      .map(x=>({t:x.textContent.slice(0,6).trim(), on:x.querySelector('input[type=checkbox]').checked})))`),
  )
ok('두 항목이 목록에 뜬다', (await listed()).length === 2)

// 두 번째(B)를 "사실과 다르다"고 표시한다
await ev(`(()=>{const li=[...document.querySelectorAll('li')].filter(x=>x.textContent.includes('사실과 다'));li[1].querySelector('input[type=checkbox]').click()})()`)
await sleep(700)
ok('B 가 체크됐다', (await listed())[1]?.on === true)

// ★ 앞 행(A)의 이름을 지운다. 목록이 한 칸 당겨진다.
await type('table input', 0, '')
await sleep(800)
const after = await listed()
ok('목록에 B 만 남는다', after.length === 1)
// 옛 코드는 여기서 체크가 풀린 것처럼 보였다 (자리 번호가 밀려서)
ok('B 의 체크가 그대로 남는다', after[0]?.on === true)

/** 화면이 말하는 개수 */
const claimed = async () => {
  const m = (await text()).match(/사실과 다르다고 표시한 (\d+)건이 서식 2/)
  return m ? Number(m[1]) : 0
}
ok('화면이 "1건"이라고 말한다', (await claimed()) === 1)

// 실제로 넘어가는 개수와 같은가
ok('[서식 2 만들기] 로 넘어간다', (await click('서식 2 만들기')) === 'ok')
await sleep(2200)
const moved = JSON.parse(
  await ev(`JSON.stringify([...document.querySelectorAll('textarea[data-field^="row-"][data-field$="-current"]')].map(t=>t.value).filter(Boolean))`),
)
ok('실제로 1건이 서식 2로 넘어갔다', moved.length === 1)
ok('넘어간 것이 B 다', (moved[0] ?? '').includes('B항목'))

console.log('[4] 손으로 채운 표가 새로고침에 남는다')
await go(BASE + '/response')
const restored = await text()
ok('수동 표가 되살아난다', restored.includes('직접 분류하기'))
ok('되살렸다고 말한다', restored.includes('직접 분류하신 결과를 불러왔습니다'))
const vals = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('table input')].map(e=>e.value))`))
ok('B항목이 표에 남아 있다', vals.includes('B항목'))
ok('빈 행의 자리도 지켜진다 (A 자리)', vals[0] === '' && vals[1] === 'A값')
const after2 = await listed()
ok('되살린 뒤에도 B 의 체크가 남는다', after2.length === 1 && after2[0]?.on === true)

console.log('[4b] [다른 회신 넣기] 는 수동 표까지 비운다')
await click('다른 회신 넣기')
await sleep(1200)
const j2 = await journey()
ok('manual 이 비워졌다', !j2?.response?.manual)
await go(BASE + '/response')
ok('새로고침해도 되살아나지 않는다', !(await text()).includes('직접 분류하기'))

console.log('────────────────────────')
console.log(`통과 ${pass} / 실패 ${fail}`)
ws.close()
process.exit(fail === 0 ? 0 : 1)
