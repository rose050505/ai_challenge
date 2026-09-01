/**
 * 심사 당일 [2] — 5분 체험 재측정.
 *
 * self-review 의 원래 진단: "5분 체험으로는 서식 생성기로 읽힌다."
 * 그 뒤로 투어·진입 카드·선정이유가 들어갔다. 다시 잰다.
 *
 * ★ 재는 방식
 *   시간을 초 단위로 지어내지 않는다. 경로를 실제로 걸으면서
 *     (1) 어느 화면에 닿는가
 *     (2) 그 화면에 우리 차별점 다섯 중 무엇이 **눈에 보이는가**
 *     (3) 거기까지 클릭 몇 번, 읽을 글자 몇 자인가
 *   를 재고, 시간은 [클릭 2초 + 훑어읽기 900자/분]이라는 **밝힌 환산식**으로 낸다.
 *
 * 차별점 다섯 (사용자 지정)
 *   전 주기 / 근거 조문 / 거절 vs 법정 제외 / 서버 검산 / 확인 못 한 것을 비움
 */
const BASE = process.argv[2] || process.env.APP_URL || 'http://localhost:4400'
const CDP = process.env.CDP || 'http://127.0.0.1:9444'
const t = (await (await fetch(CDP + '/json/list')).json()).find(x => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r)
let id = 0; const pend = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const sleep = ms => new Promise(r => setTimeout(r, ms))
await send('Page.enable'); await send('Runtime.enable')

/** 화면에 실제로 보이는 글(모달이 떠 있으면 모달 글) */
/**
 * 화면에 실제로 보이는 글.
 * ★ 투어가 열려 있으면 **모달 글 + 그 정거장이 비추고 있는 부분**을 함께 본다.
 *   투어의 요지는 모달 글이 아니라 "화면의 이 부분을 보세요"이기 때문이다.
 *   모달 글만 세면 투어가 아무것도 전달하지 않는 것처럼 나온다.
 */
const seen = async () => await ev(`(()=>{
  const d=document.querySelector('[role="dialog"]')
  const m=document.querySelector('main')
  const lit=[...document.querySelectorAll('[data-tour]')]
    .filter(e=>e.getBoundingClientRect().width>0)
    .map(e=>e.innerText.replace(/\\s+/g,' ').trim()).join(' ')
  return { dialog: d?d.innerText.replace(/\\s+/g,' ').trim():null,
           lit,
           main: m?m.innerText.replace(/\\s+/g,' ').trim():'' }
})()`)

const MARKS = {
  '전 주기': t => /한 바퀴가 닫힙니다|전 주기/.test(t),
  '근거 조문': t => /근거\s*(법|시행령|고시|신용정보)/.test(t),
  /* 화면은 "법정 제외"라는 말을 쓰지 않는다. 사용자 말로 쓴다 — 그 문장을 찾는다. */
  '거절 vs 법정 제외': t => /거절한 것이 아닙니다|제외를 허용한 범위/.test(t),
  '서버 검산': t => /서버 검산|인용을 대조|법의 구조에 비추어/.test(t),
  '확인 못 한 것을 비움': t => /대조하지 못했|확인하지 못했|출력 후 직접 기재/.test(t),
}

let clicks = 0, chars = 0
const stops = []
/** ★ 이미 읽은 문단은 다시 세지 않는다. 같은 화면을 여섯 번 세면 시간이 부풀어 거짓이 된다. */
const readBefore = new Set()
const newChars = (t) => {
  let n = 0
  for (const line of t.split(/(?<=[.。!?])\s+|\s{2,}/)) {
    const k = line.trim()
    if (!k || readBefore.has(k)) continue
    readBefore.add(k); n += k.length
  }
  return n
}
const stop = async (label) => {
  const s = await seen()
  const t = (s.dialog ? s.dialog + ' ' : '') + s.main
  const shown = s.dialog ? (s.dialog + ' ' + s.lit) : s.main
  const fresh_ = newChars(shown)
  chars += fresh_
  const hit = Object.entries(MARKS).filter(([, f]) => f(shown)).map(([k]) => k)
  stops.push({ label, url: await ev(`location.pathname+location.search`), modal: !!s.dialog, chars: fresh_, hit })
  const u = stops[stops.length - 1].url
  console.log(`  ${String(stops.length).padStart(2)}. ${label.padEnd(26)} ${s.dialog ? '[모달]' : '      '} ${u.slice(0, 18).padEnd(18)} 새 글 ${String(fresh_).padStart(5)}자  ${hit.join(' · ') || '—'}`)
}
const click = async (txt) => {
  const ok = await ev(`(()=>{const d=document.querySelector('[role="dialog"]');
    const scope=d||document;
    const e=[...scope.querySelectorAll('button,a')].find(e=>e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(txt)})&&e.offsetParent!==null);
    if(e){e.click();return true} return false})()`)
  clicks++
  await sleep(1400)
  return ok
}

/**
 * 완전한 첫 방문.
 * ★ localStorage.clear() 만으로는 안 된다 — 앱이 pagehide 에서 여정을 **다시 써서**
 *   진행 기록이 남고, 그러면 투어가 저절로 열리지 않는다(shouldAutoOpen).
 *   주입으로 비운 상태를 만든다.
 */
const fresh = async (w, h) => {
  await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: w < 500 })
  const { identifier } = (await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try{localStorage.clear()}catch(e){}`,
  })).result
  await send('Page.navigate', { url: BASE + '/?fresh=' + Date.now() }); await sleep(2000)
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
  clicks = 0; chars = 0; stops.length = 0; readBefore.clear()
}

const report = (name) => {
  const union = new Set(stops.flatMap(s => s.hit))
  const secs = clicks * 2 + Math.round(chars / 900 * 60)
  /* ★ 5분 시점에 어디까지 갔는가. 이게 이 감사의 답이다. */
  let acc = 0, at5 = [], reached = 0
  for (const st of stops) {
    acc += 2 + st.chars / 900 * 60
    if (acc > 300) break
    reached++; at5.push(...st.hit)
  }
  const five = new Set(at5)
  console.log(`  → ★ 5분(300초) 시점: 정거장 ${reached}/${stops.length} 까지 — ${stops[Math.max(0, reached - 1)]?.label ?? '—'}`)
  console.log(`  → ★ 5분 안에 전달: ${[...five].join(' · ') || '없음'}  (${five.size}/5)`)
  console.log(`\n  → 정거장 ${stops.length} · 클릭 ${clicks} · 읽을 글자 ${chars}자`)
  console.log(`  → 환산 시간 ≈ ${Math.floor(secs / 60)}분 ${secs % 60}초  (클릭 2초 + 900자/분)`)
  console.log(`  → 5분 안에 전달되는 차별점: ${[...union].join(' · ') || '없음'}`)
  console.log(`  → 전달 안 되는 것: ${Object.keys(MARKS).filter(k => !union.has(k)).join(' · ') || '없음'}`)
  return { name, stops: stops.length, clicks, chars, secs, got: [...union],
           five: [...five], fiveMissed: Object.keys(MARKS).filter(k => !five.has(k)), reached,
           missed: Object.keys(MARKS).filter(k => !union.has(k)) }
}

const results = []
for (const [w, h] of [[375, 667], [1280, 900]]) {
  // ── 가. 투어를 본 사람 ─────────────────────────────────────
  console.log(`\n══ ${w}px · 투어를 본 사람 ══`)
  await fresh(w, h)
  await stop('랜딩 (투어가 저절로 열림)')
  await click('시작하기')
  await stop('정거장 1')
  await click('다음')
  await stop('정거장 2')
  await click('다음')
  await stop('정거장 3')
  await click('다음')
  await stop('마무리')
  /* 마무리에 열어 둔 길을 따라간다 — 심사위원이 누를 법한 마지막 한 번 */
  const took = await click('AI를 어디까지 쓰는지 보기')
  await stop(took ? '마무리 링크 → /strategy' : '투어를 닫은 뒤 (닿은 화면)')
  if (!took) { await click('닫기'); await stop('투어를 닫은 뒤 (닿은 화면)') }
  results.push(report(`${w}px 투어 봄`))

  // ── 나. 투어를 건너뛴 사람 ────────────────────────────────
  console.log(`\n══ ${w}px · 투어를 건너뛴 사람 ══`)
  await fresh(w, h)
  await click('건너뛰기')
  await stop('랜딩')
  await click('대출·카드 거절, 한도 축소, 금리 인상을 겪었습니다')
  await stop('/diagnose')
  // 진단을 실제로 채운다 — 심사위원이 고를 법한 최단 조합
  await click('신용대출이 거절됐다')
  await click('금융회사')
  await ev(`(()=>{const s=document.querySelector('main select');if(!s)return false;
    const set=Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype,'value').set;
    set.call(s,[...s.options].find(o=>/은행/.test(o.textContent))?.value ?? s.options[1].value);
    s.dispatchEvent(new Event('change',{bubbles:true}));return true})()`)
  clicks++
  await sleep(1500)
  await stop('진단 결과')
  /* ★ 화면이 먼저 권하는 길을 따라간다. 진단 결과의 "바로 이어서 하시려면" 은
     [제출할 정보 정하기] 를 앞에 둔다 — 심사위원도 그 순서로 읽는다. */
  await click('제출할 정보 정하기')
  await stop('/strategy')
  await click('제출할 정보 후보 만들기')
  await stop('/strategy 후보 목록')
  await click('서식에 넣기')
  await stop('/document')
  await click('이후 절차 보기')
  await stop('/next')
  results.push(report(`${w}px 투어 건너뜀`))
}
await send('Emulation.clearDeviceMetricsOverride')
console.log('\n────────────────────────')
for (const r of results) {
  console.log(`  ${r.name.padEnd(18)} 전체 ${Math.floor(r.secs / 60)}분 ${r.secs % 60}초 · 정거장 ${r.stops}`)
  console.log(`  ${''.padEnd(18)} ★ 5분 안: 정거장 ${r.reached}/${r.stops} · 전달 ${r.five.length}/5 (${r.five.join(', ') || '없음'})`)
  console.log(`  ${''.padEnd(18)}   5분 안에 못 전달: ${r.fiveMissed.join(', ') || '없음'}`)
}
ws.close()
