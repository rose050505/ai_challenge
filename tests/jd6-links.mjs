/**
 * 심사 당일 [6] — 화면의 외부 링크를 전부 실제로 열어 본다.
 * 죽은 링크가 하나라도 있으면 "근거를 확인할 수 있다"는 이 서비스의 주장이 무너진다.
 *
 * 화면 여섯을 돌며 접힌 것까지 전부 펼치고, 바깥으로 나가는 href 를 모아
 * 하나씩 GET 한다. 200 만 보지 않는다 — 국가법령정보센터는 없는 조문에도
 * 200 을 주므로 **본문에 그 조문이 실제로 있는지**까지 본다.
 */
const BASE = process.argv[2] || process.env.APP_URL || 'http://localhost:4400'
const CDP = process.env.CDP || 'http://127.0.0.1:9444'
const t = (await (await fetch(CDP + '/json/list')).json()).find(x => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r)
let id = 0; const pend = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const sleep = ms => new Promise(r => setTimeout(r, ms))
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })

const PAGES = ['/', '/diagnose?sample=returner', '/strategy', '/document', '/next', '/response']
const found = new Map()   // url -> [어느 화면]
for (const p of PAGES) {
  await send('Page.navigate', { url: BASE + p }); await sleep(1400)
  await ev(`try{localStorage.setItem('wy-tour-v1','done')}catch(e){}`)
  await send('Page.navigate', { url: BASE + p }); await sleep(1400)
  // 접힌 것을 전부 펼친다 — 링크가 그 안에 있다
  await ev(`document.querySelectorAll('details').forEach(d=>d.open=true)`); await sleep(500)
  await ev(`document.querySelectorAll('details').forEach(d=>d.open=true)`); await sleep(400)
  const list = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('a[href]')]
    .map(a=>a.href).filter(u=>/^https?:/.test(u) && !u.startsWith(location.origin)))`))
  for (const u of list) found.set(u, [...(found.get(u) || []), p])
}
await send('Emulation.clearDeviceMetricsOverride')

console.log(`외부 링크 ${found.size}종\n`)

/**
 * ★ curl 로 확인하면 안 된다. (2026-09-01)
 *   국가법령정보센터는 조문 본문을 **iframe(lsSideInfoP.do)** 안에 그린다.
 *   첫 HTML 에는 조문이 없어서, 살아 있는 딥링크도 "본문에 제36조의2 가 없다"로
 *   나온다 — 4/8 이 거짓 실패였다. **브라우저로 열어 프레임 안까지 읽는다.**
 */
const wait = async (ms) => sleep(ms)
let pass = 0, fail = 0
for (const [u, pages] of [...found].sort()) {
  const dec = decodeURIComponent(u)
  const m = dec.match(/\/(제\d+조(?:의\d+)?)$/)
  await send('Page.navigate', { url: u })
  let txt = '', status = 'timeout'
  for (let i = 0; i < 14; i++) {
    await wait(700)
    txt = (await ev(`(()=>{
      const own=(document.body&&document.body.innerText||'')
      let inner=''
      for(const f of document.querySelectorAll('iframe,frame')){
        try{inner+=' '+(f.contentDocument&&f.contentDocument.body&&f.contentDocument.body.innerText||'')}catch(e){}
      }
      return (own+' '+inner).replace(/\\s+/g,' ')
    })()`)) || ''
    if (txt.length > 200) { status = 'ok'; break }
  }
  let ok = txt.length > 200 && !/페이지를 찾을 수 없|존재하지 않는|Not Found|오류가 발생/.test(txt)
  let why = ok ? `본문 ${txt.length}자` : `★ ${status === 'timeout' ? '본문이 오지 않는다' : '오류 페이지'}`
  if (ok && m) {
    const hit = txt.includes(m[1])
    if (!hit) { ok = false; why = `★ 열리긴 하나 ${m[1]} 이 없다` }
    else why = `${m[1]} 확인 · ` + (txt.match(/\[시행[^\]]*\]\s*\[[^\]]*\]/) || ['판본 표시 없음'])[0]
  }
  if (ok) pass++; else fail++
  console.log(`  ${ok ? '✔' : '✘'} ${dec.slice(0, 88)}`)
  console.log(`      ${why}`)
  console.log(`      나오는 화면: ${[...new Set(pages)].join(' ')}`)
}
console.log(`\n통과 ${pass} / 실패 ${fail}`)
ws.close()
process.exit(fail ? 1 : 0)
