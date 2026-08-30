/** 작업 1 — /strategy 화면: 선정이유 / 유도 문구 / 폴백 구분 */
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const click=async txt=>{await ev(`(()=>{const e=[...document.querySelectorAll('button,a')].reverse().find(e=>e.textContent.trim().includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(e)e.click();return !!e})()`);await sleep(900)}
const text=async()=>await ev(`document.querySelector('main').innerText`)
const fs=await import('node:fs')
let pass=0,fail=0; const t_=(n,c)=>{ if(c) pass++; else {fail++; console.log('  FAIL',n)} }
const seed = async (journey, path='/strategy') => {
  const { identifier } = (await send('Page.addScriptToEvaluateOnNewDocument',
    { source:`try{localStorage.setItem('wae:journey:state', ${JSON.stringify(JSON.stringify(journey))})}catch(e){}` })).result
  await send('Page.navigate',{url:BASE+path}); await sleep(1200)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})
}
/** 앞 시험이 남긴 기록을 지운다 (앱의 pagehide 플러시가 외부 삭제를 되돌리므로 주입으로 지운다) */
const wipe = async (path) => seed({ schemaVersion:1, updatedAt:null, diagnosis:{}, strategy:{}, form:{}, response:{}, milestones:{} }, path)
const J = (d={}) => ({ schemaVersion:1, updatedAt:new Date().toISOString(),
  diagnosis:{ eventId:'cardRejected', counterpartyId:'FI', institutionSectorId:'creditFinance', ...d },
  strategy:{ notice:null, candidates:[], picked:[], source:null }, form:{}, response:{}, milestones:{} })

console.log('[1] 샘플 경로 — 캐시 응답에 선정이유가 있다')
await send('Emulation.setDeviceMetricsOverride',{width:900,height:900,deviceScaleFactor:1,mobile:false})
await wipe('/diagnose?sample=returner'); await sleep(600)
await send('Page.navigate',{url:BASE+'/strategy'}); await sleep(1000)
await click('제출할 정보 후보 만들기')
let tx = await text()
const reasonCount = await ev(`[...document.querySelectorAll('main li')].filter(e=>e.innerText.includes('이걸 고른 이유')).length`)
console.log(`    선정이유가 붙은 항목: ${reasonCount}개`)
t_('샘플 5개 항목 모두 선정이유', reasonCount===5)
t_('사용자 서술을 실제로 인용한다', tx.includes("'6개월 전 재취업했습니다'") || tx.includes('6개월 전 재취업했습니다'))
t_('샘플에는 "일반 목록입니다"가 뜨지 않는다', !tx.includes('일반 목록입니다'))
t_('샘플 안내가 뜬다', tx.includes('샘플 시나리오는 미리 준비된 예시'))
let r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})
fs.writeFileSync('strategy-cached.png',Buffer.from(r.result.data,'base64'))

console.log('[2] 서술 없음 — 유도 문구')
await seed(J({ reason:'' }))
await click('제출할 정보 후보 만들기')
tx = await text()
t_('"일반 목록입니다" 표시', tx.includes('일반 목록입니다'))
t_('유도 문구 표시', tx.includes('상황을 적어주시면 왜 이 항목인지 설명해 드립니다'))
t_('상황 적으러 가는 길 제공', await ev(`!![...document.querySelectorAll('main a')].find(a=>a.getAttribute('href')&&a.getAttribute('href').includes('/diagnose')&&a.textContent.includes('상황을 적으러'))`))
t_('선정이유는 하나도 없다', (await ev(`document.querySelector('main').innerText.split('이걸 고른 이유').length-1`))===0)
r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})
fs.writeFileSync('strategy-nosituation.png',Buffer.from(r.result.data,'base64'))

console.log('[3] 서술은 있으나 API 없음(preview) — 폴백 구분')
await seed(J({ reason:'프리랜서로 3년 일했는데 카드 발급이 거절됐습니다.' }))
await click('제출할 정보 후보 만들기')
tx = await text()
t_('"일반 목록입니다" 표시', tx.includes('일반 목록입니다'))
t_('상황을 읽지 못했다고 밝힌다', tx.includes('상황을 읽지 못해'))
t_('유도 문구는 뜨지 않는다(이미 적었으므로)', !tx.includes('상황을 적어주시면'))
t_('폴백 사유를 화면에 적는다', /기본 목록을 보여드립니다/.test(tx))
t_('선정이유는 하나도 없다', (await ev(`document.querySelector('main').innerText.split('이걸 고른 이유').length-1`))===0)
r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:true})
fs.writeFileSync('strategy-fallback.png',Buffer.from(r.result.data,'base64'))

console.log('[4] 서식으로 넘길 때 선정이유가 인쇄물에 새지 않는다')
await wipe('/diagnose?sample=returner'); await sleep(600)
await send('Page.navigate',{url:BASE+'/strategy'}); await sleep(900)
await click('제출할 정보 후보 만들기')
await click('를 서식에 넣기')
await sleep(1400)
const doc = await ev(`document.querySelector('main').innerText`)
t_('서식 화면에 선정이유가 없다', !doc.includes('이걸 고른 이유') && !doc.includes('라고 하셨'))
// 서식의 값은 input 이므로 innerText 에 없다. value 로 본다.
const vals = await ev(`JSON.stringify([...document.querySelectorAll('main input,main textarea')].map(e=>e.value).filter(Boolean))`)
t_('서식 입력칸에 정보명이 채워져 있다', JSON.parse(vals).some(v=>v.includes('재직증명서')))
t_('입력칸 어디에도 선정이유가 없다', !JSON.parse(vals).some(v=>v.includes('라고 하셨')))

console.log(`\ntstrategy: ${pass}/${pass+fail} 통과`)
ws.close(); process.exit(fail?1:0)
