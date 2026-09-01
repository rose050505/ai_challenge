/**
 * 대비 실측 — 제출 문서(§2-5)가 적은 수치가 아직 맞는가.
 * 9/1 이후 테두리색이 전면 교체됐으므로 다시 잰다.
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
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })

const PROBE = `(()=>{
  const px=(c)=>{const m=(c||'').match(/[\\d.]+/g);return m?m.slice(0,3).map(Number):null}
  const lin=(v)=>{v/=255;return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4)}
  const L=(rgb)=>0.2126*lin(rgb[0])+0.7152*lin(rgb[1])+0.0722*lin(rgb[2])
  const ratio=(a,b)=>{const x=L(a),y=L(b);return +(((Math.max(x,y)+0.05)/(Math.min(x,y)+0.05))).toFixed(2)}
  const bgOf=(el)=>{for(let e=el;e;e=e.parentElement){const c=px(getComputedStyle(e).backgroundColor)
    const a=(getComputedStyle(e).backgroundColor.match(/[\\d.]+/g)||[])[3]
    if(c&&a!=='0')return c} return [255,255,255]}
  const out={text:{},border:{}}
  // 글자 대비 — main 안의 실제 글자 노드
  for(const el of document.querySelectorAll('main h1,main h2,main h3,main p,main li,main span,main b,main a')){
    if(!el.textContent.trim())continue
    const cs=getComputedStyle(el); if(cs.display==='none'||cs.visibility==='hidden')continue
    if(el.children.length&&!/^[^<]*$/.test(el.innerHTML))continue
    const r=ratio(px(cs.color),bgOf(el.parentElement||el))
    const size=parseFloat(cs.fontSize)
    const k=size>=18||(size>=14&&Number(cs.fontWeight)>=700)?'큰 글자':'본문 글자'
    out.text[k]=Math.min(out.text[k]??99,r)
  }
  // 구획선 대비 — 실제로 그려지는 테두리
  for(const el of document.querySelectorAll('main *')){
    const cs=getComputedStyle(el)
    const w=parseFloat(cs.borderTopWidth)||parseFloat(cs.borderLeftWidth)
    if(!w)continue
    const c=px(cs.borderTopColor)||px(cs.borderLeftColor); if(!c)continue
    const a=(cs.borderTopColor.match(/[\\d.]+/g)||[])[3]; if(a==='0')continue
    const bg=bgOf(el.parentElement||el)
    const r=ratio(c,bg)
    const key=cs.borderTopColor+' on rgb('+bg.join(', ')+')'
    if(!out.border[key]||out.border[key].n<1)out.border[key]={ratio:r,n:0,cls:(el.className||'').toString().slice(0,40)}
    out.border[key].n++
  }
  return JSON.stringify(out)
})()`

for (const p of ['/', '/diagnose?sample=returner', '/next', '/response?sample=partial&run=1']) {
  const { identifier } = (await send('Page.addScriptToEvaluateOnNewDocument', { source: `try{localStorage.clear();localStorage.setItem('wy-tour-v1','done')}catch(e){}` })).result
  await send('Page.navigate', { url: BASE + p }); await sleep(1800)
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
  await ev(`document.querySelectorAll('details').forEach(d=>d.open=true)`); await sleep(400)
  const d = JSON.parse(await ev(PROBE))
  console.log('\n── ' + p + ' ──')
  console.log('  글자 최저 대비:', JSON.stringify(d.text))
  const bs = Object.entries(d.border).sort((a, b) => a[1].ratio - b[1].ratio)
  for (const [k, v] of bs) console.log(`  선 ${String(v.ratio).padStart(5)}:1  ×${String(v.n).padStart(3)}  ${k}  ${v.cls}`)
}
await send('Emulation.clearDeviceMetricsOverride')
ws.close()
