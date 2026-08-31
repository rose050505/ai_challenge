const BASE = process.env.APP_URL || 'http://localhost:4400'
const t = (await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(method,params={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method,params}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const nav=async p=>{await send('Page.navigate',{url:BASE+p});await sleep(900)}
const click=async txt=>{const ok=await ev(`(()=>{const e=[...document.querySelectorAll('button,a')].reverse().find(e=>e.textContent.trim().includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`);await sleep(700);return ok}
const body=()=>ev('document.body.innerText.replace(/\\s+/g," ")')
const path=()=>ev('location.pathname+location.search')
// 저장된 여정을 비우고 시작한다 (이 테스트들은 첫 방문을 전제로 한다)
await send('Page.navigate',{url:BASE+'/'}); await sleep(1200)
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='처음부터');if(b)b.click();return !!b})()`)
await sleep(300)
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='지우고 처음부터');if(b)b.click();return !!b})()`)
await sleep(500)
// 저장된 해석 결과가 있으면 새 회신을 넣을 수 있는 상태로 되돌린다
const freshResponse = async () => {
  await nav('/response')
  if ((await body()).includes('이전에 해석한 결과를 불러왔습니다')) {
    await click('다른 회신 넣기')
  }
}
const out=[]; const ck=(n,p,d='')=>{out.push([n,p,d]);console.log((p?'  ✔ ':'  ✘ ')+n+(d?' — '+d:''))}

// ── A. 샘플 (a): 3유형 전부 + 오류 체크 → 서식 2 ──
console.log('\n[A. 샘플 (a) 3유형 전부 → 오류 체크 → 서식 2 → 인쇄]')
await nav('/next')
ck('Next 에 진입 링크', await ev(`!!document.body.innerText.includes('회신 해석하러 가기')`))
await click('회신 해석하러 가기')
ck('1) /response 도달', (await path())==='/response')
ck('   붙여넣기 안내', (await body()).includes('개인정보가 포함된 부분은 지우고'))
await click('3유형 전부 설명받은 회신')
const ta = await ev(`document.querySelector('textarea').value.length`)
ck('2) 샘플 회신 주입', ta > 200, ta+'자')
await click('회신 해석하기'); await sleep(1400)
const b1 = await body()
ck('3) 3유형 판정', b1.includes('무엇을 받았나요'))
ck('   전부 받음 (못 받음 없음)', !b1.includes('설명되지 않은 항목이 있습니다'))
ck('   ★ 제도의 한계 고지', b1.includes('자체적으로 가공하여 생성 또는 추론한 정보는 제외'))
ck('   한계 = 제도 설계 명시', b1.includes('이 서비스의 한계가 아니라 제도의 설계'))
ck('   기초정보 5분류 표시', b1.includes('신용거래능력 판단정보') && b1.includes('신용도 판단정보'))
ck('   초기 다음행동=확인 끝', b1.includes('확인이 끝났습니다'))
ck('   ★ 샘플(a)는 제외 미적용', !b1.includes('이번 회신에 적용된 제외입니다'))
ck('   ★ 거절 박스 없음', !b1.includes('거절된 회신입니다'))
const sels = await ev(`document.querySelectorAll('select').length`)
ck('   ★ 분류 직접 변경 UI', sels>=5, sels+'개')
// 분류를 사용자가 바꾸면 다른 범주로 이동하는가
const moved = await ev(`(()=>{const s=[...document.querySelectorAll('select')][0];const set=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set;set.call(s,'기타 정보');s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
await sleep(400)
const bmov = await body()
ck('   ★ 사용자 분류 변경 반영', bmov.includes('기타 정보 법 제2조 제1호 마목'))
// 원복
await ev(`(()=>{const s=[...document.querySelectorAll('select')].pop();const set=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set;set.call(s,'신용거래능력 판단정보');s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
await sleep(400)

// 오류 2건 체크
const checked = await ev(`(()=>{const cbs=[...document.querySelectorAll('input[type=checkbox]')];cbs[2].click();cbs[0].click();return document.querySelectorAll('input[type=checkbox]:checked').length})()`)
await sleep(500)
const b2 = await body()
ck('4) 오류 체크', checked===2, checked+'건')
ck('   다음행동 전환 → 정정', b2.includes('틀린 기초정보를 정정하고 재산출을 요구하세요'))
ck('   R4/R5 근거 표시', b2.includes('법 제36조의2 제2항 제2호 가목'))
await click('서식 2 만들기')
ck('5) 서식 2 도달', (await path()).includes('form=correctionRequest'))
const b3 = await body()
ck('   프리필 안내', b3.includes('현행 정보'))
// 2026-08-31: 표의 칸은 여러 줄이 될 수 있어 textarea 로 바뀌었다. 둘 다 본다.
const vals = await ev(`JSON.stringify([...document.querySelectorAll('input,textarea')].map(i=>i.value).filter(v=>v&&v!=='on'))`)
ck('6) 섹션 2 현행정보 주입', vals.includes('연체 이력')||vals.includes('직업정보'), vals.slice(0,120))
const s4on = await ev(`document.body.innerText.includes('재산출 요구')`)
ck('   s2 채워져 s4 선택 가능', s4on)

// ── B. 샘플 (b): 일부만 → 재요구 → 서식 1 ──
console.log('\n[B. 샘플 (b) 일부만 설명 → 누락 재요구 → 서식 1]')
await freshResponse()
await click('일부만 설명받은 회신')
await click('회신 해석하기'); await sleep(1400)
const c1 = await body()
ck('1) 누락 판정', c1.includes('설명되지 않은 항목이 있습니다'))
ck('   누락 항목명', c1.includes('자동화평가의 주요 기준') && c1.includes('기초정보의 개요'))
ck('   다음행동 = 재요구', c1.includes('설명되지 않은 항목을 다시 요구하세요'))
ck('   제도의 한계 고지', c1.includes('자체적으로 가공하여 생성 또는 추론한 정보는 제외'))
ck('   ★ 제외 적용 강조', c1.includes('이번 회신에 적용된 제외입니다'))
ck('   ★ 회신 원문 인용', c1.includes('자체적으로 개발·가공하여 생성한 정보에'))
ck('   ★ 거절이 아님을 명시', c1.includes('이것은 요구를 거절한 것이 아닙니다'))
ck('   ★ 거절 박스 뜨지 않음', !c1.includes('거절된 회신입니다'))
await click('서식 1 다시 만들기')
ck('2) 서식 1 도달', (await path()).startsWith('/document'), await path())
const picked = await ev(`(()=>{const ls=[...document.querySelectorAll('li')].filter(l=>l.querySelector('input[type=checkbox]'));return JSON.stringify(ls.filter(l=>l.querySelector('input').checked).map(l=>l.textContent.trim().slice(0,22)))})()`)
ck('3) 누락 항목만 선택됨', picked.includes('②')&&picked.includes('③')&&!picked.includes('①'), picked)

// ── C. 독립 진입 (진단 미경유) ──
console.log('\n[C. 독립 진입 — 진단을 거치지 않고 바로]')
await freshResponse()
ck('1) 바로 진입 가능', (await body()).includes('회신 해석'))
await ev(`(()=>{const t=document.querySelector('textarea');const s=Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype,'value').set;s.call(t,'당사는 자동화평가를 실시하였으며 내부 신용평점은 600점입니다.');t.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(300)
await click('회신 해석하기'); await sleep(1600)
const d1 = await body()
ck('2) API 없음 → 수동 모드', d1.includes('직접 분류하기'))
ck('   3유형 체크박스 제공', d1.includes('회신에 담겨 있던 내용'))
ck('   기초정보 직접 입력표', d1.includes('회신에 적힌 기초정보 항목'))
ck('   기능이 죽지 않음', d1.includes('무엇을 받았나요'))

console.log('\n════════════════════════')
const f=out.filter(([,p])=>!p)
console.log(`${out.length-f.length}/${out.length} 통과`)
if(f.length){console.log('실패:');f.forEach(([n,,d])=>console.log('  ✘',n,d))}
ws.close(); process.exit(f.length?1:0)
