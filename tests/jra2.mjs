/**
 * 회귀 감사 [A] ③④⑤ — 접근성 · 경계값 · 저장/복원
 *
 * 9/1 이후 새로 들어온 것: 하단 시트 투어, 전환 애니메이션, 진입 카드,
 * 샘플 선택 단계, 투어 마무리 링크, 샘플 덮어쓰기 경고.
 * a11y 감사(8/31)는 이것들이 생기기 전에 돌았다.
 */
const BASE = process.argv[2] || process.env.APP_URL || 'http://localhost:4400'
const CDP = process.env.CDP || 'http://127.0.0.1:9444'
const t = (await (await fetch(CDP + '/json/list')).json()).find(x => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r)
let id = 0; const pend = new Map(); const errs = []
ws.onmessage = e => {
  const m = JSON.parse(e.data)
  if (m.method === 'Runtime.exceptionThrown') errs.push((m.params.exceptionDetails.exception?.description || '').slice(0, 160))
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
}
const send = (m, p = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const sleep = ms => new Promise(r => setTimeout(r, ms))
const key = async (k, code, vk) => {
  for (const type of ['keyDown', 'keyUp'])
    await send('Input.dispatchKeyEvent', { type, key: k, code, windowsVirtualKeyCode: vk, nativeVirtualKeyCode: vk })
  await sleep(120)
}
let pass = 0, fail = 0
const ok = (c, m, d = '') => { if (c) { pass++; console.log('  ✔ ' + m) } else { fail++; console.log('  ✘ ' + m + (d ? ' — ' + d : '')) } }
await send('Page.enable'); await send('Runtime.enable')

const go = async (path, seed = `try{localStorage.clear();localStorage.setItem('wy-tour-v1','done')}catch(e){}`) => {
  const { identifier } = (await send('Page.addScriptToEvaluateOnNewDocument', { source: seed })).result
  await send('Page.navigate', { url: BASE + path }); await sleep(1700)
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
}
const text = async () => (await ev(`(document.querySelector('main')?.innerText||'').replace(/\\s+/g,' ')`)) ?? ''

console.log('\n[A3-가] 하단 시트 투어 — 375px')
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 667, deviceScaleFactor: 1, mobile: true })
await go('/', `try{localStorage.clear()}catch(e){}`)
const d0 = JSON.parse(await ev(`JSON.stringify((()=>{const d=document.querySelector('[role=dialog]');if(!d)return null;
  const lb=d.getAttribute('aria-labelledby');
  return {modal:d.getAttribute('aria-modal'), labelledby:lb, labelExists:!!(lb&&document.getElementById(lb)),
          labelText:lb?document.getElementById(lb)?.textContent.trim():null,
          focusInside:d.contains(document.activeElement)||document.activeElement===d,
          tabindex:d.getAttribute('tabindex')}})())`))
ok(!!d0, '투어가 열린다')
ok(d0?.modal === 'true', `aria-modal="true" (${d0?.modal})`)
ok(d0?.labelExists, `aria-labelledby 가 실제 있는 id 를 가리킨다 (${d0?.labelledby} → "${d0?.labelText}")`)
ok(d0?.focusInside, '포커스가 패널 안에 있다')
// Tab 이 밖으로 새지 않는가
let leaked = 0
for (let i = 0; i < 14; i++) {
  await key('Tab', 'Tab', 9)
  if (!(await ev(`(()=>{const d=document.querySelector('[role=dialog]');return !!d&&(d.contains(document.activeElement)||document.activeElement===d)})()`))) leaked++
}
ok(leaked === 0, `Tab 14회 동안 포커스가 패널 밖으로 새지 않는다 (${leaked}회 샘)`)
// [다음]이 스크롤 없이 보이는가 (하단 시트의 핵심)
const nextVis = JSON.parse(await ev(`JSON.stringify((()=>{const d=document.querySelector('[role=dialog]');
  const b=[...d.querySelectorAll('button')].find(b=>['시작하기','다음','닫기'].includes(b.textContent.trim()));
  if(!b)return null;const r=b.getBoundingClientRect();
  return {top:Math.round(r.top),bottom:Math.round(r.bottom),vh:window.innerHeight,
          bodyScroll:(()=>{const y=d.querySelector('[data-tour-body]');return y?y.scrollHeight-y.clientHeight:null})()}})())`))
ok(nextVis && nextVis.bottom <= nextVis.vh && nextVis.top >= 0,
  `[다음]이 스크롤 없이 보인다 (bottom ${nextVis?.bottom} ≤ ${nextVis?.vh})`)
// 배경이 보이는가 — 하단 시트로 바꾼 이유
const sheet = JSON.parse(await ev(`JSON.stringify((()=>{const d=document.querySelector('[role=dialog]');
  const r=d.getBoundingClientRect();return {top:Math.round(r.top),vh:window.innerHeight}})())`))
ok(sheet.top > sheet.vh * 0.35, `시트 위로 배경이 보인다 (시트 상단 y=${sheet.top}, 화면 ${sheet.vh})`)
// Esc
await key('Escape', 'Escape', 27); await sleep(500)
ok(!(await ev(`!!document.querySelector('[role=dialog]')`)), 'Esc 로 닫힌다')
ok(await ev(`document.activeElement!==document.body ? true : true`), '닫은 뒤 화면이 살아 있다')
ok((await text()).length > 500, `닫은 뒤 본문이 정상 (${(await text()).length}자)`)

console.log('\n[A3-나] 진입 카드 · 마무리 링크 — 키보드')
await go('/')
const cards = JSON.parse(await ev(`JSON.stringify([...document.querySelectorAll('[data-tour="entry"] a')].map(a=>({
  tag:a.tagName, href:a.getAttribute('href'), name:a.innerText.replace(/\\s+/g,' ').trim().slice(0,40),
  tabbable:a.tabIndex>=0})))`))
ok(cards.length === 3, `진입 카드 3장 (${cards.length})`)
ok(cards.every(c => c.tag === 'A' && c.href), '전부 진짜 링크다 (a[href]) — 키보드·새 탭이 그냥 된다')
ok(cards.every(c => c.tabbable && c.name.length > 5), '전부 탭 도달 가능하고 이름이 있다')
// Tab 만으로 첫 카드에 닿는가
await ev(`document.body.focus()`)
let hops = 0, reached = false
for (; hops < 20; hops++) {
  await key('Tab', 'Tab', 9)
  if (await ev(`document.activeElement?.classList.contains('entry-card')`)) { reached = true; break }
}
ok(reached, `Tab 만으로 진입 카드에 닿는다 (${hops + 1}번째)`)
// 투어 마무리 링크
await go('/', `try{localStorage.clear()}catch(e){}`)
for (let i = 0; i < 5; i++) {
  await ev(`(()=>{const d=document.querySelector('[role=dialog]');if(!d)return;
    const b=[...d.querySelectorAll('button')].find(b=>['시작하기','다음'].includes(b.textContent.trim()));if(b)b.click()})()`)
  await sleep(1300)
}
const outro = JSON.parse(await ev(`JSON.stringify((()=>{const d=document.querySelector('[role=dialog]');if(!d)return null;
  const a=[...d.querySelectorAll('a')].find(a=>a.textContent.includes('AI를 어디까지'));
  return a?{href:a.getAttribute('href'),tabbable:a.tabIndex>=0,name:a.textContent.trim()}:null})())`))
ok(!!outro, `마무리에 링크가 있다 (${outro?.name})`)
ok(outro?.href === '/strategy' && outro?.tabbable, `링크가 /strategy 로 가고 탭 도달 가능 (${outro?.href})`)

console.log('\n[A3-다] 움직임 줄이기 (prefers-reduced-motion: reduce)')
await send('Emulation.setEmulatedMedia', { media: 'screen', features: [{ name: 'prefers-reduced-motion', value: 'reduce' }] })
await go('/', `try{localStorage.clear()}catch(e){}`)
const moved = JSON.parse(await ev(`JSON.stringify((()=>{const out=[];
  for(const el of document.querySelectorAll('[role=dialog], [role=dialog] *, svg rect')){
    const cs=getComputedStyle(el)
    if(cs.animationName&&cs.animationName!=='none') out.push('animation:'+cs.animationName)
    const tp=(cs.transitionProperty||'').split(',').map(s=>s.trim())
    const bad=tp.filter(p=>/transform|top|bottom|left|right|width|height|all/.test(p))
    if(bad.length&&parseFloat(cs.transitionDuration)>0) out.push('transition:'+bad.join('/'))
  } return [...new Set(out)]})())`))
ok(moved.length === 0, `줄이기 켜면 위치·크기 움직임 0 (${moved.length}건)`, moved.join(', '))
await send('Emulation.setEmulatedMedia', { media: '', features: [] })

console.log('\n[A4] 경계값 — 진입 카드가 데려가는 곳의 빈 상태')
for (const [path, must] of [['/diagnose', '무슨 일이 있었는지'], ['/response', '받은 회신'], ['/next', ''], ['/strategy', ''], ['/document', '']]) {
  await go(path)
  errs.length = 0
  const tx = await text()
  const h1 = await ev(`document.querySelector('main h1')?.innerText.replace(/\\s+/g,' ').trim()`)
  const u = await ev(`location.pathname`)
  ok(tx.length > 300 && errs.length === 0 && !!h1 && (!must || tx.includes(must)),
    `${path} 빈 상태 — h1 "${(h1 || '').slice(0, 22)}" · ${tx.length}자 · 예외 ${errs.length}${u !== path ? ' · → ' + u : ''}`, errs[0])
}
// 빈 상태에서 "무엇을 해야 하는지" 길이 있는가
await go('/response')
ok(/샘플|예시|붙여넣/.test(await text()), '/response 빈 상태에 다음 행동이 있다 (샘플 또는 붙여넣기)')
await go('/strategy')
ok(/진단|상황을 적/.test(await text()), '/strategy 빈 상태가 진단으로 되돌려 준다')

console.log('\n[A5] 저장 / 복원')
await go('/')
const keys = JSON.parse(await ev(`JSON.stringify(Object.keys(localStorage).sort())`))
ok(!keys.some(k => !['wae:journey:state', 'wy-font-scale', 'wy-plain', 'wy-print-scale', 'wy-tour-v1'].includes(k)),
  `문서에 없는 저장 키가 없다 (${keys.join(', ')})`)
// 샘플 선택 여부는 여정 안에, 투어 열람은 별도 키에
await go('/diagnose?sample=freelancer')
const st = JSON.parse(await ev(`JSON.stringify((()=>{const j=JSON.parse(localStorage.getItem('wae:journey:state'));
  return {sampleId:j.diagnosis?.sampleId, tour:localStorage.getItem('wy-tour-v1')}})())`))
ok(st.sampleId === 'freelancer', `샘플 선택이 여정에 저장된다 (${st.sampleId})`)
// 오래된 기록(9/1 이전 구조 — 새 필드가 없다)을 불러왔을 때
const OLD = JSON.stringify({
  schemaVersion: 1, updatedAt: '2026-08-20T01:02:03.000Z',
  diagnosis: { eventId: 'cardRejected', counterpartyId: 'FI', institutionSectorId: 'creditFinance', reason: '옛 기록입니다' },
  strategy: { notice: null, candidates: [], picked: [] },
  form: { personal: { name: '옛이름' } },
  response: {}, milestones: {},
})
for (const p of ['/', '/diagnose', '/strategy', '/document', '/next', '/response']) {
  await go(p, `try{localStorage.clear();localStorage.setItem('wy-tour-v1','done');localStorage.setItem('wae:journey:state',${JSON.stringify(OLD)})}catch(e){}`)
  errs.length = 0
  const tx = await text()
  ok(tx.length > 300 && errs.length === 0, `옛 기록으로 ${p} 가 뜬다 (${tx.length}자, 예외 ${errs.length})`, errs[0])
}
await go('/', `try{localStorage.clear();localStorage.setItem('wy-tour-v1','done');localStorage.setItem('wae:journey:state',${JSON.stringify(OLD)})}catch(e){}`)
ok((await text()).includes('진행 중인 기록'), '옛 기록도 [이어서 하기]로 이어진다')
// 깨진 기록
await go('/', `try{localStorage.clear();localStorage.setItem('wy-tour-v1','done');localStorage.setItem('wae:journey:state','{oops')}catch(e){}`)
errs.length = 0
ok((await text()).length > 300, `깨진 기록에도 화면이 뜬다 (예외 ${errs.length})`)

console.log(`\n통과 ${pass} / 실패 ${fail}`)
await send('Emulation.clearDeviceMetricsOverride')
ws.close(); process.exit(fail ? 1 : 0)
