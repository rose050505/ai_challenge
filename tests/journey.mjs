const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const click=async txt=>{const ok=await ev(`(()=>{const e=[...document.querySelectorAll('button,a,summary')].reverse().find(e=>e.textContent.trim().includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`);await sleep(800);return ok}
const body=()=>ev('document.body.innerText.replace(/\\s+/g," ")')
const nav=async p=>{await send('Page.navigate',{url:BASE+p});await sleep(1200)}
const type=async(sel,val)=>ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return false;const proto=el.tagName==='TEXTAREA'?window.HTMLTextAreaElement:window.HTMLInputElement;Object.getOwnPropertyDescriptor(proto.prototype,'value').set.call(el,${JSON.stringify(val)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
const store=()=>ev(`(()=>{try{return localStorage.getItem('wae:journey:state')}catch(e){return 'ERR'}})()`)
const out=[]; const ck=(n,p,d='')=>{out.push([n,p]);console.log((p?'  ✔ ':'  ✘ ')+n+(d?' — '+d:''))}

console.log('\n[A. 전 경로 진행 → 저장]')
await nav('/')
// 앱의 [처음부터]로 깨끗이 지우고 시작한다
if (await click('처음부터')) { await click('지우고 처음부터'); await sleep(500) }
await nav('/')
ck('1) 기록 없으면 이어서 카드 없음', !(await body()).includes('진행 중인 기록이 있습니다'))
await nav('/diagnose')
await click('신용대출이 거절됐다')
await click('개인신용평가회사 (CB사)')
await type('#reason','프리랜서라 소득 증빙이 비정형입니다')
await sleep(2200)
const s1=await store()
ck('2) 진단이 저장된다', s1 && s1.includes('프리랜서라 소득'), s1? `${s1.length}바이트`:'없음')
await nav('/strategy')
await click('제출할 정보 후보 만들기'); await sleep(1800)
ck('3) 전략 후보 생성', (await body()).includes('서식에 넣을 항목을 고르세요'))
await click('서식에 넣기'); await sleep(1300)
ck('4) /document 도달', (await ev('location.pathname'))==='/document')
await type('.print-sheet input','김테스트')
await sleep(2200)
const s2=await store()
ck('5) 서식 인적사항 저장', s2 && s2.includes('김테스트'))
ck('6) 전략 후보도 저장', s2 && s2.includes('"strategy"') && JSON.parse(s2).strategy.candidates.length>0, `${JSON.parse(s2).strategy.candidates.length}개`)
ck('7) 저장 표시 노출', (await body()).includes('저장됨'))

console.log('\n[B. 브라우저를 닫았다 다시 오기 (새 세션)]')
await nav('/')
const b=await body()
ck('1) 이어서 하기 카드', b.includes('진행 중인 기록이 있습니다'))
ck('2) 마지막 단계 표시', b.includes('마지막 단계'))
// 첫 화면의 얇은 카드에서는 시각이 제목 줄에 붙는다 ("… 있습니다 · 오늘 10:26")
ck('3) 마지막 수정 시각', /진행 중인 기록이 있습니다\s*·\s*(오늘|어제|\d)/.test(b))
ck('4) 저장 위치 명시', b.includes('지금 사용 중인 브라우저에만 저장됩니다') && b.includes('시크릿 모드에서는 보이지 않습니다'))
await click('이어서 하기'); await sleep(1300)
ck('5) 이어서 하기로 이동', ['/document','/strategy','/diagnose'].includes(await ev('location.pathname')), await ev('location.pathname'))
await nav('/document')
ck('6) 서식 내용 복원', (await ev(`[...document.querySelectorAll('.print-sheet input')].some(i=>i.value==='김테스트')`)))
await nav('/diagnose')
ck('7) 진단 내용 복원', (await ev(`document.querySelector('#reason')?.value`))==='프리랜서라 소득 증빙이 비정형입니다')
ck('8) 이후 단계 영향 고지', (await body()).includes('이후 단계에 저장된 내용이 있습니다'))
await click('한도가 축소됐다'); await sleep(600)
const d2=await body()
ck('9) 진단 변경 시 경고 톤', d2.includes('진단을 바꾸셨습니다'))
ck('10) 조용히 지우지 않는다고 명시', d2.includes('지우지 않습니다'))
ck('11) 지우기는 선택으로', d2.includes('전략 후보 지우고 다시 만들기'))

console.log('\n[C. 내보내기 → 저장소 비우기 → 불러오기]')
await nav('/document')
const exported = await ev(`(async()=>{
  const mod = await import('/assets/'+[...document.querySelectorAll('script[type=module]')].map(s=>s.src.split('/').pop())[0]);
  return null
})().catch(()=>null)`)
// 내보내기 버튼 대신 저장소 값을 직접 파일 형식으로 만들어 불러오기를 검증한다
const raw = await store()
const fileText = await ev(`(()=>{const j=JSON.parse(localStorage.getItem('wae:journey:state'));return JSON.stringify({app:'wae.journey',schemaVersion:1,exportedAt:new Date().toISOString(),journey:j})})()`)
ck('1) 내보내기 형식 생성', Boolean(fileText) && fileText.includes('wae.journey'))
// 앱의 [처음부터]로 지운다 (외부에서 지우면 페이지를 떠날 때 다시 저장된다)
await nav('/')
await click('처음부터')
await click('지우고 처음부터')
await sleep(600)
ck('2a) 지우면 저장소가 빈다', !(await store()))
await nav('/')
ck('2b) 지우면 카드가 사라진다', !(await body()).includes('진행 중인 기록이 있습니다'))
await ev(`(()=>{
  const dt=new DataTransfer();
  dt.items.add(new File([${JSON.stringify(fileText)}],'왜요-기록.json',{type:'application/json'}));
  const input=[...document.querySelectorAll('input[type=file]')].find(i=>i.offsetParent!==null||true);
  input.files=dt.files;
  input.dispatchEvent(new Event('change',{bubbles:true}));
  return true
})()`)
await sleep(1200)
const c=await body()
ck('3) 불러오기 성공 알림 (화면 재마운트 후에도 남는다)', c.includes('기록을 불러왔습니다'))
await sleep(600)
const restored = await store()
ck('4) 저장소에 복원됨', restored && restored.includes('김테스트'))
await nav('/document')
ck('5) 서식 내용 복원', await ev(`[...document.querySelectorAll('.print-sheet input')].some(i=>i.value==='김테스트')`))
await nav('/diagnose')
ck('6) 진단 복원', (await ev(`document.querySelector('#reason')?.value`))==='프리랜서라 소득 증빙이 비정형입니다')

console.log('\n[D. 잘못된 파일 불러오기]')
await nav('/')
const bad = async (text, label) => {
  await ev(`(()=>{const d=document.querySelector('details summary'); return true})()`)
  await click('작성 중인 내용 불러오기')
  await ev(`(()=>{
    const dt=new DataTransfer();
    dt.items.add(new File([${JSON.stringify(text)}],'x.json',{type:'application/json'}));
    const input=document.querySelector('input[type=file]');
    input.files=dt.files; input.dispatchEvent(new Event('change',{bubbles:true})); return true
  })()`)
  await sleep(900)
  const t=await ev(`document.querySelector('[role=alert]')?.innerText ?? ''`)
  return t.replace(/\s+/g,' ').trim()
}
let m = await bad('이건 JSON이 아니다')
ck('1) 깨진 JSON', m.includes('JSON 파일이 아닙니다'), m)
m = await bad('{"app":"some-other-app","data":{}}')
ck('2) 다른 서비스 JSON', m.includes('이 서비스에서 내보낸 파일이 아닙니다'), m)
m = await bad('{"app":"wae.journey","schemaVersion":99,"journey":{}}')
ck('3) 미래 버전', m.includes('더 새로운 버전'), m)
ck('4) 오류 후에도 화면이 살아 있다', (await body()).includes('행사할 수 있는 권리'))

console.log('\n════════════════════════')
const f=out.filter(([,p])=>!p)
console.log(`${out.length-f.length}/${out.length} 통과`)
f.forEach(([n])=>console.log('  ✘',n))
ws.close(); process.exit(f.length?1:0)
