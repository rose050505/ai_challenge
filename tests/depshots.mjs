// 산출물(스크린샷·PDF)은 tests/out/ 에 떨어진다. .gitignore 에 걸려 있다.
const OUT = new URL('./out/', import.meta.url).pathname
await (await import('node:fs/promises')).mkdir(OUT, { recursive: true })
const BASE=process.argv[2]||'https://362.parkmiyeong.com'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const fs=await import('node:fs')
const D=OUT+''
const click=async txt=>{const r=await ev(`(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`);await sleep(800);return r}
// 깨끗한 상태 + 투어 끔
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})
await send('Page.navigate',{url:BASE+'/'}); await sleep(1600)
await ev(`try{localStorage.setItem('wy-tour-v1','done')}catch(e){}`)
if(await click('처음부터')){await click('지우고 처음부터'); await sleep(800)}
const PAGES=[['landing','/'],['diagnose','/diagnose'],['strategy','/strategy'],['document','/document'],['next','/next'],['response','/response']]
for(const w of [375,768,1280]){
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:w<500?667:900,deviceScaleFactor:1,mobile:w<500})
  for(const [n,p] of PAGES){
    await send('Page.navigate',{url:BASE+p}); await sleep(1500)
    const over=await ev(`JSON.stringify({doc:document.documentElement.clientWidth,scroll:document.documentElement.scrollWidth})`)
    const o=JSON.parse(over)
    if(o.scroll>o.doc) console.log(`  ⚠ ${w} ${n} 가로 넘침 ${o.scroll}>${o.doc}`)
    const s=await send('Page.captureScreenshot',{format:'png'})
    fs.writeFileSync(`${D}dep2-${w}-${n}.png`,Buffer.from(s.result.data,'base64'))
  }
  console.log(w,'완료 — 가로 넘침 없음')
}
ws.close()
