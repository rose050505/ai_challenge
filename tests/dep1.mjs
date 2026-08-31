import { noCache, checkBundle } from './deputil.mjs'
const BASE = process.argv[2] || 'https://362.parkmiyeong.com'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map(); const api=[]; const exc=[]
ws.onmessage=e=>{const m=JSON.parse(e.data)
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);return}
  if(m.method==='Network.responseReceived'&&/\/api\//.test(m.params.response.url))api.push(m.params.response.url.split('/').pop()+':'+m.params.response.status)
  if(m.method==='Runtime.exceptionThrown')exc.push((m.params.exceptionDetails?.exception?.description||'').slice(0,120))}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
await noCache(send)   // ★ 캐시 오탐 방지 (deputil.mjs)
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const click=async txt=>{const r=await ev(`(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`);await sleep(900);return r}
const type=async(sel,val)=>ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return false;const p=el.tagName==='TEXTAREA'?HTMLTextAreaElement:HTMLInputElement;Object.getOwnPropertyDescriptor(p.prototype,'value').set.call(el,${JSON.stringify(val)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
const body=()=>ev(`document.body.innerText.replace(/\\s+/g,' ')`)
const st=()=>ev(`(()=>{try{const j=JSON.parse(localStorage.getItem('wae:journey:state')||'null');return j?JSON.stringify({sampleId:j.diagnosis?.sampleId,src:j.strategy?.source}):'(없음)'}catch(e){return 'ERR'}})()`)
let pass=0,fail=0; const ok=(n,c,d='')=>{c?pass++:fail++;console.log((c?'  ok   ':'  FAIL ')+n+(d?' — '+d:''))}
console.log('대상:', BASE)
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})

console.log('\n[1] 사실 문구 3건 (배포본)')
await send('Page.navigate',{url:BASE+'/'}); await sleep(1800)
await ev(`try{localStorage.setItem('wy-tour-v1','done')}catch(e){}`)
if(await click('처음부터')){await click('지우고 처음부터'); await sleep(800)}
await send('Page.navigate',{url:BASE+'/'}); await sleep(1500)
let b=await body()
ok('랜딩: 옛 거짓말 없음', !b.includes('입력한 내용은 서버로 전송되지 않습니다'))
ok('랜딩: 저장/전송을 나눠 적음', b.includes('작성하신 내용은 서버에 저장하지 않습니다') && b.includes('분석을 위해 서버를 거칩니다'))
await ev(`document.querySelectorAll('details').forEach(d=>d.open=true)`); await sleep(500)
b=await body()
ok('랜딩: 처리 내역 표', b.includes('무엇을 어떻게 다루나요') && b.includes('Anthropic(미국)의 Claude 모델로 전송'))
ok('푸터: 팀명·문의 메일', b.includes('만든 곳 그라파이트 · 문의 bmy31513151@gmail.com'))
const mail=await ev(`(()=>{const a=[...document.querySelectorAll('footer a')].find(a=>a.href.startsWith('mailto:'));if(!a)return '(없음)';
  const r=document.createRange();r.selectNodeContents(a);const s=getSelection();s.removeAllRanges();s.addRange(r);const out=s.toString();s.removeAllRanges();
  return JSON.stringify({href:a.href,copied:out})})()`)
ok('푸터: mailto + 복사 가능', mail.includes('mailto:bmy31513151@gmail.com') && mail.includes('"copied":"bmy31513151@gmail.com"'), mail)

await send('Page.navigate',{url:BASE+'/document'}); await sleep(1800)
b=await body()
ok('서식: 옛 거짓말 없음', !b.includes('새로고침하면 사라집니다'))
ok('서식: 실제 동작', b.includes('이 브라우저에 저장돼 다시 오셔도 이어집니다'))

await send('Page.navigate',{url:BASE+'/diagnose'}); await sleep(1600)
b=await body()
ok('진단: 옛 거짓말 없음', !b.includes('해석하는 기능은 아직 연결하지 않았습니다'))
ok('진단: 작성 유도', b.includes('어떤 자료를 내면 좋을지 다음 화면에서 찾아 드립니다'))
ok('진단: 제공자·국외 이전 고지', b.includes('Anthropic(미국)의 Claude 모델') && b.includes('국외 이전에 해당합니다'))
ok('진단: 글자 수', b.includes('/ 2,000자'))

console.log('\n[2] 샘플 → 서술 수정 → 진짜 API 호출')
await ev(`(()=>{const b=[...document.querySelectorAll('main button')].find(x=>/샘플 시나리오로 바로 채우기/.test(x.innerText)); if(b&&b.getAttribute('aria-expanded')!=='true') b.click(); return 1})()`); await sleep(300); await click('프리랜서 이OO'); await sleep(1300)
ok('샘플 직후 sampleId', (await st()).includes('freelancer'), await st())
await type('#reason','작년에 육아휴직을 쓰고 올해 3월 복직했습니다. 지금은 같은 회사에서 정규직으로 일하고 월급도 정상입니다. 휴직 기간에 소득이 없던 것이 그대로 반영된 것 같습니다.')
await sleep(1600)
ok('서술 고치면 sampleId 해제', !(await st()).includes('freelancer'), await st())
api.length=0
await send('Page.navigate',{url:BASE+'/strategy'}); await sleep(1600)
const t0=Date.now()
await ev(`(()=>{const x=[...document.querySelectorAll('button')].find(b=>/후보 만들기|다시 만들기/.test(b.innerText));if(x)x.click();return true})()`)
for(let i=0;i<60;i++){await sleep(500); if(await ev(`document.body.innerText.includes('서식에 넣을 항목을')`))break}
const secs=((Date.now()-t0)/1000).toFixed(1)
ok('★ /api/analyze 200', api.some(x=>x==='analyze:200'), JSON.stringify(api)+` ${secs}s`)
ok('AI 결과로 표시', (await body()).includes('적어주신 상황을 읽고 고른 목록입니다'))
ok('샘플 캐시 배너 없음', !(await body()).includes('샘플 시나리오는 미리 준비된 예시를 사용합니다'))
ok('저장된 source=ai', (await st()).includes('"src":"ai"'), await st())
const reasons=await ev(`(()=>[...document.querySelectorAll('main')].map(m=>m.innerText).join(' ').match(/'[^']{2,40}'라고 하셨/g)||[])()`)
console.log('   선정이유 인용:', JSON.stringify(reasons))
ok('선정이유가 새 서술을 인용', Array.isArray(reasons)&&reasons.length>0&&!reasons.some(r=>r.includes('프리랜서로 일하며')))

console.log('\n[3] 파비콘·OG (배포 서빙)')
const fav=await (await fetch(BASE+'/favicon.svg')).text()
ok('파비콘 교체됨', fav.includes('삼육이') && !fav.includes('863bff'))
const og=await fetch(BASE+'/og.png'); ok('og.png 200 + image/png', og.status===200 && og.headers.get('content-type')==='image/png')
const html=await (await fetch(BASE+'/')).text()
for(const k of ['og:type','og:url','og:title','og:description','og:image','twitter:card']) ok('OG '+k, html.includes(`"${k}"`))
ok('미처리 예외 없음', exc.length===0, exc.join(' | '))
/* ★ 어느 판을 검사했는지 남긴다. 옛 번들을 잡고 통과/실패하면 그것이 오탐이다. */
const B = await checkBundle(ev)
console.log(`\n검사한 번들: ${B.name ?? '(못 찾음)'}${B.expect ? `  (기대 ${B.expect})` : ''}`)
ok('★ 배포된 그 번들을 검사했다', B.ok, `${B.name} ≠ ${B.expect}`)
console.log(`\n통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
