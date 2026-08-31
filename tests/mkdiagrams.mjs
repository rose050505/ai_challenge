/**
 * 기획서·발표 자료에 들어가는 그림 PNG 를 다시 뽑는다 — docs/assets/diagram-*.png
 *
 * 화면의 **가로판 SVG 를 그대로** 복제해 흰 바탕 위에 1600px 폭으로 놓고 찍는다.
 * (글꼴은 앱의 body 글꼴을 그대로 물려받아야 하므로 별도 문서를 만들지 않고
 *  같은 문서 안에 덮개를 씌운다.)
 *
 *   node tests/mkdiagrams.mjs            # 셋 다
 *   node tests/mkdiagrams.mjs routing    # 하나만
 *
 * ★ Diagrams.jsx 를 고쳤으면 반드시 다시 돌린다. 안 돌리면 기획서 그림만 옛 문구로 남는다.
 */
const BASE = process.env.APP_URL || 'http://localhost:4400'
const only = process.argv[2]
const WIDTH = 1600
const TARGETS = [
  { id: 'dg-loop',    out: 'diagram-loop.png',         path: '/', prep: null },
  { id: 'dg-arch',    out: 'diagram-architecture.png', path: '/strategy', prep: null },
  { id: 'dg-routing', out: 'diagram-routing.png',      path: '/diagnose?sample=returner',
    prep: `(()=>{const d=[...document.querySelectorAll('details')].find(d=>d.textContent.includes('정정을 요구하려면'));if(d)d.open=true})()` },
]
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const fs=await import('node:fs')

await send('Emulation.setDeviceMetricsOverride',{width:WIDTH+80,height:1200,deviceScaleFactor:1,mobile:false})
for (const t of TARGETS) {
  if (only && !t.id.includes(only)) continue
  const {identifier}=(await send('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.clear();localStorage.setItem('wy-tour-v1','done')}catch(e){}`})).result
  await send('Page.navigate',{url:BASE+t.path}); await sleep(1800)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})
  if (t.prep) { await ev(t.prep); await sleep(500) }
  const box = JSON.parse(await ev(`JSON.stringify((()=>{
    const src=document.querySelector('svg[data-diagram=${t.id}][data-layout=wide]');
    if(!src) return null;
    document.getElementById('shotwrap')?.remove();
    const wrap=document.createElement('div'); wrap.id='shotwrap';
    wrap.style.cssText='position:fixed;left:0;top:0;z-index:99999;background:#fff;padding:24px;';
    const c=src.cloneNode(true); c.removeAttribute('class');
    c.style.cssText='display:block;width:${WIDTH}px;height:auto;';
    wrap.appendChild(c); document.body.appendChild(wrap);
    window.scrollTo(0,0);
    const r=wrap.getBoundingClientRect();
    /* ceil 하면 덮개 밖 1px 이 딸려 들어와 아래쪽에 옛 화면의 선이 남는다 */
    return {x:0,y:0,width:Math.floor(r.width),height:Math.floor(r.height)-1}
  })())`))
  if (!box) { console.log('  ✘ 못 찾음', t.id); continue }
  const r=await send('Page.captureScreenshot',{format:'png',clip:{...box,scale:1},captureBeyondViewport:true})
  fs.writeFileSync(`docs/assets/${t.out}`, Buffer.from(r.result.data,'base64'))
  console.log(`  ✔ ${t.out}  ${box.width}×${box.height}`)
  await ev(`document.getElementById('shotwrap')?.remove()`)
}
ws.close(); process.exit(0)
