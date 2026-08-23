import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

/**
 * 개발 서버에서 /api/* 를 서빙한다.
 *
 * `vite dev` 는 Vercel Serverless Function 을 실행하지 않으므로,
 * 이게 없으면 로컬에서 /api/analyze 호출이 index.html 로 fallback 되어
 * LLM 경로를 전혀 테스트할 수 없다.
 *
 * - .env 의 ANTHROPIC_API_KEY 를 process.env 로 올린다 (서버 측에서만 쓰인다).
 *   VITE_ 접두사가 아니므로 클라이언트 번들에는 들어가지 않는다.
 * - 프로덕션 빌드에는 영향이 없다. apply: 'serve' 로 개발 서버 전용이다.
 */
function devApiPlugin(env) {
  return {
    name: 'dev-api',
    apply: 'serve',
    configureServer(server) {
      // 서버 전용 환경변수를 핸들러가 읽을 수 있게 올린다
      if (env.ANTHROPIC_API_KEY) process.env.ANTHROPIC_API_KEY = env.ANTHROPIC_API_KEY

      server.middlewares.use(async (req, res, next) => {
        if (!req.url?.startsWith('/api/')) return next()
        const name = req.url.split('?')[0].replace('/api/', '')
        let handler
        try {
          const mod = await server.ssrLoadModule(`/api/${name}.js`)
          handler = mod.default
        } catch {
          return next()
        }
        if (typeof handler !== 'function') return next()

        // Vercel 핸들러가 기대하는 req.body / res.status().json() 을 흉내낸다
        const chunks = []
        for await (const c of req) chunks.push(c)
        const raw = Buffer.concat(chunks).toString('utf8')
        req.body = raw ? safeJson(raw) : undefined

        res.status = (code) => {
          res.statusCode = code
          return res
        }
        res.json = (obj) => {
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify(obj))
          return res
        }

        try {
          await handler(req, res)
        } catch {
          res.statusCode = 500
          res.setHeader('Content-Type', 'application/json')
          res.end(JSON.stringify({ error: 'internal_error' }))
        }
      })
    },
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // 세 번째 인자를 '' 로 두어야 VITE_ 접두사 없는 변수도 읽힌다.
  const env = loadEnv(mode, process.cwd(), '')
  return {
    plugins: [react(), tailwindcss(), devApiPlugin(env)],
  }
})
