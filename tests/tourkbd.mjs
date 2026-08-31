/** 둘러보기 — 키보드만으로 완주 / 포커스 트랩 / 시크릿 모드 */
const BASE = process.env.APP_URL || 'http://localhost:4400'
/* ★ 정거장 수·문구는 데이터에서 읽는다. 시험이 4정거장을 손으로 박고 있으면
   정거장을 줄이는 순간 코드가 아니라 시험이 막는다. */
const { TOUR_STATIONS, TOUR_INTRO, TOUR_OUTRO } = await import('../src/data/tour.js')
const N = TOUR_STATIONS.length
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map(); const errors=[]
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}
  if(m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
let pass=0,fail=0; const t_=(n,c,d='')=>{ if(c) pass++; else {fail++; console.log('  FAIL',n,d)} }
const key=async(k,code,vk)=>{for(const type of ['rawKeyDown','char','keyUp']){
  if(type==='char'&&!['Enter',' '].includes(k)) continue
  await send('Input.dispatchKeyEvent',{type,key:k,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,text:k==='Enter'?'\r':(k===' '?' ':undefined)})}}
const tab=(shift=false)=>send('Input.dispatchKeyEvent',{type:'rawKeyDown',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9,modifiers:shift?8:0})
  .then(()=>send('Input.dispatchKeyEvent',{type:'keyUp',key:'Tab',code:'Tab',windowsVirtualKeyCode:9,nativeVirtualKeyCode:9,modifiers:shift?8:0}))
const enter=()=>key('Enter','Enter',13)
const esc=()=>key('Escape','Escape',27)
const panel=()=>ev(`document.querySelector('[role=dialog][aria-modal]')?.innerText ?? ''`)
const active=()=>ev(`(()=>{const a=document.activeElement;return a?(a.tagName+'|'+(a.textContent||'').trim().slice(0,20)):'none'})()`)
const inPanel=()=>ev(`!!document.querySelector('[role=dialog][aria-modal]')?.contains(document.activeElement)`)
const wipe=async(path)=>{const {identifier}=(await send('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.clear()}catch(e){}`})).result
  await send('Page.navigate',{url:BASE+path}); await sleep(1300)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})}
/** 패널 안에서 원하는 버튼에 포커스가 갈 때까지 Tab */
const tabTo=async(label)=>{for(let i=0;i<12;i++){
  const a=await ev(`(()=>{const a=document.activeElement;return a&&a.tagName==='BUTTON'?a.textContent.trim():''})()`)
  if(a===label) return true
  await tab(); await sleep(120)} return false}

await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})

console.log(`[A] 키보드만으로 ${N}정거장 완주`)
await wipe('/')
t_('열리면 패널로 포커스가 간다', await ev(`document.activeElement===document.querySelector('[role=dialog][aria-modal]')`))
t_('포커스 트랩 — Tab 을 20번 눌러도 패널 밖으로 안 나간다', await (async()=>{
  for(let i=0;i<20;i++){ await tab(); await sleep(60); if(!(await inPanel())) return false } return true })())
// 1) 시작하기
t_('Tab 으로 [시작하기] 에 닿는다', await tabTo('시작하기'))
await enter(); await sleep(1400)
t_('① 정거장 (키보드)', (await panel()).includes(`1 / ${N}`))
for (let n=2; n<=N; n++) {
  t_(`Tab 으로 [다음] 에 닿는다 (→${n})`, await tabTo('다음'))
  // 회신 해석 정거장은 해석이 끝나야 대상이 생긴다. 그 정거장만 더 기다린다.
  await enter(); await sleep(TOUR_STATIONS[n-1].id==='interpret'?2200:1600)
  t_(`${n} / ${N} 정거장 (키보드)`, (await panel()).includes(`${n} / ${N}`), await panel().then(s=>s.slice(0,30)))
}
t_('Tab 으로 마지막 [다음]', await tabTo('다음'))
await enter(); await sleep(900)
t_('마무리 패널 (키보드)', (await panel()).includes(TOUR_OUTRO.title))
t_('Tab 으로 [닫기]', await tabTo('닫기'))
await enter(); await sleep(700)
t_('키보드로 완주 후 닫힘', (await panel())==='')
t_('완주 후 화면이 살아 있다', await ev(`!!document.querySelector('main')`))

console.log('[B] Esc 로 닫힌다')
await wipe('/')
await esc(); await sleep(600)
t_('Esc 로 닫힌다', (await panel())==='')
t_('Esc 도 "봤다"로 기억된다', await ev(`localStorage.getItem('wy-tour-v1')==='done'`))

console.log('[C] 시크릿 모드 (저장이 막힌 브라우저)')
const {identifier} = (await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  const boom = () => { throw new DOMException('The operation is insecure.','SecurityError') }
  Object.defineProperty(window,'localStorage',{configurable:true,get:()=>({
    getItem:boom,setItem:boom,removeItem:boom,clear:boom,key:boom,length:0,
  })})
`})).result
errors.length=0
await send('Page.navigate',{url:BASE+'/'}); await sleep(1600)
t_('저장이 막혀도 투어가 열린다', (await panel()).includes(TOUR_INTRO.title))
await ev(`(()=>{const p=document.querySelector('[role=dialog][aria-modal]');[...p.querySelectorAll('button')].find(b=>b.textContent.trim()==='시작하기').click()})()`); await sleep(1400)
t_('저장이 막혀도 ① 정거장이 뜬다', (await panel()).includes(`1 / ${N}`))
await ev(`(()=>{const p=document.querySelector('[role=dialog][aria-modal]');[...p.querySelectorAll('button')].find(b=>b.textContent.trim()==='다음').click()})()`); await sleep(1600)
t_('저장이 막혀도 ② 로 넘어간다', (await panel()).includes(`2 / ${N}`))
await ev(`(()=>{const p=document.querySelector('[role=dialog][aria-modal]');[...p.querySelectorAll('button')].find(b=>b.textContent.trim()==='건너뛰기').click()})()`); await sleep(700)
t_('저장이 막혀도 닫힌다', (await panel())==='')
t_('★ 처리되지 않은 예외 0건', errors.length===0, errors.join(' | '))
await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})

console.log(`\ntourkbd: ${pass}/${pass+fail} 통과`)
ws.close(); process.exit(fail?1:0)
