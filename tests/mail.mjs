// 산출물(스크린샷·PDF)은 tests/out/ 에 떨어진다. .gitignore 에 걸려 있다.
const OUT = new URL('./out/', import.meta.url).pathname
await (await import('node:fs/promises')).mkdir(OUT, { recursive: true })
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms)); const fs=await import('node:fs')
let pass=0,fail=0; const ok=(n,c,d='')=>{c?pass++:fail++;console.log((c?'  ok   ':'  FAIL ')+n+(d?' — '+d:''))}
await send('Emulation.setDeviceMetricsOverride',{width:1000,height:900,deviceScaleFactor:1,mobile:false})
for (const p of ['/','/diagnose','/document','/next','/response','/strategy']) {
  await send('Page.navigate',{url:BASE+p}); await sleep(1300)
  const r=await ev(`(()=>{const a=[...document.querySelectorAll('footer a')].find(a=>a.href.startsWith('mailto:'));
    if(!a)return JSON.stringify({found:false});
    return JSON.stringify({found:true,href:a.href,text:a.textContent,footer:document.querySelector('footer').innerText.replace(/\\s+/g,' ')})})()`)
  const o=JSON.parse(r)
  if(p==='/'){
    ok('푸터에 mailto 링크', o.found)
    ok('href 가 완성된 주소', o.href==='mailto:bmy31513151@gmail.com', o.href)
    ok('화면 텍스트도 완성된 주소', o.text==='bmy31513151@gmail.com', o.text)
    ok('팀명·문의 라벨', o.footer.includes('만든 곳 그라파이트 · 문의'))
    // 사람이 복사할 수 있는가 — 링크를 선택해 실제 선택 문자열을 확인한다
    const sel=await ev(`(()=>{const a=[...document.querySelectorAll('footer a')].find(a=>a.href.startsWith('mailto:'));
      const r=document.createRange();r.selectNodeContents(a);const s=getSelection();s.removeAllRanges();s.addRange(r);
      const out=s.toString();s.removeAllRanges();return out})()`)
    ok('★ 드래그 복사 결과가 온전하다', sel==='bmy31513151@gmail.com', JSON.stringify(sel))
    const shot=await send('Page.captureScreenshot',{format:'png'})
    await ev(`window.scrollTo(0,document.body.scrollHeight)`); await sleep(400)
    const s2=await send('Page.captureScreenshot',{format:'png'})
    fs.writeFileSync(OUT+'new-footer.png',Buffer.from(s2.result.data,'base64'))
  } else ok(`${p} 푸터에도 있다`, o.found && o.href==='mailto:bmy31513151@gmail.com')
}
console.log(`\n통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
