/**
 * [B] 제출 문서의 주장 ↔ 화면이 실제로 하는 것.
 *
 * 심사위원은 **문서를 읽고 URL 을 여는 사람**이다. 문서가 화면에 없는 것을
 * 주장하고 있으면 그 자리에서 신뢰가 무너진다.
 * `docs/submission-facts.md` 의 사실 주장을 하나씩 **배포본에서** 확인한다.
 * 코드를 읽는 것으로 대신하지 않는다 — 화면에 글자로 있는지를 본다.
 */
const BASE = process.argv[2] || process.env.APP_URL || 'https://362.parkmiyeong.com'
const CDP = process.env.CDP || 'http://127.0.0.1:9444'
const t = (await (await fetch(CDP + '/json/list')).json()).find(x => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r)
let id = 0; const pend = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const sleep = ms => new Promise(r => setTimeout(r, ms))
const fs = await import('node:fs')
await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })

const WIPE = `try{localStorage.clear();localStorage.setItem('wy-tour-v1','done')}catch(e){}`
const go = async (path, seed = WIPE) => {
  const { identifier } = (await send('Page.addScriptToEvaluateOnNewDocument', { source: seed })).result
  await send('Page.navigate', { url: BASE + path }); await sleep(1800)
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
  for (let i = 0; i < 3; i++) {
    await ev(`(()=>{document.querySelectorAll('details').forEach(d=>d.open=true);
      document.querySelectorAll('button[aria-expanded=false]').forEach(b=>b.click())})()`)
    await sleep(500)
  }
}
const click = async txt => { const r = await ev(`(()=>{const e=[...document.querySelectorAll('button,a')].reverse().find(e=>e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(e){e.click();return true}return false})()`); await sleep(1400); return r }
const grab = async () => {
  const body = await ev(`document.body.innerText.replace(/[ \\t]+/g,' ')`)
  const vals = await ev(`JSON.stringify([...document.querySelectorAll('input,textarea')].map(e=>e.value).filter(Boolean))`)
  const labels = await ev(`JSON.stringify([...document.querySelectorAll('input,textarea,select')].map(e=>e.getAttribute('aria-label')||e.getAttribute('placeholder')||'').filter(Boolean))`)
  return (body || '') + '\n<<INPUT-VALUES>> ' + vals + '\n<<INPUT-LABELS>> ' + labels
}

const SCREENS = {}
console.log('화면을 모으는 중…')
await go('/'); SCREENS['랜딩'] = await grab()
await go('/diagnose'); SCREENS['진단(빈)'] = await grab()
await go('/diagnose?sample=returner'); SCREENS['진단(샘플)'] = await grab()
await go('/diagnose?sample=returner'); await send('Page.navigate', { url: BASE + '/strategy' }); await sleep(1500)
await click('제출할 정보 후보 만들기'); await sleep(1500)
await ev(`document.querySelectorAll('details').forEach(d=>d.open=true)`); await sleep(400)
SCREENS['전략(샘플)'] = await grab()
await go('/document'); SCREENS['서식1'] = await grab()
await go('/document?form=correctionRequest'); SCREENS['서식2'] = await grab()
await go('/next'); SCREENS['이후 절차'] = await grab()
await go('/response'); SCREENS['회신(빈)'] = await grab()
await go('/response?sample=partial&run=1'); SCREENS['회신(일부)'] = await grab()
await go('/response?sample=full&run=1'); SCREENS['회신(전부)'] = await grab()
const ALL = Object.entries(SCREENS).map(([k, v]) => `\n\n========== ${k} ==========\n` + v).join('')
fs.writeFileSync(new URL('./out/screens.txt', import.meta.url).pathname, ALL)
console.log('모은 화면 ' + Object.keys(SCREENS).length + '개 · 총 ' + ALL.length + '자 → tests/out/screens.txt\n')

let pass = 0, fail = 0
const rows = []
const chk = (claim, needle, where = Object.keys(SCREENS)) => {
  const re = needle instanceof RegExp ? needle : new RegExp(needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const hit = where.filter(w => re.test(SCREENS[w] || ''))
  const good = hit.length > 0
  if (good) pass++; else fail++
  rows.push({ claim, good, hit, where })
  console.log(`  ${good ? '✔' : '✘'} ${claim}${good ? `  [${hit.join(', ')}]` : `  ← ${where.join('/')} 에서 못 찾음`}`)
  return good
}
const forbid = (claim, needle) => {
  const re = needle instanceof RegExp ? needle : new RegExp(needle)
  const hit = Object.keys(SCREENS).filter(w => re.test(SCREENS[w]))
  const good = hit.length === 0
  if (good) pass++; else fail++
  rows.push({ claim, good, hit, forbidden: true })
  console.log(`  ${good ? '✔' : '✘'} [금지] ${claim}${good ? '' : `  ← ${hit.join(', ')} 에 있다`}`)
}

console.log('── §0 · §2-2 기능이 화면에 있는가 ──')
chk('랜딩: 자가진단', /혹시 이런 일이 있으셨나요/, ['랜딩'])
chk('랜딩: 권리 5종 목록', /행사할 수 있는 권리 5가지/, ['랜딩'])
chk('랜딩: 법령 판본 표시', /이 서비스가 기준으로 삼은 법령 판본/, ['랜딩'])
chk('랜딩: 내보내기/불러오기', /파일로 내보내기/, ['랜딩'])
chk('진단: 3~5단계라고 밝힌다', /3~5단계/, ['진단(빈)'])
chk('진단: 근거 조문과 함께 권리 판정', /근거 법 제36조의2/, ['진단(샘플)'])
chk('진단: 위임 경로(거래 판정)', /제2조 제1호의3/, ['진단(샘플)'])
chk('서식 1 제목', /설명요구서/, ['서식1'])
chk('서식 2 제목', /정정.{0,3}삭제 및 자동화평가 재산출/, ['서식2'])
chk('서식: 쪽 수 예고', /현재 내용은 .?\d+페이지로 출력됩니다/, ['서식1', '서식2'])
chk('서식: 이메일 초안', /이메일로 제출|이메일 초안/, ['서식1'])
chk('전략: 제2항 제1호 근거', /제36조의2 제2항 제1호/, ['전략(샘플)'])
chk('전략: 선정이유가 사용자 서술을 인용', /이걸 고른 이유/, ['전략(샘플)'])
chk('이후 절차: 제출 채널 4', /서면/, ['이후 절차'])
chk('이후 절차: 거절 사유', /거절/, ['이후 절차'])
chk('회신: 3유형 판정', /자동화평가의 주요 기준/, ['회신(일부)'])
chk('회신: 기초정보 5분류', /판단정보/, ['회신(일부)'])
chk('회신: 회신 법정 서식 고지', /별지 제15호의4/, ['회신(일부)', '회신(전부)'])

console.log('\n── §1-7 · §4-2 한계를 화면이 밝히는가 (여덟 칸) ──')
chk('① 정본과 대조하지 못했다', /원본과 대조하지 못했습니다/, ['서식1', '서식2'])
chk('① 개정 사실과 미확인 사실을 나눠 적는다', /개정됐는데/, ['서식1', '서식2'])
chk('② 회신 법정 서식이 "있다"까지만', /별지 제15호의4/, ['회신(일부)', '회신(전부)', '이후 절차'])
chk('③ 처리 기한이 법령에 없다', /규정되어 있지 않습니다|법령에 없습니다|규정이 없습니다/, ['이후 절차'])
chk('④ 국외 이전 고지', /국외 이전/, ['진단(빈)', '진단(샘플)', '전략(샘플)', '회신(빈)'])
chk('④ 개인 식별 내용을 쓰지 말라는 안내', /알 수 있는 내용은 쓰지 마세요/, ['진단(빈)', '진단(샘플)'])
chk('⑤ 용어집이 "직접 확인하지 않았습니다"를 표시', /직접 확인하지 않았습니다/, ['랜딩', '진단(샘플)', '이후 절차'])
/* ★ "…아니" 로 끊어 찾으면 안 된다. 한글은 음절이 미리 합쳐져 있어
   "아닙니다"(U+B2D9…) 안에 "아니"(U+B2C8)가 들어 있지 않다.
   그 탓에 실제로는 세 화면에 다 있는 문장을 한 화면에만 있다고 셌다. */
chk('⑧ 회신 샘플이 이 서비스가 만든 예시라고 밝힌다', /실제 금융회사가 보낸 문서가/, ['회신(빈)', '회신(일부)', '회신(전부)'])

console.log('\n── §2-4 개인정보 고지 ──')
chk('주민등록번호 칸은 공란 + "출력 후 직접 기재"', /출력 후 직접 기재/, ['서식1'])
chk('전송 상한(서술 2,000자)', /2,?000자/, ['진단(빈)', '진단(샘플)'])
chk('전송 상한(회신 12,000자)', /12,?000자/, ['회신(빈)'])
chk('보내는 것 / 보내지 않는 것을 나눠 적는다', /보내지 않는 것/, ['전략(샘플)', '회신(빈)'])
chk('성명·연락처를 서버로 보내지 않는다', /성명 ?· ?연락처|이름 ?· ?연락처|이름·주민등록번호·연락처/, ['전략(샘플)', '서식1', '랜딩', '진단(빈)'])
chk('저장은 이 브라우저뿐', /이 브라우저에 저장|이 브라우저의/, ['랜딩', '서식1'])
chk('회신 원문 전체는 저장하지 않는다(조각은 저장)', /원문 전체는 저장하지 않/, ['회신(빈)', '회신(일부)'])
chk('호스팅의 접속 기록은 이 서비스가 정하지 않는다', /접속 기록/, ['랜딩'])
chk('내보낸 파일에 개인정보가 들어 있다', /안전한 곳에 보관|개인정보가 그대로/, ['랜딩'])

console.log('\n── §4-3 과태료는 제1항에만 ──')
chk('과태료 제목이 적용 범위를 담는다', /과태료 — 설명 요구를 무시한 경우에 한합니다/, ['이후 절차'])
chk('신고인에게 지급되지 않는다', /신고인에게 지급되지 않습니다/, ['이후 절차'])

console.log('\n── §3 쓰면 안 되는 문장 일곱 ──')
forbid('"입력한 내용은 서버로 전송되지 않습니다"', /입력한 내용은 서버로 전송되지 않습니다/)
forbid('"새로고침하면 모든 입력이 사라집니다"', /새로고침하면 모든 입력이 사라집니다/)
forbid('"회신 원문을 저장하지 않습니다"(전체/조각 구분 없이)', /회신 원문을 저장하지 않습니다/)
forbid('"3회 이상 행사하면 거절됩니다"', /3회 이상 행사하면 거절/)
forbid('"처리 기한은 N일입니다"', /처리 기한은 \d+일/)
forbid('"정본과 동일한 서식입니다"', /정본과 동일한 서식/)
forbid('"AI 가 법령을 분석합니다"', /AI가 법령을 분석|AI 가 법령을 분석/)

console.log(`\n────────────────────────`)
console.log(`통과 ${pass} / 실패 ${fail}`)
fs.writeFileSync(new URL('./out/jdocs-rows.json', import.meta.url).pathname, JSON.stringify(rows, null, 1))
await send('Emulation.clearDeviceMetricsOverride')
ws.close(); process.exit(fail ? 1 : 0)
