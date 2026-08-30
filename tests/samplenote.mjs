const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
await send('Page.navigate',{url:BASE+'/response'}); await sleep(1300)
const b=await ev('document.body.innerText')
const ok = b.includes('이 서비스가 작성한 예시입니다') && b.includes('실제 금융회사가 보낸 문서가 아니며')
console.log(ok?'  ok   샘플이 예시임을 밝힌다':'  FAIL 샘플 고지 없음')
console.log(ok?'통과 1 / 실패 0':'통과 0 / 실패 1')
process.exit(ok?0:1)
