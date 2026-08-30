/**
 * 인쇄물 값 잘림 회귀 — **PDF 에서 글자를 뽑아 입력값과 글자 수로 대조한다.**
 *
 * ★ 왜 눈으로 보지 않는가.
 *   2026-08-30 적대적 감사에서, 화면은 "1페이지로 출력됩니다"라고 말하는데
 *   실제 인쇄물에서는 띄어쓰기 없는 한글 200자 중 163자만 나온 일이 있었다.
 *   표가 종이 밖으로 밀려 나가고, 밖으로 나간 부분이 그냥 사라진 것이다.
 *   보이는 것으로는 잡을 수 없다. 그래서 뽑아서 센다.
 *
 * ★ 왜 "문자열이 통째로 들어 있는가"로 보지 않는가.
 *   표는 칸이 옆으로 나란히 있다. pdftotext 는 같은 줄의 여러 칸을 이어 붙이므로,
 *   여러 줄로 접힌 긴 값은 **옆 칸 글자에 의해 중간이 끊긴다.** 잘리지 않았는데도
 *   "빠졌다"고 나온다. 그래서 **글자 수**로 센다.
 *
 * 방법 — 빈 상태를 먼저 재고 뺀다(기준선 빼기)
 *   1. 값 칸을 전부 비운 채 인쇄해 그 글자들이 원래 몇 개인지 센다 (서식 고정 문구에도
 *      같은 글자가 들어 있으므로).
 *   2. 값 칸을 **칸마다 길이가 다른** 문자열로 채우고 다시 인쇄해 센다.
 *   3. 늘어난 글자 수 = 넣은 글자 수여야 한다. 한 글자라도 모자라면 잘린 것이다.
 *   4. 쪽 수 예고 = 실제도 함께 본다.
 *
 * 준비물: pdftotext (poppler-utils), pdfinfo. 없으면 건너뛴다.
 */
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'

const OUT = new URL('./out/', import.meta.url).pathname
fs.mkdirSync(OUT, { recursive: true })
const BASE = process.env.APP_URL || 'http://localhost:4400'
const CDP = process.env.CDP || 'http://127.0.0.1:9444'

const have = (bin) => { try { execFileSync('which', [bin], { stdio: 'ignore' }); return true } catch { return false } }
if (!have('pdftotext') || !have('pdfinfo')) {
  console.log('pdftotext/pdfinfo 가 없어 건너뛴다 (poppler-utils 를 설치하면 돈다)')
  console.log('통과 0 / 실패 0')
  process.exit(0)
}

const t = (await (await fetch(CDP + '/json/list')).json()).find((x) => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise((r) => (ws.onopen = r))
let id = 0; const pend = new Map()
ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p = {}) => new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
await send('Page.enable'); await send('Runtime.enable')
const ev = async (x) => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
let pass = 0, fail = 0
const t_ = (n, c, extra = '') => { if (c) { pass++; console.log('  ok   ' + n) } else { fail++; console.log('  FAIL ' + n + (extra ? ' — ' + extra : '')) } }

/**
 * 값 칸에 넣을 문자열 5종. 전부 **띄어쓰기가 없는 한 덩어리**다.
 * 이 서비스에서 잘림이 나는 조건이 정확히 그것이다.
 */
const KINDS = {
  한글500: { unit: '가나다라마바사아자차카타파하', len: 500 },
  영문300: { unit: 'Xy', len: 300 },
  URL150: { unit: 'https://example.co.kr/queryparam', len: 150 },
  혼합300: { unit: '가Q나W', len: 300 },
  숫자200: { unit: '7', len: 200 },
}
const make = (k, len) => KINDS[k].unit.repeat(Math.ceil(len / KINDS[k].unit.length)).slice(0, len)

/** 여정을 심어 서식 2의 표에 내용이 있게 한다 (섹션이 비어 있으면 값 칸이 없다) */
const JOURNEY = {
  schemaVersion: 1,
  updatedAt: '2026-08-30T00:00:00.000Z',
  diagnosis: {
    eventId: 'baseInfoError', counterpartyId: 'CB', institutionSectorId: 'cb',
    correctionRows: [{ categoryId: 'capacity', current: '연체 이력' }, { categoryId: 'quality', current: '카드 사용액' }],
    selectedCandidates: [{ 정보명: '재직증명서', 세부내용: '재직 중' }],
  },
  strategy: {}, form: {}, response: {}, milestones: {},
}

const SEL = '.print-sheet input:not([type=checkbox]):not([type=date])'

const setup = async (formId, scale) => {
  const { identifier } = (await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try{localStorage.clear();localStorage.setItem('wy-tour-v1','done');
      localStorage.setItem('wy-print-scale',${JSON.stringify(scale)});
      localStorage.setItem('wae:journey:state', ${JSON.stringify(JSON.stringify(JOURNEY))})}catch(e){}`,
  })).result
  await send('Page.navigate', { url: `${BASE}/document?form=${formId}` })
  await sleep(1800)
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
}

/** 값 칸을 하나씩 채운다. 한 번에 몰아 넣으면 재렌더 사이에 유실된다. */
const fillAll = async (kind) => {
  const n = await ev(`document.querySelectorAll(${JSON.stringify(SEL)}).length`)
  let total = 0
  for (let i = 0; i < n; i++) {
    // 칸마다 길이를 다르게 준다. 한 칸만 잘려도 합계가 어긋나게.
    const v = make(kind, KINDS[kind].len + i)
    total += v.length
    await ev(`(()=>{const set=Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype,'value').set;
      const el=document.querySelectorAll(${JSON.stringify(SEL)})[${i}];
      if(!el) return false; set.call(el, ${JSON.stringify(v)}); el.dispatchEvent(new Event('input',{bubbles:true})); return true})()`)
    await sleep(90)
  }
  await sleep(1200)
  return { n, total }
}

const predicted = async () => Number(
  await ev(`(()=>{const p=[...document.querySelectorAll('[role=status]')].map(e=>e.innerText).find(t=>t&&t.includes('페이지로 출력'));
    return p? (p.match(/(\\d+)페이지/)?.[1] ?? '0') : '0'})()`))

/** 화면이 "실제로는 더 나올 수 있다"고 밝히고 있는가 (한 행이 한 쪽보다 클 때) */
const warnsOversize = async () =>
  Boolean(await ev(`document.querySelector('main').innerText.includes('실제로는 이보다 더 나올 수 있습니다')`))

/** 인쇄해서 (쪽 수, 글자 종류별 개수) 를 돌려준다 */
const printAndCount = async (name, alphabet) => {
  const r = await send('Page.printToPDF', { printBackground: false, preferCSSPageSize: true })
  const file = OUT + name
  fs.writeFileSync(file, Buffer.from(r.result.data, 'base64'))
  const pages = Number(String(execFileSync('pdfinfo', [file])).match(/Pages:\s+(\d+)/)?.[1] ?? 0)
  const text = String(execFileSync('pdftotext', [file, '-'])).replace(/\s+/g, '')
  const counts = new Map()
  for (const ch of text) if (alphabet.has(ch)) counts.set(ch, (counts.get(ch) ?? 0) + 1)
  let sum = 0
  for (const v of counts.values()) sum += v
  return { pages, sum }
}

const FORMS = [['explanationRequest', '서식1'], ['correctionRequest', '서식2']]
const SCALES = [['base', '기본'], ['lg', '큰글씨']]

for (const [formId, formName] of FORMS) {
  for (const [scale, scaleName] of SCALES) {
    for (const kind of Object.keys(KINDS)) {
      const alphabet = new Set(KINDS[kind].unit)
      const tag = `${formName}/${scaleName}/${kind}`

      // 1) 빈 상태의 기준선
      await setup(formId, scale)
      const empty = await printAndCount(`long-${formName}-${scaleName}-${kind}-empty.pdf`, alphabet)

      // 2) 채운 뒤
      const { n, total } = await fillAll(kind)
      if (n === 0) { console.log(`  (건너뜀) ${tag}: 값 칸 없음`); continue }
      const pred = await predicted()
      const filled = await printAndCount(`long-${formName}-${scaleName}-${kind}.pdf`, alphabet)

      const delta = filled.sum - empty.sum
      /**
       * ★ 같거나 많아야 한다. 적으면 잘린 것이다.
       *   많은 것은 정상이다 — 서식 1의 신청인 성명은 인적사항 칸과 서명란에 두 번 나오고,
       *   서식 2는 둘째 장부터 반복 머리에 성명이 다시 들어간다.
       */
      t_(`${tag}: ${n}칸 ${total}자 전부 인쇄 (실제 +${delta}자)`, delta >= total,
        `${total - delta}자 모자람`)
      /**
       * ★ 어긋나도 되는 경우가 하나 있다. 표의 행 하나가 한 쪽보다 크면 쪼갤 수 없어
       *   브라우저가 알아서 넘긴다. 그때는 **화면이 그렇다고 밝혀야** 통과다.
       *   숫자를 맞히지 못하는 것보다, 못 맞힌다는 것을 숨기는 쪽이 나쁘다.
       */
      const warned = await warnsOversize()
      t_(
        `${tag}: 예고 ${pred} / 실제 ${filled.pages}${warned ? ' (더 나올 수 있음을 화면이 밝힘)' : ''}`,
        pred > 0 && (pred === filled.pages || (warned && pred <= filled.pages)),
      )
    }
  }
}

console.log(`\n통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail ? 1 : 0)
