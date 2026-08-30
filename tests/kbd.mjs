const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
// 저장된 여정을 비우고 시작한다 (이 테스트들은 첫 방문을 전제로 한다)
await send('Page.navigate',{url:BASE+'/'}); await sleep(1200)
await ev(`try{localStorage.removeItem('wy-font-scale')}catch(e){}`)
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='처음부터');if(b)b.click();return !!b})()`)
await sleep(300)
await ev(`(()=>{const b=[...document.querySelectorAll('button')].find(e=>e.textContent.trim()==='지우고 처음부터');if(b)b.click();return !!b})()`)
await sleep(500)
await send('Page.navigate',{url:BASE+'/'}); await sleep(900)
const out=[]; const ck=(n,p,d='')=>{out.push([n,p]);console.log((p?'  ✔ ':'  ✘ ')+n+(d?' — '+d:''))}

// 실제 키 이벤트로만 조작한다. 마우스 클릭을 쓰지 않는다.
const key=async(k,code,vk)=>{
  for(const type of ['rawKeyDown','char','keyUp']){
    if(type==='char'&&k!=='Enter'&&k!==' ') continue
    await send('Input.dispatchKeyEvent',{type:type==='char'?'char':type,key:k,code,windowsVirtualKeyCode:vk,nativeVirtualKeyCode:vk,text:k===' '?' ':(k==='Enter'?'\r':undefined)})
  }
  await sleep(90)
}
const tab=(n=1)=>(async()=>{for(let i=0;i<n;i++)await key('Tab','Tab',9)})()
const shiftTab=async()=>{for(const type of ['rawKeyDown','keyUp'])await send('Input.dispatchKeyEvent',{type,key:'Tab',code:'Tab',windowsVirtualKeyCode:9,modifiers:8});await sleep(90)}
const enter=()=>key('Enter','Enter',13)
const space=()=>key(' ','Space',32)
const esc=()=>key('Escape','Escape',27)
const focused=()=>ev(`(()=>{const a=document.activeElement;if(!a)return'none';return a.tagName+'|'+(a.getAttribute('aria-label')||a.textContent||a.value||a.id||'').trim().slice(0,40)})()`)
const nav=async p=>{await send('Page.navigate',{url:BASE+p});await sleep(1100);await ev('document.body.focus()')}
const body=()=>ev('document.body.innerText.replace(/\\s+/g," ")')
// 포커스 가능한 요소를 앞에서부터 훑어 원하는 것을 찾아 Enter/Space 로 활성화
const tabTo=async(pred,limit=140)=>{
  for(let i=0;i<limit;i++){
    await tab()
    const f=await focused()
    if(f.includes(pred))return f
  }
  return null
}

console.log('\n[A. 포커스 가시성 / 건너뛰기 링크]')
await nav('/')
await tab()
const first=await focused()
ck('첫 Tab = 본문으로 건너뛰기', first.includes('본문으로 건너뛰기'), first)
const ring=await ev(`(()=>{const s=getComputedStyle(document.activeElement);return s.outlineStyle+' '+s.outlineWidth})()`)
ck('포커스 링이 살아 있다', ring!=='none 0px', ring)

console.log('\n[B. 용어 풀이 — 키보드만으로 열고 닫기]')
await nav('/')
let f=await tabTo('자동화평가')
ck('용어 버튼에 탭으로 도달', Boolean(f), f||'')
await enter()
const opened=await ev(`document.querySelectorAll('[role=note]').length`)
ck('Enter 로 풀이가 열린다', opened>0)
const hasBasis=await ev(`(()=>{const n=document.querySelector('[role=note]');return n?n.innerText.includes('법 제2조제14호'):false})()`)
ck('풀이에 근거 조문 표시', hasBasis)
await esc()
ck('Esc 로 닫힌다', (await ev(`document.querySelectorAll('[role=note]').length`))===0)

console.log('\n[C. 진단 — 키보드만으로 4단계 완주]')
await nav('/diagnose')
f=await tabTo('신용대출')
ck('1단계 선택지 도달', Boolean(f), f||'')
await enter(); await sleep(400)
f=await tabTo('개인신용평가회사 (CB사)')
ck('2단계 선택지 도달', Boolean(f), f||'')
await enter(); await sleep(600)
const b=await body()
ck('결과가 나타난다', b.includes('행사할 수 있는 권리'))
ck('근거 조문이 함께 표시', b.includes('법 제36조의2 제1항 제1호'))
f=await tabTo('제출할 정보 정하러 가기')
ck('전략으로 가는 링크에 탭 도달', Boolean(f), f||'')
await enter(); await sleep(1200)
ck('/strategy 도달', (await ev('location.pathname'))==='/strategy')

console.log('\n[D. 전략 — 키보드만으로 후보 생성·선택]')
f=await tabTo('제출할 정보 후보 만들기')
ck('생성 버튼 도달', Boolean(f))
await enter(); await sleep(1800)
ck('후보 목록 표시', (await body()).includes('서식에 넣을 항목을 고르세요'))
f=await tabTo('선택한')
ck('서식으로 넘기는 링크 도달', Boolean(f), f||'')
await enter(); await sleep(1300)
ck('/document 도달', (await ev('location.pathname'))==='/document')

console.log('\n[E. 서식 — 키보드만으로 항목 선택·이메일 초안]')
f=await tabTo('서식 1')
ck('서식 탭 도달', Boolean(f), f||'')
await enter(); await sleep(400)
const checkedBefore=await ev(`document.querySelectorAll('.print-sheet input[type=checkbox]:checked').length`)
f=await tabTo('')  // 다음 포커스로 이동만
for(let i=0;i<60;i++){await tab();const a=await ev(`(()=>{const e=document.activeElement;return e.type==='checkbox'&&e.closest('.print-sheet')?'cb':''})()`);if(a==='cb'){await space();break}}
const checkedAfter=await ev(`document.querySelectorAll('.print-sheet input[type=checkbox]:checked').length`)
ck('Space 로 서식 체크박스 토글', checkedAfter!==checkedBefore, `${checkedBefore} → ${checkedAfter}`)
f=await tabTo('이메일로 제출하기')
ck('이메일 초안 버튼 도달', Boolean(f), f||'')
await enter(); await sleep(500)
const e1=await body()
ck('초안이 열린다', e1.includes('받는 사람'))
ck('수신 주소를 추정하지 않는다', e1.includes('금융회사의 이메일 주소를 추정해 넣지 않습니다'))
ck('첨부·서명 안내', e1.includes('서명 또는 날인'))
const draft=await ev(`document.getElementById('email-body')?.value ?? ''`)
ck('본문에 근거 조문', draft.includes('제36조의2') && draft.includes('시행령 제31조의2 제6항'))
ck('본문에 회신 의무 조문', draft.includes('시행령 제31조의2 제7항'))
ck('제목 형식', (await ev(`document.getElementById('email-subject')?.value`))?.startsWith('[자동화평가 설명요구]'))
ck('주민등록번호 미포함', !draft.includes('주민등록번호'))

console.log('\n[F. 회신 해석 — 키보드만으로]')
await nav('/response')
f=await tabTo('3유형 전부 설명받은 회신')
ck('샘플 버튼 도달', Boolean(f))
await enter(); await sleep(400)
f=await tabTo('회신 해석하기')
ck('해석 버튼 도달', Boolean(f))
await enter(); await sleep(1500)
const r=await body()
ck('결과 표시', r.includes('무엇을 받았나요'))
ck('받음/못받음을 글자로도 표시', r.includes('받음'))
ck('제도의 한계 고지 유지', r.includes('자체적으로 가공하여 생성 또는 추론한 정보는 제외'))
ck('겹치는 분류 안내 표시', r.includes('모두 해당할 수 있습니다'))
ck('겹치는 분류의 두 근거 노출', r.includes('법 제2조 제1호의3 가목 1)') && r.includes('법 제2조 제1호의5 가목'))
ck('마크다운 별표가 남지 않음', !r.includes('**'))

console.log('\n[G. 글자 크기 조절]')
await nav('/')
const base=await ev(`getComputedStyle(document.body).fontSize`)
f=await tabTo('더 큰 글자')
ck('글자 크기 버튼 도달', Boolean(f))
await enter(); await sleep(300)
const big=await ev(`getComputedStyle(document.body).fontSize`)
ck('본문 글자가 커진다', parseFloat(big)>parseFloat(base), `${base} → ${big}`)
ck('설정이 html 에 남는다', (await ev(`document.documentElement.dataset.fontScale`))==='xl')

console.log('\n════════════════════════')
const fail=out.filter(([,p])=>!p)
console.log(`${out.length-fail.length}/${out.length} 통과`)
fail.forEach(([n])=>console.log('  ✘',n))
ws.close(); process.exit(fail.length?1:0)
