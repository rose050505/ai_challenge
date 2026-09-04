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
const send=(m,p={})=>new Promise(res=>{const i=++id;pend.set(i,res);ws.send(JSON.stringify({id:i,method:m,params:p}))})
await send('Page.enable'); await send('Runtime.enable')
const ev=async x=>(await send('Runtime.evaluate',{expression:x,awaitPromise:true,returnByValue:true})).result?.result?.value
const sleep=ms=>new Promise(r=>setTimeout(r,ms))
let pass=0,fail=0
const t_=(n,c,d='')=>{ if(c) pass++; else {fail++; console.log('  FAIL',n,d)} }

const wipe=async(path)=>{const {identifier}=(await send('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.clear()}catch(e){}`})).result
  await send('Page.navigate',{url:BASE+path}); await sleep(1300)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})}
/** 투어를 "이미 본" 상태로 열어 둔다. 자동으로 열리지 않으므로 단추로 연 순간을 잴 수 있다. */
const seenTour=async(path)=>{const {identifier}=(await send('Page.addScriptToEvaluateOnNewDocument',{source:`try{localStorage.clear();localStorage.setItem('wy-tour-v1','done')}catch(e){}`})).result
  await send('Page.navigate',{url:BASE+path}); await sleep(1300)
  await send('Page.removeScriptToEvaluateOnNewDocument',{identifier})}
const motion=(v)=>send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:v}]})
const size=(w,h)=>send('Emulation.setDeviceMetricsOverride',{width:w,height:h,deviceScaleFactor:1,mobile:w<640})

/** 프레임마다 값을 담으면서 action 을 실행한다. */
const record = (action, ms=700) => ev(`(async()=>{
  const out=[]; let stop=false; const t0=performance.now();
  const my=e=>{const m=new DOMMatrixReadOnly(getComputedStyle(e).transform);return {x:m.e,y:m.f}};
  const grab=()=>{
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
      y: Math.round(scrollY)}}
  const loop=()=>{ if(stop) return; out.push(grab()); requestAnimationFrame(loop) }
  requestAnimationFrame(loop);
  ${action}
  await new Promise(r=>setTimeout(r,${ms})); stop=true; return out })()`)

const CLICK = (txt) => `(()=>{const p=document.querySelector('[data-tour-panel]');
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
  await ev(OPEN); await sleep(700)
  await ev(CLICK('시작하기')); await sleep(1800)
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
  await ev(OPEN); await sleep(800)
  const legs = []
  legs.push(['소개→①', await record(CLICK('시작하기'), 1000)]); await sleep(700)
  legs.push(['①→②', await record(CLICK('다음'), 1000)]); await sleep(700)
  legs.push(['②→③', await record(CLICK('다음'), 1000)]); await sleep(700)

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

console.log('[reduce] 켜면 움직임이 0 이어야 한다 — 375px')
await size(375,667); await motion('reduce')
await toStation1()
const R = await record(CLICK('다음'), 800)
const last = R.at(-1)
t_('reduce: 시트 애니메이션 없음', last.pa==='none', String(last.pa))
t_('reduce: 내용 전환 애니메이션 없음', last.ba==='none', String(last.ba))
t_('reduce: 강조 표시 transition 0s', last.hd==='0s', String(last.hd))
t_('reduce: 내용이 옮겨 다니지 않는다', steps(nums(R,'bx'))<=1, JSON.stringify([...new Set(nums(R,'bx'))]))
t_('reduce: 내용 opacity 가 내내 1', nums(R,'bo').every(v=>v===1), JSON.stringify([...new Set(nums(R,'bo'))]))
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

console.log(`통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail?1:0)
