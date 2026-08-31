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

// ── 3. 인쇄 안내 ─────────────────────────────────────
// 2026-08-31: 경고 상자와 첫 인쇄 확인 단계를 걷어냈다.
//   브라우저 주소가 인쇄되는 것은 거슬리는 것이지 실제 문제가 아니고,
//   그것 때문에 사용자에게 절차를 더 요구할 값어치가 없다.
//   남은 것은 인쇄 버튼 옆 한 줄 + 접어 둔 방법 + 쪽 번호 안내다.
console.log('== 인쇄 안내 ==')
await send('Page.removeScriptToEvaluateOnNewDocument',{identifier:inj.result.identifier})
await send('Page.navigate',{url:BASE+'/document'}); await sleep(1400)
const b3=await body()
t_('한 줄 안내가 있다', b3.includes('머리글·바닥글'))
t_('경고 상자가 아니다', !b3.includes('인쇄하기 전에 — 머리글·바닥글을 꺼 주세요'))
t_('★ 변명 문단이 사라졌다', !b3.includes('브라우저가 제어하므로'))
t_('★ 쪽 번호 안내는 남았다', b3.includes('쪽 번호는 이 서비스가 서식 안에 직접 넣습니다'))
t_('브라우저별 경로는 접혀 있다', !b3.includes('옵션 더보기'))
console.log('  펼치기:', await click('끄는 방법'))
t_('펼치면 경로가 보인다', (await body()).includes('옵션 더보기'))
// 빈 칸이 없으면 곧바로 인쇄된다 — 관문이 뜨지 않는다
await ev(`window.print=()=>{window.__printed=(window.__printed||0)+1}`)
console.log('  인쇄 클릭:', await click('인쇄 / PDF로 저장'))
await sleep(900)
const b4=await body()
t_('★ 첫 인쇄에도 확인 단계가 뜨지 않는다', !b4.includes('머리글·바닥글을 끄셨나요'))
t_('다시 묻지 않기 체크가 없다', !b4.includes('다시 묻지 않기'))

console.log(`\n미처리 예외: ${errs.length}`); errs.slice(0,5).forEach(e=>console.log('   '+e))
console.log(`통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
