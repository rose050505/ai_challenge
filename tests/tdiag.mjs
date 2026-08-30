/** 그림 3종 — 접근성 / 세로판 / 화살촉 / 법령 라벨 출처 */
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map(); const errs=[]
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}
  if(m.method==='Runtime.exceptionThrown') errs.push(m.params.exceptionDetails.text)}
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
let pass=0,fail=0; const t_=(n,c,d='')=>{ if(c) pass++; else {fail++; console.log('  FAIL',n,d)} }
const go=async(path,prep)=>{const {identifier}=(await send('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.clear();localStorage.setItem('wy-tour-v1','done')}catch(e){}`})).result
  await send('Page.navigate',{url:BASE+path}); await sleep(1600)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})
  if(prep){ await ev(prep); await sleep(500) }}

const check = async (dgid, path, prep) => {
  await go(path, prep)
  const info = JSON.parse(await ev(`JSON.stringify((()=>{
    const svgs=[...document.querySelectorAll('svg[data-diagram=${dgid}]')];
    return svgs.map(s=>({
      layout: s.dataset.layout,
      role: s.getAttribute('role'),
      title: s.querySelector('title')?.textContent?.slice(0,40) ?? null,
      desc: (s.querySelector('desc')?.textContent ?? '').length,
      labelledby: s.getAttribute('aria-labelledby'),
      labelsResolve: (s.getAttribute('aria-labelledby')||'').split(' ').every(i=>!!document.getElementById(i)),
      markers: [...s.querySelectorAll('marker')].map(m=>m.id),
      arrows: [...s.querySelectorAll('path[marker-end]')].length,
      markersResolve: [...s.querySelectorAll('path[marker-end]')].every(p=>{
        const m=/url\\(#(.+)\\)/.exec(p.getAttribute('marker-end'));
        const el=m&&document.getElementById(m[1]);
        // 같은 SVG 안의 marker 로 풀려야 한다 (숨은 다른 SVG 것이면 안 그려진다)
        return !!el && s.contains(el)
      }),
    }))
  })())`))
  t_(`${dgid}: 가로·세로 두 판`, info.length===2 && info.map(i=>i.layout).sort().join()==='tall,wide', JSON.stringify(info.map(i=>i.layout)))
  for (const i of info) {
    t_(`${dgid}/${i.layout}: role=img`, i.role==='img')
    t_(`${dgid}/${i.layout}: title 있음`, !!i.title, i.title||'')
    t_(`${dgid}/${i.layout}: desc 충분`, i.desc>60, String(i.desc))
    t_(`${dgid}/${i.layout}: aria-labelledby 가 실제로 존재`, i.labelsResolve)
    t_(`${dgid}/${i.layout}: 화살표 있음`, i.arrows>0, String(i.arrows))
    t_(`${dgid}/${i.layout}: ★ 화살촉이 자기 SVG 안으로 풀린다`, i.markersResolve)
    t_(`${dgid}/${i.layout}: marker id 가 고유`, new Set(i.markers).size===i.markers.length)
  }
  // 문서 전체에서 marker id 중복이 없어야 한다
  const dup = await ev(`(()=>{const ids=[...document.querySelectorAll('marker')].map(m=>m.id);return ids.length-new Set(ids).size})()`)
  t_(`${dgid}: 문서 안 marker id 중복 0`, dup===0, String(dup))
}

await send('Emulation.setDeviceMetricsOverride',{width:375,height:667,deviceScaleFactor:1,mobile:true})
console.log('[375px]')
await check('dg-loop','/')
await check('dg-arch','/strategy')
await check('dg-routing','/diagnose?sample=returner',
  `(()=>{const d=[...document.querySelectorAll('details')].find(d=>d.textContent.includes('정정을 요구하려면'));if(d)d.open=true})()`)

console.log('[법령 라벨은 law.js 에서 온다]')
await go('/diagnose?sample=returner',`(()=>{const d=[...document.querySelectorAll('details')].find(d=>d.textContent.includes('정정을 요구하려면'));if(d)d.open=true})()`)
const txt = await ev(`document.querySelector('svg[data-diagram=dg-routing][data-layout=tall]').textContent`)
t_('질문 문구가 law.js 의 것과 같다', txt.includes('정정하려는 정보는 어디에서 만들어진 것인가요?'))
t_('서식 이름이 law.js 의 줄임 이름', txt.includes('정정ㆍ재산출 요청서') && txt.includes('설명요구서'))
t_('★ 처리되지 않은 예외 0건', errs.length===0, errs.join('|'))

console.log(`\ntdiag: ${pass}/${pass+fail} 통과`)
ws.close(); process.exit(fail?1:0)
