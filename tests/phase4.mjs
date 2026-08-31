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
const body=()=>ev('document.body.innerText')
const click=async txt=>{const ok=await ev(`(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim().includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`);await sleep(750);return ok}
// React 는 type 속성을 DOM 에 붙이지 않는다 → [type=text] 선택자가 맞지 않는다. 프로퍼티로 고른다.
const textInputs = `[...document.querySelectorAll('.print-sheet input')].filter(i=>i.type==='text')`
const setName=async(val)=>ev(`(()=>{const el=${textInputs}[0];if(!el)return 'no el';const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;set.call(el,${JSON.stringify(val)});el.dispatchEvent(new Event('input',{bubbles:true}));return 'ok'})()`)
const checkedCount=()=>ev(`document.querySelectorAll('.print-sheet input[type=checkbox]:checked, .print-sheet input:checked').length`)
let pass=0,fail=0; const t_=(n,c,d)=>{c?pass++:fail++;console.log((c?'  ok  ':'  FAIL')+' '+n+(d?' — '+d:''))}
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})

// 깨끗한 상태에서 시작 — 앱의 '처음부터'
await send('Page.navigate',{url:BASE+'/'}); await sleep(1100)
// 앱 자신의 초기화 경로로 비운다 (외부에서 지우면 pagehide flush 가 되돌린다)
if ((await body()).includes('처음부터')) {
  await click('처음부터'); await sleep(400)
  await click('지우고 처음부터'); await sleep(800)
}
console.log('  초기 상태:', await ev(`(()=>{try{const j=localStorage.getItem('wae:journey:state');return j? '남아있음':'비어있음'}catch{return '?'}})()`))

console.log('\n[1. 제출 전 검토]')
await send('Page.navigate',{url:BASE+'/diagnose'}); await sleep(1000)
await click('신용대출이 거절됐다'); await click('금융회사')
await ev(`(()=>{const s=document.querySelector('select');if(!s)return false;s.value=[...s.options].find(o=>o.value)?.value;s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
await sleep(600)
await send('Page.navigate',{url:BASE+'/document?form=explanationRequest'}); await sleep(1300)
// 성명 비우고 요구 항목 전부 해제
await ev(`(()=>{document.querySelectorAll('.print-sheet input[type=checkbox]').forEach(c=>{if(c.checked)c.click()});return true})()`)
await sleep(400)
await click('인쇄 / PDF로 저장')
let b=await body()
t_('검토 패널이 뜬다', b.includes('인쇄하기 전에 확인하세요'))
t_('성명 경고', b.includes('신청인 성명이 비어 있습니다'))
t_('요구 항목 경고', b.includes('요구할 항목을 하나도 고르지 않으셨습니다'))
t_('막지 않는다', b.includes('이대로 인쇄하기'))
// 2026-08-31: 머리글 확인 단계는 걷어냈다. 이 패널은 서식의 내용만 말한다.
t_('★ 머리글 확인은 이 패널에 없다', !b.includes('머리글·바닥글을 끄셨나요'))
await click('돌아가서 고치기')
t_('돌아가기로 닫힌다', !(await body()).includes('인쇄하기 전에 확인하세요'))
// 채우면 경고가 사라진다
await setName('홍길동')
await ev(`(()=>{const c=document.querySelector('.print-sheet input[type=checkbox]');if(c&&!c.checked)c.click();return true})()`)
await sleep(600)
// 2026-08-31: 빈 칸이 없으면 관문 없이 곧바로 인쇄된다.
//   (전에는 이 브라우저에서 처음 인쇄할 때 머리글 확인 단계가 한 번 더 있었다)
await click('인쇄 / PDF로 저장'); await sleep(900)
b=await body()
t_('★ 채우면 관문 없이 바로 인쇄', !b.includes('인쇄하기 전에 확인하세요'), b.slice(0,60))
t_('인쇄 후 전환', b.includes('제출 전에 확인하세요'))

console.log('  (확인) 저장된 성명:', await ev(`(()=>{try{return JSON.parse(localStorage.getItem('wae:journey:state')).form.personal.name}catch{return '?'}})()`))
console.log('\n[2. 복수 기관 동시 행사]')
await send('Page.navigate',{url:BASE+'/document?form=explanationRequest'}); await sleep(1300)
b=await body()
t_('받을 곳 안내', b.includes('이 요구서를 받을 곳'))
t_('추가 버튼', /개인신용평가회사[^\n]*용 서식도 만들기/.test(b))
t_('근거 조문', b.includes('법 제36조의2 제1항'))
t_('처음엔 한 건만', !b.includes('추가하신 곳'))
await click('용 서식도 만들기'); await sleep(1100)
b=await body()
t_('두 건이 생긴다', b.includes('진단에서 고르신 곳') && b.includes('추가하신 곳'))
t_('★ CB 제한 안내', b.includes('물을 수 없는 것이 하나 있습니다') && b.includes('금융거래의 설정 및 유지'))
t_('★ 제한의 근거 조문', b.includes('법 제36조의2 제1항 제1호 나목'))
t_('두 번째 건엔 서식 2 탭 없음', !b.includes('서식 2 · 기초정보'))
// 두 번째 건에 이름을 넣고 기본 건으로 돌아가 확인
// 인적사항은 두 건이 공유한다(같은 사람이다). 건마다 다른 것은 요구 항목이다.
await ev(`(()=>{document.querySelectorAll('.print-sheet input[type=checkbox]').forEach(c=>{if(c.checked)c.click()});return true})()`)
await sleep(1900)
const secChecked = await checkedCount()
await click('진단에서 고르신 곳'); await sleep(1200)
const baseChecked = await checkedCount()
t_('★ 기본 건 작성 내용이 보존된다', baseChecked > 0 && secChecked === 0, `기본=${baseChecked} 두번째=${secChecked}`)
t_('기본 건엔 서식 2 탭 있음', (await body()).includes('서식 2 · 기초정보'))
// ① 결과 항목을 켜면 '희망 결과' 칸이 성명보다 앞에 생긴다. 위치가 아니라 값으로 찾는다.
const vals=await ev(`JSON.stringify(${textInputs}.map(i=>i.value))`)
t_('인적사항은 두 건이 공유', JSON.parse(vals).includes('홍길동'), vals)
await click('추가하신 곳'); await sleep(1200)
t_('★ 두 번째 건 작성 내용이 따로 남는다', (await checkedCount())===0)
// 두 번째 건 인쇄 → 기록이 따로
await click('인쇄 / PDF로 저장'); await sleep(500)
if ((await body()).includes('이대로 인쇄하기')) await click('이대로 인쇄하기')
await sleep(900)
const ms=await ev(`(()=>{try{return Object.keys(JSON.parse(localStorage.getItem('wae:journey:state')).milestones||{}).join(',')}catch{return 'x'}})()`)
t_('★ 여정 기록이 두 건으로 구분된다', ms.includes('explanationRequest') && ms.includes(':second'), ms)

// ★ 두 번째 건을 보던 중에도 서식 2로 갈 수 있어야 한다 (두 번째 건엔 서식 2가 없다)
console.log('  (두 번째 건이 활성인 상태에서 서식 2 요청)')
await send('Page.navigate',{url:BASE+'/document?form=correctionRequest'}); await sleep(1500)
b=await body()
t_('★ 서식 2 요청이면 기본 건으로 돌아간다', b.includes('서식 2 · 기초정보') && (await ev(`document.querySelectorAll('.paged-page').length`))>0)
t_('기본 건이 선택돼 있다', b.includes('진단에서 고르신 곳'))

console.log('\n[3. 회신이 오지 않으면]')
await send('Page.navigate',{url:BASE+'/next'}); await sleep(1200)
b=await body()
t_('접힘 상태로 존재', b.includes('회신이 오지 않으면'))
await click('회신이 오지 않으면'); await sleep(700)
b=await body()
t_('기한 없음 유지', b.includes('며칠까지 기다려야 하는지는 법에 없습니다'))
t_('★ 위법 단정 없음', !b.includes('위법입니다') || b.includes('“○일이 지나면 위법”') || b.includes('○일이 지나면 위법'))
t_('회신 의무 조문', b.includes('시행령 제31조의2 제7항'))
t_('★ 3회 반복 제한 안내', b.includes('3회 이상 반복') && b.includes('정당한 사유 없이'))
t_('반복 계산 여부를 단정하지 않음', b.includes('반복 행사') && b.includes('법령에 정해져 있지 않습니다'))
t_('재요청 문안 제공', b.includes('다시 물어보는 문안'))
const draft=await ev(`document.querySelector('#reminder-body')?.value ?? ''`)
t_('문안에 회신 의무 조문 인용', draft.includes('제31조의2 제7항'))
t_('문안에 기한 주장 없음', !/위법|기한 내|법정 기한/.test(draft))
t_('문안에 새 요구가 아님을 명시', draft.includes('새로운 요구가 아니라'))

console.log('\n미처리 예외:', errs.length); errs.slice(0,4).forEach(e=>console.log('  '+e))
console.log(`통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
