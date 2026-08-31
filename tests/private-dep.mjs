import { noCache, checkBundle } from './deputil.mjs'
const BASE = process.argv[2] || process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map(); const errors=[]
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}
  if(m.method==='Runtime.exceptionThrown') errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text)}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
await noCache(send)   // ★ 캐시 오탐 방지 (deputil.mjs)
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const click=async txt=>{const ok=await ev(`(()=>{const e=[...document.querySelectorAll('button,a,summary')].reverse().find(e=>e.textContent.trim().includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`);await sleep(700);return ok}
const body=()=>ev('document.body.innerText.replace(/\\s+/g," ")')
const out=[]; const ck=(n,p,d='')=>{out.push([n,p]);console.log((p?'  ✔ ':'  ✘ ')+n+(d?' — '+d:''))}

// ── 시크릿 모드 재현: localStorage 접근이 모두 throw 하게 만든다 ──
const {identifier} = await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  const boom = () => { throw new DOMException('The operation is insecure.','SecurityError') }
  Object.defineProperty(window,'localStorage',{configurable:true,get:()=>({
    getItem:boom,setItem:boom,removeItem:boom,clear:boom,key:boom,length:0,
  })})
`})
console.log('\n[G. 저장이 막힌 브라우저 (시크릿 모드 재현)]')
await send('Page.navigate',{url:BASE+'/'}); await sleep(1600)
ck('1) ★ 화면이 뜬다 (예외로 죽지 않는다)', (await body()).includes('행사할 수 있는 권리'))
ck('2) 저장 안 됨을 헤더가 알린다', (await body()).includes('자동 저장 안 됨'))
await send('Page.navigate',{url:BASE+'/diagnose'}); await sleep(1400)
await click('신용대출이 거절됐다')
await click('개인신용평가회사 (CB사)')
await sleep(800)
ck('3) ★ 진단이 정상 동작', (await body()).includes('행사할 수 있는 권리'))
await send('Page.navigate',{url:BASE+'/document'}); await sleep(1500)
const d=await body()
ck('4) 서식 화면이 뜬다', d.includes('고시 서식을 채워 인쇄하세요'))
ck('5) ★ 저장 불가를 알리고 대안을 준다', d.includes('이 브라우저에서는 자동 저장이 안 됩니다') && d.includes('파일로 내보내'))
await ev(`(()=>{const el=document.querySelector('.print-sheet input');Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set.call(el,'시크릿테스트');el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
await sleep(2200)
ck('6) ★ 입력이 그대로 동작', (await ev(`[...document.querySelectorAll('.print-sheet input')].some(i=>i.value==='시크릿테스트')`)))
await click('인쇄 / PDF로 저장'); await sleep(600)
// 저장소를 못 쓰는 환경에서는 확인 단계가 매번 뜬다 (기억할 수 없으므로 — 설계대로)
if ((await body()).includes('인쇄하기 전에 확인하세요')) await click('이대로 인쇄하기')
await sleep(1000)
ck('7) ★ 인쇄 후 전환도 동작', (await body()).includes('제출 전에 확인하세요'))
await send('Page.navigate',{url:BASE+'/response'}); await sleep(1400)
await click('3유형 전부 설명받은 회신')
await click('회신 해석하기'); await sleep(1500)
ck('8) ★ 회신 해석도 동작', (await body()).includes('무엇을 받았나요'))
ck('9) 처리되지 않은 예외 없음', errors.length===0, errors.slice(0,2).join(' | ') || '0건')

await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})
const B = await checkBundle(ev)
ck(`★ 배포된 그 번들을 검사했다 (${B.name ?? '?'})`, B.ok, B.expect ? `기대 ${B.expect}` : '')
console.log('\n════════════════════════')
const f=out.filter(([,p])=>!p)
console.log(`${out.length-f.length}/${out.length} 통과`)
f.forEach(([n])=>console.log('  ✘',n))
ws.close(); process.exit(f.length?1:0)
