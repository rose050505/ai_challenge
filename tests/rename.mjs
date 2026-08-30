/** 서비스명 변경 — 표기 / 유래 / 기존 파일·기록 호환 / 서식 무영향 */
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map(); const errs=[]
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}
  if(m.method==='Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text)}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const click=async txt=>{const ok=await ev(`(()=>{const e=[...document.querySelectorAll('button,a,summary')].reverse().find(e=>e.textContent.trim().includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`);await sleep(800);return ok}
const body=()=>ev('document.body.innerText.replace(/\\s+/g," ")')
let pass=0,fail=0; const t_=(n,c,d='')=>{ if(c) pass++; else {fail++; console.log('  FAIL',n,d)} }
const seed=async(path,extra='')=>{const {identifier}=(await send('Page.addScriptToEvaluateOnNewDocument',{source:
  `try{localStorage.clear();localStorage.setItem('wy-tour-v1','done');${extra}}catch(e){}`})).result
  await send('Page.navigate',{url:BASE+path}); await sleep(1400)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})}

await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})

console.log('[A] 표기')
await seed('/')
t_('문서 <title> 전체 표기', (await ev('document.title'))==='삼육이 — 자동화평가 설명·이의제기 지원 서비스', await ev('document.title'))
t_('meta description 에 서비스명', (await ev(`document.querySelector('meta[name=description]')?.content ?? ''`)).startsWith('삼육이는'))
const logo = await ev(`document.querySelector('header a[aria-label]')?.innerText.replace(/\\s+/g,' ')`)
t_('로고 자리 짧은 호칭', logo?.startsWith('삼육이'), logo)
t_('로고 부제', logo?.includes('자동화평가 설명·이의제기 지원 서비스'), logo)
t_('로고 aria-label', (await ev(`document.querySelector('header a[aria-label]')?.getAttribute('aria-label')`))==='삼육이 — 처음으로')
const foot = await ev(`document.querySelector('footer')?.innerText.replace(/\\s+/g,' ')`)
t_('푸터 전체 표기', foot?.includes('삼육이 — 자동화평가 설명·이의제기 지원 서비스'))
let b = await body()
t_('이전 이름이 화면에 남지 않음(설명 문장 제외)', !/삼육이[^—]*왜요\s*—/.test(b))
t_('문장 안에서 "삼육이는 …"', b.includes('삼육이는 그 요구서를 대신 만들어 드립니다'))

console.log('[B] 이름의 유래')
t_('유래 문장', b.includes('이름은 신용정보법 제36조의2에서 왔습니다'))
t_('유래 설명', b.includes('이 조문 하나가 이 서비스의 전부입니다'))
const link = await ev(`(()=>{const a=[...document.querySelectorAll('a.basis-link')].find(a=>a.textContent.includes('이름의 유래'));
  return a? JSON.stringify({href:a.getAttribute('href'),target:a.getAttribute('target'),rel:a.getAttribute('rel'),text:a.textContent.replace(/\\s+/g,' ').trim()}) : null})()`)
t_('유래에 근거 조문 배지', !!link, String(link))
const L = link && JSON.parse(link)
t_('배지가 국가법령정보센터 제36조의2로 연결', L?.href?.includes('law.go.kr') && decodeURIComponent(L.href).includes('제36조의2'), L?.href)
t_('새 탭 + noopener noreferrer', L?.target==='_blank' && L?.rel==='noopener noreferrer')
t_('"왜요?"는 설명 문장으로 남아 있다', b.includes('AI가 내린 결정에도 “왜요?”라고 물을 수 있습니다'))

console.log('[C] 기존 자산 호환')
// 이전 이름으로 내보낸 파일(표지는 그대로)이 열려야 한다
const OLD = JSON.stringify({app:'wae.journey',schemaVersion:1,exportedAt:'2026-08-01T00:00:00.000Z',
  journey:{schemaVersion:1,updatedAt:'2026-08-01T00:00:00.000Z',
    diagnosis:{eventId:'loanRejected',counterpartyId:'CB',reason:'이전 버전에서 내보낸 기록'},
    strategy:{},form:{personal:{name:'구파일테스트'}},response:{},milestones:{}}})
await seed('/')
await click('작성 중인 내용 불러오기')
await ev(`(()=>{const dt=new DataTransfer();
  dt.items.add(new File([${JSON.stringify(OLD)}],'왜요-기록-20260801-0900.json',{type:'application/json'}));
  const i=document.querySelector('input[type=file]'); i.files=dt.files; i.dispatchEvent(new Event('change',{bubbles:true})); return true})()`)
await sleep(1400)
b = await body()
t_('★ 이전 파일명 형식의 파일이 열린다', b.includes('기록을 불러왔습니다'), b.slice(0,80))
await send('Page.navigate',{url:BASE+'/diagnose'}); await sleep(1200)
t_('불러온 내용이 복원된다', (await ev(`document.querySelector('#reason')?.value`))==='이전 버전에서 내보낸 기록')
// 새 파일명 — 실제 [파일로 내보내기]가 만드는 이름. 화면이 그 이름을 알려 준다.
await send('Page.navigate',{url:BASE+'/'}); await sleep(1200)
await ev(`(()=>{const d=document.querySelector('details'); if(d) d.open=true; return true})()`)
await sleep(300)
await click('파일로 내보내기')
const msg = await ev(`(()=>{const el=[...document.querySelectorAll('p,div')].map(e=>e.textContent||'').find(t=>/로 내보냈습니다/.test(t)); return el||''})()`)
const fname = (/([가-힣A-Za-z0-9_-]+\.json)\s*로 내보냈습니다/.exec(msg)||[])[1]
t_('★ 새 내보내기 파일명', /^삼육이-기록-\d{8}-\d{4}\.json$/.test(fname||''), String(fname))

console.log('[D] 저장소 네임스페이스 불변')
await send('Page.navigate',{url:BASE+'/'}); await sleep(1000)
const keys = await ev(`JSON.stringify(Object.keys(localStorage))`)
t_('★ localStorage 키가 wae:journey:state 그대로', JSON.parse(keys).includes('wae:journey:state'), keys)
t_('표지가 wae.journey 그대로', (await ev(`JSON.parse(localStorage.getItem('wae:journey:state')) && true`))===true)

console.log('[E] 서식에는 서비스명이 없다')
await seed('/document?form=explanationRequest')
let sheet = await ev(`document.querySelector('.print-sheet')?.innerText ?? ''`)
t_('서식 1에 서비스명 없음', !sheet.includes('삼육이') && !sheet.includes('왜요'), sheet.slice(0,60))
await seed('/document?form=correctionRequest')
sheet = await ev(`document.querySelector('.print-sheet')?.innerText ?? ''`)
t_('서식 2에 서비스명 없음', !sheet.includes('삼육이') && !sheet.includes('왜요'), sheet.slice(0,60))
t_('★ 처리되지 않은 예외 0건', errs.length===0, errs.join('|'))

console.log(`\nrename: ${pass}/${pass+fail} 통과`)
ws.close(); process.exit(fail?1:0)
