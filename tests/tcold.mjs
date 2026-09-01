/**
 * 첫 방문에 화면이 튀지 않는가. (심사 당일 감사 [1], 2026-09-01)
 *
 * ★ 왜 있나
 *   1280px 첫 방문에서 둘러보기 패널이 y=16 에 그려졌다가 592px 아래(y=608)로
 *   뛰었다. 레이아웃 이동 0.233. 원인은 패널 자리를 **스크롤이 끝나기 전** 대상
 *   위치로 정한 것이었다(Tour.jsx placeTopFor 주석). 심사위원이 보는 첫 3초에
 *   일어나는 일이라 눈에 띈다.
 *
 * 재는 것 — 상수끼리 맞대지 않고 **화면이 실제로 움직였는지**를 본다.
 *   1) 투어 패널이 처음 그려진 자리에서 움직이지 않는다
 *   2) 랜딩의 레이아웃 이동 총합이 0.05 이하
 *   3) 웹폰트가 없다 (늦게 적용돼 글자가 바뀌는 일이 없다)
 *   4) 투어는 본문이 다 있는 상태에서 뜬다 (빈 화면 위에 모달만 뜨지 않는다)
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
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  ✔ ' + m) } else { fail++; console.log('  ✘ ' + m) } }

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

const PROBE = `
window.__c = { pos: [], cls: 0 }
try { new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__c.cls += e.value })
  .observe({ type: 'layout-shift', buffered: true }) } catch (e) {}
const tick = () => {
  const d = document.querySelector('[role="dialog"]')
  if (d) {
    const r = d.getBoundingClientRect()
    const last = window.__c.pos[window.__c.pos.length - 1]
    const cur = { t: Math.round(performance.now()), y: Math.round(r.y), x: Math.round(r.x), h: Math.round(r.height) }
    if (!last || last.y !== cur.y || last.x !== cur.x || last.h !== cur.h) {
      const main = document.querySelector('main')
      cur.mainText = main ? main.innerText.trim().length : 0
      window.__c.pos.push(cur)
    }
  }
  if (performance.now() < 3000) requestAnimationFrame(tick)
}
requestAnimationFrame(tick)
`

for (const [w, h] of [[375, 667], [1280, 900]]) {
  console.log(`── ${w}px ──`)
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 })
  await send('Network.clearBrowserCache'); await send('Network.clearBrowserCookies')
  await send('Page.navigate', { url: BASE + '/' }); await sleep(1200)
  await ev(`try{localStorage.clear();sessionStorage.clear()}catch(e){}`)
  const idf = (await send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE })).result?.result?.identifier
  await send('Page.navigate', { url: BASE + '/?cold=' + Date.now() }); await sleep(3400)
  const d = JSON.parse(await ev(`JSON.stringify({
    ...window.__c,
    fonts: [...document.fonts].map(f => f.family),
  })`))
  if (idf) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: idf })

  /* 모바일 하단 시트는 220ms 동안 아래에서 올라온다(의도한 움직임). 그 뒤로는
     자리가 바뀌면 안 된다 — 바뀌면 "그리다가 튄" 것이다. */
  const after = d.pos.filter((p) => p.t >= 500)
  ok(after.length <= 1, `올라온 뒤 패널이 움직이지 않는다 (500ms 이후 자리 ${after.length}개 ${JSON.stringify(after.map(p => p.y))})`)
  ok(d.cls <= 0.05, `랜딩 레이아웃 이동 ${d.cls.toFixed(4)} ≤ 0.05`)
  ok(d.fonts.length === 0, `웹폰트 없음 (${d.fonts.length}개)`)
  ok((d.pos[0]?.mainText ?? 0) > 500, `투어가 뜰 때 본문이 이미 있다 (${d.pos[0]?.mainText ?? 0}자)`)
  /* 데스크톱은 올라오는 연출이 없다. 처음 그린 자리가 곧 마지막 자리여야 한다. */
  if (w >= 640) ok(d.pos.length === 1, `데스크톱은 처음 그린 자리가 곧 마지막 자리 (${JSON.stringify(d.pos.map(p => p.y))})`)
}
await send('Emulation.clearDeviceMetricsOverride')
console.log(`통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail ? 1 : 0)
