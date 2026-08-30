const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map(); const errs=[]
ws.onmessage=e=>{const m=JSON.parse(e.data)
 if(m.method==='Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text+' '+(m.params.exceptionDetails.exception?.description||'').slice(0,90))
 if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const click=async txt=>{const ok=await ev(`(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim().includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`);await sleep(700);return ok}
let pass=0,fail=0
const t_=(name,cond)=>{cond?pass++:fail++;console.log((cond?'  ok  ':'  FAIL')+' '+name)}
const body=()=>ev('document.body.innerText')

await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})

// ── 1. 새로고침 내성 ──────────────────────────────────
console.log('== 새로고침 내성 ==')
for (const path of ['/','/diagnose','/document','/strategy','/next','/response','/없는화면']) {
  await send('Page.navigate',{url:BASE+path}); await sleep(1000)
  const b=await body()
  // 머리말 로고가 살아 있으면 화면이 뜬 것이다 (서비스명 변경: 왜요 → 삼육이)
  const alive = b && b.length>200 && b.includes('삼육이')
  t_(`${path} 직접 진입`, alive)
  await send('Page.reload'); await sleep(1000)
  const b2=await body()
  t_(`${path} 새로고침`, b2 && b2.length>200 && b2.includes('삼육이'))
}

// ── 2. 오류 경계 ─────────────────────────────────────
console.log('== 오류 경계 ==')
const inj = await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  (()=>{ const p = Element.prototype;
    Object.defineProperty(p,'getBoundingClientRect',{configurable:true,value:function(){
      if (location.pathname === '/document') throw new Error('의도적 실패 — 사용자가 입력한 이름 홍길동');
      return {x:0,y:0,width:0,height:0,top:0,left:0,right:0,bottom:0,toJSON(){return{}}}
    }})
  })()`})
await send('Page.navigate',{url:BASE+'/document?form=correctionRequest'}); await sleep(1600)
const b=await body()
t_('폴백 제목', b.includes('이 화면에서 문제가 생겼습니다'))
t_('기록 보존 문구', b.includes('진행 기록은 보존되어 있습니다'))
t_('오류 원문 비노출', !b.includes('홍길동') && !b.includes('의도적 실패') && !b.includes('Error'))
t_('네비게이션 생존', b.includes('진단') && b.includes('회신 해석'))
t_('복구 경로 3개', b.includes('이 화면 다시 시도') && b.includes('처음 화면으로') && b.includes('파일로 내려받기'))
console.log('  → 다른 화면 이동:', await click('진단'))
await sleep(900)
const b2=await body()
t_('다른 화면은 정상', !b2.includes('이 화면에서 문제가 생겼습니다') && b2.includes('무슨 일이'))

// ── 3. 인쇄 확인 단계 ────────────────────────────────
console.log('== 인쇄 확인 단계 ==')
await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:inj.result.identifier})
await send('Page.navigate',{url:BASE+'/document'}); await sleep(1400)
const b3=await body()
t_('안내가 화면에 있다', b3.includes('머리글·바닥글을 꺼 주세요'))
t_('제어 불가 문장', b3.includes('브라우저가 제어하므로 서비스에서 자동으로 끌 수 없습니다'))
const order = await ev(`(()=>{const n=[...document.querySelectorAll('*')].find(e=>e.textContent.includes('머리글·바닥글을 꺼 주세요')&&e.children.length<6);const btn=[...document.querySelectorAll('button')].find(e=>e.textContent.includes('인쇄 / PDF'));if(!n||!btn)return null;return n.getBoundingClientRect? 'rect':'x'})()`)
t_('안내와 인쇄 버튼이 함께 있다', order!==null)
// 이 브라우저에서 이미 확인했다면 머리글 부분은 뜨지 않는다 — 기억을 지우고 본다
await ev("try{localStorage.removeItem('wy-print-ack')}catch{}")
await send('Page.reload'); await sleep(1400)
console.log('  인쇄 클릭:', await click('인쇄 / PDF로 저장'))
const b4=await body()
t_('확인 단계가 뜬다', b4.includes('인쇄하기 전에 확인하세요') && b4.includes('머리글·바닥글을 끄셨나요'))
t_('다시 묻지 않기', b4.includes('다시 묻지 않기'))
console.log('  돌아가기:', await click('돌아가서 고치기'))
t_('취소하면 사라진다', !(await body()).includes('인쇄하기 전에 확인하세요'))

console.log(`\n미처리 예외: ${errs.length}`); errs.slice(0,5).forEach(e=>console.log('   '+e))
console.log(`통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
