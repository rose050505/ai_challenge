/**
 * 심사 당일 [1] — 완전한 첫 방문.
 * 캐시·localStorage·쿠키가 전부 없는 상태에서 랜딩이 그려지는 과정을 잰다.
 * 회선 3종(제한 없음 / 빠른 3G / 느린 3G) × 화면 2종(375 / 1280).
 *
 * 재는 것: FP·FCP·LCP·DCL·load, 레이아웃 이동(CLS), 투어가 뜨는 시점,
 *          그 시점에 랜딩이 이미 그려져 있었는지, 글꼴이 늦게 바뀌는지.
 */
const BASE = process.argv[2] || 'https://362.parkmiyeong.com'
const CDP = process.env.CDP || 'http://127.0.0.1:9444'
const t = (await (await fetch(CDP + '/json/list')).json()).find(x => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r)
let id = 0; const pend = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const sleep = ms => new Promise(r => setTimeout(r, ms))

await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')

// DevTools 표준값 (throttling/ThrottlingPresets)
const NET = {
  '제한 없음': { offline: false, latency: 0, downloadThroughput: -1, uploadThroughput: -1 },
  '빠른 3G': { offline: false, latency: 562.5 * 0.8, downloadThroughput: 1.6 * 1024 * 1024 / 8 * 0.9, uploadThroughput: 750 * 1024 / 8 * 0.9 },
  '느린 3G': { offline: false, latency: 2000 * 0.8, downloadThroughput: 500 * 1024 / 8 * 0.8, uploadThroughput: 500 * 1024 / 8 * 0.8 },
}

// 페이지가 뜨기 전에 심어 두는 관측자. 투어 모달이 붙는 시각과 그때의 본문 상태를 남긴다.
const PROBE = `
window.__jd = { tour: null, shifts: 0, shiftList: [], fonts: null, err: null }
try {
  new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) {
    window.__jd.shifts += e.value
    window.__jd.shiftList.push({
      t: Math.round(e.startTime), v: +e.value.toFixed(4),
      src: (e.sources||[]).map(s => {
        const n = s.node
        return n ? (n.nodeName||'') + (n.className && n.className.baseVal===undefined ? '.'+String(n.className).split(/\\s+/).slice(0,3).join('.') : '')
                 + ' [' + Math.round(s.previousRect.y) + '->' + Math.round(s.currentRect.y) + ']' : '?'
      }).slice(0,4),
    })
  } }).observe({ type: 'layout-shift', buffered: true })
} catch (e) { window.__jd.err = 'cls:' + e.message }
const watchTour = () => {
  try {
    new MutationObserver(() => {
      if (window.__jd.tour) return
      const d = document.querySelector('[role="dialog"]')
      if (!d) return
      const main = document.querySelector('main')
      window.__jd.tour = {
        t: Math.round(performance.now()),
        mainH: main ? Math.round(main.getBoundingClientRect().height) : 0,
        mainText: main ? main.innerText.trim().length : 0,
      }
    }).observe(document.documentElement, { childList: true, subtree: true })
  } catch (e) { window.__jd.err = (window.__jd.err||'') + ' tour:' + e.message }
}
if (document.documentElement) watchTour()
else document.addEventListener('readystatechange', function once(){ if(document.documentElement){document.removeEventListener('readystatechange',once); watchTour()} })
try { document.fonts.ready.then(() => { window.__jd.fonts = Math.round(performance.now()) }) } catch (e) {}
`

const rows = []
for (const [w, h, tag] of [[375, 667, '375'], [1280, 900, '1280']]) {
  for (const [netName, cond] of Object.entries(NET)) {
    // ── 완전한 첫 방문 상태 만들기 ───────────────────────────────
    await send('Network.clearBrowserCache')
    await send('Network.clearBrowserCookies')
    await send('Network.setCacheDisabled', { cacheDisabled: true })
    await send('Page.navigate', { url: BASE + '/' }); await sleep(1500)
    await ev(`try{localStorage.clear();sessionStorage.clear()}catch(e){}`)
    await send('Page.navigate', { url: 'about:blank' }); await sleep(300)
    await send('Network.setCacheDisabled', { cacheDisabled: false }) // 캐시는 비웠지만 끄지는 않는다 — 실제 첫 방문과 같게

    await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 })
    await send('Network.emulateNetworkConditions', cond)
    const identifier = (await send('Page.addScriptToEvaluateOnNewDocument', { source: PROBE })).result?.result?.identifier

    const t0 = Date.now()
    await send('Page.navigate', { url: BASE + '/?jd=' + Date.now() })
    // 다 그려질 때까지 기다린다 (진입 카드 3장이 다 보일 때 = 랜딩이 그려진 것)
    let painted = null
    for (let i = 0; i < 120; i++) {
      await sleep(250)
      const n = await ev(`document.querySelectorAll('[data-tour="entry"] li').length`)
      if (n >= 3) { painted = Date.now() - t0; break }
    }
    await sleep(2500) // 투어·글꼴이 뒤늦게 뜨는지 더 본다

    const m = await ev(`JSON.stringify((()=>{
      const nav = performance.getEntriesByType('navigation')[0] || {}
      const paints = {}; for (const p of performance.getEntriesByType('paint')) paints[p.name] = Math.round(p.startTime)
      const lcp = performance.getEntriesByType('largest-contentful-paint').slice(-1)[0]
      const res = performance.getEntriesByType('resource').map(r=>({n:r.name.split('/').pop().slice(0,28),t:Math.round(r.responseEnd),s:r.transferSize}))
      return {
        dcl: Math.round(nav.domContentLoadedEventEnd||0), load: Math.round(nav.loadEventEnd||0),
        ttfb: Math.round(nav.responseStart||0),
        fp: paints['first-paint']||null, fcp: paints['first-contentful-paint']||null,
        lcp: lcp?Math.round(lcp.startTime):null,
        cls: +(window.__jd.shifts||0).toFixed(4), shifts: window.__jd.shiftList,
        tour: window.__jd.tour, fonts: window.__jd.fonts, err: window.__jd.err,
        webfonts: [...document.fonts].map(f=>f.family).filter((v,i,a)=>a.indexOf(v)===i),
        res,
      }
    })())`)
    const d = JSON.parse(m)
    if (identifier) await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
    rows.push({ tag, net: netName, painted, ...d })
    console.log(`\n── ${tag}px / ${netName} ──`)
    console.log(`  TTFB ${d.ttfb}ms  FCP ${d.fcp}ms  LCP ${d.lcp}ms  DCL ${d.dcl}ms  load ${d.load}ms  카드3장 ${painted}ms`)
    console.log(`  레이아웃 이동(CLS) ${d.cls}${d.shifts.length ? '  ' + JSON.stringify(d.shifts.slice(0, 5)) : ''}`)
    console.log(`  투어 모달: ${d.tour ? d.tour.t + 'ms (그때 main 높이 ' + d.tour.mainH + 'px, 글자 ' + d.tour.mainText + '자)' : '안 뜸'}`)
    console.log(`  document.fonts.ready ${d.fonts}ms / 등록된 웹폰트 ${JSON.stringify(d.webfonts)}`)
    if (d.err) console.log(`  (관측자 오류: ${d.err})`)
  }
}
await send('Network.emulateNetworkConditions', NET['제한 없음'])
await send('Emulation.clearDeviceMetricsOverride')

console.log('\n────────────────────────')
// 판정
let bad = 0
for (const r of rows) {
  if (r.cls > 0.1) { console.log(`  ✘ ${r.tag}/${r.net}: 레이아웃 이동 ${r.cls} (>0.1)`); bad++ }
  if (r.tour && r.tour.mainText < 100) { console.log(`  ✘ ${r.tag}/${r.net}: 투어가 본문보다 먼저 떴다 (main 글자 ${r.tour.mainText}자)`); bad++ }
  if (r.webfonts.length) { console.log(`  ✘ ${r.tag}/${r.net}: 웹폰트가 있다 ${JSON.stringify(r.webfonts)}`); bad++ }
}
console.log(bad === 0 ? `통과 ${rows.length} / 실패 0` : `통과 ${rows.length - bad} / 실패 ${bad}`)
ws.close()
process.exit(bad ? 1 : 0)
