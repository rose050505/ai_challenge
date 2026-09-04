/**
 * 둘러보기의 움직임 — **양쪽으로** 잰다.
 *
 * ★ 왜 이 시험이 생겼나 (2026-09-04)
 *   기존 시험은 "prefers-reduced-motion: reduce 에서 움직임이 0 인가"만 봤다.
 *   그래서 **평소에 실제로 움직이는가**는 아무도 보지 않았고, 375px 에서
 *   강조 표시의 미끄러짐이 30~60ms 만에 죽어 있는 것을 놓쳤다.
 *   한쪽만 잠그면 다음에도 한쪽만 깨진 채로 통과한다.
 *
 * ★ 그래서 전환 **도중의 값을 프레임마다 기록해서**,
 *   시작·중간·끝이 서로 다른지(= 정말 움직이는지) 375px 과 1280px 각각 확인한다.
 */
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t=(await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find(x=>x.type==='page')
const ws=new WebSocket(t.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r)
let id=0; const pend=new Map()
ws.onmessage=e=>{const m=JSON.parse(e.data); if(m.id&&pend.has(m.id)){pend.get(m.id)(m);pend.delete(m.id)}}
/*
 * ★ 응답을 **영원히 기다리지 않는다.** (2026-09-04)
 *   전에는 CDP 응답이 한 번 안 오면 top-level await 이 그대로 매달렸다.
 *   그러면 run.sh 의 timeout 400 이 죽일 때까지 아무것도 찍히지 않고,
 *   요약 줄이 없어 "원인 불명 실패"로 남는다. 멈춤을 **빠르고 읽히는 실패**로 바꾼다.
 */
const stalls=[]
const send=(m,p={},ms=15000)=>new Promise(res=>{const i=++id
  const to=setTimeout(()=>{pend.delete(i);stalls.push(m);res({__timeout:true})},ms)
  pend.set(i,(v)=>{clearTimeout(to);res(v)})
  ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
/**
 * ★ 브라우저 쪽 오류를 **삼키지 않는다.** (2026-09-04)
 *   전에는 평가가 실패하면 조용히 undefined 가 돌아왔고, 시험은 한참 뒤 엉뚱한 줄에서
 *   터졌다. 그래서 회차마다 다른 곳이 실패하는 것처럼 보였다. 여기서 바로 찍는다.
 */
const evErrs=[]
const ev=async x=>{const r=await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})
  if(r.error) evErrs.push('CDP: '+JSON.stringify(r.error).slice(0,120))
  const ed=r.result?.exceptionDetails
  if(ed) evErrs.push('EX: '+String(ed.exception?.description||ed.text).slice(0,120).split(String.fromCharCode(10)).join(' | '))
  return r.result?.result?.value}
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
let pass=0,fail=0
const t_=(n,c,d='')=>{ if(c) pass++; else {fail++; console.log('  FAIL',n,d)} }

/**
 * 탐색이 끝나기를 기다리는 동안에는 브라우저 오류를 **오류로 세지 않는다.**
 * ★ 문서가 바뀌는 순간의 평가는 "Inspected target navigated or closed" 로 날아간다.
 *   그건 고장이 아니라 **아직 준비되지 않았다**는 뜻이다. 조용히 다시 묻는다.
 *   (이것을 오류로 세면 정상 탐색마다 거짓 실패가 난다 — 이 시험이 흔들린 진짜 이유다)
 */
const evQuiet=async x=>{try{
  const r=await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})
  return r.result?.result?.value}catch(_){return undefined}}

/**
 * 조건이 참이 될 때까지 기다린다.
 * ★ 고정 시간으로 기다리지 않는다. (2026-09-04)
 *   기계가 바쁘면 모자라고 한가하면 낭비다 — 그 차이가 "회차마다 다른 곳이 실패"로 나타났다.
 *   실측으로는 랜딩이 90ms 안에 조작 가능해지지만, 값을 믿지 않고 조건을 본다.
 */
const until=async(expr,ms=8000)=>{const t0=Date.now()
  while(Date.now()-t0<ms){ if(await evQuiet(expr)) return true; await sleep(30) }
  console.log('  ‼ 기다려도 참이 되지 않음: '+expr.slice(0,60))
  return false}
/** 랜딩이 조작 가능해질 때까지 */
const READY=`[...document.querySelectorAll('button,a')].some(e=>e.textContent.includes('둘러보기'))`
const PANEL=`!!document.querySelector('[data-tour-panel]')`

const wipe=async(path)=>{const {identifier}=(await send('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.clear()}catch(e){}`})).result
  await send('Page.navigate',{url:BASE+path}); await until(READY)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})}
/** 투어를 "이미 본" 상태로 열어 둔다. 자동으로 열리지 않으므로 단추로 연 순간을 잴 수 있다. */
const seenTour=async(path)=>{const {identifier}=(await send('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.clear();localStorage.setItem('wy-tour-v1','done')}catch(e){}`})).result
  await send('Page.navigate',{url:BASE+path}); await until(READY)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})}
const motion=(v)=>send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:v}]})
/**
 * 화면 크기를 바꾸고 **실제로 바뀔 때까지 기다린다.** (2026-09-04)
 * ★ setDeviceMetricsOverride 는 곧바로 반영되지 않는다. 바로 재면 옛 크기가 잡힌다.
 */
const size=async(w,h)=>{
  await send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<640})
  await until(`innerWidth===${w} && innerHeight===${h}`, 3000)
  await sleep(150)
}

/**
 * 프레임마다 값을 담으면서 action 을 실행한다.
 *
 * ★ **어떤 경우에도 배열을 돌려준다.** (2026-09-04)
 *   전에는 안에서 예외가 나면 `undefined` 가 돌아와 시험이 `rec.length` 에서 **터졌다.**
 *   터지면 남은 검사가 통째로 날아가고, 회차마다 다른 곳이 실패하는 것처럼 보인다.
 *   원인 둘을 함께 막는다 —
 *     · `transform: none` 을 DOMMatrixReadOnly 에 넣으면 던진다 (평소에 자주 있는 값이다)
 *     · action 이 아직 없는 요소를 만지면 던진다
 *   이제 그런 일이 생기면 **기록이 짧아질 뿐**이고, "프레임을 20개 이상 담았다"가
 *   그 사실을 숫자로 잡는다. 크래시가 assertion 실패로 바뀐다.
 */
const recordRaw = (action, ms=700) => ev(`(async()=>{
  const out=[]; let stop=false; const t0=performance.now(); const errs=[];
  const my=e=>{try{const t=getComputedStyle(e).transform
    if(!t||t==='none') return {x:0,y:0}
    const m=new DOMMatrixReadOnly(t);return {x:m.e,y:m.f}}catch(_){return {x:0,y:0}}};
  const grab=()=>{ try{
    const p=document.querySelector('[data-tour-panel]');
    const b=document.querySelector('[data-tour-body]');
    const h=document.querySelector('[data-tour-hole]');
    return {t:Math.round(performance.now()-t0),
      py: p?Math.round(my(p).y):null, pa: p?getComputedStyle(p).animationName:null,
      bx: b?Math.round(my(b).x*10)/10:null,
      bo: b?Math.round(Number(getComputedStyle(b).opacity)*100)/100:null,
      ba: b?getComputedStyle(b).animationName:null,
      hy: h?Math.round(h.getBoundingClientRect().top):null,
      hm: h?/tour-hole-move/.test(h.getAttribute('class')||''):false,
      hd: h?getComputedStyle(h).transitionDuration:null,
      y: Math.round(scrollY)}
    }catch(e){ errs.push(String(e).slice(0,80)); return {t:-1} }}
  const loop=()=>{ if(stop) return; out.push(grab()); requestAnimationFrame(loop) }
  requestAnimationFrame(loop);
  try { ${action} } catch(e) { errs.push('action: '+String(e).slice(0,80)) }
  await new Promise(r=>setTimeout(r,${ms})); stop=true
  if(errs.length) out.errs=[...new Set(errs)]
  return out })()`)
/** 무슨 일이 있어도 배열이다. 실패하면 빈 배열 → assertion 이 숫자로 잡는다. */
const record = async (action, ms=700) => {
  const r = await recordRaw(action, ms)
  if (Array.isArray(r)) return r
  console.log('  ‼ 기록이 통째로 실패했다 (아래 assertion 이 0 으로 잡는다)')
  return []
}

const CLICK = (txt) => `(()=>{const p=document.querySelector('[data-tour-panel]');
  if(!p) return;
  const b=[...p.querySelectorAll('button')].find(e=>e.textContent.trim()===${JSON.stringify(txt)});
  if(b) b.click()})();`
const OPEN = `(()=>{const b=[...document.querySelectorAll('button,a')].find(e=>e.textContent.includes('둘러보기'));
  if(b) b.click()})();`

const nums=(rec,k)=>rec.map(r=>r[k]).filter(v=>typeof v==='number')
/** 서로 다른 값이 몇 개인가 = 정말 프레임마다 바뀌는가 */
const steps=(a)=>new Set(a).size
/** 값이 바뀐 프레임의 수. 미끄러짐은 여러 번, 즉시 이동은 한두 번이다. */
const changes=(a)=>{let n=0; for(let i=1;i<a.length;i++) if(a[i]!==a[i-1]) n++; return n}
/** 시작과 끝 **사이의** 값이 실제로 나타나는가 = 뛴 것이 아니라 지나간 것인가 */
const passedThrough=(a)=>{const s=a[0], e=a[a.length-1]; return s!==e && a.some(v=>(v-s)*(v-e)<0)}
/** 마지막으로 값이 바뀐 시각 = 움직임이 끝난 때 */
const settled=(rec,k)=>{let last=0; for(let i=1;i<rec.length;i++) if(rec[i][k]!==rec[i-1][k]) last=rec[i].t; return last}
/*
 * ★ **즉시 건너뛴 한 걸음은 빼고 잰다.**
 *   정거장은 저마다 다른 화면이라, 새 화면은 앞 화면의 스크롤 값을 물려받은 채 열린다.
 *   그 거리는 한 프레임에 즉시 건너뛰고(useTargets 의 LEAD 주석), 마지막 구간만 미끄러진다.
 *   가장 큰 한 걸음 뒤부터가 "부드럽게 훑는 구간"이다.
 */
const glide=(a)=>{let j=0,m=-1; for(let i=1;i<a.length;i++){const d=Math.abs(a[i]-a[i-1]); if(d>m){m=d;j=i}} return a.slice(j)}

/** 소개 → 정거장1 → (기록하며) 정거장2 */
async function toStation1(){
  await wipe('/')
  await ev(OPEN); await until(PANEL)
  await ev(CLICK('시작하기'))
  // 정거장 1은 대상(구멍)이 생겨야 잴 것이 있다. 그때까지 기다린다.
  await until(`document.querySelectorAll('[data-tour-hole]').length>0`)
  await sleep(400)   // 전환(260ms)이 끝나 값이 가라앉기를 기다린다
}

for (const [W,H] of [[375,667],[1280,900]]) {
  console.log(`[평소 · ${W}px] 전환 도중에 값이 실제로 바뀌는가`)
  await size(W,H); await motion('no-preference')

  /* ④ 하단 시트가 아래에서 올라온다 (모바일 전용 규칙).
     ★ 첫 방문은 자동으로 열려 버려 상승을 놓친다. "본 적 있음"으로 두고 단추로 연다. */
  await seenTour('/')
  const open = await record(OPEN, 600)
  const py = nums(open,'py')
  if (W < 640) {
    t_(`${W}: ④ 시트가 아래에서 올라온다`, py.length>0 && Math.max(...py) >= 60 && py[py.length-1]===0,
       JSON.stringify(py.slice(0,6))+'…'+JSON.stringify(py.slice(-2)))
    t_(`${W}: ④ 올라오는 도중 값이 여럿`, steps(py)>=3, String(steps(py)))
  } else {
    t_(`${W}: ④ 데스크톱에는 상승이 없다`, open.at(-1)?.pa==='none', String(open.at(-1)?.pa))
  }

  /* ①②③ — 정거장을 실제로 넘기며 **매 전환마다** 잰다.
     한 번만 재면 그 한 자리만 잠긴다. 소개→①→②→③ 를 모두 지나간다. */
  await seenTour('/')
  await ev(OPEN); await until(PANEL); await sleep(300)
  const legs = []
  // 다음 다리로 넘어가기 전에 **대상이 자리잡을 때까지** 기다린다.
  // 정거장 3은 /response 의 해석이 끝나야 대상이 생긴다 — 고정 시간으로는 못 맞춘다.
  const settle = async () => {
    await until(`document.querySelectorAll('[data-tour-hole]').length>0`)
    await sleep(300)
  }
  legs.push(['소개→①', await record(CLICK('시작하기'), 1000)]); await settle()
  legs.push(['①→②', await record(CLICK('다음'), 1000)]); await settle()
  legs.push(['②→③', await record(CLICK('다음'), 1000)]); await settle()

  for (const [leg, rec] of legs) {
    const tag = `${W} ${leg}`
    t_(`${tag}: 프레임을 20 개 이상 담았다`, rec.length>=20, String(rec.length))

    // ① 강조 표시가 미끄러져 이동한다
    const hm = rec.filter(r=>r.hm)
    const hy = glide(nums(rec,'hy'))
    if (process.env.DUMP) console.log('   ', tag, 'hy:', JSON.stringify(nums(rec,'hy')), 'y:', JSON.stringify(nums(rec,'y')))
    t_(`${tag}: ① 미끄러짐이 150ms 이상 살아 있다`,
       hm.length>0 && (hm.at(-1).t - hm[0].t) >= 150, hm.length? `${hm[0].t}~${hm.at(-1).t}ms`:'없음')
    t_(`${tag}: ① 강조 표시가 프레임마다 옮겨 간다`, changes(hy)>=5, String(changes(hy)))
    t_(`${tag}: ① 뛴 것이 아니라 지나간다`, passedThrough(hy), JSON.stringify([hy[0],hy[Math.floor(hy.length/2)],hy.at(-1)]))
    t_(`${tag}: ① 끝나면 화면 안에 자리잡는다`, hy.at(-1) >= 0 && hy.at(-1) < H*0.5, String(hy.at(-1)))

    // ② 배경 스크롤이 부드럽다 — 그리고 한 화면 안쪽에서 끝난다
    const y = glide(nums(rec,'y'))
    t_(`${tag}: ② 배경이 프레임마다 스크롤된다`, changes(y)>=5, String(changes(y)))
    t_(`${tag}: ② 뛴 것이 아니라 지나간다`, passedThrough(y), JSON.stringify([y[0],y[Math.floor(y.length/2)],y.at(-1)]))
    t_(`${tag}: ② 훑는 거리가 한 화면 안쪽`, Math.abs(y.at(-1)-y[0]) <= H, String(Math.abs(y.at(-1)-y[0])))
    t_(`${tag}: ② 600ms 안에 멎는다`, settled(rec,'y') <= 600, String(settled(rec,'y')))

    // ③ 시트 내용이 방향을 갖고 들어온다
    const bx = nums(rec,'bx'), bo = nums(rec,'bo')
    t_(`${tag}: ③ [다음]은 오른쪽에서 들어온다`, bx[0] > 5 && bx.at(-1) === 0, JSON.stringify([bx[0],bx.at(-1)]))
    t_(`${tag}: ③ 내용 transform 이 프레임마다 바뀐다`, changes(bx)>=5, String(changes(bx)))
    t_(`${tag}: ③ opacity 가 0 에서 1 로 지나간다`,
       bo[0]<0.2 && bo.at(-1)>0.99 && changes(bo)>=5 && passedThrough(bo), JSON.stringify([bo[0],bo.at(-1),changes(bo)]))
    t_(`${tag}: ③ 150~320ms 안에 끝난다`, settled(rec,'bx')>=150 && settled(rec,'bx')<=320, String(settled(rec,'bx')))

    // ④ 정거장이 바뀔 때 시트는 **다시 올라오지 않는다**
    t_(`${tag}: ④ 옮길 때 시트가 다시 올라오지 않는다`, nums(rec,'py').every(v=>v===0),
       JSON.stringify([...new Set(nums(rec,'py'))]))
  }

  // [이전] 은 반대 방향
  const back = await record(CLICK('이전'), 800)
  const bbx = nums(back,'bx')
  t_(`${W}: ③ [이전]은 왼쪽에서 들어온다`, bbx[0] < -5 && bbx.at(-1) === 0, JSON.stringify([bbx[0],bbx.at(-1)]))
  await sleep(600)
}

/*
 * [reduce] 이동은 0, 밝기만 바뀐다 — 크로스페이드. (2026-09-04 승인)
 * ★ 옛 기대값은 "animation-name 이 none 이면 통과"였다. 그 기준으로는 지금의 크로스페이드도,
 *   실수로 되살아난 슬라이드도 구별하지 못한다. **자리와 불투명도를 따로 잰다.**
 *   (규칙과 키프레임 쪽은 tmotion.mjs 가 결정적으로 잠근다)
 */
console.log('[reduce] 자리는 그대로, 밝기만 바뀐다 — 375px')
await size(375,667); await motion('reduce')
await toStation1()
const R = await record(CLICK('다음'), 800)
const last = R.at(-1)
t_('reduce: 내용 전환이 페이드다', last.ba==='tour-fade', String(last.ba))
t_('reduce: 강조 표시 transition 0s', last.hd==='0s', String(last.hd))
t_('★ reduce: 내용이 한 픽셀도 옮겨 다니지 않는다', steps(nums(R,'bx'))<=1,
   JSON.stringify([...new Set(nums(R,'bx'))]))
t_('★ reduce: 그래도 불투명도는 바뀐다', (()=>{const o=nums(R,'bo');return steps(o)>=3&&Math.min(...o)<0.5})(),
   JSON.stringify([...new Set(nums(R,'bo'))]))
/* ★ 여기서 "0" 은 값이 하나라는 뜻이 아니다 — 대상을 찾을 때까지 다시 재므로 몇 번은 바뀐다.
     평소에는 프레임마다(20 번 넘게) 바뀌고, reduce 에서는 손에 꼽게 바뀐다. 그 차이를 잠근다. */
t_('reduce: 배경이 훑지 않고 곧바로 자리잡는다', changes(nums(R,'y'))<=3, String(changes(nums(R,'y'))))
t_('reduce: 강조 표시도 미끄러지지 않는다', changes(nums(R,'hy'))<=3, String(changes(nums(R,'hy'))))

console.log('[인쇄] 종이에는 움직임이 없다')
await motion('no-preference')
await send('Emulation.setEmulatedMedia',{media:'print',features:[{name:'prefers-reduced-motion',value:'no-preference'}]})
const P = await ev(`(()=>{const p=document.querySelector('[data-tour-panel]');const b=document.querySelector('[data-tour-body]');
  const h=document.querySelector('[data-tour-hole]');const g=e=>e?getComputedStyle(e):null;
  return {pa:g(p)?.animationName, ba:g(b)?.animationName, hd:h?getComputedStyle(h).transitionDuration:null}})()`)
t_('인쇄: 시트 애니메이션 무효', P?.pa==='none', JSON.stringify(P))
t_('인쇄: 내용 애니메이션 무효', P?.ba==='none', JSON.stringify(P))
t_('인쇄: 강조 표시 transition 무효', P?.hd==='0s', JSON.stringify(P))
await send('Emulation.setEmulatedMedia',{features:[]})
await send('Emulation.clearDeviceMetricsOverride')

t_('★ 브라우저 쪽 오류 0건', evErrs.length===0, evErrs.slice(0,3).join(' ／ '))
t_('★ CDP 응답이 멈춘 호출 0건', stalls.length===0, stalls.slice(0,3).join(','))
console.log(`통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
