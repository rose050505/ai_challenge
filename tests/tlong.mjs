// [C] 오래 쓰는 사용자 · 되돌리기 — 2026-08-31 감사에서 고친 것을 고정한다.
//
//  1. 진단을 바꾼 뒤 /strategy 가 옛 서술로 만든 목록임을 밝히는가
//  2. 그 표시가 **옛 기록**(basedOn 이 없던 시절)에는 붙지 않는가 — 확인 못 한 것을 단정하지 않는다
//  3. 해를 넘긴 기록의 날짜에 연도가 붙는가
//  4. 오래된·큰 기록으로 어느 화면에 들어가도 죽지 않는가
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map(); const errs=[]
ws.onmessage=e=>{const m=JSON.parse(e.data)
  if(m.method==='Runtime.exceptionThrown')errs.push((m.params.exceptionDetails?.exception?.description||m.params.exceptionDetails?.text||'').slice(0,120))
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const body=()=>ev(`document.body.innerText.replace(/\\s+/g,' ')`)
let pass=0,fail=0
const ok=(n,c,d='')=>{c?pass++:fail++;console.log((c?'  ok   ':'  FAIL ')+n+(c?'':' — '+d))}

const ago=d=>new Date(Date.now()-d*86400000).toISOString()
const CANDS=[{정보명:'국세청 소득금액증명',세부내용:'최근 3년',증빙서류:'홈택스',선정이유:"'프리랜서로 3년'이라고 하셨는데, 소득의 지속성을 보여주는 자료가 필요합니다.",근거범주:'신용거래능력 판단정보'}]
const REASON='프리랜서로 3년 일했고 연체는 없었습니다.'
const base=(o={})=>({schemaVersion:1,updatedAt:ago(0),
  diagnosis:{eventId:'loanRejected',counterpartyId:'FI',institutionSectorId:'bank',customInstitution:'',
    reason:REASON,routingBranchId:null,sampleId:null,limitKind:null,selectedCandidates:[],correctionRows:[],missingRequestItems:[]},
  strategy:{notice:null,candidates:[],picked:[],source:null,basedOn:null},
  form:{tab:'explanationRequest',personal:{name:'홍길동',phone:'010-1111-2222',email:'a@b.c'},
    form1:{selectedItems:['result'],hopeResult:'',consent:null},
    form2:{enabled:null,rows:null,favorable:null,recipient:''},activeCase:null,second:null,form2Index:0,form2Extras:[]},
  response:{interpretation:null,errors:[],catOverrides:{}},milestones:{},...o})
const seedNav=async(state,url)=>{
  const {result:{identifier}} = await send('Page.addScriptToEvaluateOnNewDocument',
    {source:`try{localStorage.clear();localStorage.setItem('wy-tour-v1','done');localStorage.setItem('wae:journey:state',${JSON.stringify(JSON.stringify(state))})}catch(e){}`})
  await send('Page.navigate',{url:BASE+url}); await sleep(1900)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})
}
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:1000,deviceScaleFactor:1,mobile:false})

console.log('[A] 진단을 바꾼 뒤의 전략 후보')
const withBasedOn = (reasonNow) => base({
  diagnosis:{...base().diagnosis, reason:reasonNow},
  strategy:{notice:null,candidates:CANDS,picked:[0],source:'ai',
    basedOn:{reason:REASON,eventId:'loanRejected',institutionSectorId:'bank'}}})
await seedNav(withBasedOn(REASON),'/strategy')
let b=await body()
ok('바꾸기 전에는 "읽고 고른 목록"', b.includes('적어주신 상황을 읽고 고른 목록입니다'), b.slice(0,120))
ok('바꾸기 전에는 낡음 표시가 없다', !b.includes('진단을 바꾸신 뒤의 목록입니다'))

await seedNav(withBasedOn('저는 경력이 단절됐다가 6개월 전 재취업했습니다.'),'/strategy')
b=await body()
ok('★ 서술을 바꾸면 낡음을 밝힌다', b.includes('진단을 바꾸신 뒤의 목록입니다'), b.slice(0,160))
ok('무엇으로 만든 것인지 말한다', b.includes('그 전에 적으셨던 서술'))
ok('낡았을 때는 "읽고 고른 목록"이라 말하지 않는다', !b.includes('적어주신 상황을 읽고 고른 목록입니다'))
ok('다시 만들 길이 있다', b.includes('다시 만들기'))

// 사건 유형·업권이 바뀌어도 같다
await seedNav(base({diagnosis:{...base().diagnosis,eventId:'cardRejected'},
  strategy:{notice:null,candidates:CANDS,picked:[0],source:'ai',
    basedOn:{reason:REASON,eventId:'loanRejected',institutionSectorId:'bank'}}}),'/strategy')
ok('사건 유형이 바뀌어도 밝힌다', (await body()).includes('진단을 바꾸신 뒤의 목록입니다'))
await seedNav(base({diagnosis:{...base().diagnosis,institutionSectorId:'savingsBank'},
  strategy:{notice:null,candidates:CANDS,picked:[0],source:'ai',
    basedOn:{reason:REASON,eventId:'loanRejected',institutionSectorId:'bank'}}}),'/strategy')
ok('업권이 바뀌어도 밝힌다', (await body()).includes('진단을 바꾸신 뒤의 목록입니다'))

console.log('[B] 옛 기록에는 단정하지 않는다')
// basedOn 이 없던 시절의 기록 — 무엇으로 만들었는지 알 수 없다. 낡았다고 말하지 않는다.
await seedNav(base({diagnosis:{...base().diagnosis,reason:'완전히 다른 서술'},
  strategy:{notice:null,candidates:CANDS,picked:[0],source:'ai',basedOn:null}}),'/strategy')
b=await body()
ok('★ basedOn 이 없으면 낡았다고 말하지 않는다', !b.includes('진단을 바꾸신 뒤의 목록입니다'), b.slice(0,140))
// 샘플 캐시·일반 목록은 애초에 이 표시의 대상이 아니다
await seedNav(base({diagnosis:{...base().diagnosis,reason:'다른 서술'},
  strategy:{notice:null,candidates:CANDS,picked:[0],source:'fallback',
    basedOn:{reason:REASON,eventId:'loanRejected',institutionSectorId:'bank'}}}),'/strategy')
ok('일반 목록에는 낡음 표시를 붙이지 않는다', !(await body()).includes('진단을 바꾸신 뒤의 목록입니다'))

console.log('[C] 해를 넘긴 기록')
await seedNav(base({updatedAt:ago(400),milestones:{explanationRequest:{printedAt:ago(400),submittedAt:ago(400)}}}),'/')
b=await body()
const yr = new Date(Date.now()-400*86400000).getFullYear()
ok('★ 이어서 하기 날짜에 연도가 붙는다', b.includes(`${yr}년`), (b.match(/진행 중인 기록이 있습니다.{0,30}/)||[''])[0])
ok('제출 기록에도 연도가 붙는다', new RegExp(`${yr}년.{0,30}제출하셨습니다`).test(b), (b.match(/제출 기록.{0,80}/)||[''])[0])
ok('경과일도 함께 말한다', /\d+일 지났습니다/.test(b))
await seedNav(base({updatedAt:ago(2)}),'/')
ok('같은 해면 연도를 붙이지 않는다', !(await body()).includes(`${new Date().getFullYear()}년`))

console.log('[D] 오래되고 큰 기록으로 전 화면')
const rows=Object.fromEntries(['identity','transaction','creditworthiness','capacity','other']
  .map(c=>[c,{current:('항목: 값 '.repeat(30)),correction:('정정 내용 '.repeat(30))}]))
const bigInterp={covered:['result'],missing:['criteria','baseInfo'],
  baseInfoItems:Array.from({length:20},(_,i)=>({항목:'항목'+i,내용:'값'.repeat(40)+i,분류:'기타 정보'})),
  refused:false,refusalReasonText:'',excludedByProviso:false,provisoText:''}
const big=base({updatedAt:ago(90),
  form:{...base().form,form2:{enabled:{s2:true,s3:true,s4:true},rows,favorable:Array.from({length:10},(_,j)=>({infoName:'정보'+j,detail:'세부'.repeat(30)})),recipient:''},
    form2Extras:Array.from({length:4},(_,i)=>({recipient:'기관'+i,enabled:{s2:true,s3:true,s4:true},rows,favorable:null}))},
  response:{interpretation:bigInterp,errors:[],catOverrides:{}},
  diagnosis:{...base().diagnosis,correctionRows:Array.from({length:60},(_,i)=>({categoryId:'other',current:'행'+i}))}})
for (const p of ['/','/diagnose','/strategy','/document','/next','/response']) {
  await seedNav(big,p)
  const bb=await body()
  ok(`${p} 오류 경계로 넘어가지 않는다`, !bb.includes('이 화면에서 문제가 생겼습니다'))
}
ok('큰 기록도 그대로 저장돼 있다',
   (await ev(`(localStorage.getItem('wae:journey:state')||'').length`)) > 10000)

ok('★ 처리되지 않은 예외 0건', errs.length===0, errs.join('|'))
console.log(`\n통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
