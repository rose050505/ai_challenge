// 서식 2 원문 대조(2026-08-30) 교정 다섯 군데가 실제 서식에 인쇄되는지 확인한다.
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
let pass=0,fail=0
const ok=(n,c,d='')=>{c?pass++:fail++;console.log((c?'  ok   ':'  FAIL ')+n+(d?' — '+d:''))}

await send('Page.navigate',{url:BASE+'/'}); await sleep(700)
await ev("try{localStorage.clear()}catch(e){}")
await send('Page.navigate',{url:BASE+'/document?form=correctionRequest'}); await sleep(1400)
// 섹션 2·3·4 를 모두 켠 상태로 본다 (기본값 확인 후 필요하면 체크)
// .print-sheet 는 화면용과 측정용 두 벌이다. 내용이 있는 쪽을 본다.
const SHEET = `(()=>{const s=[...document.querySelectorAll('.print-sheet')].map(e=>e.innerText).sort((a,b)=>b.length-a.length)[0]??'';return s.replace(/[ \\t]+/g,' ')})()`
// 섹션 4는 섹션 2가 비어 있으면 렌더되지 않는다(dependsOn). 한 칸 채우고 본다.
await ev(`(()=>{const el=document.querySelector('.print-sheet tbody input, .print-sheet tbody textarea');if(!el)return false;const p=el.tagName==='TEXTAREA'?HTMLTextAreaElement:HTMLInputElement;Object.getOwnPropertyDescriptor(p.prototype,'value').set.call(el,'무직으로 표기됨');el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(900)
const sheet=await ev(SHEET)

const TILDE='\u223C', RQ='\u2019'
ok('섹션 3 헤더 어순', sheet.includes('다음과 같이 자동화평가 결과의 산출에 유리하다고 판단되는 정보를 제출합니다.'))
ok('옛 어순은 없다', !sheet.includes('유리하다고 판단되는 정보를 다음과 같이'))
ok('섹션 4 쉼표', sheet.includes('정정 또는 삭제하고, 수정된 정보를'))
ok('구분 라벨 붙여쓰기', sheet.includes('신용거래능력판단정보'))
ok('나머지 4분류는 그대로', ['식별정보','거래내용 판단정보','신용도 판단정보','기타 정보'].every(x=>sheet.includes(x)))
ok('붙임 공백', sheet.includes('붙 임 : 증빙자료'))
ok('서명 표기', sheet.includes('(서명 / 인)'), JSON.stringify(sheet.slice(-40)))
ok('표 머리 3열', ['구 분','현행 정보','정정 또는 삭제 내용'].every(x=>sheet.includes(x)))

// 예시 행은 placeholder 라 innerText 에 없다. 속성으로 확인한다.
const ph=await ev(`(()=>{const i=[...document.querySelectorAll('.print-sheet [placeholder]')].map(e=>e.getAttribute('placeholder'));return JSON.stringify(i)})()`)
const phs=JSON.parse(ph||'[]')
ok('예시 정보명', phs.includes('건강보험 납부실적'))
const want=`${RQ}xx년 x월 x일${TILDE}${RQ}◊◊년 ◊월 ◊일까지 연체없이 납부`
ok('예시 세부 내용(U+2019/U+223C, 공백 없음)', phs.includes(want), JSON.stringify(phs.filter(x=>x&&x.includes('납부'))))
ok('ASCII 물결/따옴표 없음', !phs.some(x=>x&&(x.includes(' ~ ')||x.includes("'xx년"))))

/* ★ 서식 1의 서명 표기는 정본이 `(서명/인)` 이다 (2026-09-04 별지 제15호의2 대조).
     공개본의 `(서명 또는 인)` 을 따라 적고 있었다. 서식 2는 `(서명 / 인)` 으로 공백이 다르다 —
     정본이 서로 다르므로 둘을 합치지 않는다. */
await send('Page.navigate',{url:BASE+'/document?form=explanationRequest'}); await sleep(1300)
const s1=await ev(`(()=>[...document.querySelectorAll('.print-sheet')].map(e=>e.innerText).sort((a,b)=>b.length-a.length)[0]??'')()`)
ok('서식 1 서명 표기 = 정본', s1.includes('(서명/인)') && !s1.includes('(서명 또는 인)'), s1.slice(-60))
// 화면 용어는 그대로다 — 붙여쓰기는 서식 인쇄 라벨(formLabel)에만 있다
const law = await import('../src/data/law.js')
const cap = law.BASE_INFO_CATEGORIES_BY_ID.capacity
ok('화면 라벨 불변', cap.label==='신용거래능력 판단정보' && cap.id==='capacity', cap.label)
ok('서식 라벨만 붙여쓰기', cap.formLabel==='신용거래능력판단정보')
ok('나머지 4분류에는 formLabel 없음', law.BASE_INFO_CATEGORIES.filter(c=>c.formLabel).length===1)
ok('R3 범주 라벨 불변', law.R3_SCOPE.categoryLabel==='신용거래능력 판단정보')

/* ══════════════════════════════════════════════════════════════════
 * 정본 대조 (2026-09-04) — 별지 제15호의2·제15호의3
 *
 * ★ 그전까지 기준으로 삼던 HB저축은행 공개본이 정본을 손댄 것이었다.
 *   정본은 "당사"·"귀 사"로 **기관 중립적**이라, 업권마다 문구를 바꿔 끼우던
 *   치환·조사 보정 경로가 통째로 필요 없어졌다. 그 경로가 되살아나지 않는지도 함께 잠근다.
 * ══════════════════════════════════════════════════════════════════ */
const S1_정본 =
  '당사는 고객의 요청에 따라 자동화평가 결과, 자동화평가의 주요 기준 및 자동화평가에 ' +
  '이용된 기초정보의 개요를 설명하고 있으며, 기초정보가 정확하지 않은 경우 해당 정보에 대한 ' +
  '정정ㆍ삭제 및 수정된 정보를 활용하여 자동화평가 결과를 재산출하여 줄 것을 당사에 ' +
  '요청할 수 있습니다.'
const S2_정본 =
  '는(은) 기초정보 정정ㆍ삭제 및 자동화평가 결과 재산출과 관련하여 귀 사의 설명을 읽고 ' +
  '이해하였으며, 귀 사가 보유하고 있는 본인의 기초정보 중 정확하지 않거나 최신의 정보가 ' +
  '아닌 내용이 있어 아래와 같이 정정 및 삭제를 요구합니다.'
const flat = (x) => (x || '').replace(/\s+/g, ' ')

ok('서식 2 제목에 "서"가 없다',
   flat(sheet).includes('기초정보 정정ㆍ삭제 및 자동화평가 재산출 요청') &&
   !flat(sheet).includes('재산출 요청서'), flat(sheet).slice(0, 60))
ok('서식 2 부제', flat(sheet).includes('(제40조의5제1항 관련)'))
ok('섹션 1 정본 전문', flat(sheet).includes(S1_정본), flat(sheet).slice(0, 200))
ok('섹션 2 리드 정본', flat(sheet).includes(S2_정본))
ok('공개본 문구가 남아 있지 않다',
   !sheet.includes('저축은행') && !sheet.includes('상기 설명') && !sheet.includes('은(는)'),
   JSON.stringify(sheet.slice(0, 120)))

/* ★ 업권을 바꿔도 서식 본문이 **한 글자도** 달라지지 않아야 한다.
     달라진다면 치환 경로가 어딘가 남아 있다는 뜻이다. */
const sectors = law.INSTITUTION_SECTORS.map((s) => s.id)
const seen = new Map()
for (const id of sectors) {
  await ev(`(()=>{localStorage.setItem('wae:journey:state', JSON.stringify({
    schemaVersion:1, updatedAt:new Date().toISOString(),
    diagnosis:{eventId:'loanRejected',counterpartyId:'FI',institutionSectorId:${JSON.stringify(id)},
      customInstitution:'',reason:'',routingBranchId:null,sampleId:null,limitKind:null,
      selectedCandidates:[],correctionRows:[],missingRequestItems:[]}}))})()`)
  await send('Page.navigate', { url: BASE + '/document?form=correctionRequest' })
  await sleep(1100)
  const body = flat(await ev(SHEET))
  const s1 = body.includes(S1_정본)
  const s2 = body.includes(S2_정본)
  if (!s1 || !s2) ok(`${id}: 정본 그대로`, false, `s1=${s1} s2=${s2}`)
  seen.set(id, `${s1}|${s2}`)
}
ok(`${sectors.length}개 업권 전부 정본 그대로`,
   [...seen.values()].every((v) => v === 'true|true'),
   JSON.stringify([...seen].filter(([, v]) => v !== 'true|true')))

console.log(`\n통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
