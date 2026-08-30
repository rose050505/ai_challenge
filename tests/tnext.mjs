/** 작업 3 — /next 접기 구조: 상황별 기본 펼침 / 접근성 / 인쇄 */
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
let pass=0, fail=0
const t_=(n,c)=>{ if(c) pass++; else {fail++; console.log('  FAIL', n)} }

const seed = async (journey) => {
  const { identifier } = (await send('Page.addScriptToEvaluateOnNewDocument',
    { source: `try{localStorage.setItem('wae:journey:state', ${JSON.stringify(JSON.stringify(journey))})}catch(e){}` })).result
  await send('Page.navigate',{url:BASE+'/next'}); await sleep(1100)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})
}
const J = (extra={}) => ({ schemaVersion:1, updatedAt:new Date().toISOString(),
  diagnosis:{}, strategy:{}, form:{}, response:{}, milestones:{}, ...extra })

/** 각 접기 섹션의 제목과 열림 상태 */
const states = `JSON.stringify([...document.querySelectorAll('main h2 > button[aria-expanded]')].map(b=>({
  title: (b.querySelector('span.text-lg,span.block.text-lg')||b).textContent.trim().slice(0,20),
  open: b.getAttribute('aria-expanded')==='true',
  hasSummary: !!b.textContent.trim().split('\\n').length,
  controls: b.getAttribute('aria-controls'),
  panelExists: !!document.getElementById(b.getAttribute('aria-controls')),
})))`

console.log('[1] 기록 없음')
await seed(J())
let s = JSON.parse(await ev(states))
s.forEach(x=>console.log(`    ${x.open?'펼침':'접힘'}  ${x.title}`))
t_('섹션 7개(본문 6 + 회신이 오지 않으면)', s.length===7)
t_('제출 전 → "어디로 내나요"만 펼침', s.filter(x=>x.open).length===1 && s.find(x=>x.open).title.includes('어디로'))
t_('모든 패널에 aria-controls 대상 존재', s.every(x=>!x.controls || (x.open ? x.panelExists : !x.panelExists)))

console.log('[2] 제출 기록 있음')
await seed(J({ milestones:{ explanationRequest:{ printedAt:'2026-08-20T01:00:00.000Z', submittedAt:'2026-08-20T02:00:00.000Z' } } }))
s = JSON.parse(await ev(states))
s.forEach(x=>console.log(`    ${x.open?'펼침':'접힘'}  ${x.title}`))
const openT = s.filter(x=>x.open).map(x=>x.title)
t_('제출 후 → 언제 답이 오나요 펼침', openT.some(x=>x.includes('언제 답이')))
t_('제출 후 → 회신이 오지 않으면 펼침', openT.some(x=>x.includes('회신이 오지')))
t_('제출 후 → 어디로 내나요는 접힘', !openT.some(x=>x.includes('어디로')))

console.log('[3] 거절 판정 회신을 해석하고 옴')
await seed(J({ response:{ interpretation:{ refused:true, covered:[], missing:[], baseInfoItems:[], refusalReasonText:'상거래관계 유지가 곤란' }, errors:[], catOverrides:{} } }))
s = JSON.parse(await ev(states))
s.forEach(x=>console.log(`    ${x.open?'펼침':'접힘'}  ${x.title}`))
t_('거절 판정 → "거절당하면" 펼침', s.filter(x=>x.open).some(x=>x.title.includes('거절당하면')))

console.log('[4] 접근성 · 인쇄')
// 접힌 섹션도 제목만으로 내용을 알 수 있는가 — 요약줄 존재
const summaries = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('main h2 > button[aria-expanded]')].map(b=>b.innerText.trim().split('\\n').filter(Boolean).length))`))
t_('모든 섹션에 제목 + 한 줄 요약', summaries.every(n=>n>=2))
// 키보드: Tab 으로 모든 토글에 닿는가
const reachable = await ev(`(()=>{const bs=[...document.querySelectorAll('main h2 > button[aria-expanded]')];return bs.every(b=>b.tabIndex>=0 && b.offsetParent!==null)})()`)
t_('토글 7개 모두 키보드로 닿는다', reachable===true)
// 스페이스/엔터로 열리는가 (네이티브 button)
const SEL = "main h2 > button[aria-expanded]"
await ev(`document.querySelectorAll('${SEL}')[1].focus()`)
const focused = await ev(`document.activeElement===document.querySelectorAll('${SEL}')[1]`)
t_('토글에 포커스가 간다', focused===true)
const before = await ev(`document.querySelectorAll('${SEL}')[1].getAttribute('aria-expanded')`)
for (const k of [{type:'rawKeyDown'},{type:'char',text:'\r'},{type:'keyUp'}])
  await send('Input.dispatchKeyEvent',{key:'Enter',code:'Enter',windowsVirtualKeyCode:13,nativeVirtualKeyCode:13,...k})
await sleep(350)
const after = await ev(`document.querySelectorAll('${SEL}')[1].getAttribute('aria-expanded')`)
t_(`Enter 로 상태가 바뀐다 (${before} → ${after})`, before!==after)
// 스페이스로도 (button 의 기본 동작)
for (const k of [{type:'rawKeyDown'},{type:'char',text:' '},{type:'keyUp'}])
  await send('Input.dispatchKeyEvent',{key:' ',code:'Space',windowsVirtualKeyCode:32,nativeVirtualKeyCode:32,...k})
await sleep(350)
const after2 = await ev(`document.querySelectorAll('${SEL}')[1].getAttribute('aria-expanded')`)
t_(`스페이스로 상태가 바뀐다 (${after} → ${after2})`, after!==after2)
// 인쇄: beforeprint 로 전부 펼쳐지는가
await send('Emulation.setEmulatedMedia',{media:'print'})
await ev(`window.dispatchEvent(new Event('beforeprint'))`); await sleep(400)
const allOpen = await ev(`[...document.querySelectorAll('main h2 > button[aria-expanded]')].every(b=>b.getAttribute('aria-expanded')==='true')`)
t_('인쇄 직전 모든 섹션이 펼쳐진다', allOpen===true)
const printedChars = await ev(`document.querySelector('main').innerText.replace(/\\s+/g,'').length`)
t_(`인쇄 본문 글자수 ${printedChars}자 (접힌 내용이 살아 있다)`, printedChars > 3000)
await send('Emulation.setEmulatedMedia',{media:''})

console.log(`\ntnext: ${pass}/${pass+fail} 통과`)
ws.close(); process.exit(fail?1:0)
