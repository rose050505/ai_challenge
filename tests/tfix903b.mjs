/**
 * 2026-09-03 [1] 회귀 재검증 — Document.jsx 의 저장 모델을 건드렸으므로,
 * "손대야 저장한다"가 **저장·복원 경로를 하나도 깨지 않았는지** 확인한다.
 *
 *   · 서식 1 저장 → 새로고침 → 복원
 *   · 서식 2 저장 → 새로고침 → 복원
 *   · 서식 2 여러 벌 추가 · 전환 · 각각 따로 저장
 *   · 두 번째 건(복수 기관) 추가 · 전환 · 따로 저장
 *   · 옛 기록(= `response.manual` 키가 없는 파일) 불러오기
 *   · 회신 해석(캐시 경로) → 서식 2 로 정정 행 주입
 */
const BASE = process.env.APP_URL || 'http://localhost:4400'
const t = (await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json())
  .find((x) => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pend = new Map()
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) }
}
const send = (m, p = {}) =>
  new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
await send('Page.enable')
await send('Runtime.enable')
const ev = async (x) =>
  (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (n, c) => { if (c) { pass++ } else { fail++; console.log('  FAIL', n) } }

const fresh = async (url) => {
  const { identifier } = (await send('Page.addScriptToEvaluateOnNewDocument', {
    source: 'try{localStorage.clear()}catch(e){}',
  })).result
  await send('Page.navigate', { url })
  await sleep(1600)
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
}
/** 저장소에 여정을 심고 그 주소로 간다 (옛 기록 재현용) */
const seed = async (journey, url) => {
  const { identifier } = (await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try{localStorage.clear();localStorage.setItem('wae:journey:state', ${JSON.stringify(JSON.stringify(journey))})}catch(e){}`,
  })).result
  await send('Page.navigate', { url })
  await sleep(1700)
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
}
const go = async (url, ms = 1700) => { await send('Page.navigate', { url }); await sleep(ms) }
const journey = async () => JSON.parse((await ev(`localStorage.getItem('wae:journey:state')`)) || 'null')
const text = async () => await ev('document.body.innerText')
const click = (label) =>
  ev(`(()=>{const b=[...document.querySelectorAll('button,a')].find(x=>x.textContent.includes(${JSON.stringify(label)}));if(!b)return 'NOT_FOUND';b.click();return 'ok'})()`)
const typeSel = (sel, v) =>
  ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)});
    if(!e) return 'NOT_FOUND';
    const proto = e.tagName==='TEXTAREA' ? window.HTMLTextAreaElement.prototype : window.HTMLInputElement.prototype;
    Object.getOwnPropertyDescriptor(proto,'value').set.call(e, ${JSON.stringify(v)});
    e.dispatchEvent(new Event('input',{bubbles:true})); return 'ok'})()`)
const val = (sel) => ev(`document.querySelector(${JSON.stringify(sel)})?.value ?? null`)

/* ── 서식 1 ─────────────────────────────────────────────────── */
console.log('[1] 서식 1 저장 → 새로고침 → 복원')
await fresh(BASE + '/document')
await sleep(1000)
ok('이름 칸이 있다', (await typeSel('input[data-field="name"]', '김서식')) === 'ok')
// 요구 항목을 하나 고른다 (form1.selectedItems)
await ev(`document.querySelector('input[data-field="items"]')?.click()`)
await sleep(2200)
const j1 = await journey()
ok('이름이 저장됐다', j1?.form?.personal?.name === '김서식')
ok('고른 요구 항목이 저장됐다', (j1?.form?.form1?.selectedItems ?? []).length === 1)
await go(BASE + '/document')
ok('새로고침해도 이름이 남는다', (await val('input[data-field="name"]')) === '김서식')
ok('새로고침해도 요구 항목이 남는다', await ev(`document.querySelector('input[data-field="items"]')?.checked === true`))

/* ── 서식 2 ─────────────────────────────────────────────────── */
console.log('[2] 서식 2 저장 → 새로고침 → 복원')
await go(BASE + '/document?form=correctionRequest')
ok('섹션 2 현행 칸에 적는다', (await typeSel('textarea[data-field="row-identity-current"]', '현행값')) === 'ok')
await typeSel('textarea[data-field="row-identity-correction"]', '정정값')
await sleep(2200)
const j2 = await journey()
ok('서식 2 행이 저장됐다', j2?.form?.form2?.rows?.identity?.current === '현행값')
ok('정정 내용도 저장됐다', j2?.form?.form2?.rows?.identity?.correction === '정정값')
await go(BASE + '/document?form=correctionRequest')
ok('새로고침해도 현행값이 남는다', (await val('textarea[data-field="row-identity-current"]')) === '현행값')
ok('탭도 서식 2로 복원된다', (await journey())?.form?.tab === 'correctionRequest')

/* ── 서식 2 여러 벌 ─────────────────────────────────────────── */
console.log('[3] 서식 2 여러 벌 — 추가 · 전환 · 각각 저장')
// 라우팅이 other 여야 여러 벌이 성립한다 (제출처가 "정보가 발생한 그 금융회사")
const withOther = {
  schemaVersion: 1,
  updatedAt: new Date().toISOString(),
  diagnosis: { eventId: 'loanRejected', counterpartyId: 'FI', institutionSectorId: 'bank', routingBranchId: 'other' },
  strategy: {}, form: {}, response: {}, milestones: {},
}
await seed(withOther, BASE + '/document?form=correctionRequest')
ok('여러 벌 전환 패널이 뜬다', (await text()).includes('정정 요청서를 낼 회사'))
await typeSel('input[data-field="recipient"]', '가나은행')
await typeSel('textarea[data-field="row-identity-current"]', '1번 회사 값')
await sleep(2200)
ok('[다른 회사 것도 만들기]', (await click('다른 회사 것도 만들기')) === 'ok')
await sleep(1500)
ok('2번째 건은 빈 칸으로 시작한다', (await val('textarea[data-field="row-identity-current"]')) === '')
await typeSel('input[data-field="recipient"]', '다라은행')
await typeSel('textarea[data-field="row-identity-current"]', '2번 회사 값')
await sleep(2200)
const j3 = await journey()
ok('1번 회사 값이 그대로다', j3?.form?.form2?.rows?.identity?.current === '1번 회사 값')
ok('2번 회사가 따로 저장됐다', j3?.form?.form2Extras?.[0]?.rows?.identity?.current === '2번 회사 값')
ok('수신 기관도 따로 저장됐다', j3?.form?.form2?.recipient === '가나은행' && j3?.form?.form2Extras?.[0]?.recipient === '다라은행')
await go(BASE + '/document?form=correctionRequest')
ok('새로고침하면 보던 건(2번)이 그대로 열린다', (await val('textarea[data-field="row-identity-current"]')) === '2번 회사 값')
ok('1번으로 되돌아갈 수 있다', (await click('가나은행')) === 'ok')
await sleep(1400)
ok('되돌아가면 1번 값이 보인다', (await val('textarea[data-field="row-identity-current"]')) === '1번 회사 값')

/* ── 두 번째 건 (복수 기관 동시 행사) ───────────────────────── */
console.log('[4] 두 번째 건 — 추가 · 전환 · 따로 저장')
await seed(withOther, BASE + '/document')
await typeSel('input[data-field="name"]', '박기본')
await sleep(2200)
ok('[개인신용평가회사용 서식도 만들기]', (await click('용 서식도 만들기')) === 'ok')
await sleep(1600)
const secondTxt = await text()
ok('두 건 전환 단추가 생겼다', secondTxt.includes('추가하신 곳'))
// 두 번째 건에서 요구 항목을 고른다 — 기본 건과 섞이면 안 된다
await ev(`document.querySelector('input[data-field="items"]')?.click()`)
await sleep(2200)
const j4 = await journey()
ok('두 번째 건에 따로 저장됐다', (j4?.form?.second?.form1?.selectedItems ?? []).length === 1)
ok('기본 건의 요구 항목은 그대로다', (j4?.form?.form1?.selectedItems ?? []).length === 0)
ok('성명은 두 건이 함께 쓴다 (같은 사람)', j4?.form?.personal?.name === '박기본')

/* ── 옛 기록 파일 (manual 키가 없는 것) ─────────────────────── */
console.log('[5] 옛 기록 불러오기 — response.manual 이 없던 시절의 파일')
const oldRecord = {
  schemaVersion: 1,
  updatedAt: '2026-08-20T01:00:00.000Z',
  diagnosis: { eventId: 'cardRejected', counterpartyId: 'FI', institutionSectorId: 'creditFinance' },
  strategy: {},
  form: { personal: { name: '옛기록', phone: '', email: '' } },
  // ★ manual 키가 아예 없다
  response: {
    interpretation: {
      covered: ['result'],
      missing: ['criteria', 'baseInfo'],
      baseInfoItems: [{ 항목: '연체 이력', 내용: '2021년 3건', 분류: '신용도 판단정보' }],
      refused: false,
      refusalReasonText: '',
      excludedByProviso: false,
      provisoText: '',
    },
    errors: [0],
    catOverrides: {},
  },
  milestones: {},
}
await seed(oldRecord, BASE + '/response')
const restored = await text()
ok('옛 해석 결과가 열린다', restored.includes('이전에 해석한 결과를 불러왔습니다'))
ok('옛 항목이 보인다', restored.includes('연체 이력'))
ok('옛 체크(errors)가 살아 있다', await ev(`(()=>{const li=[...document.querySelectorAll('li')].filter(x=>x.textContent.includes('사실과 다'));return li.length===1 && li[0].querySelector('input[type=checkbox]').checked})()`))
await go(BASE + '/document')
ok('옛 기록의 이름도 서식에 들어온다', (await val('input[data-field="name"]')) === '옛기록')
// 한 번이라도 저장하면 새 모양(manual: null)으로 정규화돼 다시 쓰인다
await typeSel('input[data-field="name"]', '옛기록2')
await sleep(2200)
ok('다시 저장하면 manual: null 로 정규화된다', (await journey())?.response?.manual === null)
ok('옛 해석 결과는 그대로 남는다', (await journey())?.response?.interpretation?.covered?.[0] === 'result')

/* ── 회신 해석 → 서식 2 (캐시 경로) ─────────────────────────── */
console.log('[6] 회신 해석(샘플 캐시) → 서식 2 정정 행 주입')
await fresh(BASE + '/response?sample=partial&run=1')
await sleep(3000)
ok('샘플 해석이 끝났다', (await text()).includes('무엇을 받았나요'))
const marked = await ev(`(()=>{const li=[...document.querySelectorAll('li')].filter(x=>x.textContent.includes('이 정보가 사실과 다릅니다'));if(li.length===0)return 0;li[0].querySelector('input[type=checkbox]').click();return li.length})()`)
ok('기초정보 항목이 있다', marked > 0)
await sleep(900)
const claim = ((await text()).match(/사실과 다르다고 표시한 (\d+)건이 서식 2/) || [])[1]
ok('화면이 1건이라고 말한다', claim === '1')
ok('[서식 2 만들기]', (await click('서식 2 만들기')) === 'ok')
await sleep(2400)
const moved = JSON.parse(
  await ev(`JSON.stringify([...document.querySelectorAll('textarea[data-field$="-current"]')].map(t=>t.value).filter(Boolean))`),
)
ok('말한 만큼(1건) 실제로 넘어왔다', moved.length === 1)
ok('넘어온 뒤 저장된다', (await journey())?.form?.form2?.rows != null)

console.log('────────────────────────')
console.log(`통과 ${pass} / 실패 ${fail}`)
ws.close()
process.exit(fail === 0 ? 0 : 1)
