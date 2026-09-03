// 화면이 사용자를 목적지까지 데려가는가. (2026-09-03 사용자 지적으로 신설)
//
// 셋 다 "누르면 무언가 일어나긴 하는데 도착지가 틀린" 종류였다. 앞선 검사들은
// 단추가 있는지·눌리는지만 봤고, **눌린 뒤 사용자 눈앞에 무엇이 있는지**는 재지 않았다.
//
//   [A] 진입 카드 아래 두 단추가 한 덩어리로 읽히는가 (375px 에서 줄이 갈라졌다)
//   [B] "그림이 있습니다"를 누르면 그 그림 앞에 서는가 (앵커가 없어 제자리에 남았다)
//   [C] [돌아가서 고치기]가 비어 있는 그 칸으로 데려가는가 (창만 닫았다)
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
const vp=(w,h,mobile)=>send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile})
const seed = async (url, state) => {
  const {result:{identifier}} = await send('Page.addScriptToEvaluateOnNewDocument',
    {source:`try{localStorage.clear();localStorage.setItem('wy-tour-v1','done');${state?`localStorage.setItem('wae:journey:state',${JSON.stringify(JSON.stringify(state))})`:''}}catch(e){}`})
  await send('Page.navigate',{url:BASE+url}); await sleep(1900)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})
}

/* ── [A] 진입 카드 아래 두 단추 ──────────────────────────────── */
console.log('\n[A] 375px — [2분 둘러보기]와 [샘플로 체험하기]가 한 줄에 있다')
await vp(375, 667, true)
await seed('/')
const a = JSON.parse(await ev(`(()=>{
  const bs=[...document.querySelectorAll('button')].filter(b=>/^(2분 둘러보기|샘플로 체험하기)$/.test(b.textContent.trim()))
  const lab=[...document.querySelectorAll('span')].find(s=>s.textContent.trim().startsWith('어느 것도 아니라면'))
  const r=e=>{const x=e.getBoundingClientRect();return {t:Math.round(x.top),b:Math.round(x.bottom),l:Math.round(x.left),rt:Math.round(x.right)}}
  return JSON.stringify({n:bs.length, btns:bs.map(r), lab:lab?r(lab):null, vw:document.documentElement.clientWidth})
})()`))
ok('두 단추를 모두 찾았다', a.n === 2, JSON.stringify(a))
ok('두 단추가 같은 줄에 있다', a.n === 2 && Math.abs(a.btns[0].t - a.btns[1].t) <= 1,
   JSON.stringify(a.btns))
ok('두 단추가 화면 안에 들어온다', a.n === 2 && a.btns[1].rt <= a.vw && a.btns[0].l >= 0,
   JSON.stringify(a.btns))
// 라벨과의 관계 — 바로 윗줄이어야 한다. 사이에 다른 것이 끼면 관계가 끊긴다.
ok('라벨이 단추 바로 윗줄에 있다',
   a.lab !== null && a.lab.b <= a.btns[0].t + 1 && a.btns[0].t - a.lab.b < 24,
   JSON.stringify({lab:a.lab, btn:a.btns[0]}))

console.log('\n[A-2] 넓은 화면은 원래대로 라벨과 단추가 한 줄이다')
await vp(1280, 900, false)
await seed('/')
const a2 = JSON.parse(await ev(`(()=>{
  const bs=[...document.querySelectorAll('button')].filter(b=>/^(2분 둘러보기|샘플로 체험하기)$/.test(b.textContent.trim()))
  const lab=[...document.querySelectorAll('span')].find(s=>s.textContent.trim().startsWith('어느 것도 아니라면'))
  const c=e=>Math.round(e.getBoundingClientRect().top+e.getBoundingClientRect().height/2)
  return JSON.stringify({lab:c(lab), b0:c(bs[0]), b1:c(bs[1])})})()`))
ok('1280: 라벨과 단추 둘이 한 줄', Math.abs(a2.lab-a2.b0)<=4 && Math.abs(a2.b0-a2.b1)<=1, JSON.stringify(a2))

/* ── [B] 랜딩 → /strategy 의 그림 ───────────────────────────── */
console.log('\n[B] "그림이 있습니다"를 누르면 그림 앞에 선다')
for (const [w, h, mobile] of [[375, 667, true], [1280, 900, false]]) {
  await vp(w, h, mobile)
  await seed('/')
  const link = await ev(`(()=>{const a=[...document.querySelectorAll('a')].find(a=>a.getAttribute('href')==='/strategy#ai-role')
    return a? JSON.stringify({text:a.textContent.replace(/\\s+/g,' ').trim()}) : null})()`)
  ok(`${w}: 링크가 /strategy#ai-role 를 가리킨다`, Boolean(link), '앵커 없는 /strategy 로 가고 있다')
  if (link) {
    const txt = JSON.parse(link).text
    // ★ 문구가 목적지를 말해야 한다. "그림으로 보기"만 있으면 화면이 바뀐 이유를 알 수 없다.
    ok(`${w}: 문구가 목적지 화면을 밝힌다`, txt.includes('대응 전략'), txt)
    ok(`${w}: 문구가 그림임을 밝힌다`, txt.includes('그림'), txt)
  }
  await ev(`(()=>{[...document.querySelectorAll('a')].find(a=>a.getAttribute('href')==='/strategy#ai-role').click();return 1})()`)
  await sleep(1500)
  const b = JSON.parse(await ev(`(()=>{
    const sec=document.getElementById('ai-role')
    if(!sec) return JSON.stringify({no:true})
    const fig=sec.querySelector('figure')||sec.querySelector('svg')
    const h2=sec.querySelector('h2')
    const r=e=>{const x=e.getBoundingClientRect();return {t:Math.round(x.top),b:Math.round(x.bottom)}}
    return JSON.stringify({url:location.pathname+location.hash, h2:r(h2), fig:fig?r(fig):null,
      title:h2.textContent.trim(), vh:innerHeight})})()`))
  ok(`${w}: /strategy#ai-role 로 갔다`, b.url === '/strategy#ai-role', JSON.stringify(b))
  // 도착 지점의 y 좌표 실측 — 제목이 화면 위쪽에 서야 한다 (머리말은 고정이 아니다)
  ok(`${w}: 도착하면 제목이 화면 맨 위에 있다 (y=${b.h2?.t})`,
     b.h2 && b.h2.t >= 0 && b.h2.t <= 40, JSON.stringify(b.h2))
  ok(`${w}: 도착 직후 그림이 무엇인지 제목이 말한다`, /AI/.test(b.title||''), b.title)
  ok(`${w}: 도착하면 그림이 화면 안에 전부 들어온다 (${b.fig?.t}~${b.fig?.b} / ${b.vh})`,
     b.fig && b.fig.t >= 0 && b.fig.b <= b.vh, JSON.stringify(b))
}

/* ── [C] 빈칸 점검 → 그 칸으로 ───────────────────────────────── */
console.log('\n[C] 375px — [돌아가서 고치기]가 비어 있는 칸으로 데려간다')
await vp(375, 667, true)
const state = (name, rows) => ({schemaVersion:1,updatedAt:new Date().toISOString(),
  diagnosis:{eventId:'loanRejected',counterpartyId:'FI',institutionSectorId:'bank',customInstitution:'',
    reason:'프리랜서로 3년 일했습니다.',routingBranchId:null,sampleId:null,limitKind:null,selectedCandidates:[],
    correctionRows:[],missingRequestItems:[]},
  strategy:{notice:null,candidates:[],picked:[],source:null,basedOn:null},
  form:{tab:'correctionRequest',personal:{name,phone:'010-1111-2222',email:'h@example.com'},
    form1:{selectedItems:['result'],hopeResult:'',consent:'agree'},
    form2:{enabled:{s2:true,s3:true,s4:true},rows,favorable:[{infoName:'',detail:''}],recipient:''},
    activeCase:null,second:null,form2Index:0,form2Extras:[]},
  response:{interpretation:null,errors:[],catOverrides:{}},milestones:{}})

const openPanel = async () => {
  await ev(`(()=>{[...document.querySelectorAll('button')].find(b=>/인쇄 \\/ PDF/.test(b.textContent)).click();return 1})()`)
  await sleep(500)
  return JSON.parse(await ev(`(()=>{const t=document.querySelector('[aria-labelledby=preprint-heading]')
    if(!t) return JSON.stringify({no:true})
    return JSON.stringify({n:t.querySelectorAll('li').length,
      goto:t.querySelectorAll('[data-testid^=goto-]').length,
      back:[...t.querySelectorAll('button')].find(b=>/돌아가서 고치기/.test(b.textContent))?.textContent.replace(/\\s+/g,' ').trim()})})()`))
}
const clickBack = async () => {
  await ev(`(()=>{const t=document.querySelector('[aria-labelledby=preprint-heading]')
    ;[...t.querySelectorAll('button')].find(b=>/돌아가서 고치기/.test(b.textContent)).click();return 1})()`)
  await sleep(700)
  return JSON.parse(await ev(`(()=>{const a=document.activeElement, r=a.getBoundingClientRect()
    const s=document.querySelector('[data-testid=jump-status]')
    return JSON.stringify({tag:a.tagName, label:a.getAttribute('aria-label')||a.type,
      field:a.getAttribute('data-field'), flash:a.classList.contains('field-flash'),
      top:Math.round(r.top), bottom:Math.round(r.bottom), vh:innerHeight,
      inView: r.top>=0 && r.bottom<=innerHeight,
      panelGone: !document.querySelector('[aria-labelledby=preprint-heading]'),
      status: s? s.textContent.replace(/\\s+/g,' ').trim() : null})})()`))
}

// (1) 빈 칸 1개 — 성명만 비어 있다
await seed('/document?form=correctionRequest',
  state('', {identity:{current:'',correction:''}}))
let p = await openPanel()
ok('빈칸 1개: 점검 창에 한 건', p.n === 1, JSON.stringify(p))
ok('빈칸 1개: 항목마다 [이 칸으로 가기]가 있다', p.goto === 1, JSON.stringify(p))
ok('빈칸 1개: 단추가 나머지 개수를 말하지 않는다', !/나머지/.test(p.back||''), p.back)
let r = await clickBack()
ok('빈칸 1개: 점검 창이 닫힌다', r.panelGone, JSON.stringify(r))
ok('빈칸 1개: 성명 칸에 포커스가 간다', r.field === 'name' && r.tag === 'INPUT', JSON.stringify(r))
ok('빈칸 1개: 그 칸이 표시된다', r.flash === true, JSON.stringify(r))
ok(`빈칸 1개: 그 칸이 화면 안이다 (${r.top}~${r.bottom} / ${r.vh})`, r.inView, JSON.stringify(r))
ok('빈칸 1개: 남은 곳이 없다고 알린다', /다른 빈 칸은 없습니다/.test(r.status||''), r.status)

// (2) 빈 칸 3개 — 성명 + 현행만 적힌 행 둘
await seed('/document?form=correctionRequest',
  state('', {identity:{current:'주소가 옛 주소입니다',correction:''},
             creditworthiness:{current:'연체 3건',correction:''}}))
p = await openPanel()
ok('빈칸 3개: 점검 창에 세 건', p.n === 3, JSON.stringify(p))
ok('빈칸 3개: 단추가 나머지 2군데를 말한다', /나머지 2군데/.test(p.back||''), p.back)
r = await clickBack()
ok('빈칸 3개: 첫 번째(성명)로 간다', r.field === 'name', JSON.stringify(r))
ok(`빈칸 3개: 그 칸이 화면 안이다 (${r.top}~${r.bottom} / ${r.vh})`, r.inView, JSON.stringify(r))
ok('빈칸 3개: 남은 개수를 알린다', /2군데 더/.test(r.status||''), r.status)

// ★ 남은 개수는 화면이 **다시 센다.** 다른 빈 칸을 채우면 그 자리에서 줄어든다 —
//   옛 숫자가 남아 있으면 확인하지 않은 것을 말하는 셈이다.
await ev(`(()=>{const el=document.querySelector('[data-field="row-identity-correction"]')
  const set=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set
  set.call(el,'현재 주소로 고쳐 주세요'); el.dispatchEvent(new Event('input',{bubbles:true})); return 1})()`)
await sleep(600)
const st2 = await ev(`document.querySelector('[data-testid=jump-status]')?.textContent.replace(/\s+/g,' ').trim()`)
ok('다른 칸을 채우면 남은 개수가 줄어든다', /1군데 더/.test(st2||''), st2)

// (3) 목록의 [이 칸으로 가기] — 성명이 아닌 칸도 찾아간다
await seed('/document?form=correctionRequest',
  state('홍길동', {identity:{current:'주소가 옛 주소입니다',correction:''}}))
p = await openPanel()
// 성명은 채워져 있으므로 남는 것은 표의 칸 하나뿐이다
ok('표의 칸도 점검에 잡힌다', p.n === 1, JSON.stringify(p))
await ev(`(()=>{document.querySelector('[data-testid="goto-row-identity-correction"]').click();return 1})()`)
await sleep(700)
r = JSON.parse(await ev(`(()=>{const a=document.activeElement,x=a.getBoundingClientRect()
  return JSON.stringify({tag:a.tagName,field:a.getAttribute('data-field'),flash:a.classList.contains('field-flash'),
    inView:x.top>=0&&x.bottom<=innerHeight,top:Math.round(x.top)})})()`))
ok('[이 칸으로 가기]: 그 표 칸에 포커스가 간다',
   r.field === 'row-identity-correction' && r.tag === 'TEXTAREA', JSON.stringify(r))
ok(`[이 칸으로 가기]: 화면 안이다 (y=${r.top})`, r.inView, JSON.stringify(r))

// (4) 표시는 잠시 뒤 사라진다 — 남아 있으면 다음 칸과 구별되지 않는다
await sleep(2200)
ok('표시는 잠시 뒤 사라진다',
   (await ev(`document.querySelectorAll('.field-flash').length`)) === 0)

ok('★ 처리되지 않은 예외 0건', errs.length===0, errs.join('|'))
console.log(`\n통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
