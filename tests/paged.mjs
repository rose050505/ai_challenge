// 산출물(인쇄 PDF)은 tests/out/ 에 떨어진다. .gitignore 에 걸려 있다.
const OUT = new URL('./out/', import.meta.url).pathname
await (await import('node:fs/promises')).mkdir(OUT, { recursive: true })
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const fs=await import('node:fs')
const click=async txt=>{const ok=await ev(`(()=>{const e=[...document.querySelectorAll('button,a')].reverse().find(e=>e.textContent.trim().includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`);await sleep(800);return ok}
const pdf=async(name)=>{const r=await send('Page.printToPDF',{printBackground:false,preferCSSPageSize:true});fs.writeFileSync(OUT+name,Buffer.from(r.result.data,'base64'))}

const CASE=process.argv[2]||'worst'
const SCALE=process.argv[3]||'base'
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})
// 인쇄 글자 크기는 앱이 첫 렌더에서 localStorage 로 읽는다. 이동 전에 심어 둔다.
// ★ 앞 시험이 남긴 기록을 먼저 지운다. 남아 있으면 /strategy 가 이미 'done' 이라
//   [후보 만들기]가 없고, 행 수가 달라져 케이스별 쪽 수가 재현되지 않는다.
//   투어도 '봤음'으로 심는다. 첫 방문이면 오버레이가 클릭을 가로챈다.
const {identifier:seed} = (await send('Page.addScriptToEvaluateOnNewDocument',{source:
  `try{localStorage.clear();localStorage.setItem('wy-tour-v1','done');localStorage.setItem('wy-print-scale',${JSON.stringify(SCALE)})}catch(e){}`})).result
await send('Page.navigate',{url:BASE+'/'}); await sleep(900)
await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:seed})

await send('Page.navigate',{url:BASE+'/strategy'}); await sleep(1200)
await click('제출할 정보 후보 만들기'); await sleep(1600)
await click('서식에 넣기'); await sleep(1000)
await click('회신 해석'); await sleep(900)
await click('3유형 전부 설명받은 회신')
await click('회신 해석하기'); await sleep(1500)
await ev(`(()=>{document.querySelectorAll('li input[type=checkbox]').forEach(c=>{if(!c.checked)c.click()});return true})()`)
await sleep(400)
await click('서식 2 만들기'); await sleep(1400)

const FILL={
  base:null,
  worst:'2024년 12월 기준 실제 값으로 정정 요구 — 증빙 첨부 예정입니다',
  split:'2021년 3월 등록된 연체 이력은 통신요금 자동이체 계좌 변경 과정에서 발생한 것으로 실제 채무 불이행이 아니며, 통신사 확인서와 완납 증명서를 첨부합니다. 해당 기록의 삭제와 자동화평가 결과의 재산출을 함께 요구합니다. 또한 같은 기간의 국민연금 납부내역과 건강보험 납부실적을 유리한 정보로 함께 제출하오니 재산출 시 반영하여 주시기 바랍니다. 관련 증빙은 모두 원본 대조필로 첨부하였습니다.',
  mega:'2021년 3월 등록된 연체 이력은 통신요금 자동이체 계좌 변경 과정에서 발생한 것으로 실제 채무 불이행이 아니며, 통신사 확인서와 완납 증명서를 첨부합니다. 해당 기록의 삭제와 자동화평가 결과의 재산출을 함께 요구합니다. 또한 같은 기간의 국민연금 납부내역과 건강보험 납부실적을 유리한 정보로 함께 제출하오니 재산출 시 반영하여 주시기 바랍니다. 관련 증빙은 모두 원본 대조필로 첨부하였습니다. 아울러 해당 기간 중 소득이 지속적으로 발생하였음을 국세청 소득금액증명으로 확인할 수 있으며, 재직 사실은 재직증명서로 확인할 수 있습니다. 위 사실관계에 비추어 현행 기초정보는 정확하지 아니하거나 최신의 정보가 아니라고 판단됩니다.',
  huge:'2021년 3월 등록된 연체 이력은 통신요금 자동이체 계좌 변경 과정에서 발생한 것으로 실제 채무 불이행이 아니며, 통신사 확인서와 완납 증명서를 첨부합니다. 해당 기록의 삭제와 자동화평가 결과의 재산출을 함께 요구합니다.',
}
if(FILL[CASE]){
  const count=await ev(`document.querySelectorAll('.print-sheet input:not([type=checkbox]), .print-sheet textarea').length`)
  // 한 칸씩 채운다. 한 번에 몰아 넣으면 React 재렌더 사이에 일부가 유실된다.
  for(let i=0;i<count;i++){
    // 2026-08-31: 표의 값 칸이 textarea 로 바뀌었다. 둘 다 채운다.
    await ev(`(()=>{const el=document.querySelectorAll('.print-sheet input:not([type=checkbox]), .print-sheet textarea')[${i}];if(!el)return false;const proto=el.tagName==='TEXTAREA'?window.HTMLTextAreaElement:window.HTMLInputElement;const set=Object.getOwnPropertyDescriptor(proto.prototype,'value').set;set.call(el,${JSON.stringify(FILL[CASE])});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
    await sleep(120)
  }
  await sleep(900)
  console.log('채운 칸 수:', await ev(`[...document.querySelectorAll('.print-sheet input:not([type=checkbox])')].filter(e=>e.value).length`))
}
// 신청인 성명 — 반복 머리에 들어간다
await ev(`(()=>{const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;return true})()`)
const name=await ev(`(()=>{const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;const el=[...document.querySelectorAll('#email-body')];return true})()`)
await sleep(500)
console.log('화면 예고:', await ev(`(()=>{const p=[...document.querySelectorAll('[role=status]')].map(e=>e.innerText).find(t=>t.includes('페이지로 출력'));return p?p.replace(/\\s+/g,' '):'없음'})()`))
console.log('화면 페이지 상자 수:', await ev(`document.querySelectorAll('.paged-page').length`))
console.log('쪽 번호:', await ev(`JSON.stringify([...document.querySelectorAll('.paged-foot')].map(e=>e.innerText.trim()))`))
console.log('반복 머리:', await ev(`JSON.stringify([...document.querySelectorAll('.paged-runhead')].map(e=>e.innerText.replace(/\\s+/g,' ').trim()))`))
console.log('섹션1 등장 횟수:', await ev(`(()=>{let n=0;document.querySelectorAll('.paged-page').forEach(p=>{if(p.innerText.includes('1. 기초정보 정정')||p.innerText.includes('대응권'))n++});return n})()`))
console.log('마지막 페이지에 서명란:', await ev(`(()=>{const ps=[...document.querySelectorAll('.paged-page')];return ps.length? ps[ps.length-1].innerText.includes('(서명 / 인)'):null})()`))
console.log('측정영역이 인쇄 대상에서 빠짐:', await ev(`!!document.querySelector('.print-metrics')?.closest('.no-print')`))
console.log('예측 분할:', await ev(`JSON.stringify([...document.querySelectorAll('.paged-page')].map(p=>[...p.querySelectorAll('.paged-block')].length))`))
console.log('페이지 상자 실제 높이(mm):', await ev(`JSON.stringify([...document.querySelectorAll('.paged-page')].map(p=>Math.round(p.getBoundingClientRect().height/96*25.4)))`))
console.log('측정값:', await ev(`(()=>{
  const root=document.querySelector('.print-metrics');
  if(!root) return 'measure root 없음';
  const o={w:Math.round(root.getBoundingClientRect().width), mids:{}, gheads:{}};
  root.querySelectorAll('[data-mid]').forEach(e=>o.mids[e.getAttribute('data-mid')]=Math.round(e.getBoundingClientRect().height));
  root.querySelectorAll('[data-mghead]').forEach(e=>o.gheads[e.getAttribute('data-mghead')]=Math.round(e.getBoundingClientRect().height));
  o.first=Math.round(root.querySelector('[data-mhead=\\'first\\']').getBoundingClientRect().height);
  o.run=Math.round(root.querySelector('[data-mhead=\\'run\\']').getBoundingClientRect().height);
  o.foot=Math.round(root.querySelector('[data-mfoot]').getBoundingClientRect().height);
  o.sum=Object.values(o.mids).reduce((a,b)=>a+b,0)+Object.values(o.gheads).reduce((a,b)=>a+b,0);
  o.capacity=Math.round((273-8)*96/25.4);
  o.font=getComputedStyle(root).fontSize;
  return JSON.stringify(o);
})()`))
// ── 인쇄 미디어를 강제해 실제 인쇄 조판의 높이를 잰다 (진단용) ──
await send('Emulation.setEmulatedMedia',{media:'print'})
await sleep(600)
console.log('인쇄 조판 실측:', await ev(`(()=>{
  const art=document.querySelector('.print-sheet.print-paged');
  const page=art.querySelector('.paged-page');
  const body=page.querySelector('.paged-body');
  const o={pageH:Math.round(page.getBoundingClientRect().height), bodyScroll:Math.round(body.scrollHeight), bodyH:Math.round(body.getBoundingClientRect().height), blocks:{}};
  body.querySelectorAll(':scope > .paged-block').forEach((e,i)=>{o.blocks[i+'|'+e.innerText.replace(/\\s+/g,' ').slice(0,12)]=Math.round(e.getBoundingClientRect().height)});
  const tb=body.querySelector('table tbody');
  o.rows=tb?[...tb.rows].map(r=>Math.round(r.getBoundingClientRect().height)):null;
  o.thead=body.querySelector('table thead')?Math.round(body.querySelector('table thead').getBoundingClientRect().height):null;
  o.font=getComputedStyle(art).fontSize;
  o.wordBreak=getComputedStyle(document.body).wordBreak;
  return JSON.stringify(o);
})()`))
await send('Emulation.setEmulatedMedia',{media:''})
await sleep(400)
await pdf(`paged-${CASE}-${SCALE}-main.pdf`)
// 브라우저 머리글·바닥글을 켠 상태 — 사용자가 끄지 않았을 때 본문과 겹치는지 본다
{
  const r=await send('Page.printToPDF',{printBackground:false,preferCSSPageSize:true,displayHeaderFooter:true,
    headerTemplate:'<div style="font-size:9px;width:100%;padding:0 10mm;display:flex;justify-content:space-between"><span>삼육이 — 자동화평가 설명·이의제기 지원 서비스</span><span>https://autoevalrights.vercel.app/document</span></div>',
    footerTemplate:'<div style="font-size:9px;width:100%;padding:0 10mm;display:flex;justify-content:space-between"><span class="pageNumber"></span><span>26. 8. 26. 22:14</span></div>'})
  fs.writeFileSync(`${OUT}paged-${CASE}-browserhf.pdf`,Buffer.from(r.result.data,'base64'))
}
// 인쇄 조판 그대로(폭 182mm + print 미디어) 페이지 상자 높이를 잰다
await send('Emulation.setDeviceMetricsOverride',{width:688,height:971,deviceScaleFactor:1,mobile:false})
await send('Emulation.setEmulatedMedia',{media:'print'})
await sleep(800)
console.log('인쇄폭 페이지 상자(px, 한계 971):', await ev(`JSON.stringify([...document.querySelectorAll('.paged-page')].map(p=>Math.round(p.getBoundingClientRect().height)))`))
console.log('인쇄폭 블록 높이:', await ev(`JSON.stringify([...document.querySelectorAll('.paged-page')].map(p=>[...p.querySelectorAll(':scope > .paged-body > .paged-block')].map(e=>Math.round(e.getBoundingClientRect().height))))`))
console.log('인쇄폭 행 높이:', await ev(`JSON.stringify([...document.querySelectorAll('.paged-page table tbody')].map(tb=>[...tb.rows].map(r=>Math.round(r.getBoundingClientRect().height))))`))
await send('Emulation.setEmulatedMedia',{media:''})
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})
await sleep(600)
// 글자 크기 3단계에서 인쇄 결과가 같은지 (접근성 설정이 인쇄에 새지 않아야 한다)
for (const sc of ['base','lg','xl']) {
  await ev(`document.documentElement.dataset.fontScale=${JSON.stringify(sc)}`)
  await sleep(500)
  await pdf(`paged-${CASE}-${sc}.pdf`)
}
await ev(`document.documentElement.dataset.fontScale='base'`); await sleep(300)
// 서식 1 회귀
await click('서식 1 ·'); await sleep(700)
await ev(`(()=>{document.querySelectorAll('.print-sheet input[type=checkbox]').forEach(c=>{if(!c.checked)c.click()});return true})()`)
await sleep(400)
await pdf(`paged-${CASE}-${SCALE}-form1.pdf`)
ws.close(); process.exit(0)
