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
let pass=0,fail=0; const t_=(n,c)=>{c?pass++:fail++;console.log((c?'  ok  ':'  FAIL')+' '+n)}
await send('Emulation.setDeviceMetricsOverride',{width:1280,height:900,deviceScaleFactor:1,mobile:false})
await send('Page.navigate',{url:BASE+'/'}); await sleep(1300)

const b0=await ev('document.body.innerText')
t_('자가진단 제목', b0.includes('혹시 이런 일이 있으셨나요'))
t_('4개 항목', ['이유를 정확히 듣지 못했다','하루도 지나지 않아','시스템에서 그렇게 나왔다','한도나 금리가 불리하게'].every(s=>b0.includes(s)))
t_('아무것도 안 고른 상태 안내', b0.includes('해당하는 것이 없어도 괜찮습니다'))
t_('단정하지 않는다(초기)', !b0.includes('자동화평가입니다'))

/* 순서 — 자가진단이 권리 5종 목록보다 위에 있어야 한다.
   ★ 글자 위치(indexOf)로 재지 않는다. 진입 카드 본문에도 "행사할 수 있는 권리"라는
     말이 들어 있어서, 문자열로 재면 카드가 목록으로 잡힌다. 제목 요소로 잰다. */
const order = await ev(`(()=>{const Y=e=>e?Math.round(e.getBoundingClientRect().top+scrollY):-1;
  const h=[...document.querySelectorAll('h2')];
  return {sc:Y(h.find(e=>e.textContent.includes('혹시 이런 일이'))),
          rights:Y(h.find(e=>e.textContent.trim().startsWith('행사할 수 있는 권리'))),
          cta:Y(document.querySelector('.entry-card'))}})()`)
t_('자가진단이 권리 목록보다 앞', order.sc>0 && order.rights>0 && order.sc < order.rights, JSON.stringify(order))
t_('진입 카드가 자가진단보다 앞', order.cta>0 && order.cta < order.sc, JSON.stringify(order))

// 하나 체크
const n = await ev(`(()=>{const cbs=[...document.querySelectorAll('input[type=checkbox]')];const c=cbs[0];if(!c)return -1;c.click();return 1})()`)
await sleep(500)
const b1=await ev('document.body.innerText')
t_('체크하면 결과가 바뀐다', b1.includes('가능성') && b1.includes('1개 해당'))
t_('★ 단정하지 않는다', !b1.includes('자동화평가입니다') && !b1.includes('자동화평가를 받으셨습니다'))
t_('확인해 줄 수 없다고 밝힌다', b1.includes('확인해 드릴 수 없습니다'))
t_('요건을 인용한다', b1.includes('종사자가 평가 업무에 관여하지 아니하고'))
t_('R1 으로 연결한다', b1.includes('자동화평가를 했습니까') && b1.includes('자동화평가 실시 여부 설명 요구'))
t_('근거 조문 두 개', b1.includes('법 제2조제14호') && b1.includes('법 제36조의2 제1항 제1호'))
t_('항목 자체엔 조문이 없다', !/이유를 정확히 듣지 못했다[^\n]*제\d+조/.test(b1))
const live = await ev(`(()=>{const el=[...document.querySelectorAll('[aria-live]')].find(e=>e.textContent.includes('가능성'));return el? el.getAttribute('aria-live'):null})()`)
t_('결과가 낭독 영역', live==='polite')
/* ★ 라벨은 체크 여부와 무관하게 하나다. (2026-09-03)
      "이 상황으로 진단 시작하기"였는데 링크는 그냥 /diagnose 라 고른 항목이 넘어가지
      않았다. 자가진단 항목은 사건 유형과 1:1 이 아니어서 넘길 것도 없다.
      화면이 하지 않는 일을 약속하지 않는다 — 그래서 없어진 문구도 함께 잠근다. */
const cta = await ev(`(()=>{const a=[...document.querySelectorAll('a')].find(e=>e.textContent.trim()==='진단 시작하기');return a? a.getAttribute('href'):null})()`)
t_('진단으로 연결', cta==='/diagnose')
t_('넘기지도 않을 것을 약속하지 않는다', !b1.includes('이 상황으로 진단 시작하기'))

// 무엇을 해 드리나요
t_('3단계 요약', b1.includes('무엇을 해 드리나요') && b1.includes('어떤 권리를 쓸 수 있는지'))
console.log('미처리 예외:', errs.length)
console.log(`통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
