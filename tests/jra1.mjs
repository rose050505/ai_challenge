/**
 * 회귀 감사 [A] ①② — 새로 생긴 입력 경로에 적대적 사용 · 되돌리기
 *
 * 심사당일 감사(9/1) 뒤에 바뀐 것: 진입 카드 3종, 샘플 선택 단계,
 * 하단 시트 투어, 랜딩 AI 두 줄, 투어 마무리 링크.
 * 적대적 감사(8/30)는 이것들이 생기기 전에 돌았다. 새 경로에 다시 건다.
 */
const BASE = process.argv[2] || process.env.APP_URL || 'http://localhost:4400'
const CDP = process.env.CDP || 'http://127.0.0.1:9444'
const t = (await (await fetch(CDP + '/json/list')).json()).find(x => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r)
let id = 0; const pend = new Map(); const errs = []
ws.onmessage = e => {
  const m = JSON.parse(e.data)
  if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception?.description || m.params.exceptionDetails.text || '').slice(0, 200))
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
}
const send = (m, p = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const sleep = ms => new Promise(r => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, m, d = '') => { if (c) { pass++; console.log('  ✔ ' + m) } else { fail++; console.log('  ✘ ' + m + (d ? ' — ' + d : '')) } }
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 1, mobile: true })

const WIPE = `try{localStorage.clear();localStorage.setItem('wy-tour-v1','done')}catch(e){}`
const go = async (path, seed = WIPE) => {
  const { identifier } = (await send('Page.addScriptToEvaluateOnNewDocument', { source: seed })).result
  await send('Page.navigate', { url: BASE + path }); await sleep(1600)
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
}
const text = async () => (await ev(`(document.querySelector('main')?.innerText||'').replace(/\\s+/g,' ')`)) ?? ''
const url = async () => (await ev(`location.pathname+location.search`)) ?? '?'

console.log('\n[A1-가] 랜딩 [샘플로 체험하기] 연타')
await go('/')
errs.length = 0
await ev(`(async()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('샘플로 체험하기'));
  for(let i=0;i<20;i++){b.click();await new Promise(r=>setTimeout(r,20))}})()`)
await sleep(900)
const pick = JSON.parse(await ev(`JSON.stringify((()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('샘플로 체험하기'));
  const p=document.getElementById('sample-pick');
  return {exp:b?.getAttribute('aria-expanded'), ctrl:b?.getAttribute('aria-controls'),
          panelExists:!!p, hidden:p?p.hasAttribute('hidden'):null,
          cards:p?[...p.querySelectorAll('a')].map(a=>a.getAttribute('href')):[]}})())`))
ok(errs.length === 0, `연타 20회에 예외 0건 (${errs.length}건)`, errs[0])
ok(pick.panelExists, '패널이 DOM 에 계속 있다 (aria-controls 가 가리킬 대상)')
ok(pick.ctrl === null || pick.ctrl === 'sample-pick', `aria-controls 가 존재하는 id 를 가리킨다 (${pick.ctrl})`)
ok(pick.exp === String(!pick.hidden), `aria-expanded(${pick.exp}) 가 실제 상태(${!pick.hidden})와 같다`)
ok(pick.cards.length === 3 && new Set(pick.cards).size === 3, `예시 카드 3장이 서로 다른 곳으로 (${pick.cards.length}장)`)

console.log('\n[A1-나] 진입 카드 연타')
for (const [i, want] of [[0, '/diagnose'], [1, '/response'], [2, '/next']]) {
  await go('/')
  errs.length = 0
  await ev(`(async()=>{const a=document.querySelectorAll('[data-tour="entry"] a')[${i}];
    for(let k=0;k<10;k++){a.click();await new Promise(r=>setTimeout(r,15))}})()`)
  await sleep(1500)
  const u = await url()
  ok(u.startsWith(want) && errs.length === 0, `카드 ${i + 1} 연타 10회 → ${want} 한 번만 (${u}, 예외 ${errs.length})`, errs[0])
}

console.log('\n[A1-다] 예시 카드(샘플) 연타')
await go('/')
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('샘플로 체험하기'));b.click()})()`)
await sleep(600)
errs.length = 0
await ev(`(async()=>{const as=[...document.querySelectorAll('#sample-pick a')];
  for(let k=0;k<9;k++){as[k%3].click();await new Promise(r=>setTimeout(r,15))}})()`)
await sleep(1800)
ok((await url()).startsWith('/diagnose') && errs.length === 0, `세 카드를 섞어 9번 눌러도 진단 한 곳으로 (${await url()}, 예외 ${errs.length})`, errs[0])
const filled = await ev(`(()=>{try{const j=JSON.parse(localStorage.getItem('wae:journey:state'));return j?.diagnosis?.sampleId??null}catch(e){return 'ERR'}})()`)
ok(['newcomer', 'freelancer', 'returner'].includes(filled), `채워진 샘플이 셋 중 하나로 확정된다 (${filled})`)

console.log('\n[A1-라] URL 로 이상한 값 넣기')
/* ★ 3,000자로 걸면 서버가 431 을 준다 — URL 27KB 는 앱이 뜨기도 전에 거절된다.
   그건 우리 코드가 아니라 서버 한계다(로컬 vite preview 는 16KB 부근, 배포본은 32KB 부근).
   여기서 보려는 것은 **앱이 이상한 값을 어떻게 다루는가**이므로, 앱이 확실히
   뜨는 길이로 건다. 그보다 긴 URL 의 거동은 감사 기록에 따로 적었다. */
const LONG = 'ㄱ'.repeat(1000)
const CASES = [
  ['/diagnose?sample=' + encodeURIComponent(LONG), '/diagnose'],
  ['/diagnose?sample=' + encodeURIComponent('<script>alert(1)</script>'), '/diagnose'],
  ['/diagnose?sample=' + encodeURIComponent('"><img src=x onerror=alert(1)>'), '/diagnose'],
  ['/document?form=' + encodeURIComponent(LONG), null],
  ['/document?form=' + encodeURIComponent('__proto__'), null],
  ['/response?sample=' + encodeURIComponent('__proto__') + '&run=1', '/response'],
  ['/diagnose?sample=returner&sample=newcomer', '/diagnose'],
]
for (const [path, want] of CASES) {
  await go(path)
  errs.length = 0
  const tx = await text()
  const u = await url()
  const alerted = await ev(`window.__alerted===true`)
  ok(tx.length > 200 && errs.length === 0 && !alerted,
    `${path.slice(0, 52)}… → 화면이 뜬다 (${u.slice(0, 24)}, ${tx.length}자, 예외 ${errs.length})`, errs[0])
}

console.log('\n[A1-마] 투어 단추 연타 · 경계')
await go('/', `try{localStorage.clear()}catch(e){}`)
errs.length = 0
ok(await ev(`!!document.querySelector('[role=dialog]')`), '첫 방문에 투어가 열린다')
// [다음]을 끝까지 넘어서 연타
for (let i = 0; i < 12; i++) {
  await ev(`(()=>{const d=document.querySelector('[role=dialog]');if(!d)return;
    const b=[...d.querySelectorAll('button')].find(b=>['시작하기','다음','닫기'].includes(b.textContent.trim()));if(b)b.click()})()`)
  await sleep(400)
}
await sleep(800)
ok(errs.length === 0, `[다음]을 끝 너머로 12회 눌러도 예외 0건 (${errs.length}건)`, errs[0])
ok(!(await ev(`!!document.querySelector('[role=dialog]')`)), '투어가 닫힌 상태로 끝난다')
ok((await text()).length > 200, '남은 화면이 정상')

await go('/', `try{localStorage.clear()}catch(e){}`)
errs.length = 0
for (let i = 0; i < 8; i++) {
  await ev(`(()=>{const d=document.querySelector('[role=dialog]');if(!d)return;
    const b=[...d.querySelectorAll('button')].find(b=>b.textContent.trim()==='이전');if(b)b.click()})()`)
  await sleep(250)
}
ok(errs.length === 0 && (await ev(`!!document.querySelector('[role=dialog]')`)),
  `소개에서 [이전]은 없거나 아무 일도 안 한다 (예외 ${errs.length})`)

console.log('\n[A2] 되돌리기 — 쓴 것이 조용히 사라지는가')
// (가) 샘플 A → 뒤로 → 샘플 B
await go('/')
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('샘플로 체험하기'));b.click()})()`)
await sleep(500)
await ev(`document.querySelectorAll('#sample-pick a')[0].click()`); await sleep(1600)
const a1 = await ev(`(()=>{try{return JSON.parse(localStorage.getItem('wae:journey:state')).diagnosis.sampleId}catch(e){return null}})()`)
await ev(`history.back()`); await sleep(1500)
ok((await url()) === '/', `뒤로 가면 랜딩으로 (${await url()})`)
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('샘플로 체험하기'));if(b)b.click()})()`)
await sleep(500)
await ev(`document.querySelectorAll('#sample-pick a')[2].click()`); await sleep(1800)
const a2 = await ev(`(()=>{try{return JSON.parse(localStorage.getItem('wae:journey:state')).diagnosis.sampleId}catch(e){return null}})()`)
ok(a1 !== a2 && a2 === 'returner', `다른 샘플을 고르면 그것으로 바뀐다 (${a1} → ${a2})`)
const tx2 = await text()
ok(!tx2.includes('첫 신용대출') || tx2.includes('재취업'), '앞 샘플의 서술이 남아 있지 않다')

// (나) 직접 쓴 것이 있는 상태에서 샘플을 고르면?
await go('/diagnose')
await ev(`(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('신용대출이 거절됐다'));e.click()})()`)
await sleep(700)
await ev(`(()=>{const e=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('금융회사'));if(e)e.click()})()`)
await sleep(700)
const MINE = '제가 직접 적은 사정입니다. 지워지면 안 됩니다.'
await ev(`(()=>{const ta=document.querySelector('main textarea');if(!ta)return false;
  const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
  set.call(ta,${JSON.stringify(MINE)});ta.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(1800)
const mineSaved = await ev(`(()=>{try{return JSON.parse(localStorage.getItem('wae:journey:state')).diagnosis.reason}catch(e){return null}})()`)
ok(mineSaved === MINE, '직접 쓴 서술이 저장된다')
await send('Page.navigate', { url: BASE + '/' }); await sleep(1500)
const resume = (await text()).includes('진행 중인 기록이 있습니다')
ok(resume, '랜딩이 진행 중인 기록을 알린다')
// 이 상태에서 투어를 시작하면 덮어쓴다고 말하는가
// ★ 저절로 열리지는 않는다 — 기록이 있으면 하던 일을 가로채지 않는다(설계). 손으로 연다.
await send('Page.navigate', { url: BASE + '/' }); await sleep(1600)
ok(!(await ev(`!!document.querySelector('[role=dialog]')`)), '기록이 있으면 투어가 저절로 열리지 않는다')
await ev(`(()=>{const b=[...document.querySelectorAll('button,a')].find(e=>e.textContent.includes('2분 둘러보기'));if(b)b.click()})()`)
await sleep(1200)
const warn = await ev(`document.querySelector('[role=dialog]')?.innerText.replace(/\\s+/g,' ')||''`)
ok(/덮어써집니다/.test(warn), `손으로 연 투어가 "덮어쓴다"고 먼저 말한다`, warn.slice(0, 110))
// 샘플 카드는? (투어 밖 경로)
await go('/')
await ev(`(()=>{try{const j={schemaVersion:1,updatedAt:new Date().toISOString(),diagnosis:{eventId:'loanRejected',counterpartyId:'FI',reason:${JSON.stringify(MINE)}},strategy:{},form:{},response:{},milestones:{}};localStorage.setItem('wae:journey:state',JSON.stringify(j))}catch(e){}})()`)
await send('Page.navigate', { url: BASE + '/' }); await sleep(1600)
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.includes('샘플로 체험하기'));if(b)b.click()})()`)
await sleep(600)
const nearPick = await ev(`document.getElementById('sample-pick')?.innerText.replace(/\\s+/g,' ')||''`)
const landTx = await text()
console.log('    (샘플 고르기 패널 문구) ' + nearPick.slice(0, 120))
ok(/덮어|지우|바뀝니다|대신/.test(nearPick) || /덮어|지우/.test(landTx),
  '기록이 있을 때 샘플이 덮어쓴다는 사실을 알린다', '패널: ' + nearPick.slice(0, 80))

console.log(`\n통과 ${pass} / 실패 ${fail}`)
await send('Emulation.clearDeviceMetricsOverride')
ws.close(); process.exit(fail ? 1 : 0)
