/**
 * 회신 법정 서식(별지 제15호의4) 고지 — /response 결과 화면과 /next 4번 섹션.
 *
 * 보는 것
 *  - 감독규정 제40조의5 제2항 원문이 화면에 그대로 나오는가
 *  - 서식 번호·이름을 말하는가
 *  - ★ 정본이 정한 **절 구성과 두 칸(반영비중·입수 경로)**을 안내하는가 (2026-09-04)
 *  - ★ 본문을 못 받았던 시절의 고지가 **되살아나지 않는가**
 *  - ★ 위법이라고 단정하는 표현이 없는가 — 그리고 그 근거가 작성요령인가
 *  - 근거 배지가 감독규정으로 링크되는가
 */
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
let pass=0, fail=0
const t_=(n,c)=>{ if(c) pass++; else {fail++; console.log('  FAIL', n)} }

const RULE = '영 제31조의2제7항에서 "금융위원회가 정하여 고시하는 서식"이란 별지 제15호의4 서식을 말한다.'
const seed = async (journey, path) => {
  const { identifier } = (await send('Page.addScriptToEvaluateOnNewDocument',
    { source: `try{localStorage.setItem('wae:journey:state', ${JSON.stringify(JSON.stringify(journey))})}catch(e){}` })).result
  await send('Page.navigate',{url:BASE+path}); await sleep(1200)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})
}
const J = (extra={}) => ({ schemaVersion:1, updatedAt:new Date().toISOString(),
  diagnosis:{}, strategy:{}, form:{}, response:{}, milestones:{}, ...extra })

const checkBlock = async (where) => {
  const txt = await ev(`document.querySelector('main').innerText`)
  t_(`${where}: 규정 원문 그대로`, txt.includes(RULE))
  t_(`${where}: 서식 번호`, txt.includes('별지 제15호의4'))
  t_(`${where}: 서식 이름`, txt.includes('자동화평가 결과 안내서'))
  t_(`${where}: 상위 근거(시행령 제31조의2 제7항) 언급`, txt.includes('시행령 제31조의2 제7항'))
  /* ★ 2026-09-04 별지 제15호의4 정본 확보. 무엇이 담기는지까지 말한다. */
  t_(`${where}: 절 구성 1`, txt.includes('1. 자동화평가 결과'))
  t_(`${where}: 절 구성 2`, txt.includes('2. 자동화평가 주요 기준 및 기초정보의 개요'))
  t_(`${where}: 절 구성 2(유리한 정보)`,
     txt.includes('2. 자동화평가 결과의 산출에 유리하다고 판단되는 정보'))
  t_(`${where}: 해당사항 없으면 본란 삭제`, txt.includes('본란을 삭제한다'))
  /* 다섯 분류 — 정본 표기는 세 「판단정보」를 붙여 쓴다 */
  t_(`${where}: 다섯 분류 정본 표기`,
     ['식별정보','거래내용판단정보','신용도판단정보','신용거래능력판단정보','기타 정보']
       .every((c)=>txt.includes(c)))
  t_(`${where}: 반영비중을 안내한다`, txt.includes('반영비중'))
  t_(`${where}: 입수 경로 세 값`,
     ['당사 자체입수','신용정보집중기관','개인신용평가회사'].every((v)=>txt.includes(v)))
  t_(`${where}: 입수 경로가 제출처를 정한다고 잇는다`,
     txt.includes('정정 요청을 어느 회사에 낼지'))
  t_(`${where}: 작성요령 근거`, txt.includes('별지 제15호의4 작성요령'))
  /* ★ 못 받았던 시절의 고지가 되살아나지 않는지 */
  t_(`${where}: 본문 미확인 고지가 남아 있지 않다`,
     !txt.includes('어떤 항목을 담는지는 확인하지 못했습니다') &&
     !txt.includes('그런 법정 서식이 있다'))
  /* ★ 단정하지 않는 이유가 추측이 아니라 정본이다 */
  t_(`${where}: 위법 단정 금지 고지`, txt.includes('위법이라고 볼 수 없습니다'))
  t_(`${where}: 그 근거가 작성요령이다`,
     txt.includes('자체적으로 정한 서식을 사용할 수 있음') &&
     txt.includes('자체적으로 정할 수 있음'))
  t_(`${where}: 추측을 근거로 삼지 않는다`, !txt.includes('실무에서 어떻게 운용되는지'))
  // ★ 단정 표현이 새로 들어오지 않았는지
  const bad = ['위법입니다','법 위반입니다','불법입니다','따르지 않으면 처벌']
  t_(`${where}: 단정 표현 없음`, bad.every(b=>!txt.includes(b)))
  // 근거 배지 링크
  const link = await ev(`(()=>{const a=[...document.querySelectorAll('main a')].find(a=>a.textContent.includes('제40조의5')); return a? a.href : null})()`)
  t_(`${where}: 감독규정 배지 링크`, !!link && decodeURIComponent(link).includes('행정규칙/신용정보업감독규정'))
}

console.log('[1] /response 결과 화면')
await seed(J({ response:{ interpretation:{ refused:false, covered:['result','criteria','baseInfo'], missing:[],
  baseInfoItems:[{항목:'연체 이력',내용:'없음',분류:'신용도판단정보'}], excludedByProviso:false }, errors:[], catOverrides:{} } }), '/response')
t_('결과 화면이 떴다', (await ev(`document.querySelector('main').innerText.includes('무엇을 받았나요')`))===true)
await checkBlock('/response')

console.log('[2] /next 4번 섹션')
await seed(J({ milestones:{ explanationRequest:{ printedAt:'2026-08-20T01:00:00.000Z', submittedAt:'2026-08-20T02:00:00.000Z' } } }), '/next')
// 4번 섹션을 펼친다
await ev(`(()=>{const b=[...document.querySelectorAll('main h2 > button[aria-expanded]')].find(b=>b.innerText.includes('어떤 답을 받게')); if(b&&b.getAttribute('aria-expanded')!=='true') b.click(); return true})()`)
await sleep(300)
await checkBlock('/next')

console.log(`\ntrform: ${pass}/${pass+fail} 통과`)
ws.close(); process.exit(fail?1:0)
