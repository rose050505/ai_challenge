/**
 * CSP 를 실제로 실은 로컬 정적 서버.
 *
 * 왜 있나 — `vite preview` 는 vercel.json 의 헤더를 싣지 않는다. CSP 를 넣고
 * "빌드가 통과했다"로 끝내면 배포 후에야 막힌 것을 알게 된다. 그래서 배포와
 * **같은 헤더**를 붙여 dist/ 를 서빙하고, 그 위에서 전 경로를 걸어 본다.
 *
 *   node tests/csp-server.mjs [port]      # 기본 4500
 *
 * 헤더는 vercel.json 에서 읽는다. 두 벌로 관리하면 언젠가 어긋난다.
 * /api/* 는 여기서 서빙하지 않는다 (CSP 검증에 필요 없다 — 화면은 실패 시
 * 폴백 모드로 가고, 그 경로도 함께 확인된다).
 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join, normalize } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const DIST = join(HERE, '..', 'dist')
const PORT = Number(process.argv[2] || 4500)

const vercel = JSON.parse(await readFile(join(HERE, '..', 'vercel.json'), 'utf8'))
const HEADERS = vercel.headers.find((h) => h.source === '/(.*)').headers

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
}

createServer(async (req, res) => {
  for (const h of HEADERS) res.setHeader(h.key, h.value)
  const path = normalize(decodeURIComponent(req.url.split('?')[0])).replace(/^(\.\.[/\\])+/, '')
  const ext = path.includes('.') ? path.slice(path.lastIndexOf('.')) : ''
  let file = join(DIST, path)
  let type = TYPES[ext]
  if (!ext) {
    // SPA — vercel.json 의 rewrite 와 같은 동작
    file = join(DIST, 'index.html')
    type = TYPES['.html']
  }
  try {
    const body = await readFile(file)
    res.writeHead(200, { 'Content-Type': type || 'application/octet-stream' })
    res.end(body)
  } catch {
    res.writeHead(404, { 'Content-Type': TYPES['.txt'] })
    res.end('not found')
  }
}).listen(PORT, () => console.log(`CSP 서버: http://localhost:${PORT}  (dist/, vercel.json 헤더)`))
