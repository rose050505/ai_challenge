/**
 * CSP 를 실제로 실은 채 전 경로를 걷는다. (2026-09-02 심사 대비 [1])
 *
 * ★ 왜 별도 서버인가 — `vite preview` 는 vercel.json 의 헤더를 싣지 않는다.
 *   CSP 를 넣고 빌드만 통과시키면 **배포 후에야** 막힌 것을 알게 된다.
 *   csp-server.mjs 가 vercel.json 의 헤더 그대로 dist/ 를 서빙한다.
 *
 *   node tests/csp-server.mjs 4500 &
 *   CSP_URL=http://localhost:4500 node tests/tcsp.mjs
 *
 * 무엇을 잡나 — 위반은 조용하다. 이미지가 안 뜨거나 스크립트가 안 돌아도
 * 화면은 그냥 이상해질 뿐이다. 그래서 두 경로로 동시에 듣는다.
 *   (1) document 의 'securitypolicyviolation' 이벤트 (페이지마다 다시 심는다)
 *   (2) CDP Log.entryAdded — 위반은 콘솔에도 남는다
 * 마지막에 **하나라도** 있으면 실패시키고 어느 지시어가 막았는지 찍는다.
 */
const BASE = process.env.CSP_URL || 'http://localhost:4500'
const t = (await (await fetch((process.env.CDP || 'http://127.0.0.1:9444') + '/json/list')).json())
  .find((x) => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl)
await new Promise((r) => (ws.onopen = r))
let id = 0
const pend = new Map()
const viol = []   // CSP 위반
const errs = []   // 미처리 예외
ws.onmessage = (e) => {
  const m = JSON.parse(e.data)
  if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id); return }
  if (m.method === 'Runtime.exceptionThrown')
    errs.push((m.params.exceptionDetails?.exception?.description || '').slice(0, 160))
  if (m.method === 'Log.entryAdded') {
    const txt = m.params.entry?.text || ''
    if (/Content Security Policy|Refused to/i.test(txt)) viol.push('[log] ' + txt.slice(0, 220))
  }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error') {
    const txt = (m.params.args || []).map((a) => a.value ?? '').join(' ')
    if (/CSPVIOLATION/.test(txt)) viol.push('[event] ' + txt.slice(0, 220))
  }
}
const send = (m, p = {}) =>
  new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
await send('Page.enable'); await send('Runtime.enable'); await send('Log.enable'); await send('Network.enable')
const ev = async (x) =>
  (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

let pass = 0, fail = 0
const ok = (n, c, d = '') => { if (c) { pass++; console.log('  ok   ' + n) } else { fail++; console.log('  FAIL ' + n + (d ? ' — ' + d : '')) } }

/** 페이지마다 위반 청취기를 다시 심는다 (문서가 바뀌면 리스너도 사라진다) */
const LISTENER = `try{document.addEventListener('securitypolicyviolation',e=>{
  console.error('CSPVIOLATION',e.violatedDirective,e.blockedURI,(e.sourceFile||''))})}catch(e){}`
const go = async (path, extra = '') => {
  const { identifier } = (await send('Page.addScriptToEvaluateOnNewDocument', {
    source: `try{localStorage.clear();localStorage.setItem('wy-tour-v1','done');${extra}}catch(e){}\n${LISTENER}`,
  })).result
  await send('Page.navigate', { url: BASE + path })
  await sleep(1800)
  await send('Page.removeScriptToEvaluateOnNewDocument', { identifier })
}
const clickText = async (sel, txt) => {
  const r = await ev(`(()=>{const e=[...document.querySelectorAll('${sel}')].find(e=>e.textContent.replace(/\\s+/g,' ').includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`)
  await sleep(1100); return r
}
const body = () => ev(`document.body.innerText.replace(/\\s+/g,' ')`)

console.log('대상:', BASE, '(vercel.json 헤더 그대로)')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })

console.log('\n[0] 헤더가 실제로 실렸는가')
const hdr = (await fetch(BASE + '/')).headers.get('content-security-policy') || ''
ok('CSP 헤더 존재', hdr.includes("default-src 'self'"), hdr.slice(0, 80))
ok("script-src 'self' — 인라인/외부 스크립트 금지", hdr.includes("script-src 'self'"))
ok("connect-src 'self' — 외부로 fetch 금지", hdr.includes("connect-src 'self'"))
ok("frame-ancestors 'none' — 끼워넣기 금지", hdr.includes("frame-ancestors 'none'"))

console.log('\n[1] 여섯 화면이 CSP 아래에서 그려지는가')
for (const [path, needle] of [
  ['/', '자동화평가'],
  ['/diagnose', '무슨 일이 있었'],
  ['/strategy', '제출'],
  ['/document', '서식'],
  ['/next', '이후'],
  ['/response', '회신'],
]) {
  await go(path)
  const b = await body()
  ok(`${path} 본문 렌더`, (b || '').includes(needle), (b || '').slice(0, 60))
}

console.log('\n[2] 스타일·글꼴·이미지')
await go('/')
ok('Tailwind CSS 적용됨 (style-src)',
  await ev(`getComputedStyle(document.querySelector('header')).borderBottomWidth!=='0px'`))
ok('파비콘 SVG 200 (img-src self)',
  (await fetch(BASE + '/favicon.svg')).status === 200)
/* 웹폰트는 애초에 0개다. 그 사실을 여기서도 고정한다 — 누가 나중에 넣으면 CSP 에 막힌다. */
ok('웹폰트 0개 (외부 font-src 없음)', (await ev(`document.fonts.size`)) === 0)

console.log('\n[3] 내보내기 — blob: URL 다운로드')
await go('/diagnose', `localStorage.setItem('wae:journey:state',JSON.stringify({schemaVersion:1,diagnosis:{event:'loanRejected',target:'financial',sector:'bank',situation:'테스트 서술입니다'},form:{personal:{name:'홍길동'}}}))`)
await send('Page.setDownloadBehavior', { behavior: 'allow', downloadPath: '/tmp/csp-dl' }).catch(() => {})
const blobOk = await ev(`(()=>{try{const b=new Blob(['{"a":1}'],{type:'application/json'});
  const u=URL.createObjectURL(b);const a=document.createElement('a');a.href=u;a.download='t.json';
  document.body.appendChild(a);a.click();a.remove();URL.revokeObjectURL(u);return 'ok'}catch(e){return 'ERR '+e.message}})()`)
ok('blob: 만들고 a[download] 클릭', blobOk === 'ok', String(blobOk))
await sleep(600)
/* 실제 화면의 [파일로 내보내기] 도 눌러 본다 */
await go('/', `localStorage.setItem('wae:journey:state',JSON.stringify({schemaVersion:1,diagnosis:{event:'loanRejected',target:'financial',sector:'bank',situation:'테스트 서술입니다'}}))`)
const exported = await clickText('button', '파일로 내보내기')
ok('화면의 [파일로 내보내기] 눌림', exported !== false)

console.log('\n[4] mailto: — 이메일 초안')
await go('/document')
const mailto = await ev(`(()=>{const a=[...document.querySelectorAll('a')].find(a=>(a.getAttribute('href')||'').startsWith('mailto:'));
  return a?a.getAttribute('href').slice(0,60):'(없음)'})()`)
ok('바닥글 mailto: 링크 존재', String(mailto).startsWith('mailto:'), String(mailto))
/* form-action 은 form 제출에만 걸린다. mailto: 링크는 네비게이션이라 막히지 않는다.
   그래도 실제로 눌러 위반이 나는지 본다. */
const before = viol.length
await ev(`(()=>{const a=[...document.querySelectorAll('a')].find(a=>(a.getAttribute('href')||'').startsWith('mailto:'));if(a)a.click();return 1})()`)
await sleep(900)
ok('mailto: 클릭에 CSP 위반 없음', viol.length === before, viol.slice(before).join(' | '))

console.log('\n[5] 투어 (하단 시트 · 애니메이션)')
await go('/', `localStorage.removeItem('wy-tour-v1')`)
await clickText('button', '2분 둘러보기')
ok('투어 패널 열림', await ev(`!!document.querySelector('[data-tour-panel]')`))
for (let i = 0; i < 4; i++) await clickText('button', '다음')
ok('투어 진행 중 위반 없음', true)

console.log('\n[6] /api 폴백 — connect-src self')
/* 이 서버에는 /api 가 없다(404). 화면은 폴백으로 가야 하고, 그 fetch 자체는
   same-origin 이므로 connect-src 'self' 에 막히지 않아야 한다. */
await go('/strategy', `localStorage.setItem('wae:journey:state',JSON.stringify({schemaVersion:1,diagnosis:{event:'loanRejected',target:'financial',sector:'bank',situation:'프리랜서로 3년 일했고 소득 증빙이 비정형입니다'}}))`)
const vb = viol.length
await clickText('button', '후보 만들기')
await sleep(2500)
const sb = (await body()) || ''
ok('폴백 목록이 떴다', sb.includes('제출') && sb.length > 400, sb.slice(0, 80))
ok('/api fetch 가 CSP 에 막히지 않았다', viol.length === vb, viol.slice(vb).join(' | '))

console.log('\n[7] 회신 해석 — 샘플 딥링크')
await go('/response?sample=partial&run=1')
const rb = (await body()) || ''
ok('샘플 해석 결과 표시', rb.includes('무엇을 받았나요'), rb.slice(0, 80))
ok('샘플 고지 표시', rb.includes('실제 금융회사가 보낸 문서가'))

console.log('\n[8] 인쇄 미리보기 (print 미디어)')
await go('/document')
await send('Emulation.setEmulatedMedia', { media: 'print' })
await sleep(700)
ok('인쇄 미디어에서 서식이 남아 있다', await ev(`!!document.querySelector('.print-sheet')`))
await send('Emulation.setEmulatedMedia', { media: '' })

console.log('\n────────────────────────')
if (viol.length) {
  console.log('★ CSP 위반 ' + viol.length + '건:')
  for (const v of [...new Set(viol)]) console.log('   ' + v)
  fail += 1
} else {
  console.log('CSP 위반 0건')
}
if (errs.length) console.log('미처리 예외: ' + [...new Set(errs)].join(' | '))
console.log(`통과 ${pass} / 실패 ${fail}`)
ws.close()
process.exit(fail ? 1 : 0)
