// [A] 랜딩 제목 · [A-2] 서식 정본 미대조 고지 · 진단 결과의 바로가기 줄.
//
// 지키려는 것 (2026-08-31)
//  1. 제목이 사건 하나("대출 거절")에 묶이지 않는다 — 다섯 사건을 다 다루는 서비스다
//  2. 부제에 근거 조문 배지가 붙는다
//  3. 375×667 첫 화면에 [내 상황으로 시작하기]와 자가진단 제목이 남는다
//  4. 쉬운 말 보기에서도 제목·부제가 바뀌고, 버튼이 첫 화면 안에 남는다
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
t_('부제에 서비스가 무엇을 하는지 한 줄', body.includes('삼육이는 그 요구서를 대신 만들어 드립니다'))
// 근거 배지 — 부제와 같은 문단 안에 있어야 한다(줄을 따로 만들면 버튼이 밀린다)
const badge = await ev(`(()=>{const p=[...document.querySelectorAll('p')].find(p=>p.textContent.includes('한도 축소'));
  if(!p)return null; const a=p.querySelector('a.basis-link'); return a?JSON.stringify({t:a.textContent.replace(/\\s+/g,' ').trim(),href:a.getAttribute('href')}):null})()`)
t_('부제의 조문에 근거 배지', !!badge, String(badge))
const B = badge && JSON.parse(badge)
t_('배지가 제36조의2 원문으로 연결', !!B && decodeURIComponent(B.href).includes('제36조의2'), B?.href)

console.log('[A] 375×667 첫 화면')
const ctaY = await y(`[...document.querySelectorAll('a')].find(e=>e.textContent.includes('내 상황으로 시작하기'))`)
const scY  = await y(`[...document.querySelectorAll('h2')].find(e=>e.textContent.includes('혹시 이런 일'))`)
t_('[내 상황으로 시작하기]가 첫 화면 안', ctaY!==null && ctaY < 667, 'y='+ctaY)
t_('자가진단 제목이 첫 화면 안', scY!==null && scY < 667, 'y='+scY)
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
const pCtaY = await y(`[...document.querySelectorAll('a')].find(e=>e.textContent.includes('내 상황으로 시작하기'))`)
t_('쉬운 말에서도 버튼이 첫 화면 안', pCtaY!==null && pCtaY < 667, 'y='+pCtaY)

console.log('[A-2] 서식 — 정본과 대조하지 못했다는 고지')
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})
for (const f of ['explanationRequest','correctionRequest']) {
  await send('Page.navigate',{url:BASE+'/document?form='+f}); await sleep(1500)
  const b = await ev(`document.body.innerText.replace(/\\s+/g,' ')`)
  t_(`${f}: 원본 미대조를 밝힌다`, b.includes('원본과 대조하지 못했습니다'), b.slice(0,80))
  t_(`${f}: 왜 대조하지 못했는지 밝힌다`, b.includes('고시의 첨부 파일로만'))
  t_(`${f}: 개정 판본을 특정한다`, b.includes('2026-08-13') && b.includes('제2026-37호'))
  // ★ 확인하지 않은 것을 단정하지 않는다 — "별지 15의2가 개정됐다"고 말하면 안 된다
  t_(`${f}: 별지 개정 여부를 단정하지 않는다`,
     !/별지 제15호의[23] 서식이 (개정|변경)됐/.test(b) && b.includes('바꾸었는지'))
  // 고지는 화면에만 — 종이에는 나가지 않는다
  const inSheet = await ev(`(document.querySelector('.print-sheet')?.innerText ?? '').includes('원본과 대조하지 못했습니다')`)
  t_(`${f}: 고지가 인쇄물에는 들어가지 않는다`, inSheet===false)
}

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

t_('★ 처리되지 않은 예외 0건', errs.length===0, errs.join('|'))
console.log(`\n통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
