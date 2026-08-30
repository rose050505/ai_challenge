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
const click=async txt=>{const ok=await ev(`(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim().includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`);await sleep(700);return ok}
let pass=0,fail=0; const t_=(n,c,d)=>{c?pass++:fail++;console.log((c?'  ok  ':'  FAIL')+' '+n+(d?' — '+d:''))}
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})

console.log('\n[1. 큰 글씨 인쇄]')
await send('Page.navigate',{url:BASE+'/document?form=explanationRequest'}); await sleep(1500)
let b=await body()
t_('선택지 두 개', b.includes('기본 (8.8pt)') && b.includes('큰 글씨 (11pt)'))
t_('구조는 그대로임을 밝힘', b.includes('항목과 순서는 그대로이고 크기만'))
t_('화면 글자 크기와 별개임을 밝힘', b.includes('화면 글자 크기와는 별개'))
await click('큰 글씨 (11pt)'); await sleep(600)
t_('html 에 표시', (await ev(`document.documentElement.dataset.printScale`))==='lg')
const z=await ev(`getComputedStyle(document.documentElement).getPropertyValue('--sheet-zoom').trim()`)
t_('배율이 걸린다', z==='1.25', `zoom=${z}`)
// 인쇄 매체에서 실제 글자 크기 확인
await send('Emulation.setEmulatedMedia',{media:'print'}); await sleep(500)
const lgSize=await ev(`(()=>{const td=document.querySelector('.print-sheet td, .print-sheet p');return td? td.getBoundingClientRect().height:0})()`)
await ev(`delete document.documentElement.dataset.printScale`); await sleep(500)
const baseSize=await ev(`(()=>{const td=document.querySelector('.print-sheet td, .print-sheet p');return td? td.getBoundingClientRect().height:0})()`)
await send('Emulation.setEmulatedMedia',{media:''})
t_('★ 인쇄에서 실제로 커진다', lgSize > baseSize*1.15, `${baseSize.toFixed(0)}px → ${lgSize.toFixed(0)}px`)
// 화면 글자 크기(접근성)와 독립인지 — 인쇄 배율을 바꿔도 화면 크기는 그대로여야 한다
await ev(`delete document.documentElement.dataset.printScale`); await sleep(300)
const before=await ev(`getComputedStyle(document.body).fontSize`)
await click('큰 글씨 (11pt)'); await sleep(500)
const after=await ev(`getComputedStyle(document.body).fontSize`)
t_('화면 글자 크기는 그대로', before===after, `${before} → ${after}`)

console.log('\n[2. 쉬운 말 보기]')
await send('Page.navigate',{url:BASE+'/'}); await sleep(1300)
b=await body()
const hard = b.includes('컴퓨터가 자동으로 심사했다면 그 결과와 기준을 설명하라고')
t_('기본은 원문', hard)
t_('토글 존재', b.includes('쉬운 말'))
await click('쉬운 말'); await sleep(700)
b=await body()
t_('★ 경계를 밝힌다', b.includes('쉬운 말 보기가 켜져 있습니다') && b.includes('법 조문을 그대로 옮긴 부분과 서식의 원문은 바뀌지 않습니다'))
t_('설명문이 바뀐다', b.includes('사람이 아니라 컴퓨터가 알아서 심사했다면') && !hard0(b))
function hard0(x){return x.includes('컴퓨터가 자동으로 심사했다면 그 결과와 기준을 설명하라고')}
t_('★ 조문 정의는 그대로', b.includes('종사자가 평가 업무에 관여하지 아니하고'))
t_('★ 근거 배지는 그대로', b.includes('법 제36조의2 제1항 제1호'))
t_('권리 요약도 쉬운 말로', b.includes('컴퓨터가 알아서 심사했는지 아닌지를 알려 달라고'))
// 서식 원문이 안 바뀌는지
await send('Page.navigate',{url:BASE+'/document?form=explanationRequest'}); await sleep(1400)
b=await body()
t_('★ 서식 원문 유지', b.includes('자동화평가 결과에 대한 설명요구서'))
// 설명문은 저장 가능 여부에 따라 두 갈래다(document.intro / document.introBlocked).
// 저장이 되는 보통의 환경이므로 앞쪽 문구가 나와야 한다.
t_('서식 화면 설명문은 바뀜', b.includes('서식 내용은 인터넷 너머로 보내지 않습니다') && b.includes('이 브라우저 안에 남아'))
t_('★ 사라진다는 옛 문구 없음', !b.includes('새로고침하면 사라집니다'))
// 새로고침해도 유지
await send('Page.reload'); await sleep(1300)
t_('설정이 유지된다', (await body()).includes('쉬운 말 보기가 켜져 있습니다'))
await click('쉬운 말'); await sleep(500)
t_('끄면 원래대로', !(await body()).includes('쉬운 말 보기가 켜져 있습니다'))

console.log('\n[3. 스크린리더 구조]')
for (const path of ['/','/diagnose','/document','/document?form=correctionRequest','/next','/response','/strategy']) {
  await send('Page.navigate',{url:BASE+path}); await sleep(1100)
  const r=JSON.parse(await ev(`JSON.stringify((()=>{
    const hs=[...document.querySelectorAll('h1,h2,h3,h4')].filter(h=>h.offsetParent!==null).map(h=>+h.tagName[1]);
    let jump=null; for(let i=1;i<hs.length;i++) if(hs[i]-hs[i-1]>1) jump=[hs[i-1],hs[i]];
    const inputs=[...document.querySelectorAll('input,select,textarea')].filter(e=>e.offsetParent!==null&&e.type!=='hidden');
    const unlabeled=inputs.filter(e=>{
      if(e.getAttribute('aria-label')||e.getAttribute('aria-labelledby'))return false;
      if(e.id&&document.querySelector('label[for="'+CSS.escape(e.id)+'"]'))return false;
      if(e.closest('label'))return false; return true}).map(e=>e.tagName+':'+(e.type||'')+':'+(e.className||'').slice(0,30));
    const tables=[...document.querySelectorAll('table')].filter(t=>t.offsetParent!==null);
    const badTables=tables.filter(t=>!t.querySelector('th')).length;
    return {main:!!document.querySelector('main'), nav:!!document.querySelector('nav[aria-label]'),
      h1:document.querySelectorAll('h1').length, jump, unlabeled, live:document.querySelectorAll('[aria-live]').length,
      tables:tables.length, badTables}
  })())`))
  t_(`${path} 랜드마크(main/nav)`, r.main && r.nav)
  t_(`${path} h1 정확히 하나`, r.h1===1, `h1=${r.h1}`)
  t_(`${path} 제목 단계 건너뜀 없음`, r.jump===null, r.jump?`h${r.jump[0]}→h${r.jump[1]}`:'')
  t_(`${path} 라벨 없는 입력 없음`, r.unlabeled.length===0, r.unlabeled.join(' / '))
  if (r.tables) t_(`${path} 표에 th 있음`, r.badTables===0, `th 없는 표 ${r.badTables}개`)
}
console.log('\n미처리 예외:', errs.length)
console.log(`통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
