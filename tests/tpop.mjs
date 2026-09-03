// 용어 풀이 팝오버가 뷰포트를 벗어나지 않는가. (2026-09-03 사용자 지적으로 신설)
//
// ★ 왜 앞선 검사가 놓쳤나
//   tnarrow 의 [D] 는 `aria-expanded=false` 인 단추를 **전부, 네 번** 눌렀다.
//   Term 은 토글이고 바깥을 누르면 닫히므로, 그렇게 누르면 대부분 열렸다 닫히고
//   마지막 하나만 남는다. 그 하나가 마침 왼쪽 끝의 용어였다.
//   → 여기서는 **한 번에 하나씩 열고, 열린 그 순간에** 잰다.
//
// 무엇을 보는가
//   (1) 팝오버가 뷰포트 안에 전부 들어오는가 (좌·우·상·하)
//   (2) 팝오버 때문에 문서가 가로로 밀리지 않는가 (배경이 흔들리지 않는가)
//   (3) 용어가 화면 네 끝 어디에 있어도 그런가 — 트리거를 위/아래 끝으로 굴려 놓고 연다
//   (4) 넓은 화면에서도 (자리 보정·위로 뒤집기)
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map(); const errs=[]
ws.onmessage=e=>{const m=JSON.parse(e.data)
  if(m.method==='Runtime.exceptionThrown')errs.push((m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text||'').slice(0,140))
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
let pass=0,fail=0
const ok=(n,c,d='')=>{c?pass++:fail++;console.log((c?'  ok   ':'  FAIL ')+n+(c?'':' — '+d))}

const CATS=['identity','transaction','creditworthiness','capacity','other']
const filled={schemaVersion:1,updatedAt:new Date().toISOString(),
  diagnosis:{eventId:'loanRejected',counterpartyId:'FI',institutionSectorId:'bank',customInstitution:'',
    reason:'프리랜서로 3년 일했습니다.',routingBranchId:null,sampleId:null,limitKind:null,selectedCandidates:[],
    correctionRows:CATS.map(c=>({categoryId:c,current:'연체 이력'})),missingRequestItems:[]},
  strategy:{notice:null,candidates:[],picked:[],source:null,basedOn:null},
  form:{tab:'correctionRequest',personal:{name:'홍길동',phone:'010-1111-2222',email:'h@example.com'},
    form1:{selectedItems:['result'],hopeResult:'',consent:'agree'},
    form2:{enabled:{s2:true,s3:true,s4:true},rows:null,favorable:null,recipient:''},
    activeCase:null,second:null,form2Index:0,form2Extras:[]},
  response:{interpretation:null,errors:[],catOverrides:{}},milestones:{}}

const seed = async (url) => {
  const {result:{identifier}} = await send('Page.addScriptToEvaluateOnNewDocument',
    {source:`try{localStorage.clear();localStorage.setItem('wy-tour-v1','done');localStorage.setItem('wae:journey:state',${JSON.stringify(JSON.stringify(filled))})}catch(e){}`})
  await send('Page.navigate',{url:BASE+url}); await sleep(2000)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})
}

const SCREENS = ['/', '/diagnose', '/document', '/document?form=correctionRequest',
                 '/strategy', '/next', '/response?sample=partial&run=1']

/**
 * 용어 하나를 열고 잰다.
 * @param i        몇 번째 트리거인가
 * @param place    'center' | 'start' | 'end' — 트리거를 화면 어디에 두고 여는가
 */
const openAndMeasure = async (i, place) => {
  await ev(`(()=>{const t=document.querySelectorAll('.term-trigger')[${i}]
    t.scrollIntoView({block:${JSON.stringify(place)}}); t.click(); return 1})()`)
  await sleep(200)
  const raw = await ev(`(()=>{
    const t=document.querySelectorAll('.term-trigger')[${i}]
    const p=document.querySelector('[role=note]')
    if(!p) return JSON.stringify({missing:t.textContent.trim().slice(0,20)})
    const r=p.getBoundingClientRect(), vw=document.documentElement.clientWidth, vh=innerHeight
    return JSON.stringify({term:t.textContent.trim().slice(0,16),
      L:Math.round(r.left),R:Math.round(r.right),T:Math.round(r.top),B:Math.round(r.bottom),
      w:Math.round(r.width),vw,vh,
      docOver: document.documentElement.scrollWidth > vw+1,
      empty: p.textContent.trim().length < 10})
  })()`)
  await ev(`(()=>{const t=document.querySelectorAll('.term-trigger')[${i}]
    if(t.getAttribute('aria-expanded')==='true')t.click(); return 1})()`)
  await sleep(80)
  return JSON.parse(raw)
}

/** 뷰포트를 벗어난 곳이 있으면 그 사연을 돌려준다. 없으면 null. */
const outside = (o) => {
  if (o.missing) return `팝오버가 열리지 않았다 (${o.missing})`
  const bad = []
  if (o.L < -1) bad.push(`왼쪽 ${o.L}`)
  if (o.R > o.vw + 1) bad.push(`오른쪽 ${o.R}>${o.vw}`)
  if (o.T < -1) bad.push(`위 ${o.T}`)
  if (o.B > o.vh + 1) bad.push(`아래 ${o.B}>${o.vh}`)
  if (o.docOver) bad.push('문서가 가로로 밀림')
  if (o.empty) bad.push('내용이 비었다')
  return bad.length ? `${o.term}: ${bad.join(' / ')}` : null
}

let total = 0
for (const [w, h, mobile] of [[375, 667, true], [1280, 900, false]]) {
  console.log(`\n[${w}px] 용어를 하나씩 열어 잰다`)
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile})
  for (const url of SCREENS) {
    await seed(url)
    // 접혀 있는 곳의 용어도 센다
    await ev(`(()=>{document.querySelectorAll('details:not([open])').forEach(d=>d.open=true);return true})()`)
    await sleep(600)
    const n = await ev(`document.querySelectorAll('.term-trigger').length`)
    const bad = []
    for (let i = 0; i < n; i++) {
      // 화면 네 끝 — 위로 붙였을 때·아래로 붙였을 때·가운데
      for (const place of ['center', 'start', 'end']) {
        const o = await openAndMeasure(i, place)
        const why = outside(o)
        if (why) bad.push(`[${place}] ${why}`)
      }
    }
    total += n
    ok(`${w} ${url} — 용어 ${n}개가 모두 뷰포트 안`, bad.length === 0, bad.slice(0, 4).join(' ／ '))
  }
}

// 좁은 화면의 처리 방식 자체를 못 박는다 — 자리를 계산하지 않고 아래 시트로 고정한다.
console.log('\n[좁은 화면] 아래 시트로 고정한다')
await send('Emulation.setDeviceMetricsOverride',{width:375,height:667,deviceScaleFactor:1,mobile:true})
await seed('/response?sample=partial&run=1')
await sleep(400)
const sheets = []
const n375 = await ev(`document.querySelectorAll('.term-trigger').length`)
for (let i = 0; i < n375; i++) {
  await ev(`(()=>{const t=document.querySelectorAll('.term-trigger')[${i}];t.scrollIntoView({block:'center'});t.click();return 1})()`)
  await sleep(200)
  sheets.push(JSON.parse(await ev(`(()=>{const p=document.querySelector('[role=note]')
    const cs=getComputedStyle(p), r=p.getBoundingClientRect()
    return JSON.stringify({pos:cs.position,L:Math.round(r.left),R:Math.round(r.right)})})()`)))
  await ev(`(()=>{const t=document.querySelectorAll('.term-trigger')[${i}];if(t.getAttribute('aria-expanded')==='true')t.click();return 1})()`)
  await sleep(80)
}
ok('375: 어느 용어에서 열어도 같은 자리·같은 폭', sheets.length > 1 &&
   sheets.every((s) => s.pos === 'fixed' && s.L === sheets[0].L && s.R === sheets[0].R),
   JSON.stringify(sheets.slice(0, 3)))

// 넓은 화면은 용어 옆에 붙어 있어야 한다 — 아래 시트로 바뀌면 무엇에 대한 설명인지 흐려진다
console.log('\n[넓은 화면] 용어 옆에 붙어 있다')
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})
await seed('/response?sample=partial&run=1')
await sleep(400)
await ev(`(()=>{const t=document.querySelectorAll('.term-trigger')[0];t.scrollIntoView({block:'center'});t.click();return 1})()`)
await sleep(250)
const wide = JSON.parse(await ev(`(()=>{const p=document.querySelector('[role=note]')
  const t=document.querySelectorAll('.term-trigger')[0]
  const a=p.getBoundingClientRect(), b=t.getBoundingClientRect()
  return JSON.stringify({pos:getComputedStyle(p).position, gap:Math.round(Math.min(Math.abs(a.top-b.bottom),Math.abs(b.top-a.bottom)))})})()`))
ok('1280: 팝오버가 용어에 붙어 있다 (아래 시트가 아니다)', wide.pos === 'absolute' && wide.gap < 24, JSON.stringify(wide))

ok('★ 처리되지 않은 예외 0건', errs.length===0, errs.join('|'))
console.log(`\n연 팝오버 ${total * 3}회`)
console.log(`통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
