/**
 * 심사 당일 [5][6] — 화면이 무엇을 요청하는가.
 *
 * ★ 왜 이게 동시 접속 항목인가
 *   심사위원 여럿이 같은 시각에 열 때 위험한 것은 **서버리스 함수**다. 정적 파일은
 *   CDN 이 준다. 그래서 "화면을 여는 것만으로 함수가 불리는가"가 핵심이다.
 *   버튼을 눌러야만 불린다면, 동시 접속의 부하는 사실상 CDN 부하다.
 *
 * 함께 본다 — 바깥으로 나가는 요청이 하나라도 있으면 그 서버가 죽는 날 화면도 죽는다.
 */
const BASE = process.argv[2] || process.env.APP_URL || 'http://localhost:4400'
const CDP = process.env.CDP || 'http://127.0.0.1:9444'
const t = (await (await fetch(CDP + '/json/list')).json()).find(x => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r)
let id = 0; const pend = new Map(); let reqs = []
ws.onmessage = e => {
  const m = JSON.parse(e.data)
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return }
  if (m.method === 'Network.requestWillBeSent') reqs.push(m.params.request.url)
}
const send = (m, p = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const sleep = ms => new Promise(r => setTimeout(r, ms))
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  ✔ ' + m) } else { fail++; console.log('  ✘ ' + m) } }
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

const origin = new URL(BASE).origin
const PAGES = ['/', '/diagnose?sample=returner', '/strategy', '/document', '/next', '/response']
/* 앞 시험이 남긴 기록을 지운다. 남아 있으면 /response 가 "이전 해석"을 보여줘
   입력란이 없다 — 되돌아온 사용자에게는 맞는 동작이지만 여기서 재려는 것이 아니다. */
const WIPE = `try{localStorage.clear();localStorage.setItem('wy-tour-v1','done');
  localStorage.setItem('wae:journey:state',JSON.stringify({schemaVersion:1,updatedAt:null,diagnosis:{},strategy:{},form:{},response:{},milestones:{}}))}catch(e){}`
const { identifier: seed } = (await send('Page.addScriptToEvaluateOnNewDocument', { source: WIPE })).result
await send('Page.navigate', { url: BASE + '/' }); await sleep(1200)

let allOut = [], allApi = []
for (const p of PAGES) {
  reqs = []
  await send('Page.navigate', { url: BASE + p }); await sleep(1800)
  // 접힌 것을 펼쳐도(=사용자가 읽기만 해도) 요청이 늘지 않아야 한다
  await ev(`document.querySelectorAll('details').forEach(d=>d.open=true)`); await sleep(900)
  const out = [...new Set(reqs.filter(u => /^https?:/.test(u) && !u.startsWith(origin)))]
  const api = reqs.filter(u => u.includes('/api/'))
  allOut.push(...out); allApi.push(...api)
  console.log(`  ${p.padEnd(28)} 요청 ${reqs.length}건 · 바깥 ${out.length}건 · /api ${api.length}건`)
}
console.log()
ok(allOut.length === 0, `화면을 여는 것만으로 나가는 바깥 요청 0건 (${[...new Set(allOut)].join(', ') || '없음'})`)
ok(allApi.length === 0, `화면을 여는 것만으로 부르는 함수 0건 (${allApi.length}건)`)

// 눌렀을 때만 불리는가
await send('Page.navigate', { url: BASE + '/response' }); await sleep(1500)
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: seed })
reqs = []
await ev(`(()=>{const ta=document.querySelector('main textarea');if(!ta)return false;
  const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;
  set.call(ta,'귀하의 신용평가는 자동화평가로 이루어졌습니다.');ta.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(600)
ok(reqs.filter(u => u.includes('/api/')).length === 0, '글을 붙여넣기만 해서는 함수를 부르지 않는다')
await ev(`(()=>{const e=[...document.querySelectorAll('button')].reverse().find(e=>e.textContent.includes('회신 해석하기')&&e.offsetParent!==null);if(e)e.click();return !!e})()`)
await sleep(2500)
const after = reqs.filter(u => u.includes('/api/'))
ok(after.length === 1, `[회신 해석하기]를 눌러야 한 번 부른다 (${after.length}건)`)

console.log(`\n통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail ? 1 : 0)
