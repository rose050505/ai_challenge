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
const click=async txt=>{const ok=await ev(`(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.trim().includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`);await sleep(700);return ok}
let pass=0,fail=0; const t_=(n,c)=>{c?pass++:fail++;console.log((c?'  ok  ':'  FAIL')+' '+n)}
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})

const hrefs=new Set()
const collect=async()=>{
  const list=await ev(`JSON.stringify([...document.querySelectorAll('a[href^="https://www.law.go.kr"]')].map(a=>({h:a.href,t:a.textContent.trim().slice(0,60),tgt:a.target,rel:a.rel,al:a.getAttribute('aria-label')||''})))`)
  return JSON.parse(list||'[]')
}
let all=[]
for (const p of ['/','/diagnose','/document','/document?form=correctionRequest','/strategy','/next','/response']) {
  await send('Page.navigate',{url:BASE+p}); await sleep(1200)
  const l=await collect(); all=all.concat(l.map(x=>({...x,p})))
  console.log(`  ${p}: 링크 ${l.length}개`)
}
// 진단을 채워야 나오는 화면들도 본다
await send('Page.navigate',{url:BASE+'/diagnose?sample=' }); await sleep(900)

t_('법령 링크가 존재한다', all.length>0)
t_('전부 새 탭', all.every(a=>a.tgt==='_blank'))
t_('전부 noopener noreferrer', all.every(a=>a.rel.includes('noopener')&&a.rel.includes('noreferrer')))
t_('전부 설명 라벨', all.every(a=>a.al.includes('국가법령정보센터')||a.t.length>0))
for (const a of all) hrefs.add(a.h)
console.log(`  고유 주소 ${hrefs.size}개`)

// 판본 표시
await send('Page.navigate',{url:BASE+'/'}); await sleep(1000)
const b=await ev('document.body.innerText')
t_('판본 제목', b.includes('이 서비스가 기준으로 삼은 법령 판본'))
t_('법률 판본', b.includes('법률 제21646호'))
t_('시행령 판본', b.includes('대통령령 제36574호'))
t_('금융위원회법 판본', b.includes('법률 제21065호'))
t_('개정 고지', b.includes('이후 개정 사항은 반영되지 않았을 수 있습니다'))

// 서식 출처 — 저장된 탭이 남아 있으면 서식 2가 열리므로 기록을 비우고 본다
await send('Page.navigate',{url:BASE+'/'}); await sleep(800)
await ev("localStorage.removeItem('wae:journey:state')")
await send('Page.navigate',{url:BASE+'/document?form=explanationRequest'}); await sleep(1300)
const d1=await ev('document.body.innerText')
t_('서식 1 출처', d1.includes('서식 출처') && d1.includes('별지 제15호의2 정본'))
/* 별지 자체의 개정 표기. 감독규정의 2026-08-13 개정과 다른 것이다. */
t_('서식 1 별지 개정 표기', d1.includes('<개정 2022.7.7.>'))
await send('Page.navigate',{url:BASE+'/document?form=correctionRequest'}); await sleep(1300)
const d2=await ev('document.body.innerText')
t_('서식 2 출처', d2.includes('서식 출처') && d2.includes('별지 제15호의3 정본'))
/* 2026-09-04 정본 대조 완료 → 공개본을 기준으로 삼던 시절의 유보 문구는 전부 사라졌다.
   ('실무 표준으로 다룹니다' 는 정본을 못 봤을 때 쓰던 표현이다) */
t_('대조 전 안내문 제거',
   !d2.includes('글자를 추출해') && !d2.includes('실무 표준으로') && !d2.includes('공개본'))
t_('서식 2에는 별지 개정 표기가 없다 — 지어내지 않는다', !d2.includes('<개정'))

console.log('미처리 예외:', errs.length)
console.log(JSON.stringify([...hrefs],null,0))
console.log(`통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
