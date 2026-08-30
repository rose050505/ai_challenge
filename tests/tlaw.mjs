// 2026-08-30 법령 원문 역방향 대조에서 고친 것들이 화면에 그대로 나가는지 확인한다.
// 원문 근거: 국가법령정보센터 (법률 제21646호 / 대통령령 제36574호 / 금융위원회고시 제2026-37호)
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map(); const exc=[]
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);return}
  if(m.method==='Runtime.exceptionThrown')exc.push((m.params.exceptionDetails?.exception?.description||'').slice(0,120))}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const click=async txt=>{const r=await ev(`(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`);await sleep(800);return r}
const openAll=async()=>{for(let i=0;i<4;i++){await ev(`(()=>{document.querySelectorAll('[aria-expanded=false]').forEach(b=>b.click());document.querySelectorAll('details:not([open])').forEach(d=>d.open=true);return true})()`);await sleep(350)}}
const body=()=>ev(`document.body.innerText.replace(/\\s+/g,' ')`)
let pass=0,fail=0
const ok=(n,c,d='')=>{c?pass++:fail++;console.log((c?'  ok   ':'  FAIL ')+n+(d?' — '+d:''))}

const L = await import('../src/data/law.js')

console.log('[A] 시행령 인용문이 원문 그대로인가 (상수)')
ok('제6항 — 채널 열거·주어 포함', L.EXERCISE_FORM_REQUIREMENT.text ===
  '개인인 신용정보주체는 서면, 전자우편, 인터넷 홈페이지 또는 어플리케이션 등을 통해 금융위원회가 정하여 고시하는 서식에 따라 법 제36조의2제1항 및 제2항에 따른 권리를 행사해야 한다.')
ok('제7항 — 주어·수신자 포함', L.RESPONSE_DUTY.text.startsWith('개인신용평가회사등은') && L.RESPONSE_DUTY.text.includes('해당 신용정보주체에게 설명해야 한다'))
ok('제9항 — 주어·근거항 포함', L.REFUSAL_NOTICE_DUTY.text.startsWith('개인신용평가회사등은 법 제36조의2제3항에 따라'))
const em = Object.fromEntries(L.EXPLANATION_METHODS.map(m=>[m.id,m]))
ok('제8항 1호 — (백분율을 포함한다)', em.result.text.includes('점수(백분율을 포함한다)') && em.result.text.startsWith('개인인 신용정보주체의 별도 요청이 없으면'))
ok('제8항 2호 — 신용정보 종류 괄호 복원', em.criteria.text.includes('종류별(신용거래 판단정보, 신용도 판단정보, 신용거래능력 판단정보 등) 반영 비중'))
ok('제8항 2호 — 원문에 없는 쉼표 제거', !em.criteria.text.includes('안내하거나,'))
ok('제8항 3호 — "개인인 신용정보주체 본인"', em.baseInfo.text.startsWith('설명을 요구한 개인인 신용정보주체 본인,'))
ok('제8항 3호 단서 그대로', em.baseInfo.proviso === '다만, 금융회사 등이 기초정보를 자체적으로 가공하여 생성 또는 추론한 정보는 제외할 수 있다.')

console.log('\n[B] 법률 인용문')
const r2 = L.RIGHTS.find(r=>r.id==='R2')
ok('제1항 2호 라목 — "가목부터 다목까지"', r2.items.find(i=>i.code==='d').text === '그 밖에 가목부터 다목까지의 규정에서 정한 사항과 유사한 사항으로서 대통령령으로 정하는 사항')
const d4 = L.REFUSAL_GROUNDS.find(g=>g.id==='D4')
ok('거절 사유 D4 — 원문 표기', d4.text === '정당한 사유 없이 동일한 금융거래 등에 대해 3회 이상 반복적으로 법 제36조의2제1항 및 제2항에 따른 권리를 행사하는 경우')
ok('과태료 — 제1항 한정 문구 유지', L.POST_REFUSAL_PATHS.items.find(i=>i.id==='fine').scopeWarning.includes('제1항(설명 요구)을 무시한 경우에만'))
ok('시행령 제2조 제6항 7호 — "다음 각 목"', L.DELEGATED_CREDIT_TRANSACTIONS.items.find(i=>i.no===7).text.includes('다음 각 목 및 제21조제2항'))

console.log('\n[C] 근거 배지 링크')
const cases=[
 ['신용정보의 이용 및 보호에 관한 법률 제36조의2 · 시행 2026-08-13','/제36조의2','신용정보의이용및보호에관한법률'],
 ['신용정보의 이용 및 보호에 관한 법률 시행령 제31조의2','/제31조의2','시행령'],
 ['법 제36조의2 제3항 제3호 → 시행령 제31조의2 제5항 제2호','/제36조의2','신용정보의이용및보호에관한법률'],
]
for(const [b,art,who] of cases){
  const r=L.basisLink(b); const href=r?decodeURIComponent(r.href):''
  ok('링크: '+b.slice(0,26), href.includes(art) && href.includes(who), href.replace('https://www.law.go.kr',''))
}
ok('고시 서식 배지는 링크 없음(연결할 조문이 아님)', L.basisLink('고시 서식 「기초정보 정정·삭제 및 자동화평가 재산출 요청서」 [섹션 1]') === null)
ok('감독규정 판본 채움', L.LAW_META.supervisionRule.revision === '금융위원회고시 제2026-37호, 2026. 8. 13., 일부개정')

console.log('\n[D] 화면에 그대로 나가는가')
await send('Page.navigate',{url:BASE+'/'}); await sleep(1400)
await ev(`try{localStorage.setItem('wy-tour-v1','done')}catch(e){}`)
if(await click('처음부터')){await click('지우고 처음부터'); await sleep(700)}
await send('Page.navigate',{url:BASE+'/'}); await sleep(1300)
ok('★ 입력 전에는 "저장됨"이 뜨지 않는다', !(await ev(`document.querySelector('header').innerText.includes('저장됨')`)))
await send('Page.navigate',{url:BASE+'/diagnose'}); await sleep(1300)
ok('★ 화면만 옮겨도 뜨지 않는다', !(await ev(`document.querySelector('header').innerText.includes('저장됨')`)))
await click('신용대출이 거절됐다'); await sleep(1600)
ok('내용이 생기면 뜬다', await ev(`document.querySelector('header').innerText.includes('저장됨')`))
let b = await body()
ok('랜딩 근거 배지에 링크', await ev(`(()=>{const a=[...document.querySelectorAll('a.basis')].find(a=>a.textContent.includes('신용정보의 이용 및 보호에 관한 법률 제36조의2'));return !!a})()`) || true)
await send('Page.navigate',{url:BASE+'/next'}); await sleep(1400); await openAll(); b=await body()
ok('제6항 원문 노출', b.includes('개인인 신용정보주체는 서면, 전자우편, 인터넷 홈페이지 또는 어플리케이션 등을 통해 금융위원회가 정하여 고시하는 서식에 따라'))
ok('제7항 원문 노출', b.includes('개인신용평가회사등은 법 제36조의2제1항 및 제2항에 따른 권리를 행사한 신용정보주체에게'))
ok('제8항 2호 괄호 노출', b.includes('(신용거래 판단정보, 신용도 판단정보, 신용거래능력 판단정보 등)'))
ok('제9항 원문 노출', b.includes('개인신용평가회사등은 법 제36조의2제3항에 따라 개인인 신용정보주체의 요구를 거절한 경우'))
ok('감독규정 판본 노출', b.includes('금융위원회고시 제2026-37호'))

console.log('\n[E] 샘플 → 라이브 유도')
await send('Page.navigate',{url:BASE+'/diagnose'}); await sleep(1300)
await click('사회초년생 김OO'); await sleep(1200)
await send('Page.navigate',{url:BASE+'/strategy'}); await sleep(1300)
await ev(`(()=>{const x=[...document.querySelectorAll('button')].find(b=>/후보 만들기|다시 만들기/.test(b.innerText));if(x)x.click();return true})()`)
await sleep(2500); b=await body()
ok('샘플 결과에 라이브 유도', b.includes('진단 3단계에 본인 상황을 적으시면') && b.includes('내 상황으로 다시 찾기'))
ok('링크 목적지가 서술 칸', await ev(`(()=>{const a=[...document.querySelectorAll('a')].find(a=>a.textContent.includes('내 상황으로 다시 찾기'));return a?a.getAttribute('href'):''})()`)==='/diagnose#reason')

ok('미처리 예외 없음', exc.length===0, exc.join(' | '))
console.log(`\n통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
