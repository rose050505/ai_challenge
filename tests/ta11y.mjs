/**
 * 접근성 자동 검사 — 스크린리더가 걸려 넘어질 자리를 화면마다 훑는다.
 *
 * 외부 도구(axe 등)를 넣지 않는다. 새 의존성을 늘리지 않기로 했고,
 * 여기서 보는 것들은 DOM 만으로 판정할 수 있다.
 *
 * 보는 것
 *  - 랜드마크(header/nav/main/footer)가 있는가
 *  - main 안에 h1 이 하나인가, 제목 단계가 건너뛰지 않는가
 *  - 모든 입력에 이름이 있는가 (label / aria-label / aria-labelledby)
 *  - 이름 없는 버튼·링크가 없는가
 *  - aria-controls 가 **실제로 있는 id** 를 가리키는가
 *  - 표의 th 에 scope 가 있는가
 *  - 장식이 아닌 svg 에 이름이 있는가
 *
 * ★ 보이지 않는 것은 세지 않는다.
 *   측정용 숨은 영역(visibility:hidden), display:none, 닫힌 <details> 안,
 *   aria-hidden 안은 스크린리더도 읽지 않는다. 여기서 세면 없는 문제를 만든다.
 */
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t = (await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json()).find((x) => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
await send('Page.enable'); await send('Runtime.enable')
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const t_ = (n, c, extra = '') => { if (c) pass++; else { fail++; console.log('  FAIL ' + n + (extra ? ' — ' + extra : '')) } }

/** 화면마다 내용이 있어야 검사가 의미 있다. 여정을 심어 둔다. */
const J = {
  schemaVersion: 1, updatedAt: '2026-08-30T00:00:00.000Z',
  diagnosis: {
    eventId: 'baseInfoError', counterpartyId: 'CB', institutionSectorId: 'cb', reason: '재취업 6개월차입니다',
    correctionRows: [{ categoryId: 'capacity', current: '연체 이력' }],
    selectedCandidates: [{ 정보명: '재직증명서', 세부내용: '재직 중' }],
  },
  strategy: { source: 'fallback', candidates: [{ 정보명: '재직증명서', 세부내용: '재직 중', 증빙서류: '회사', 선정이유: '' }], picked: [0], notice: '기본 목록입니다' },
  form: { personal: { name: '홍길동', phone: '010-1234-5678', email: 'a@b.kr' } },
  response: {
    interpretation: {
      covered: ['result'], missing: ['criteria', 'baseInfo'],
      baseInfoItems: [{ 항목: '연체 이력', 내용: '2021년 3월', 분류: '신용도판단정보' }],
      refused: false, refusalReasonText: '', excludedByProviso: true, provisoText: '자체 가공 정보는 제외합니다',
    }, errors: [], catOverrides: {},
  },
  milestones: { explanationRequest: { printedAt: '2026-08-20T01:00:00.000Z', submittedAt: '2026-08-20T02:00:00.000Z' } },
}

const seed = async (path) => {
  const { identifier } = (await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try{localStorage.clear();localStorage.setItem('wy-tour-v1','done');
      localStorage.setItem('wae:journey:state', ${JSON.stringify(JSON.stringify(J))})}catch(e){}`,
  })).result
  await send('Page.navigate', { url: BASE + path }); await sleep(2000)
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
}

const AUDIT = `(()=>{
  const vis = el => {
    const r = el.getBoundingClientRect()
    if (!(r.width>0 && r.height>0 && el.offsetParent!==null)) return false
    const cs = getComputedStyle(el)
    if (cs.visibility==='hidden' || cs.display==='none') return false
    if (el.closest('[aria-hidden="true"]')) return false
    // 닫힌 <details> 안은 그려지지 않는다
    for (let d=el.closest('details'); d; d=d.parentElement && d.parentElement.closest('details')) { if (!d.open) return false }
    return true
  }
  const out = {}
  out.landmarks = ['header','nav','main','footer'].filter(t=>document.querySelector(t))
  const hs = [...document.querySelectorAll('main h1,main h2,main h3,main h4,main h5,main h6')].filter(vis)
    .map(e=>({l:Number(e.tagName[1]), t:(e.innerText||'').replace(/\\s+/g,' ').trim()}))
  out.h1 = hs.filter(h=>h.l===1).length
  out.emptyHeadings = hs.filter(h=>!h.t).length
  const skips=[]; let prev=0
  for (const h of hs) { if (prev && h.l>prev+1) skips.push(prev+'→'+h.l+' "'+h.t.slice(0,20)+'"'); prev=h.l }
  out.headingSkips = skips
  const named = el => el.getAttribute('aria-label') || el.getAttribute('aria-labelledby') ||
    (el.id && document.querySelector('label[for="'+CSS.escape(el.id)+'"]')) || el.closest('label')
  out.unlabeled = [...document.querySelectorAll('main input,main select,main textarea')].filter(vis)
    .filter(el=>el.type!=='hidden' && !named(el)).map(el=>el.tagName+'/'+el.type)
  out.nameless = [...document.querySelectorAll('main button, main a')].filter(vis)
    .filter(el=>!((el.innerText||'').trim() || el.getAttribute('aria-label') || el.getAttribute('title')))
    .map(el=>el.tagName+'/'+String(el.className).slice(0,24))
  out.badControls = [...document.querySelectorAll('[aria-controls]')].filter(vis)
    .filter(e=>{const i=e.getAttribute('aria-controls'); return i && !document.getElementById(i)})
    .map(e=>(e.innerText||e.getAttribute('aria-label')||'').replace(/\\s+/g,' ').slice(0,26))
  out.thNoScope = [...document.querySelectorAll('main th')].filter(vis).filter(h=>!h.getAttribute('scope')).length
  out.svgNoName = [...document.querySelectorAll('main svg')].filter(vis)
    .filter(s=>s.getAttribute('aria-hidden')!=='true' && !s.getAttribute('aria-label') && !s.querySelector('title')).length
  out.live = [...document.querySelectorAll('main [aria-live],main [role=status],main [role=alert]')].length
  return JSON.stringify(out)
})()`

const SCREENS = [
  ['랜딩', '/'], ['진단', '/diagnose'], ['전략', '/strategy'],
  ['서식1', '/document?form=explanationRequest'], ['서식2', '/document?form=correctionRequest'],
  ['이후 절차', '/next'], ['회신 해석', '/response'], ['없는 경로', '/nope'],
]

for (const [name, path] of SCREENS) {
  await seed(path)
  const r = JSON.parse(await ev(AUDIT))
  t_(`${name}: 랜드마크 4종`, r.landmarks.length === 4, JSON.stringify(r.landmarks))
  t_(`${name}: main 안에 h1 하나`, r.h1 === 1, `${r.h1}개`)
  t_(`${name}: 제목 단계 건너뜀 없음`, r.headingSkips.length === 0, JSON.stringify(r.headingSkips))
  t_(`${name}: 빈 제목 없음`, r.emptyHeadings === 0, `${r.emptyHeadings}개`)
  t_(`${name}: 이름 없는 입력 없음`, r.unlabeled.length === 0, JSON.stringify(r.unlabeled))
  t_(`${name}: 이름 없는 버튼·링크 없음`, r.nameless.length === 0, JSON.stringify(r.nameless))
  t_(`${name}: aria-controls 대상 존재`, r.badControls.length === 0, JSON.stringify(r.badControls))
  t_(`${name}: th 에 scope`, r.thNoScope === 0, `${r.thNoScope}개`)
  t_(`${name}: 이름 없는 svg 없음`, r.svgNoName === 0, `${r.svgNoName}개`)
}

// 동적으로 바뀌는 영역이 낭독되는가 — 각 화면에 live region 이 있어야 하는 곳
for (const [name, path, need] of [['진단','/diagnose',1], ['전략','/strategy',1], ['회신 해석','/response',1], ['서식1','/document?form=explanationRequest',1]]) {
  await seed(path)
  const r = JSON.parse(await ev(AUDIT))
  t_(`${name}: 상태를 알리는 live 영역 있음`, r.live >= need, `${r.live}개`)
}

console.log(`\n통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail ? 1 : 0)
