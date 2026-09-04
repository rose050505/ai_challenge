/**
 * 시험 전에 브라우저 탭을 새것으로 바꾼다.
 *
 * ★ 왜 필요한가 (2026-09-01 심사 당일 감사에서 데였다)
 *   CDP 로 붙는 시험들은 **탭 하나를 함께 쓴다.** 그 탭에는 상태가 눌어붙는다 —
 *   Page.addScriptToEvaluateOnNewDocument 로 심었다가 못 지운 스크립트,
 *   Emulation.setEmulatedMedia 의 features(어두운 모드·고대비), 화면 크기 재정의,
 *   Network 의 캐시/헤더/회선 흉내.
 *   감사 중에 그런 상태가 남은 채로 run.sh 를 돌렸더니 thero 가 한 번은 9/34,
 *   다음엔 31/34, 다음엔 15/34 로 나왔다. **코드는 멀쩡했다.** 배포 직전에 이런
 *   거짓 실패를 보면 없는 문제를 쫓게 된다.
 *
 *   지울 수 있는 것은 지우고, 지울 수 없는 것(남의 주입 스크립트)은
 *   **탭을 새로 만들어 버린다.** 새 탭에는 아무것도 심겨 있지 않다.
 */
const CDP = process.env.CDP || 'http://127.0.0.1:9444'
const j = async (p, m = 'GET') => (await fetch(CDP + p, { method: m })).text()

let list = []
try { list = JSON.parse(await j('/json/list')) } catch { console.log('  · 브라우저 없음 — 건너뜀'); process.exit(0) }
const pages = list.filter(x => x.type === 'page')

// 새 탭을 하나 열고
await j('/json/new?about:blank', 'PUT').catch(() => j('/json/new?about:blank'))
// 옛 탭을 전부 닫는다
for (const p of pages) await j('/json/close/' + p.id)

/* 닫기는 비동기라 곧바로 세면 아직 남아 있을 수 있다. 잠깐 두고 다시 센다. */
let after = []
for (let i = 0; i < 10; i++) {
  await new Promise((r) => setTimeout(r, 200))
  after = JSON.parse(await j('/json/list')).filter((x) => x.type === 'page')
  if (after.length === 1) break
}
if (after.length !== 1) {
  console.log(`  · 탭 정리: ${pages.length}개 닫고 ${after.length}개 남김`)
  console.log('  ✘ 탭이 하나가 아니다. 시험이 어느 탭을 물지 알 수 없다.')
  process.exit(1)
}

/*
 * ★ 새 탭을 **활성화하고, 앱까지 한 번 띄워 놓고** 넘긴다. (2026-09-04)
 *
 *   왜 필요한가 — 이 저장소의 브라우저 시험 다수가 `Page.navigate` 뒤에
 *   **고정 시간**만 기다린다. 탭이 데워져 있으면 그 시간이 넉넉하고, `about:blank`
 *   에서 시작하면 모자란다. 그러면 시험은 **앞 화면을 측정한다.**
 *   실제로 그랬다 — 브라우저를 새로 띄운 뒤 돌렸더니 `thero` 가 랜딩이 아니라
 *   `/response` 를 재고 19/36 으로 떨어졌다. 코드는 멀쩡했다.
 *   리셋은 눌어붙은 상태를 막으려고 만든 장치인데, **그 리셋이 앞쪽 시험을 깨고 있었다.**
 *
 *   그래서 여기서 한 번 띄워 캐시와 렌더러를 데운 뒤, 저장소만 비워 넘긴다.
 *   앱이 안 떠 있으면 조용히 건너뛴다 — 리셋은 앱 없이도 쓸 수 있어야 한다.
 */
const APP = process.env.APP_URL || 'http://localhost:4400'
await j('/json/activate/' + after[0].id)
let warmed = '건너뜀(앱 없음)'
try {
  const ws = new WebSocket(after[0].webSocketDebuggerUrl)
  await new Promise((r, x) => { ws.onopen = r; ws.onerror = x })
  let id = 0
  const pend = new Map()
  ws.onmessage = (e) => { const m = JSON.parse(e.data); if (m.id && pend.has(m.id)) { pend.get(m.id)(m); pend.delete(m.id) } }
  const send = (method, params = {}) =>
    new Promise((res) => { const i = ++id; pend.set(i, res); ws.send(JSON.stringify({ id: i, method, params })) })
  const ev = async (x) => {
    try { return (await send('Runtime.evaluate', { expression: x, returnByValue: true })).result?.result?.value }
    catch { return undefined }
  }
  await send('Page.enable'); await send('Runtime.enable')
  const t0 = Date.now()
  let ready = false
  /*
   * 여섯 화면을 **각각 실제로 탐색해** 한 번씩 그린다.
   * `/` 만 띄우면 다른 경로의 첫 그리기가 여전히 느리고, 그 화면을 재는 앞쪽 시험이
   * 앞 화면을 측정한다 — 콜드 브라우저에서 rename·tnarrow·tlaw·phase1 이 그렇게 깨졌다.
   */
  for (const path of ['/', '/diagnose', '/document', '/strategy', '/next', '/response', '/']) {
    await send('Page.navigate', { url: APP + path })
    const s0 = Date.now()
    ready = false
    while (Date.now() - s0 < 8000) {
      if (await ev(`document.readyState==='complete' && (document.querySelector('main')?.innerText||'').length > 80`)) { ready = true; break }
      await new Promise((r) => setTimeout(r, 25))
    }
    if (!ready) break
  }
  // 데우기만 하고 흔적은 남기지 않는다 — 시험은 빈 저장소에서 시작해야 한다
  await ev(`try{localStorage.clear();sessionStorage.clear()}catch(e){}`)
  warmed = ready ? `앱을 한 번 띄움 (${Date.now() - t0}ms)` : '앱 응답 없음'
  ws.close()
} catch { /* 앱이 없으면 데우지 않는다 */ }
console.log(`  · 탭 정리: ${pages.length}개 닫고 ${after.length}개 남김 · ${warmed}`)
