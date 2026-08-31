/**
 * 흐름·진입점의 **약속**을 지킨다. (2026-09-01, 뮤테이션 2차에서 아무도 못 잡은 것들)
 *
 * ★ 여기 있는 것은 전부 "화면이 말하는 것"과 "실제 동작"을 맞대는 검사다.
 *   상수끼리 비교하면 코드와 시험이 함께 틀려도 통과한다 — 그런 검사는 넣지 않는다.
 *   - 네비 순서       : 화면의 순서 ↔ 실제 흐름 순서(우리가 손으로 박은 고정점)
 *   - 샘플 고르기     : 화면의 링크 ↔ samples.js 의 id 집합
 *   - "3~5단계"       : 화면의 문구 ↔ **실제로 걸어 본 단계 수**
 *   - [지우고 …]      : 있다는 것뿐 아니라 **눌러서 비워지는지**
 *   - 인쇄 애니메이션 : print 미디어에서 computed animationName 이 none 인지
 */
const BASE = process.env.APP_URL || 'http://localhost:4400'
const { SAMPLE_SCENARIOS } = await import('../src/data/samples.js')
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map(); const errs=[]
ws.onmessage=e=>{const m=JSON.parse(e.data)
  if(m.method==='Runtime.exceptionThrown') errs.push((m.params.exceptionDetails?.exception?.description||'').slice(0,120))
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
let pass=0,fail=0; const ok=(n,c,d='')=>{ if(c) pass++; else {fail++; console.log('  FAIL',n,d?'— '+d:'')} }
const go=async(path,extra='')=>{const {identifier}=(await send('Page.addScriptToEvaluateOnNewDocument',{source:
    `try{localStorage.clear();localStorage.setItem('wy-tour-v1','done');${extra}}catch(e){}`})).result
  await send('Page.navigate',{url:BASE+path}); await sleep(1700)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})}
const clickText=async(sel,txt)=>{const r=await ev(`(()=>{const e=[...document.querySelectorAll('${sel}')].find(e=>e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`);await sleep(1200);return r}

await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})

/* ── [1] 네비 순서는 실제 흐름 순서다 ─────────────────────────────
   ★ 고정점은 여기 손으로 박는다. 다섯이 나란히 있으면 사용자는 그것을 순서로 읽는다.
     진단 → 전략(무엇을 낼까) → 서식(그것을 담아 만든다) → 이후 절차 → 회신 해석. */
const FLOW = ['진단', '전략', '서식', '이후 절차', '회신 해석']
console.log('[1] 네비 순서 = 실제 흐름 순서')
await go('/')
const nav = await ev(`(()=>{const n=document.querySelector('header nav')||document.querySelector('nav');
  return n?[...n.querySelectorAll('a')].map(a=>a.textContent.trim()).join('|'):''})()`)
ok('★ 네비가 흐름 순서대로 있다', nav === FLOW.join('|'), nav)

/* ── [2] 랜딩의 예시 고르기 ─────────────────────────────────── */
console.log('[2] 예시를 고르는 단계 — 미리 채우지 않는다')
ok('처음에는 접혀 있다', (await ev(`document.getElementById('sample-pick')?.hidden`)) === true)
ok('[샘플로 체험하기]가 펼친다', await clickText('button','샘플로 체험하기'))
ok('펼쳐졌다', (await ev(`document.getElementById('sample-pick')?.hidden`)) === false)
const hrefs = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('#sample-pick a')].map(a=>a.getAttribute('href')))`))
ok('★ 시나리오 수만큼 고를 수 있다', hrefs.length === SAMPLE_SCENARIOS.length, JSON.stringify(hrefs))
ok('★ 세 링크가 서로 다른 시나리오로 간다',
   SAMPLE_SCENARIOS.every(s => hrefs.includes(`/diagnose?sample=${s.id}`)) &&
   new Set(hrefs).size === hrefs.length, JSON.stringify(hrefs))
const shown = await ev(`document.getElementById('sample-pick').innerText`)
ok('★ 무엇을 보여주는 예시인지 적혀 있다',
   SAMPLE_SCENARIOS.every(s => shown.includes(s.demonstrates.slice(0, 12))))

/* ── [3] "3~5단계"는 실제로 걸어 본 수와 맞는다 ────────────────── */
console.log('[3] 안내 띠의 단계 수 = 실제 단계 수')
/* ★ "3-1단계" 처럼 번호가 갈라지는 칸이 있다. 숫자만 세면 그 칸을 놓친다. */
const stepCount = () => ev(`(()=>{const s=new Set();
  document.querySelectorAll('main section h2 span').forEach(e=>{const m=/^([\\d-]+)단계$/.exec(e.textContent.trim()); if(m) s.add(m[1])});
  return s.size})()`)
const band = async () => ev(`(()=>{const u=document.querySelector('main header ul');return u?u.innerText.replace(/\\s+/g,' '):''})()`)
await go('/diagnose')
const bandText = await band()
ok('안내 띠가 폼 앞에 있다', /단계/.test(bandText), bandText)
// (가) CB사 — 업권을 묻지 않는다
await clickText('button','카드 발급이 거절됐다')
await clickText('button','개인신용평가회사')
const nCb = await stepCount()
// (나) 금융회사 × 은행 × 카드 발급 거절 — 업권을 묻는다
await go('/diagnose')
await clickText('button','카드 발급이 거절됐다')
await clickText('button','금융회사 (대통령령으로')
await ev(`(()=>{const s=document.querySelector('main select');s.value='bank';s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(1200)
const nBank = await stepCount()
// (다) 은행 × 한도 축소 — 어떤 한도인지까지 묻는다 (가장 긴 경로)
await go('/diagnose')
await clickText('button','한도가 축소됐다')
await clickText('button','금융회사 (대통령령으로')
await ev(`(()=>{const s=document.querySelector('main select');s.value='bank';s.dispatchEvent(new Event('change',{bubbles:true}))})()`); await sleep(1200)
const nLimit = await stepCount()
const lo = Math.min(nCb, nBank, nLimit), hi = Math.max(nCb, nBank, nLimit)
console.log(`    실제 단계 수 — CB사 ${nCb} / 은행 ${nBank} / 은행×한도축소 ${nLimit}`)
ok('★ 화면이 말하는 단계 수가 실제와 같다', bandText.includes(`${lo}~${hi}단계`), `화면 "${bandText}" vs 실제 ${lo}~${hi}`)

/* ── [4] 샘플에서 빠져나가는 문 ─────────────────────────────── */
console.log('[4] 샘플이 채워져 있을 때 빠져나갈 수 있다')
await go('/diagnose?sample=returner')
const beforeText = await ev(`document.querySelector('main').innerText`)
ok('무엇이 채워졌는지 이름을 말한다', beforeText.includes('지금 채워진 것은 샘플'))
ok('[지우고 내 상황으로 시작하기]가 있다', await clickText('button','지우고 내 상황으로 시작하기'))
await sleep(800)
const afterState = JSON.parse(await ev(`JSON.stringify((()=>{const j=JSON.parse(localStorage.getItem('wae:journey:state')||'{}');
  const d=j.diagnosis||{}; return {eventId:d.eventId, counterpartyId:d.counterpartyId, sampleId:d.sampleId, reason:d.reason}})())`))
ok('★ 눌렀더니 실제로 비워졌다',
   !afterState.eventId && !afterState.counterpartyId && !afterState.sampleId && !afterState.reason,
   JSON.stringify(afterState))
ok('빈 진단 화면이 됐다', !(await ev(`document.querySelector('main').innerText`)).includes('지금 채워진 것은 샘플'))

/* ── [5] 되돌아온 사람에게 무엇이 남아 있는지 이름을 말한다 ────── */
console.log('[5] 되돌아온 알림')
const seed = {version:1,
  diagnosis:{eventId:'cardRejected',counterpartyId:'financialCompany',institutionSectorId:'bank',customInstitution:'',reason:'',sampleId:null,routingBranchId:null,limitKind:null},
  form:{personal:{name:'홍길동'}}}
await go('/diagnose', `localStorage.setItem('wae:journey:state',${JSON.stringify(JSON.stringify(seed))})`)
const notice = await ev(`(()=>{const d=[...document.querySelectorAll('main details')].find(d=>d.textContent.includes('이후 단계에 저장된'));
  return d?d.innerText.replace(/\\s+/g,' '):''})()`)
ok('저장된 내용이 있으면 알린다', notice.includes('이후 단계에 저장된 내용이 있습니다'), notice)
ok('★ 무엇이 저장돼 있는지 이름을 말한다', notice.includes('서식 작성 내용'), notice)
ok('접혀 있다(한 줄)', (await ev(`(()=>{const d=[...document.querySelectorAll('main details')].find(d=>d.textContent.includes('이후 단계에 저장된'));return d?d.open:null})()`)) === false)

/* ── [6] 인쇄에서는 움직임이 없다 ──────────────────────────────
   ★ 애니메이션이 도는 중에 인쇄하면 요소가 반투명하거나 어긋난 채로 찍힌다. */
console.log('[6] @media print 에서 애니메이션·트랜지션 무효화')
await go('/')
/*
 * ★ 탐침에 **인라인 스타일**로 움직임을 준다.
 *   투어의 애니메이션 규칙은 @media screen 안에 있어서 인쇄에서는 어차피 안 걸린다.
 *   그것만 보면 인쇄용 무효화 규칙이 있는지 없는지 구별되지 않는다.
 *   인라인 선언은 스타일시트의 !important 만 이길 수 있으므로,
 *   이 탐침이 곧 "@media print 의 무효화 규칙이 살아 있는가"를 잰다.
 */
const probe = `(()=>{
  let e=document.getElementById('__anim_probe');
  if(!e){e=document.createElement('div');e.id='__anim_probe';document.body.appendChild(e)}
  e.className='tour-page'
  e.style.transition='opacity 1s linear'
  e.style.animationName='tour-in'
  e.style.animationDuration='1s'
  const s=getComputedStyle(e);
  return JSON.stringify({name:s.animationName, dur:s.animationDuration, tdur:s.transitionDuration})
})()`
await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'no-preference'}]})
const scr = JSON.parse(await ev(probe))
ok('화면에서는 애니메이션이 있다', scr.name === 'tour-in' && scr.dur === '1s', JSON.stringify(scr))
ok('화면에서는 트랜지션이 있다', scr.tdur === '1s', JSON.stringify(scr))
await send('Emulation.setEmulatedMedia',{media:'print',features:[{name:'prefers-reduced-motion',value:'no-preference'}]})
await sleep(200)
const prn = JSON.parse(await ev(probe))
ok('★ 인쇄에서는 애니메이션이 없다', prn.name === 'none' || prn.dur === '0s', JSON.stringify(prn))
ok('★ 인쇄에서는 트랜지션이 0s', prn.tdur === '0s', JSON.stringify(prn))
await ev(`document.getElementById('__anim_probe')?.remove()`)
await send('Emulation.setEmulatedMedia',{features:[]})

ok('★ 처리되지 않은 예외 0건', errs.length === 0, errs.join(' | '))
console.log(`\ntflow: ${pass}/${pass+fail} 통과`)
ws.close(); process.exit(fail?1:0)
