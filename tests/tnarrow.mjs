// 좁은 화면에서 잘리는 곳이 없는가. (2026-08-31 사용자 지적으로 신설)
//
// ★ 왜 앞선 검사가 놓쳤나
//   depshots 는 `document.scrollWidth > clientWidth` 만 봤다. 그건 **문서 전체**가
//   넘치는지만 본다. 서식은 `overflow-x:auto` 안에 있어서 문서는 넘치지 않았고,
//   정작 안에서 "정정 또는 삭제 내용" 열이 통째로 잘려 있었다.
//   그래서 여기서는 **요소 단위**로 본다:
//     (1) 화면 밖으로 나간 칸이 있는가
//     (2) 잘려 있는데 스크롤 영역이 아닌 곳이 있는가 (= 내용이 사라진다)
//     (3) 스크롤 영역이 넘칠 때, 밀 수 있다는 것을 사용자가 알 수 있는가
//   화면 밖에 일부러 둔 측정 영역(.print-metrics)은 제외한다 — 이걸 빼지 않으면
//   전 폭에서 8칸씩 "화면 밖"으로 잡혀 신호가 묻힌다.
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map(); const errs=[]
ws.onmessage=e=>{const m=JSON.parse(e.data)
  if(m.method==='Runtime.exceptionThrown')errs.push((m.params.exceptionDetails?.exception?.description||'').slice(0,120))
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
let pass=0,fail=0
const ok=(n,c,d='')=>{c?pass++:fail++;console.log((c?'  ok   ':'  FAIL ')+n+(c?'':' — '+d))}

/** 화면에 보이는 요소만. 일부러 화면 밖에 둔 측정 영역과 감춘 것은 뺀다. */
const PROBE = `(() => {
  const vw = document.documentElement.clientWidth
  const hidden = (el) => {
    for (let e = el; e; e = e.parentElement) {
      if (e.classList?.contains('print-metrics')) return true
      if (e.getAttribute?.('aria-hidden') === 'true') return true
      const cs = getComputedStyle(e)
      if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') return true
      // 화면 밖에 일부러 고정해 둔 영역 (측정용 래퍼)
      if (cs.position === 'fixed' && parseFloat(cs.left) < -1000) return true
    }
    return false
  }
  const all = [...document.querySelectorAll('main *')].filter((e) => !hidden(e))
  const outside = []
  const clipped = []
  const scrollers = []
  for (const el of all) {
    const b = el.getBoundingClientRect()
    if (b.width === 0 && b.height === 0) continue
    if (b.right > vw + 1 || b.left < -1) {
      outside.push(el.tagName + '.' + String(el.className).slice(0, 30) + ' | ' + el.textContent.replace(/\\s+/g,' ').trim().slice(0, 30))
    }
    if (el.scrollWidth - el.clientWidth > 1) {
      const ox = getComputedStyle(el).overflowX
      const rec = el.tagName + '.' + String(el.className).slice(0, 30)
      if (ox === 'auto' || ox === 'scroll') scrollers.push(rec)
      // 입력칸은 브라우저가 안에서 굴린다. 값이 사라지는 것이 아니라 커서를 따라간다.
      // .sr-only 는 1px 로 눌러 감추는 것이 목적이다 — 눈으로 볼 것이 아니다.
      else if (!['INPUT', 'TEXTAREA', 'SELECT'].includes(el.tagName) &&
               !el.classList.contains('sr-only')) clipped.push(rec)
    }
  }
  return { vw, outside: outside.slice(0, 6), clipped: clipped.slice(0, 6),
    scrollers: scrollers.slice(0, 4),
    docOverflow: document.documentElement.scrollWidth > vw + 1 }
})()`

const seed = async (state, url, extra = '') => {
  const {result:{identifier}} = await send('Page.addScriptToEvaluateOnNewDocument',
    {source:`try{localStorage.clear();localStorage.setItem('wy-tour-v1','done');${extra}${state?`localStorage.setItem('wae:journey:state',${JSON.stringify(JSON.stringify(state))})`:''}}catch(e){}`})
  await send('Page.navigate',{url:BASE+url}); await sleep(2100)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})
}
const CATS=['identity','transaction','creditworthiness','capacity','other']
const filled={schemaVersion:1,updatedAt:new Date().toISOString(),
  diagnosis:{eventId:'loanRejected',counterpartyId:'FI',institutionSectorId:'bank',customInstitution:'',reason:'프리랜서로 3년 일했습니다.',routingBranchId:null,sampleId:null,limitKind:null,selectedCandidates:[],
    correctionRows:CATS.map(c=>({categoryId:c,current:'연체 이력: 2021년 3건 (총 연체일수 22일)'})),missingRequestItems:[]},
  strategy:{notice:null,candidates:[],picked:[],source:null,basedOn:null},
  form:{tab:'correctionRequest',personal:{name:'홍길동',phone:'010-1111-2222',email:'hong@example.com'},
    form1:{selectedItems:['result','criteria','baseInfo'],hopeResult:'720점 이상',consent:'agree'},
    form2:{enabled:{s2:true,s3:true,s4:true},rows:null,favorable:null,recipient:''},activeCase:null,second:null,form2Index:0,form2Extras:[]},
  response:{interpretation:null,errors:[],catOverrides:{}},milestones:{}}

console.log('[A] 서식 — 375px 에서 모든 열이 화면 안에 있다')
for (const form of ['explanationRequest','correctionRequest']) {
  for (const sc of ['base','lg']) {
    await send('Emulation.setDeviceMetricsOverride',{width:375,height:800,deviceScaleFactor:1,mobile:true})
    await seed(filled, '/document?form='+form, `localStorage.setItem('wy-print-scale','${sc}');`)
    const r = await ev(`JSON.stringify(${PROBE})`)
    const p = JSON.parse(r)
    ok(`${form}/${sc}: 화면 밖으로 나간 요소 없음`, p.outside.length===0, p.outside.join(' ／ '))
    ok(`${form}/${sc}: 스크롤 영역이 아닌데 잘린 곳 없음`, p.clipped.length===0, p.clipped.join(' ／ '))
    ok(`${form}/${sc}: 문서가 가로로 넘치지 않음`, !p.docOverflow)
    // 375 에서는 서식이 화면에 들어가야 한다 — 밀지 않고 세 열이 다 보인다
    const wrap = await ev(`document.querySelector('.sheet-scroll-wrap')?.dataset.scrollable`)
    ok(`${form}/${sc}: 375px 에서는 밀지 않아도 된다`, wrap==='false', String(wrap))
  }
}
// 세 열이 실제로 보이는가 (사용자가 지적한 그 열)
await send('Emulation.setDeviceMetricsOverride',{width:375,height:800,deviceScaleFactor:1,mobile:true})
await seed(filled,'/document?form=correctionRequest')
const cols = await ev(`(()=>{const t=[...document.querySelectorAll('.print-sheet table')].filter(e=>!e.closest('.print-metrics'))[0]
  if(!t)return null; const vw=document.documentElement.clientWidth
  return JSON.stringify([...t.querySelectorAll('thead th, tr:first-child th')].map(e=>({t:e.textContent.trim().slice(0,12), r:Math.round(e.getBoundingClientRect().right), inside:e.getBoundingClientRect().right<=vw+1})))})()`)
ok('★ 섹션 2의 세 열이 모두 화면 안', cols && JSON.parse(cols).length>=3 && JSON.parse(cols).every(c=>c.inside), String(cols))
ok('★ "정정 또는 삭제 내용" 열이 보인다',
   cols && JSON.parse(cols).some(c=>c.t.includes('정정')&&c.inside), String(cols))
// 값이 잘리지 않고 다 보이는가 — 여러 줄이 되는 칸은 textarea 로 늘어난다
const grown = await ev(`(()=>{const tas=[...document.querySelectorAll('.print-sheet textarea')].filter(e=>!e.closest('.print-metrics')&&e.value)
  return JSON.stringify({n:tas.length, 잘린것:tas.filter(e=>e.scrollHeight-e.clientHeight>2).length})})()`)
ok('★ 값이 든 칸이 내용에 맞게 늘어난다', grown && JSON.parse(grown).n>0 && JSON.parse(grown).잘린것===0, String(grown))

console.log('[B] 320px — 넘칠 때는 밀 수 있다고 알린다')
await send('Emulation.setDeviceMetricsOverride',{width:320,height:800,deviceScaleFactor:1,mobile:true})
await seed(filled,'/document?form=correctionRequest')
const w = await ev(`(()=>{const el=document.querySelector('.sheet-scroll-wrap');const sc=document.querySelector('.sheet-scroll')
  return JSON.stringify({scrollable:el?.dataset.scrollable, hint:!!document.querySelector('[data-testid=sheet-scroll-hint]'),
    tabindex:sc?.getAttribute('tabindex'), role:sc?.getAttribute('role'), label:sc?.getAttribute('aria-label'),
    canScroll: sc.scrollWidth>sc.clientWidth})})()`)
const W = JSON.parse(w)
ok('실제로 넘친다', W.canScroll)
ok('★ 밀 수 있다고 화면이 말한다', W.hint, w)
ok('★ 키보드로 닿는다 (tabindex + region)', W.tabindex==='0' && W.role==='region' && /밀어서/.test(W.label||''), w)
// 끝까지 밀면 오른쪽 그림자가 사라진다
await ev(`(()=>{const sc=document.querySelector('.sheet-scroll');sc.scrollLeft=sc.scrollWidth;sc.dispatchEvent(new Event('scroll'))})()`)
await sleep(400)
ok('끝까지 밀면 오른쪽 표시가 꺼진다',
   (await ev(`document.querySelector('.sheet-scroll-wrap')?.dataset.atEnd`))==='true')
ok('처음으로 되돌리면 다시 켜진다',
   (await ev(`(()=>{const sc=document.querySelector('.sheet-scroll');sc.scrollLeft=0;sc.dispatchEvent(new Event('scroll'));return true})()`)) &&
   (await sleep(400), (await ev(`document.querySelector('.sheet-scroll-wrap')?.dataset.atEnd`))==='false'))

console.log('[C] 넓은 화면에서는 아무것도 덧붙지 않는다')
for (const width of [768, 1280]) {
  await send('Emulation.setDeviceMetricsOverride',{width,height:900,deviceScaleFactor:1,mobile:false})
  await seed(filled,'/document?form=correctionRequest')
  const p = JSON.parse(await ev(`JSON.stringify(${PROBE})`))
  ok(`${width}: 화면 밖으로 나간 요소 없음`, p.outside.length===0, p.outside.join(' ／ '))
  ok(`${width}: 밀라는 안내가 뜨지 않는다`, !(await ev(`!!document.querySelector('[data-testid=sheet-scroll-hint]')`)))
  ok(`${width}: 탭 정거장을 늘리지 않는다`, (await ev(`document.querySelector('.sheet-scroll')?.getAttribute('tabindex')`))===null)
}

console.log('[D] 나머지 화면도 375 에서 잘리지 않는다')
await send('Emulation.setDeviceMetricsOverride',{width:375,height:800,deviceScaleFactor:1,mobile:true})
for (const p0 of ['/','/diagnose?sample=returner','/strategy','/next','/response?sample=partial&run=1']) {
  await seed(filled, p0)
  await ev(`(()=>{for(let i=0;i<4;i++){document.querySelectorAll('[aria-expanded=false]').forEach(b=>b.click());document.querySelectorAll('details:not([open])').forEach(d=>d.open=true)}return true})()`)
  await sleep(600)
  const p = JSON.parse(await ev(`JSON.stringify(${PROBE})`))
  ok(`${p0}: 화면 밖으로 나간 요소 없음`, p.outside.length===0, p.outside.join(' ／ '))
  ok(`${p0}: 스크롤 영역이 아닌데 잘린 곳 없음`, p.clipped.length===0, p.clipped.join(' ／ '))
}

ok('★ 처리되지 않은 예외 0건', errs.length===0, errs.join('|'))
console.log(`\n통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
