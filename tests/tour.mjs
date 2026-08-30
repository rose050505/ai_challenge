/** 둘러보기 — 마우스 완주 / 키보드 완주 / 이탈 후 사용 / 재방문 / 시크릿 */
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const fs=await import('node:fs')
let pass=0,fail=0; const t_=(n,c,d='')=>{ if(c) pass++; else {fail++; console.log('  FAIL',n,d)} }
const panel=()=>ev(`document.querySelector('[role=dialog][aria-modal]')?.innerText ?? ''`)
const clickIn=async(txt)=>{const ok=await ev(`(()=>{const p=document.querySelector('[role=dialog][aria-modal]');if(!p)return false;const b=[...p.querySelectorAll('button')].find(b=>b.textContent.trim()===${JSON.stringify(txt)});if(!b)return false;b.click();return true})()`);await sleep(1200);return ok}
const wipe=async(path)=>{const {identifier}=(await send('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.clear()}catch(e){}`})).result
  await send('Page.navigate',{url:BASE+path}); await sleep(1300)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})}
const path=()=>ev('location.pathname+location.search')
const holes=()=>ev(`document.querySelectorAll('svg mask#tour-mask rect').length-1`)

await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})

console.log('[A] 첫 방문 — 자동으로 열린다')
await wipe('/')
t_('첫 방문에 투어가 열린다', (await panel()).includes('2분만 따라와 보세요'))
t_('건너뛰기 버튼 존재', (await panel()).includes('건너뛰기'))

console.log('[B] 마우스로 4정거장 완주')
await clickIn('시작하기')
let p1=await panel()
t_('① 자가진단 정거장', p1.includes('단정하지 않습니다') && p1.includes('1 / 4'), p1.slice(0,40))
t_('① 경로 /', (await path())==='/')
t_('① 구멍 1개', (await holes())===1, String(await holes()))
let r=await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync('tour-1.png',Buffer.from(r.result.data,'base64'))

await clickIn('다음')
let p2=await panel()
t_('② 근거 정거장', p2.includes('조문 번호까지'))
t_('② 경로 /diagnose?sample=returner', (await path()).includes('/diagnose?sample=returner'), await path())
let badge=await ev(`document.querySelector('[data-tour=basis]')?.innerText.replace(/\\s+/g,' ')`)
t_('② 근거 배지가 보인다', /법 제2조 제1호의3/.test(badge||''), badge)
console.log('    기본:', badge)
// 시연 버튼
t_('② 시연 버튼', await clickIn('상호저축은행 · 신용대출 거절로 바꿔 보기'))
badge=await ev(`document.querySelector('[data-tour=basis]')?.innerText.replace(/\\s+/g,' ')`)
console.log('    시연 후:', badge)
t_('② 위임 경로가 드러난다', /가목 4\)/.test(badge||'') && /시행령 제2조 제6항 제1호/.test(badge||''), badge)
r=await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync('tour-2.png',Buffer.from(r.result.data,'base64'))

await clickIn('다음'); await sleep(1500)
let p3=await panel()
t_('③ 회신 해석 정거장', p3.includes('거절인지 아닌지'))
t_('③ 경로 /response', (await path()).includes('/response'), await path())
t_('③ 해석 결과가 그려졌다', await ev(`!!document.querySelector('[data-tour=coverage]')`))
t_('③ 구멍 2개', (await holes())===2, String(await holes()))
t_('③ 시연 되돌아감(샘플 복원)', await ev(`JSON.parse(localStorage.getItem('wae:journey:state')).diagnosis.eventId==='cardRejected'`))
r=await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync('tour-3.png',Buffer.from(r.result.data,'base64'))

await clickIn('다음'); await sleep(1500)
let p4=await panel()
t_('④ 서식 정거장', p4.includes('서식으로 그대로'))
t_('④ 경로 /document', (await path()).includes('/document'), await path())
const doc=await ev(`document.querySelector('main').innerText`)
t_('④ 회신 항목이 서식으로 넘어왔다', doc.includes('현행 정보') && /회신 해석에서 표시하신 \d건/.test(doc))
t_('④ 쪽 수 예고 존재', /현재 내용은 .?\d+페이지/.test(doc.replace(/\\s+/g,' ')))
r=await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync('tour-4.png',Buffer.from(r.result.data,'base64'))

await clickIn('다음')
t_('⑤ 마무리 패널', (await panel()).includes('한 바퀴 돌았습니다'))
await clickIn('닫기')
t_('닫으면 오버레이가 사라진다', (await panel())==='')
t_('닫은 뒤 화면 그대로 사용 가능', await ev(`!!document.querySelector('.print-sheet input')`))

console.log('[C] 재방문 — 자동으로 열리지 않는다')
await send('Page.navigate',{url:BASE+'/'}); await sleep(1200)
t_('재방문에 안 열린다', (await panel())===''  )
t_('버튼으로는 열 수 있다', await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='2분 둘러보기');if(!b)return false;b.click();return true})()`))
await sleep(600)
t_('버튼으로 열린다', (await panel()).includes('2분만 따라와'))
// 진행 기록이 있으므로 덮어쓰기 경고가 떠야 한다
t_('기록이 있으면 덮어쓰기 경고', (await panel()).includes('덮어써집니다'))
await clickIn('건너뛰기')

console.log('[D] 중간 이탈 → 그 화면에서 정상 사용')
await wipe('/')
await clickIn('시작하기'); await clickIn('다음')
await clickIn('건너뛰기')
t_('이탈 후 오버레이 없음', (await panel())==='')
t_('이탈 지점이 진단 화면', (await path()).includes('/diagnose'))
const canUse = await ev(`(()=>{const el=document.querySelector('#reason');if(!el)return false;el.focus();return document.activeElement===el})()`)
t_('이탈 지점에서 입력 가능', canUse===true)
t_('이탈도 "봤다"로 기억된다', await ev(`localStorage.getItem('wy-tour-v1')==='done'`))

console.log(`\ntour: ${pass}/${pass+fail} 통과`)
ws.close(); process.exit(fail?1:0)
