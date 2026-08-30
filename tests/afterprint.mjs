const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const click=async txt=>{const ok=await ev(`(()=>{const e=[...document.querySelectorAll('button,a,summary')].reverse().find(e=>e.textContent.trim().includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`);await sleep(700);return ok}
const body=()=>ev('document.body.innerText.replace(/\\s+/g," ")')
const nav=async p=>{await send('Page.navigate',{url:BASE+p});await sleep(1300)}
const store=()=>ev(`(()=>{try{return JSON.parse(localStorage.getItem('wae:journey:state'))}catch(e){return null}})()`)
const out=[]; const ck=(n,p,d='')=>{out.push([n,p]);console.log((p?'  ✔ ':'  ✘ ')+n+(d?' — '+d:''))}

console.log('\n[E. 인쇄 이후 → 제출까지]')
await nav('/')
if (await click('처음부터')) { await click('지우고 처음부터'); await sleep(400) }
await nav('/document')
await ev(`(()=>{const el=document.querySelector('.print-sheet input');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(el,'김테스트');el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(400)
ck('1) 인쇄 전에는 체크리스트 없음', !(await body()).includes('제출 전에 확인하세요'))
// 실제 버튼을 누른다. headless 는 afterprint 가 오지 않을 수 있어 보조 경로가 받아야 한다.
// 인쇄 직전 검토 단계 (Phase 0 머리글 안내 + Phase 4 빈칸 점검)
await click('인쇄 / PDF로 저장')
const gate = (await body()).includes('인쇄하기 전에 확인하세요')
ck('1-a) 인쇄 직전 검토 단계', gate)
if (gate) { await click('이대로 인쇄하기'); await sleep(600) }
await sleep(1200)
const a=await body()
ck('2) ★ 인쇄 후 화면 전환', a.includes('제출 전에 확인하세요'), 'headless 에서도 전환됨(보조 경로)')
ck('3) 서명·날인 항목', a.includes('출력물에 서명 또는 날인했습니다'))
ck('4) 주민등록번호 항목 (서식 1)', a.includes('주민등록번호를 직접 기재했습니다'))
ck('5) 제출처 확인 항목', a.includes('제출할 곳을 확인했습니다'))
ck('6) 진행 표시', /\d\/\d 확인/.test(a))
ck('7) 인쇄 시각 표시', /인쇄/.test(a))
const printed = (await store())?.milestones?.explanationRequest?.printedAt
ck('8) ★ 인쇄 기록이 여정에 남는다', Boolean(printed), printed ?? '없음')
// 체크
await ev(`(()=>{document.querySelectorAll('section[aria-labelledby=afterprint-heading] input[type=checkbox]').forEach(c=>c.click());return true})()`)
await sleep(400)
ck('9) 체크 진행 반영', (await body()).includes('3/3 확인'))
// 이메일 초안 연결
await click('이메일 초안 열기')
await sleep(500)
ck('10) ★ 이메일 초안이 열린다', (await ev(`document.querySelector('#email-draft-panel')!==null`)))
ck('11) 초안 본문에 근거 조문', (await ev(`document.getElementById('email-body')?.value ?? ''`)).includes('제36조의2'))
// 제출 날짜
await ev(`(()=>{const el=document.getElementById('submitted-at');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(el,'2026-08-24');el.dispatchEvent(new Event('change',{bubbles:true}));el.dispatchEvent(new Event('input',{bubbles:true}));return el.value})()`)
await sleep(700)
const b=await body()
ck('12) 제출일 기록됨', b.includes('8월 24일에 제출한 것으로 기록했습니다'))
const sub = (await store())?.milestones?.explanationRequest?.submittedAt
ck('13) ★ 제출 기록이 저장된다', sub==='2026-08-24', sub ?? '없음')

console.log('\n[F. 제출 기록 → 회신 해석 연결]')
await nav('/')
const l=await body()
ck('1) 랜딩에 제출 기록', l.includes('8월 24일에') && l.includes('제출하셨습니다'))
ck('2) 경과일 표시 (카운트다운 아님)', /제출한 지 \d+일 지났습니다/.test(l), l.match(/제출한 지 \d+일 지났습니다/)?.[0])
ck('3) ★ 남은 날짜 카운트다운 없음', !/남았습니다|남은 기간|기한까지/.test(l))
ck('4) 회신 해석 연결', l.includes('회신 해석하기'))
await nav('/next')
const n=await body()
ck('5) /next 에도 제출 기록', n.includes('제출하셨습니다'))
ck('6) 법령 기한 없음 유지', n.includes('법령상 기한 규정은 없으며'))
ck('7) /next 에도 카운트다운 없음', !/남았습니다/.test(n))
await click('회신 해석하기'); await sleep(1000)
ck('8) 회신 해석으로 이동', (await ev('location.pathname'))==='/response')

console.log('\n════════════════════════')
const f=out.filter(([,p])=>!p)
console.log(`${out.length-f.length}/${out.length} 통과`)
f.forEach(([n])=>console.log('  ✘',n))
ws.close(); process.exit(f.length?1:0)
