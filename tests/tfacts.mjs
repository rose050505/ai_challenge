// 2026-08-30 감사 반영분 검증: 사실 오류 3건 / 샘플 캐시 해제 / 전송 고지 / 입력 한도 / 첫인상
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map(); const api=[]; const exc=[]
ws.onmessage=e=>{const m=JSON.parse(e.data)
  if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id);return}
  if(m.method==='Network.requestWillBeSent'&&/\/api\//.test(m.params.request.url))api.push(m.params.request.url.split('/').pop())
  if(m.method==='Runtime.exceptionThrown')exc.push((m.params.exceptionDetails?.exception?.description||'').slice(0,120))}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const click=async txt=>{const r=await ev(`(()=>{const e=[...document.querySelectorAll('button,a')].find(e=>e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`);await sleep(800);return r}
const type=async(sel,val)=>ev(`(()=>{const el=document.querySelector(${JSON.stringify(sel)});if(!el)return false;const p=el.tagName==='TEXTAREA'?HTMLTextAreaElement:HTMLInputElement;Object.getOwnPropertyDescriptor(p.prototype,'value').set.call(el,${JSON.stringify(val)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
const body=()=>ev(`document.body.innerText.replace(/\\s+/g,' ')`)
const st=()=>ev(`(()=>{try{const j=JSON.parse(localStorage.getItem('wae:journey:state')||'null');return j?JSON.stringify({sampleId:j.diagnosis?.sampleId,reason:(j.diagnosis?.reason||'').slice(0,14)}):'(없음)'}catch(e){return 'ERR'}})()`)
let pass=0,fail=0
const ok=(n,c,d='')=>{c?pass++:fail++;console.log((c?'  ok   ':'  FAIL ')+n+(d?' — '+d:''))}

console.log('[A] 사실과 다른 문구 3건')
await send('Page.navigate',{url:BASE+'/'}); await sleep(1200)
await ev(`try{localStorage.setItem('wy-tour-v1','done')}catch(e){}`)
if(await click('처음부터')){await click('지우고 처음부터'); await sleep(700)}
let b=await body()
ok('랜딩: 옛 거짓말 제거', !b.includes('입력한 내용은 서버로 전송되지 않습니다'))
ok('랜딩: 저장 안 함을 정확히', b.includes('작성하신 내용은 서버에 저장하지 않습니다'))
ok('랜딩: 전송 사실 고지', b.includes('분석을 위해 서버를 거칩니다'))
await ev(`document.querySelectorAll('details').forEach(d=>d.open=true)`); await sleep(400)
b=await body()
ok('랜딩: 처리 내역 표 노출', b.includes('무엇을 어떻게 다루나요') && b.includes('Anthropic(미국)의 Claude 모델로 전송'))
ok('랜딩: 표에 회신 원문 행', b.includes('해석이 끝나면 폐기'))
ok('푸터: 운영 주체', b.includes('만든 곳') && b.includes('그라파이트'))

await send('Page.navigate',{url:BASE+'/document'}); await sleep(1500)
b=await body()
ok('서식: 옛 거짓말 제거', !b.includes('새로고침하면 사라집니다'))
ok('서식: 실제 동작으로 교체', b.includes('이 브라우저에 저장돼 다시 오셔도 이어집니다'))

await send('Page.navigate',{url:BASE+'/diagnose'}); await sleep(1400)
b=await body()
ok('진단: 옛 거짓말 제거', !b.includes('해석하는 기능은 아직 연결하지 않았습니다'))
ok('진단: 작성 유도로 교체', b.includes('어떤 자료를 내면 좋을지 다음 화면에서 찾아 드립니다'))
ok('진단: AI 전송 고지', b.includes('Anthropic(미국)의 Claude 모델'))
ok('진단: 국외 이전 명시', b.includes('국외 이전에 해당합니다'))

console.log('\n[B] 샘플을 고른 뒤 직접 고쳐 쓰면 캐시를 버린다')
await click('프리랜서 이OO'); await sleep(1200)
ok('샘플 직후 sampleId 있음', (await st()).includes('freelancer'), await st())
await type('#reason','저는 프리랜서가 아니라 육아휴직 후 복직한 직장인입니다.')
await sleep(1500)
ok('서술을 고치면 sampleId 해제', !(await st()).includes('freelancer'), await st())
await click('프리랜서 이OO'); await sleep(1000)
await click('카드 발급이 거절됐다'); await sleep(1000)
ok('사건 유형을 바꿔도 해제', !(await st()).includes('freelancer'), await st())

api.length=0
await send('Page.navigate',{url:BASE+'/strategy'}); await sleep(1400)
await ev(`(()=>{const x=[...document.querySelectorAll('button')].find(b=>/후보 만들기|다시 만들기/.test(b.innerText));if(x)x.click();return true})()`)
await sleep(3000)
ok('★ 캐시로 새지 않고 API 를 부른다', api.some(u=>u.startsWith('analyze')), JSON.stringify(api))
b=await body()
ok('샘플 배너가 뜨지 않는다', !b.includes('샘플 시나리오는 미리 준비된 예시를 사용합니다'))

console.log('\n[B-2] 전송 고지가 입력 화면에 있다')
await send('Page.navigate',{url:BASE+'/'}); await sleep(1200)
if(await click('처음부터')){await click('지우고 처음부터'); await sleep(700)}
await send('Page.navigate',{url:BASE+'/strategy'}); await sleep(1500)
b=await body()
ok('전략: 보내는 것/보내지 않는 것', b.includes('보내는 것') && b.includes('보내지 않는 것'))
ok('전략: 제공자·국외 이전', b.includes('Anthropic(미국)의 Claude 모델') && b.includes('국외 이전에 해당합니다'))
ok('전략: 확인 못 한 것은 확인 못 했다고', b.includes('보관 정책은 이 서비스가 정하지 않습니다'))

console.log('\n[C] 입력 한도')
await send('Page.navigate',{url:BASE+'/diagnose'}); await sleep(1400)
ok('진단 maxLength', (await ev(`document.querySelector('#reason')?.maxLength`))===2000, String(await ev(`document.querySelector('#reason')?.maxLength`)))
ok('진단 글자 수 표시', (await body()).includes('/ 2,000자'))
await send('Page.navigate',{url:BASE+'/response'}); await sleep(1400)
ok('회신 maxLength', (await ev(`document.querySelector('#responseText')?.maxLength`))===12000)
ok('회신 글자 수 표시', (await body()).includes('/ 12,000자'))
ok('회신: 전송 고지', (await body()).includes('붙여넣으신 회신 원문'))
// 지연 안내는 로딩 상태에서만 뜬다. 로컬에서는 /api 가 곧바로 실패해 그 상태를 붙잡기 어려우므로
// 번들에 문구가 실렸는지로 확인한다(렌더 위치는 Strategy/Response 의 state==='loading' 분기).
{
  const js = await (await fetch(BASE + (await (await fetch(BASE+'/')).text()).match(/src="(\/assets\/[^"]+\.js)"/)[1])).text()
  ok('전략: 지연 안내 문구', js.includes('보통 10초 안팎, 최대 25초까지'))
  ok('회신: 지연 안내 문구', js.includes('최대 25초까지 기다립니다'))
}

console.log('\n[D] 용어·말투')
b=await body()
ok('답변서 → 회신', !b.includes('답변서'))
await send('Page.navigate',{url:BASE+'/next'}); await sleep(1400)
b=await body()
ok('서류 → 서식', !b.includes('서류를 출력했다면') && b.includes('서식을 출력했다면'))
ok('절 제목 형식 통일', b.includes('회신은 어디로 받나요'))
await send('Page.navigate',{url:BASE+'/'}); await sleep(1300)
b=await body()
ok('권리 요약 합니다체', b.includes('요구할 수 있습니다.') && !b.includes('요구할 수 있다.'))

console.log('\n[E] 첫인상')
const fav=await (await fetch(BASE+'/favicon.svg')).text()
ok('파비콘 교체됨(스캐폴드 아님)', fav.includes('삼육이') && !fav.includes('863bff'))
ok('icons.svg 제거', (await fetch(BASE+'/icons.svg')).status!==200 || !(await (await fetch(BASE+'/icons.svg')).text()).includes('bluesky'))
const html=await (await fetch(BASE+'/')).text()
for(const k of ['og:title','og:description','og:type','og:url','og:image','twitter:card'])
  ok('OG '+k, html.includes(`"${k}"`))
ok('og.png 존재', (await fetch(BASE+'/og.png')).status===200)

ok('미처리 예외 없음', exc.length===0, exc.join(' | '))
console.log(`\n통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
