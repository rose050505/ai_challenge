const BASE=process.argv[2]
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
const {result:{identifier}} = await send('Page.addScriptToEvaluateOnNewDocument',{source:`
  const boom=()=>{throw new DOMException('The operation is insecure.','SecurityError')}
  Object.defineProperty(window,'localStorage',{configurable:true,get:()=>({getItem:boom,setItem:boom,removeItem:boom,clear:boom,key:boom,length:0})})`})
await send('Page.navigate',{url:BASE+'/document'}); await sleep(2200)
const lead=await ev(`(()=>{const m=document.querySelector('main').innerText;const i=m.indexOf('화면에서 채운');return m.slice(i,i+120).replace(/\\n/g,' ')})()`)
console.log('저장 차단 리드:', lead)
console.log('판정:', lead.includes('저장을 막고 있습니다') ? 'OK — 차단 분기' : 'FAIL')
await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})
ws.close()
