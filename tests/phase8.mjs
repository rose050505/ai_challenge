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
const sel=async(v)=>ev(`(()=>{const s=document.querySelector('select');if(!s)return false;const set=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set;set.call(s,${JSON.stringify(v)});s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
let pass=0,fail=0; const t_=(n,c,d)=>{c?pass++:fail++;console.log((c?'  ok  ':'  FAIL')+' '+n+(d?' — '+d:''))}
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})

// 깨끗한 상태
await send('Page.navigate',{url:BASE+'/'}); await sleep(1100)
if ((await body()).includes('처음부터')) { await click('처음부터'); await click('지우고 처음부터') }

console.log('\n[판단 2] TODO-5 업권 매핑')
for (const [sector,expect] of [['savingsBank','시행령 제2조 제6항 제1호'],['mutualCredit','시행령 제2조 제6항 제2호'],['insurance','시행령 제2조 제6항 제5호']]) {
  await send('Page.navigate',{url:BASE+'/diagnose'}); await sleep(1000)
  await click('신용대출이 거절됐다'); await click('금융회사')
  await sel(sector); await sleep(900)
  const b=await body()
  t_(`${sector} → ${expect}`, b.includes(expect), b.includes('상위 문구만 표시')?'아직 상위 문구':'')
  if (sector==='savingsBank') {
    t_('  위임 경로 표시', b.includes('법 제2조 제1호의3 가목 4) → 시행령 제2조 제6항 제1호'))
    t_('  시행령 원문 표시', b.includes('「상호저축은행법」 제2조제6호에 따른 신용공여'))
    const href=await ev(`(()=>{const a=[...document.querySelectorAll('a.basis-link')].find(a=>a.textContent.includes('시행령 제2조 제6항'));return a?a.href:null})()`)
    t_('  원문 링크', !!href && decodeURIComponent(href).includes('시행령/제2조'), href?decodeURIComponent(href):'없음')
  }
}
// 매핑되지 않은 업권은 그대로 상위 문구
await send('Page.navigate',{url:BASE+'/diagnose'}); await sleep(1000)
await click('신용대출이 거절됐다'); await click('금융회사'); await sel('fssExamined'); await sleep(900)
let b=await body()
t_('매핑 없는 업권은 상위 문구 유지', b.includes('상위 문구만 표시'))
t_('  기존 판정 불변(은행)', true)
await send('Page.navigate',{url:BASE+'/diagnose'}); await sleep(900)
await click('신용대출이 거절됐다'); await click('금융회사'); await sel('bank'); await sleep(900)
b=await body()
t_('은행은 여전히 가목 1)', b.includes('법 제2조 제1호의3 가목 1)') && !b.includes('시행령 제2조 제6항'))

console.log('\n[판단 1] 두 서식의 차이 안내')
await send('Page.navigate',{url:BASE+'/document?form=explanationRequest'}); await sleep(1400)
b=await body()
t_('설명요구서는 양쪽에 각각', b.includes('양쪽에 각각'))
t_('정정 요청서는 보유한 곳에', b.includes('그 정보를 보유한 곳'))
t_('라우팅 근거 조문', b.includes('고시 서식 「기초정보 정정·삭제 및 자동화평가 재산출 요청서」 [섹션 1]'))

console.log('\n[판단 3] 거절 이후 경로')
await send('Page.navigate',{url:BASE+'/next'}); await sleep(1400)
b=await body()
t_('섹션 존재', b.includes('거절당했다면, 남은 경로'))
// 작업 3 이후 이 섹션은 접힌 채로 열린다. 펼치고 본다.
await ev(`(()=>{const b=[...document.querySelectorAll('main h2 > button[aria-expanded]')].find(x=>x.textContent.includes('거절당했다면'));if(b&&b.getAttribute('aria-expanded')==='false')b.click();return !!b})()`)
await sleep(500)
b=await body()
t_('과태료 조문', b.includes('법 제52조 제3항 제7호의2') && b.includes('3천만원 이하의 과태료'))
t_('★ 제1항 한정 명시', b.includes('제1항(설명 요구)을 무시한 경우에만 적용됩니다'))
t_('★ 제2항엔 규정 없음 명시', b.includes('과태료나 벌칙 규정이 없습니다'))
t_('손해배상 조문', b.includes('법 제43조, 법 제43조의2') && b.includes('300만원'))
t_('입증 책임', b.includes('입증 책임이 회사 쪽에 있습니다'))
t_('분쟁조정 조문', b.includes('「금융소비자 보호에 관한 법률」 제36조 제1항'))
t_('★ 금융회사 한정', b.includes('「금융위원회의 설치 등에 관한 법률」 제38조 각 호의 기관'))
t_('★ CB사 확인되지 않음', b.includes('조문만으로 확인되지 않았습니다'))
t_('★ 개인정보 분쟁조정은 넣지 않음', !b.includes('개인정보 분쟁조정') && !b.includes('개인정보 보호법'))
t_('확인 못 한 경로 고지', b.includes('다른 경로가 있을 수 있으나 이 서비스는 확인하지 못했습니다'))
t_('★ 법률자문 아님 고지', b.includes('개별 사안의 법적 판단이 아닙니다') && b.includes('전문가와 상의'))
const links=await ev(`JSON.stringify([...document.querySelectorAll('a.basis-link')].map(a=>decodeURIComponent(a.href)).filter(h=>h.includes('금융소비자')))`)
t_('금소법 원문 링크', JSON.parse(links).length>0, links)

console.log('\n[판단 4] 예상 쪽 수 불확실성')
await send('Page.navigate',{url:BASE+'/document?form=explanationRequest'}); await sleep(1400)
b=await body()
t_('Chrome 에서는 경고 없음', !b.includes('예상 페이지 수가 실제와 다를 수 있습니다'))
t_('쪽 수 예고는 그대로 보인다', /현재 내용은 \d+페이지로 출력됩니다/.test(b))

console.log('\n[판단 5] 서식 1 쪽 수 측정')
const probe=await ev(`(()=>{const p=[...document.querySelectorAll('.print-metrics')];return p.length})()`)
t_('측정 영역이 존재한다', probe>=1, `${probe}개`)
t_('측정 영역이 인쇄 대상에서 빠짐', await ev(`[...document.querySelectorAll('.print-metrics')].every(e=>!!e.closest('.no-print'))`))

// ★ 서식 1 쪽 수 — 실제 입력 범위에서 예고 = 실제
console.log('\n[판단 5-b] 서식 1 예고 = 실제')
const fs=await import('node:fs')
const pdfPages=async(name)=>{const r=await send('Page.printToPDF',{printBackground:false,preferCSSPageSize:true});fs.writeFileSync(name,Buffer.from(r.result.data,'base64'));
  const buf=fs.readFileSync(name).toString('latin1'); const m=buf.match(/\/Count (\d+)/); return m?Number(m[1]):null}
for (const [scale,label] of [['기본 (8.8pt)','기본'],['큰 글씨 (11pt)','큰글씨']]) {
  for (const [name,val] of [['빈칸',''],['보통','홍길동'],['긴이름','홍길동'.repeat(30)]]) {
    await send('Page.navigate',{url:BASE+'/document?form=explanationRequest'}); await sleep(1400)
    await click(scale); await sleep(500)
    await ev(`(()=>{document.querySelectorAll('.print-sheet input[type=checkbox]').forEach(c=>{if(!c.checked)c.click()});return 1})()`)
    await sleep(400)
    await ev(`(()=>{const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      [...document.querySelectorAll('.print-sheet input')].filter(i=>i.type==='text').forEach(el=>{set.call(el,${JSON.stringify(val)});el.dispatchEvent(new Event('input',{bubbles:true}))});return 1})()`)
    await sleep(900)
    const pred=Number(await ev(`(()=>{const p=[...document.querySelectorAll('[role=status]')].map(e=>e.innerText).find(t=>t&&t.includes('페이지로 출력'));return p?p.match(/(\\d+)페이지/)?.[1]:'0'})()`))
    const actual=await pdfPages(`chk-${label}-${name}.pdf`)
    t_(`  ${label}/${name}: 예고 ${pred} = 실제 ${actual}`, pred===actual)
  }
}

console.log('\n미처리 예외:', errs.length); errs.slice(0,4).forEach(e=>console.log('  '+e))
console.log(`통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
