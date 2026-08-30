/**
 * tools/og-card.html 을 1200×630 PNG 로 그려 public/og.png 에 쓴다.
 *
 *   chrome-headless-shell --remote-debugging-port=9444 --user-data-dir=/tmp/cdp-og about:blank &
 *   node tools/make-og.mjs
 *
 * 새 의존성을 쓰지 않는다. 회귀 시험이 쓰는 것과 같은 CDP 연결이다.
 */
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'

const CDP = process.env.CDP || 'http://127.0.0.1:9444'
const src = new URL('./og-card.html', import.meta.url).pathname
const out = new URL('../public/og.png', import.meta.url).pathname

const t = (await (await fetch(CDP + '/json/list')).json()).find((x) => x.type === 'page')
if (!t) throw new Error('CDP 페이지를 찾지 못했다')
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
await send('Emulation.setDeviceMetricsOverride', { width: 1200, height: 630, deviceScaleFactor: 1, mobile: false })
await send('Page.navigate', { url: pathToFileURL(src).href })
await new Promise((r) => setTimeout(r, 1200))
const s = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: false })
fs.writeFileSync(out, Buffer.from(s.result.data, 'base64'))
ws.close()
console.log('public/og.png 갱신 —', fs.statSync(out).size, 'bytes')
