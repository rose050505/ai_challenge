/**
 * 움직임을 **켜는 조건**이 아니라 **끄는 조건**으로 쓰고 있는가.
 *
 * ★ 왜 이 시험이 생겼나 (2026-09-04 — 삼성 인터넷·iOS Safari 실기)
 *   둘러보기의 움직임 셋이 전부 `@media (prefers-reduced-motion: no-preference)`
 *   **안에** 있었다. 그 형태는 브라우저가 **명시적으로 no-preference 라고 답할 때만**
 *   켜진다. 그래서
 *     · reduce 라고 답하는 브라우저 → 꺼짐 (이건 의도한 것이다)
 *     · 이 미디어 특성을 **모르는** 브라우저 → 어느 값도 맞지 않아 **함께 꺼짐** (사고)
 *   크롬은 언제나 no-preference 라 값만 흉내 내는 시험으로는 뒤쪽을 영영 못 본다.
 *
 * ★ 그래서 값이 아니라 **규칙이 어느 미디어 조건 안에 있는지**를 본다.
 *   이 시험은 둘러보기를 열지 않는다 — 클래스만 붙여 계산값을 읽는다.
 *   그래서 스크롤·전환 타이밍에 흔들리지 않는다.
 *
 * ★ reduce 에서는 **크로스페이드**다 (2026-09-04 승인).
 *   자리와 크기는 한 픽셀도 움직이지 않고 밝기만 바뀐다. 그래서 여기서 재는 것은
 *   "움직임이 0 인가"가 아니라 **"이동이 0 이면서 불투명도는 바뀌는가"** 두 가지다.
 *   ★ 되짚어 볼 것: 지난 판은 reduce 에서 animation-name 이 none 이기만 하면 통과했다.
 *     그 기준으로는 지금의 크로스페이드도, 실수로 되돌아간 슬라이드도 구별하지 못한다.
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
const motion=v=>send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:v}]})
let pass=0,fail=0
const ok=(n,c,d='')=>{c?pass++:fail++;console.log((c?'  ok   ':'  FAIL ')+n+(c?'':' — '+d))}

/** 움직임을 다루는 세 클래스. 하나라도 빠지면 그 정거장 전환이 뚝 끊긴다. */
const WANT = ['.tour-hole-move', '.tour-page', '.tour-sheet']

/** 규칙이 어느 미디어 조건 안에 있는지 CSSOM 으로 직접 읽는다. */
const FORM = `(()=>{
  const want=${JSON.stringify(WANT)}
  const gatedOn=[], off=[], on=[], over=[]
  const walk=(rules,conds)=>{ for(const r of rules){
    // ★ 요즘 브라우저는 CSSStyleRule 에도 cssRules 가 있다(중첩 규칙용).
    //   컨테이너로 먼저 판정하면 모든 규칙이 빈 컨테이너로 취급돼 하나도 안 잡힌다.
    if(r.selectorText){
      const hit=want.filter(w=>r.selectorText.split(',').some(s=>s.trim().startsWith(w)))
      if(hit.length){
        const cond=conds.join(' AND ')
        // ★ cssText 로 보면 안 된다 — animation:none 은
        //   "auto ease 0s 1 normal none running none" 으로 직렬화된다. 속성으로 읽는다.
        const an=r.style.getPropertyValue('animation-name')
        const tp=r.style.getPropertyValue('transition-property')||r.style.getPropertyValue('transition')
        const turnsOn=(an&&an!=='none')||(tp&&tp!=='none')
        const turnsOff=an==='none'||tp==='none'
        if(turnsOn&&/no-preference/.test(cond)) gatedOn.push(hit.join('/')+' @ '+cond)
        // reduce 블록이 이 선택자를 다시 정의하는가 (끄든, 페이드로 갈아 끼우든)
        if((turnsOn||turnsOff)&&/prefers-reduced-motion:\\s*reduce/.test(cond)) over.push(...hit)
        if(turnsOff&&/prefers-reduced-motion:\\s*reduce/.test(cond)) off.push(...hit)
        if(turnsOn&&!/prefers-reduced-motion/.test(cond)) on.push(...hit)
      }
      if(r.cssRules&&r.cssRules.length) walk(r.cssRules,conds)
      continue
    }
    const c=r.conditionText ?? r.media?.mediaText
    if(r.cssRules) walk(r.cssRules, c? conds.concat(c) : conds)
  }}
  for(const sh of document.styleSheets){try{walk(sh.cssRules,[])}catch(_){}}
  return JSON.stringify({gatedOn,off:[...new Set(off)],on:[...new Set(on)],over:[...new Set(over)]})})()`

/** 클래스만 붙여 계산값을 읽는다. 투어를 열지 않으므로 타이밍에 흔들리지 않는다. */
const LIVE = `(()=>{const mk=(cls)=>{const d=document.createElement('div');d.className=cls
  document.body.appendChild(d);const cs=getComputedStyle(d)
  const v={an:cs.animationName,td:cs.transitionDuration};d.remove();return v}
  return JSON.stringify({page:mk('tour-page'),back:mk('tour-page tour-page-back'),
    sheet:mk('tour-sheet'),hole:mk('tour-hole-move')})})()`

// 하단 시트 규칙은 좁은 화면에서만 있다. 그 폭으로 잰다.
await send('Emulation.setDeviceMetricsOverride',{width:375,height:667,deviceScaleFactor:1,mobile:true})
await motion('no-preference')
await send('Page.navigate',{url:BASE+'/'}); await sleep(1400)

console.log('[구조] 켜는 조건이 아니라 끄는 조건으로 쓴다')
const F = JSON.parse(await ev(FORM))
ok('★ no-preference 를 요구하는 규칙이 하나도 없다', F.gatedOn.length === 0,
   JSON.stringify(F.gatedOn) + ' — 이 형태는 특성을 모르는 브라우저에서 함께 꺼진다')
for (const sel of WANT) {
  ok(`${sel} 는 조건 없이 켜져 있다`, F.on.includes(sel), JSON.stringify(F.on))
  ok(`${sel} 는 reduce 블록이 다시 정의한다`, F.over.includes(sel), JSON.stringify(F.over))
}
// 구멍은 페이드하지 않는다 — 마스크가 흐려지면 어두운 막이 대상 위로 번진다
ok('.tour-hole-move 는 reduce 에서 아예 꺼진다', F.off.includes('.tour-hole-move'),
   JSON.stringify(F.off))

console.log('\n[동작·평소] 움직임을 줄이라고 하지 않은 브라우저')
await motion('no-preference')
{
  const L = JSON.parse(await ev(LIVE))
  ok('평소: 내용이 오른쪽에서 들어온다', L.page.an === 'tour-in', JSON.stringify(L.page))
  ok('평소: [이전]은 왼쪽에서 들어온다', L.back.an === 'tour-in-back', JSON.stringify(L.back))
  ok('평소: 하단 시트가 올라온다', L.sheet.an === 'tour-rise', JSON.stringify(L.sheet))
  ok('평소: 강조 표시가 미끄러진다', L.hole.td !== '0s', JSON.stringify(L.hole))
}

console.log('\n[동작·reduce] 자리는 그대로, 밝기만 바뀐다 (크로스페이드)')
await motion('reduce')
{
  const L = JSON.parse(await ev(LIVE))
  ok('reduce: 내용이 페이드로 바뀐다', L.page.an === 'tour-fade', JSON.stringify(L.page))
  ok('reduce: [이전]도 같은 페이드다 (방향 없음)', L.back.an === 'tour-fade', JSON.stringify(L.back))
  ok('reduce: 하단 시트도 페이드다', L.sheet.an === 'tour-fade', JSON.stringify(L.sheet))
  ok('reduce: 강조 표시는 즉시 옮겨 간다', L.hole.td === '0s', JSON.stringify(L.hole))

  /*
   * ★ 이름만 보고 끝내지 않는다. tour-fade 라는 이름의 키프레임이 transform 을 건드리면
   *   "한 픽셀도 움직이지 않는다"가 깨진다. 키프레임 안을 직접 들여다본다.
   */
  const KF = await ev(`(()=>{
    const seen={}
    const walk=(rules)=>{ for(const r of rules){
      if(r.type===7||r.constructor?.name==='CSSKeyframesRule'){
        if(r.name==='tour-fade') seen[r.name]=[...r.cssRules].map(k=>k.keyText+' {'+k.style.cssText+'}')
        continue
      }
      if(r.cssRules&&!r.selectorText) walk(r.cssRules)
    }}
    for(const sh of document.styleSheets){try{walk(sh.cssRules)}catch(_){}}
    return JSON.stringify(seen['tour-fade']||null)})()`)
  const kf = JSON.parse(KF)
  ok('reduce: tour-fade 키프레임이 있다', Array.isArray(kf) && kf.length >= 2, KF)
  ok('★ reduce: 키프레임이 자리·크기를 건드리지 않는다',
     Array.isArray(kf) && !kf.some((k) => /transform|translate|scale|rotate|top|left|width|height|margin/.test(k)),
     KF)
  ok('★ reduce: 키프레임이 불투명도를 바꾼다',
     Array.isArray(kf) && kf.filter((k) => /opacity/.test(k)).length >= 2, KF)

  /*
   * ★ 실제로 돌려 보고 잰다. 규칙이 맞아도 다른 규칙이 transform 을 얹으면 소용없다.
   *   프레임마다 위치·크기·불투명도를 담아, 앞 둘은 붙박이고 뒤 하나만 움직이는지 본다.
   */
  const RUN = await ev(`(async()=>{
    const d=document.createElement('div'); d.className='tour-page'
    d.style.cssText='position:fixed;left:0;top:0;width:120px;height:40px;background:#000'
    document.body.appendChild(d)
    const out=[]; let stop=false
    const tick=()=>{ if(stop) return
      const r=d.getBoundingClientRect(), cs=getComputedStyle(d)
      out.push({x:Math.round(r.left*100)/100, y:Math.round(r.top*100)/100,
        w:Math.round(r.width*100)/100, h:Math.round(r.height*100)/100,
        tf:cs.transform, o:Math.round(Number(cs.opacity)*100)/100})
      requestAnimationFrame(tick) }
    requestAnimationFrame(tick)
    await new Promise(r=>setTimeout(r,420)); stop=true; d.remove()
    const uniq=(k)=>[...new Set(out.map(v=>v[k]))]
    return JSON.stringify({n:out.length, x:uniq('x'), y:uniq('y'), w:uniq('w'), h:uniq('h'),
      tf:uniq('tf'), o:uniq('o')})})()`)
  const R = JSON.parse(RUN)
  ok('reduce: 프레임을 여러 개 담았다', R.n >= 8, RUN)
  ok('★ reduce: 가로 자리가 한 번도 안 움직인다', R.x.length === 1, JSON.stringify(R.x))
  ok('★ reduce: 세로 자리가 한 번도 안 움직인다', R.y.length === 1, JSON.stringify(R.y))
  ok('★ reduce: 크기가 한 번도 안 변한다', R.w.length === 1 && R.h.length === 1,
     JSON.stringify({w:R.w, h:R.h}))
  ok('★ reduce: transform 이 내내 none 이다', R.tf.length === 1 && R.tf[0] === 'none',
     JSON.stringify(R.tf))
  ok('★ reduce: 불투명도는 실제로 바뀐다', R.o.length >= 3 && Math.min(...R.o) < 0.5,
     JSON.stringify(R.o))
}

console.log('\n[인쇄] 종이에는 움직임이 없다')
await send('Emulation.setEmulatedMedia',{media:'print',features:[{name:'prefers-reduced-motion',value:'no-preference'}]})
const P = JSON.parse(await ev(LIVE))
ok('인쇄: 내용 슬라이드 무효', P.page.an === 'none', JSON.stringify(P.page))
ok('인쇄: 하단 시트 무효', P.sheet.an === 'none', JSON.stringify(P.sheet))
ok('인쇄: 강조 표시 무효', P.hole.td === '0s', JSON.stringify(P.hole))

await send('Emulation.setEmulatedMedia',{features:[]})
await send('Emulation.clearDeviceMetricsOverride')
console.log(`\n통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
