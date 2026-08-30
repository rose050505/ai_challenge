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

// 서식 1의 서명 표기는 건드리지 않았다 (원본 대조 대상이 아니다)
await send('Page.navigate',{url:BASE+'/document?form=explanationRequest'}); await sleep(1300)
const s1=await ev(`(()=>[...document.querySelectorAll('.print-sheet')].map(e=>e.innerText).sort((a,b)=>b.length-a.length)[0]??'')()`)
ok('서식 1 서명 표기 불변', s1.includes('(서명 또는 인)') && !s1.includes('(서명 / 인)'))
// 화면 용어는 그대로다 — 붙여쓰기는 서식 인쇄 라벨(formLabel)에만 있다
const law = await import('../src/data/law.js')
const cap = law.BASE_INFO_CATEGORIES_BY_ID.capacity
ok('화면 라벨 불변', cap.label==='신용거래능력 판단정보' && cap.id==='capacity', cap.label)
ok('서식 라벨만 붙여쓰기', cap.formLabel==='신용거래능력판단정보')
ok('나머지 4분류에는 formLabel 없음', law.BASE_INFO_CATEGORIES.filter(c=>c.formLabel).length===1)
ok('R3 범주 라벨 불변', law.R3_SCOPE.categoryLabel==='신용거래능력 판단정보')

console.log(`\n통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
