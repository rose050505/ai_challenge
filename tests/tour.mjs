/** 둘러보기 — 마우스 완주 / 키보드 완주 / 이탈 후 사용 / 재방문 / 시크릿 */
const BASE = process.env.APP_URL || 'http://localhost:4400'
/* ★ 정거장 수·문구는 데이터에서 읽는다. 손으로 박아 두면 정거장을 줄일 때
   코드가 아니라 시험이 막는다. */
const { TOUR_STATIONS, TOUR_INTRO, TOUR_OUTRO } = await import('../src/data/tour.js')
const N = TOUR_STATIONS.length
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
t_('첫 방문에 투어가 열린다', (await panel()).includes(TOUR_INTRO.title))
t_('건너뛰기 버튼 존재', (await panel()).includes('건너뛰기'))

console.log(`[B] 마우스로 ${N}정거장 완주`)
t_('소개가 자가진단을 비춘다', (await holes())===1, String(await holes()))
await clickIn('시작하기')
let p1=await panel()
t_('① 근거 정거장', p1.includes(TOUR_STATIONS[0].title) && p1.includes(`1 / ${N}`), p1.slice(0,40))
t_('① 경로 /diagnose?sample=returner', (await path()).includes('/diagnose?sample=returner'), await path())
let badge=await ev(`document.querySelector('[data-tour=basis]')?.innerText.replace(/\\s+/g,' ')`)
t_('① 근거 배지가 보인다', /법 제2조 제1호의3/.test(badge||''), badge)
console.log('    기본:', badge)
// 시연 버튼
t_('① 시연 버튼', await clickIn(TOUR_STATIONS[0].action.on))
badge=await ev(`document.querySelector('[data-tour=basis]')?.innerText.replace(/\\s+/g,' ')`)
console.log('    시연 후:', badge)
t_('① 위임 경로가 드러난다', /가목 4\)/.test(badge||'') && /시행령 제2조 제6항 제1호/.test(badge||''), badge)
let r=await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync('tour-1.png',Buffer.from(r.result.data,'base64'))

await clickIn('다음'); await sleep(1500)
let p2=await panel()
t_('② 회신 해석 정거장', p2.includes(TOUR_STATIONS[1].title), p2.slice(0,40))
t_('② 경로 /response', (await path()).includes('/response'), await path())
t_('② 해석 결과가 그려졌다', await ev(`!!document.querySelector('[data-tour=coverage]')`))
t_('② 구멍 2개', (await holes())===2, String(await holes()))
t_('② 시연 되돌아감(샘플 복원)', await ev(`JSON.parse(localStorage.getItem('wae:journey:state')).diagnosis.eventId==='cardRejected'`))
r=await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync('tour-2.png',Buffer.from(r.result.data,'base64'))

await clickIn('다음'); await sleep(1500)
let p3=await panel()
t_('③ 서식 정거장', p3.includes(TOUR_STATIONS[2].title), p3.slice(0,40))
t_('③ 경로 /document', (await path()).includes('/document'), await path())
const doc=await ev(`document.querySelector('main').innerText`)
t_('③ 회신 항목이 서식으로 넘어왔다', doc.includes('현행 정보') && /회신 해석에서 표시하신 \d건/.test(doc))
t_('③ 쪽 수 예고 존재', /현재 내용은 .?\d+페이지/.test(doc.replace(/\\s+/g,' ')))
r=await send('Page.captureScreenshot',{format:'png'}); fs.writeFileSync('tour-3.png',Buffer.from(r.result.data,'base64'))

console.log('[C] 재방문 — 자동으로 열리지 않는다')
await send('Page.navigate',{url:BASE+'/'}); await sleep(1200)
t_('재방문에 안 열린다', (await panel())===''  )
t_('버튼으로는 열 수 있다', await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent.trim()==='2분 둘러보기');if(!b)return false;b.click();return true})()`))
await sleep(600)
t_('버튼으로 열린다', (await panel()).includes(TOUR_INTRO.title))
// 진행 기록이 있으므로 덮어쓰기 경고가 떠야 한다
t_('기록이 있으면 덮어쓰기 경고', (await panel()).includes('덮어써집니다'))
await clickIn('건너뛰기')

console.log('[D] 중간 이탈 → 그 화면에서 정상 사용')
await wipe('/')
// 정거장 1(근거)에서 나간다. 그 화면이 /diagnose 다.
await clickIn('시작하기')
await clickIn('건너뛰기')
t_('이탈 후 오버레이 없음', (await panel())==='')
t_('이탈 지점이 진단 화면', (await path()).includes('/diagnose'))
const canUse = await ev(`(()=>{const el=document.querySelector('#reason');if(!el)return false;el.focus();return document.activeElement===el})()`)
t_('이탈 지점에서 입력 가능', canUse===true)
t_('이탈도 "봤다"로 기억된다', await ev(`localStorage.getItem('wy-tour-v1')==='done'`))

console.log('[E] 375px — 정거장이 바뀌면 패널이 맨 위부터 보인다')
/* ★ 실기에서 나온 버그: 패널은 overflow-y-auto 라, 앞 정거장에서 안쪽을 내려 두면
     그 scrollTop 이 남아 다음 정거장의 글이 중간부터 보였다. */
await send('Emulation.setDeviceMetricsOverride',{width:375,height:667,deviceScaleFactor:1,mobile:true})
const scrollTop=()=>ev(`document.querySelector('[role=dialog][aria-modal]')?.scrollTop ?? -1`)
const scrollable=()=>ev(`(()=>{const p=document.querySelector('[role=dialog][aria-modal]');return p?p.scrollHeight-p.clientHeight:-1})()`)
const nextVisible=()=>ev(`(()=>{const p=document.querySelector('[role=dialog][aria-modal]');if(!p)return false;
  const b=[...p.querySelectorAll('button')].find(b=>['다음','시작하기','닫기'].includes(b.textContent.trim()));
  if(!b)return false; const r=b.getBoundingClientRect();
  return r.top>=0 && r.bottom<=innerHeight+1})()`)
await wipe('/')
t_('소개: 패널이 맨 위', (await scrollTop())===0, String(await scrollTop()))
t_('소개: [시작하기]가 스크롤 없이 보인다', await nextVisible())
await clickIn('시작하기')
for (let n=1; n<=N; n++) {
  if (n>1) { await clickIn('다음'); await sleep(1500) }
  // 일부러 패널 안쪽을 끝까지 내린 다음 넘어간다 — 실기와 같은 조건
  const room = await scrollable()
  t_(`${n}/${N}: 패널이 맨 위부터`, (await scrollTop())===0, String(await scrollTop()))
  t_(`${n}/${N}: [다음]이 스크롤 없이 보인다`, await nextVisible(), `여유 ${room}px`)
  /* 배경 화면도 강조 대상으로 스크롤돼야 한다 — 패널 안쪽 스크롤과는 별개다 */
  const first = TOUR_STATIONS[n-1].targets[0]
  t_(`${n}/${N}: 강조 대상이 화면 안에 있다`, await ev(
    `(()=>{const e=document.querySelector('[data-tour=${first}]');if(!e)return false;`+
    `const r=e.getBoundingClientRect();return r.top<innerHeight && r.bottom>0})()`), first)
  await ev(`(()=>{const p=document.querySelector('[role=dialog][aria-modal]');if(p)p.scrollTop=p.scrollHeight})()`)
}
// [이전] 으로 돌아갈 때도 같다
await clickIn('이전'); await sleep(1500)
t_('[이전] 뒤에도 패널이 맨 위', (await scrollTop())===0, String(await scrollTop()))
await clickIn('건너뛰기')
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})

console.log(`\ntour: ${pass}/${pass+fail} 통과`)
ws.close(); process.exit(fail?1:0)
