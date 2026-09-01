/**
 * 심사 당일 [7] — 인쇄 실기 조건.
 *
 * 심사위원의 프린터 설정을 우리가 모른다. 용지가 Letter 일 수 있고, 배율이
 * 100% 가 아닐 수 있고, 머리글·바닥글이 켜져 있을 수 있고, 흑백일 수 있다.
 * 그 네 가지를 각각 강제해 **서식이 읽히는가 / 내용이 사라지는가**를 본다.
 *
 * 판정 기준은 쪽 수가 아니라 **글자다.** A4 로 뽑은 글자가 전부 그대로 나오면
 * 내용은 잃지 않은 것이다. 쪽 수는 함께 보고한다.
 */
const OUT = new URL('./out/', import.meta.url).pathname
const fs = await import('node:fs')
const cp = await import('node:child_process')
await (await import('node:fs/promises')).mkdir(OUT, { recursive: true })
const BASE = process.env.APP_URL || 'http://localhost:4400'
const CDP = process.env.CDP || 'http://127.0.0.1:9444'
const t = (await (await fetch(CDP + '/json/list')).json()).find(x => x.type === 'page')
const ws = new WebSocket(t.webSocketDebuggerUrl); await new Promise(r => ws.onopen = r)
let id = 0; const pend = new Map()
ws.onmessage = e => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
const send = (m, p = {}) => new Promise(res => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method: m, params: p })) })
const ev = async x => (await send('Runtime.evaluate', { expression: x, awaitPromise: true, returnByValue: true })).result?.result?.value
const sleep = ms => new Promise(r => setTimeout(r, ms))
const click = async txt => { const ok = await ev(`(()=>{const e=[...document.querySelectorAll('button,a')].reverse().find(e=>e.textContent.trim().includes(${JSON.stringify(txt)})&&e.offsetParent!==null);if(!e)return false;e.click();return true})()`); await sleep(800); return ok }
let pass = 0, fail = 0
const ok = (c, m) => { if (c) { pass++; console.log('  ✔ ' + m) } else { fail++; console.log('  ✘ ' + m) } }

await send('Page.enable'); await send('Runtime.enable')
await send('Emulation.setDeviceMetricsOverride', { width: 1280, height: 900, deviceScaleFactor: 1, mobile: false })
/* 여러 쪽짜리 서식일수록 용지 차이가 드러난다. 인자로 고른다.
   base = 빈 서식 1쪽 / split = 긴 값 여러 쪽 (paged.mjs 와 같은 값) */
const CASE = process.argv[2] || 'split'
const SCALE = process.argv[3] || 'lg'
const FILL = CASE === 'base' ? null :
  '2021년 3월 등록된 연체 이력은 통신요금 자동이체 계좌 변경 과정에서 발생한 것으로 실제 채무 불이행이 아니며, 통신사 확인서와 완납 증명서를 첨부합니다. 해당 기록의 삭제와 자동화평가 결과의 재산출을 함께 요구합니다. 또한 같은 기간의 국민연금 납부내역과 건강보험 납부실적을 유리한 정보로 함께 제출하오니 재산출 시 반영하여 주시기 바랍니다. 관련 증빙은 모두 원본 대조필로 첨부하였습니다.'
const { identifier: seed } = (await send('Page.addScriptToEvaluateOnNewDocument', {
  source: `try{localStorage.clear();localStorage.setItem('wy-tour-v1','done');localStorage.setItem('wy-print-scale',${JSON.stringify(SCALE)})}catch(e){}`,
})).result
await send('Page.navigate', { url: BASE + '/' }); await sleep(900)
await send('Page.removeScriptToEvaluateOnNewDocument', { identifier: seed })

// 서식 2까지 채운 상태를 만든다 (paged.mjs 와 같은 경로)
await send('Page.navigate', { url: BASE + '/strategy' }); await sleep(1200)
await click('제출할 정보 후보 만들기'); await sleep(1600)
await click('서식에 넣기'); await sleep(1000)
await click('회신 해석'); await sleep(900)
await click('3유형 전부 설명받은 회신')
await click('회신 해석하기'); await sleep(1500)
await ev(`(()=>{document.querySelectorAll('li input[type=checkbox]').forEach(c=>{if(!c.checked)c.click()});return true})()`)
await sleep(400)
await click('서식 2 만들기'); await sleep(1600)
if (FILL) {
  const n = await ev(`document.querySelectorAll('.print-sheet input:not([type=checkbox]), .print-sheet textarea').length`)
  for (let i = 0; i < n; i++) {
    await ev(`(()=>{const el=document.querySelectorAll('.print-sheet input:not([type=checkbox]), .print-sheet textarea')[${i}];if(!el)return false;const proto=el.tagName==='TEXTAREA'?window.HTMLTextAreaElement:window.HTMLInputElement;const set=Object.getOwnPropertyDescriptor(proto.prototype,'value').set;set.call(el,${JSON.stringify(FILL)});el.dispatchEvent(new Event('input',{bubbles:true}));return true})()`)
    await sleep(110)
  }
  await sleep(1200)
}
console.log(`(경우 ${CASE} · 인쇄 글자 ${SCALE})`)
const notice = await ev(`(()=>{const p=[...document.querySelectorAll('[role=status]')].map(e=>e.innerText).find(t=>t.includes('페이지로 출력'));return p?p.replace(/\\s+/g,' '):'없음'})()`)
console.log('화면 예고:', notice)
const pred = Number((notice.match(/(\d+)\s*페이지/) || [])[1] || 0)

const txt = f => { try { return cp.execSync(`pdftotext -layout ${OUT}${f} -`, { maxBuffer: 40e6 }).toString() } catch { return '' } }
const pages = f => { try { return Number(cp.execSync(`pdfinfo ${OUT}${f}`).toString().match(/^Pages:\s*(\d+)/m)[1]) } catch { return -1 } }
const words = s => s.replace(/\s+/g, '').length
const print = async (name, params) => {
  const r = await send('Page.printToPDF', { printBackground: false, ...params })
  fs.writeFileSync(OUT + name, Buffer.from(r.result.data, 'base64'))
  return { p: pages(name), t: txt(name) }
}

console.log('\n── 용지 ──')
const a4 = await print('jd7-a4.pdf', { preferCSSPageSize: true })
console.log(`  A4 (CSS 지정)          ${a4.p}쪽 · 글자 ${words(a4.t)}자`)
ok(a4.p === pred, `예고(${pred}쪽) = A4 실제(${a4.p}쪽)`)

// 심사위원이 인쇄 대화상자에서 Letter 를 고른 경우
const letter = await print('jd7-letter.pdf', { preferCSSPageSize: false, paperWidth: 8.5, paperHeight: 11 })
console.log(`  Letter (사용자가 바꿈)  ${letter.p}쪽 · 글자 ${words(letter.t)}자`)
/**
 * ★ 글자 조각을 통째로 찾아 맞추면 안 된다. (2026-09-01)
 *   pdftotext -layout 은 표 칸이 어디서 줄바꿈되는지에 따라 조각을 다르게 뱉는다.
 *   배율만 바꿔도 "67조각이 사라졌다"고 나왔는데, 실제로는 **한 글자도 잃지 않았다**.
 *   그래서 문자 개수로 본다 — A4 에 있던 글자가 그만큼 다 있으면 잃은 것이 없다.
 */
const count = (s) => { const m = new Map(); for (const ch of s.replace(/\s+/g, '')) m.set(ch, (m.get(ch) || 0) + 1); return m }
const A4C = count(a4.t)
const lost = (other) => { const c = count(other); let n = 0; for (const [ch, k] of A4C) n += Math.max(0, k - (c.get(ch) || 0)); return n }
const missing = { length: lost(letter.t) }
ok(missing.length === 0, `Letter 에서 사라진 글자 없음 (${missing.length}자)`)
console.log(`     쪽 수 차이: ${letter.p - a4.p}쪽 (예고와 ${letter.p === pred ? '같다' : '다르다'})`)

console.log('\n── 배율 ──')
for (const s of [0.9, 1.1]) {
  const r = await print(`jd7-scale-${s}.pdf`, { preferCSSPageSize: true, scale: s })
  const miss = lost(r.t)
  console.log(`  배율 ${Math.round(s * 100)}%  ${r.p}쪽 · 글자 ${words(r.t)}자${r.p !== a4.p ? `  ★ 예고(${pred}쪽)와 다르다` : ''}`)
  ok(miss === 0, `  배율 ${Math.round(s * 100)}% 에서 사라진 글자 없음 (${miss}자)`)
}

console.log('\n── 머리글·바닥글 ──')
const hf = await print('jd7-headerfooter.pdf', {
  preferCSSPageSize: true, displayHeaderFooter: true,
  headerTemplate: '<div style="font-size:9px;width:100%;padding:0 10mm;display:flex;justify-content:space-between"><span>삼육이 — 자동화평가 설명·이의제기 지원 서비스</span><span>https://362.parkmiyeong.com/document</span></div>',
  footerTemplate: '<div style="font-size:9px;width:100%;padding:0 10mm;display:flex;justify-content:space-between"><span class="pageNumber"></span><span>26. 9. 1.</span></div>',
})
console.log(`  머리글·바닥글 켬  ${hf.p}쪽 · 글자 ${words(hf.t)}자`)
ok(hf.p === a4.p, `  켜도 쪽 수가 그대로 (${hf.p} = ${a4.p})`)
const missHF = lost(hf.t)
ok(missHF === 0, `  켜도 사라진 글자 없음 (${missHF}자)`)

console.log('\n── 흑백 ──')
// 서식 안에서 색으로만 뜻을 전하는 곳이 있는가. 인쇄 대상(.print-sheet) 안만 본다.
await send('Emulation.setEmulatedMedia', { media: 'print' }); await sleep(500)
const colors = JSON.parse(await ev(`JSON.stringify((()=>{
  const lum=(c)=>{const m=c.match(/[\\d.]+/g);if(!m)return null;const[r,g,b]=m.map(Number);
    return +(0.2126*r+0.7152*g+0.0722*b).toFixed(1)}
  const out={bg:{},fg:{},border:{}}
  document.querySelectorAll('.print-sheet, .print-sheet *').forEach(e=>{
    const cs=getComputedStyle(e)
    const b=cs.backgroundColor, f=cs.color, bc=cs.borderTopColor
    if(b&&!/rgba\\(0, 0, 0, 0\\)/.test(b)) out.bg[b]=(out.bg[b]||0)+1
    out.fg[f]=(out.fg[f]||0)+1
    if(parseFloat(cs.borderTopWidth)>0) out.border[bc]=(out.border[bc]||0)+1
  })
  const l={}; for(const k of [...Object.keys(out.bg),...Object.keys(out.fg),...Object.keys(out.border)]) l[k]=lum(k)
  return {...out, lum:l}
})())`))
await send('Emulation.setEmulatedMedia', { media: '' })
console.log('  배경색:', JSON.stringify(colors.bg))
console.log('  글자색:', JSON.stringify(colors.fg))
console.log('  테두리색:', JSON.stringify(colors.border))
const bgs = Object.keys(colors.bg)
ok(bgs.every(c => (colors.lum[c] ?? 255) > 200), `서식 배경이 전부 밝다 — 흑백에서 글자가 묻히지 않는다 (${bgs.length}종)`)
const fgs = Object.keys(colors.fg)
ok(fgs.every(c => (colors.lum[c] ?? 0) < 130), `서식 글자색이 전부 어둡다 (${fgs.length}종: ${fgs.map(c => colors.lum[c]).join(', ')})`)

await send('Emulation.clearDeviceMetricsOverride')
console.log(`\n────────────────────────`)
console.log(`통과 ${pass} / 실패 ${fail}`)
ws.close(); process.exit(fail ? 1 : 0)
