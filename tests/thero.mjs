// [A] 랜딩 제목 · [A-2] 서식 정본 미대조 고지 · 진단 결과의 바로가기 줄.
//
// 지키려는 것 (2026-08-31)
//  1. 제목이 사건 하나("대출 거절")에 묶이지 않는다 — 다섯 사건을 다 다루는 서비스다
//  2. 부제에 근거 조문 배지가 붙는다
//  3. 375×667 첫 화면에 진입 카드 두 장이 통째로 들어온다
//  4. 쉬운 말 보기에서도 제목·부제가 바뀌고, 진입 카드가 첫 화면 안에 남는다
//  5. 서식 화면이 "고시 별지 원본과 대조하지 못했다"를 밝힌다
//  6. 진단 결과 앞머리에 다음 화면으로 가는 줄이 있다
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map(); const errs=[]
ws.onmessage=e=>{const m=JSON.parse(e.data)
 if(m.method==='Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text)
 if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const click=async txt=>{const ok=await ev(`(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`);await sleep(700);return ok}
const setSel=v=>ev(`(()=>{const s=document.querySelector('select');if(!s)return false;const set=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set;set.call(s,${JSON.stringify(v)});s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
const y=async q=>ev(`(()=>{const e=${q};return e?Math.round(e.getBoundingClientRect().top+scrollY):null})()`)
let pass=0,fail=0
const t_=(name,cond,extra='')=>{cond?pass++:fail++;console.log((cond?'  ok  ':'  FAIL')+' '+name+(cond?'':' — '+extra))}

// ── 375 · 기본 ─────────────────────────────────────────────────
// ★ 로드된 뒤에 localStorage.clear() 를 하면 안 된다. 이미 뜬 앱이 메모리에 든
//   여정을 도로 저장해서 [이어서 하기] 카드가 뜨고, 첫 화면 측정이 202px 어긋난다.
//   앱이 뜨기 전에 지운다.
const {result:{identifier:seed}} = await send('Page.addScriptToEvaluateOnNewDocument',
  {source:`try{localStorage.clear();localStorage.setItem('wy-tour-v1','done')}catch(e){}`})
await send('Emulation.setDeviceMetricsOverride',{width:375,height:667,deviceScaleFactor:1,mobile:true})
await send('Page.navigate',{url:BASE+'/'}); await sleep(1400)
await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:seed})

console.log('[A] 랜딩 제목')
const h1 = await ev(`document.querySelector('h1').textContent.replace(/\\s+/g,' ').trim()`)
t_('제목이 사건 하나에 묶이지 않는다', !/대출이 거절|카드 발급이 거절|금리가 인상/.test(h1), h1)
t_('제목이 무엇을 묻는 서비스인지 말한다', /심사 결과/.test(h1) && /물을 수 있습니다/.test(h1), h1)
const body = await ev(`document.body.innerText.replace(/\\s+/g,' ')`)
t_('부제가 다섯 사건을 다 담는다',
   ['대출','카드','한도 축소','금리 인상'].every(w=>body.includes(w)), body.slice(0,200))
/* 이 문장은 히어로 부제에서 "이름의 유래" 단락으로 내려갔다(진입 카드가 그 일을 대신한다).
   첫 화면 밖이어도 랜딩에 남아 있어야 한다 — 이름을 문장 안에서 한 번은 쓴다. */
t_('랜딩이 서비스가 무엇을 하는지 한 줄로 말한다', body.includes('삼육이는 그 요구서를 대신 만들어 드립니다'))
// 근거 배지 — 부제와 같은 문단 안에 있어야 한다(줄을 따로 만들면 버튼이 밀린다)
const badge = await ev(`(()=>{const p=[...document.querySelectorAll('p')].find(p=>p.textContent.includes('한도 축소'));
  if(!p)return null; const a=p.querySelector('a.basis-link'); return a?JSON.stringify({t:a.textContent.replace(/\\s+/g,' ').trim(),href:a.getAttribute('href')}):null})()`)
t_('부제의 조문에 근거 배지', !!badge, String(badge))
const B = badge && JSON.parse(badge)
t_('배지가 제36조의2 원문으로 연결', !!B && decodeURIComponent(B.href).includes('제36조의2'), B?.href)

console.log('[A] 375×667 첫 화면')
/*
 * ★ 첫 화면의 계약이 바뀌었다. (2026-08-31 사용자 지적 — "훑어서 보이게")
 *   앞서는 [내 상황으로 시작하기] 버튼 하나와 자가진단 제목이 들어오는지를 쟀다.
 *   지금은 히어로 아래에 **진입 카드**가 있고, 그 카드가 각기 다른 화면으로 들어간다.
 *   재는 것: 진입 제목과 **카드 두 장이 통째로** 첫 화면 안에 들어오는가.
 *   (셋째 장은 일부러 걸치게 둔다 — 아래에 더 있다는 신호다)
 */
const entryY = await y(`[...document.querySelectorAll('h2')].find(e=>e.textContent.includes('어떤 상황이신가요'))`)
const cards  = await ev(`JSON.stringify([...document.querySelectorAll('.entry-card')].map(e=>{
  const r=e.getBoundingClientRect(); return {top:Math.round(r.top+scrollY),bottom:Math.round(r.bottom+scrollY)}}))`)
const C = JSON.parse(cards)
const scY  = await y(`[...document.querySelectorAll('h2')].find(e=>e.textContent.includes('혹시 이런 일'))`)
t_('진입 카드가 셋', C.length===3, String(C.length))
t_('"지금 어떤 상황이신가요"가 첫 화면 안', entryY!==null && entryY < 667, 'y='+entryY)
t_('★ 진입 카드 첫 장이 통째로 첫 화면 안', C[0] && C[0].bottom <= 667, JSON.stringify(C[0]))
t_('★ 진입 카드 둘째 장이 통째로 첫 화면 안', C[1] && C[1].bottom <= 667, JSON.stringify(C[1]))
t_('셋째 장은 아래에 더 있다는 신호로 남는다', C[2] && C[2].top > 640, JSON.stringify(C[2]))
t_('카드마다 목적지가 다르다', await ev(`(()=>{const h=[...document.querySelectorAll('.entry-card')].map(a=>a.getAttribute('href'));
  return new Set(h).size===h.length && h.every(Boolean)})()`))
t_('자가진단은 진입 카드 아래에 있다', scY!==null && entryY!==null && scY > entryY, 'y='+scY)
t_('가로 넘침 없음', (await ev(`document.documentElement.scrollWidth<=document.documentElement.clientWidth`)))

console.log('[A] 쉬운 말 보기')
const {result:{identifier:seedP}} = await send('Page.addScriptToEvaluateOnNewDocument',
  {source:`try{localStorage.clear();localStorage.setItem('wy-tour-v1','done');localStorage.setItem('wy-plain','1')}catch(e){}`})
await send('Page.navigate',{url:BASE+'/'}); await sleep(1400)
await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:seedP})
const ph1 = await ev(`document.querySelector('h1').textContent.replace(/\\s+/g,' ').trim()`)
t_('제목이 쉬운 말로 바뀐다', ph1 !== h1 && ph1.includes('컴퓨터'), ph1)
t_('쉬운 말 제목도 사건 하나에 묶이지 않는다', !/대출이 거절/.test(ph1), ph1)
const pBody = await ev(`document.body.innerText.replace(/\\s+/g,' ')`)
t_('부제도 쉬운 말로 바뀐다', pBody.includes('정해 둔 권리입니다'), pBody.slice(0,200))
const pCards = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('.entry-card')].map(e=>{
  const r=e.getBoundingClientRect(); return Math.round(r.bottom+scrollY)}))`))
t_('쉬운 말에서도 진입 카드 첫 장이 첫 화면 안', pCards[0] !== undefined && pCards[0] < 667, 'y='+pCards[0])

// ★ 쉬운 말을 켠 채로 끝내면 다음 시험(phase5 "기본은 원문")이 깨진다.
//   같은 브라우저·같은 localStorage 를 쓰기 때문이다. 여기서 되돌린다.
const {result:{identifier:seedR}} = await send('Page.addScriptToEvaluateOnNewDocument',
  {source:`try{localStorage.clear();localStorage.setItem('wy-tour-v1','done')}catch(e){}`})

/* ★ 2026-09-04 정본을 확보해 대조를 마쳤다. 그 전까지 여기 있던 "원본과 대조하지
     못했습니다"는 이제 사실이 아니다 — 그 문장이 **되살아나지 않는지**까지 잠근다.
     확인한 것만 적는다는 규칙은 방향이 바뀌어도 같다. */
console.log('[A-2] 서식 — 정본과 대조했다는 사실')
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})
for (const f of ['explanationRequest','correctionRequest']) {
  await send('Page.navigate',{url:BASE+'/document?form='+f}); await sleep(1500)
  const b = await ev(`document.body.innerText.replace(/\\s+/g,' ')`)
  t_(`${f}: 정본 대조 사실을 밝힌다`,
     b.includes('별지 제15호의2·제15호의3 정본과 대조했습니다'), b.slice(0,80))
  t_(`${f}: 어느 별지인지 밝힌다`, b.includes('별지 제15호의2·제15호의3'))
  t_(`${f}: 미대조 고지가 남아 있지 않다`, !b.includes('원본과 대조하지 못했습니다'))
  /* ★ a.href 는 한글을 퍼센트 인코딩해서 돌려준다. 적어 넣은 그대로 보려면 속성을 읽는다. */
  t_(`${f}: 감독규정 원문으로 연결한다`,
     await ev(`!![...document.querySelectorAll('a')].find(a=>(a.getAttribute('href')||'').includes('행정규칙/신용정보업감독규정'))`))
  // 고지는 화면에만 — 종이에는 나가지 않는다
  const inSheet = await ev(`(document.querySelector('.print-sheet')?.innerText ?? '').includes('정본과 대조했습니다')`)
  t_(`${f}: 고지가 인쇄물에는 들어가지 않는다`, inSheet===false)
}
/* 별지마다의 개정 표기 — 2026-08-13 은 감독규정 자체의 개정일이지 서식의 개정일이 아니었다 */
await send('Page.navigate',{url:BASE+'/document?form=explanationRequest'}); await sleep(1400)
const b1 = await ev(`document.body.innerText.replace(/\\s+/g,' ')`)
t_('서식 1: 별지 자체의 개정 표기를 적는다', b1.includes('<개정 2022.7.7.>'), b1.slice(0,60))
await send('Page.navigate',{url:BASE+'/document?form=correctionRequest'}); await sleep(1400)
const b2 = await ev(`document.body.innerText.replace(/\\s+/g,' ')`)
t_('서식 2: 개정 표기가 없으므로 지어내지 않는다', !b2.includes('<개정'), b2.slice(0,60))

console.log('[A-2] 진단 결과 — 앞머리의 바로가기')
await send('Page.navigate',{url:BASE+'/diagnose'}); await sleep(1300)
await click('신용대출이 거절됐다'); await click('금융회사'); await setSel('bank'); await sleep(1200)
const titleY = await y(`[...document.querySelectorAll('h2')].find(e=>e.textContent.includes('행사할 수 있는 권리'))`)
const quickY = await y(`[...document.querySelectorAll('p')].find(e=>e.textContent.includes('바로 이어서 하시려면'))`)
const bigY   = await y(`[...document.querySelectorAll('a')].find(e=>e.textContent.includes('제출할 정보 정하러 가기'))`)
t_('결과 앞머리에 바로가기 줄이 있다', quickY!==null, 'y='+quickY)
t_('바로가기가 결과 제목 한 화면 안에 있다', quickY!==null && titleY!==null && quickY-titleY < 900, `${titleY}→${quickY}`)
t_('아래 큰 버튼은 그대로 남아 있다', bigY!==null && bigY > quickY, `${quickY} / ${bigY}`)
const links = await ev(`(()=>{const p=[...document.querySelectorAll('p')].find(e=>e.textContent.includes('바로 이어서 하시려면'));
  return p?JSON.stringify([...p.querySelectorAll('a')].map(a=>a.getAttribute('href'))):null})()`)
t_('두 갈래 모두로 이어진다', links && JSON.parse(links).join(',')==='/strategy,/document', String(links))

await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:seedR})
// 마지막으로 한 번 더 비워 두고 나간다 (다음 시험이 깨끗한 상태에서 시작하도록)
const {result:{identifier:seedZ}} = await send('Page.addScriptToEvaluateOnNewDocument',
  {source:`try{localStorage.clear()}catch(e){}`})
await send('Page.navigate',{url:BASE+'/'}); await sleep(1000)
await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:seedZ})
t_('쉬운 말을 켠 채로 끝내지 않는다', (await ev(`localStorage.getItem('wy-plain')`)) !== '1')

t_('★ 처리되지 않은 예외 0건', errs.length===0, errs.join('|'))
console.log(`\n통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
