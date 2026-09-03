/**
 * /api/* Origin 가드 단위 시험 (api/_origin.js)
 *
 * 왜 — 두 함수는 Claude API 프록시라, 아무 출처의 웹페이지가 부를 수 있으면
 * 심사 기간에 제3자가 크레딧으로 무임승차한다. 브라우저의 교차 출처 POST 는
 * 반드시 Origin 을 실으므로 그 경로를 403 으로 막는다.
 *
 * ★ Origin 이 없는 요청은 막지 않는다 — same-origin 에 Origin 을 싣지 않는
 *   환경이 있고, 사용자를 잘못 막는 비용이 더 크다. 여기서 그 규칙을 고정한다.
 */
import { originAllowed } from '../api/_origin.js'
import analyzeHandler from '../api/analyze.js'
import interpretHandler from '../api/interpret.js'

let fail = 0
const eq = (name, got, want) => {
  const ok = got === want
  if (!ok) fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n   got ${got} want ${want}`}`)
}

// [1] 허용 — 우리 출처들
eq('[1] 대표 도메인', originAllowed('https://362.parkmiyeong.com'), true)
eq('[1] 보험용 도메인', originAllowed('https://autoevalrights.vercel.app'), true)
eq('[1] 프로젝트 프리뷰', originAllowed('https://autoevalrights-abc123-team.vercel.app'), true)
eq('[1] 로컬 dev', originAllowed('http://localhost:5173'), true)
eq('[1] 로컬 preview', originAllowed('http://127.0.0.1:4400'), true)
eq('[1] ★ Origin 없음(undefined)은 통과', originAllowed(undefined), true)
eq('[1] ★ Origin 없음(빈 문자열)은 통과', originAllowed(''), true)

// [2] 거부 — 낯선 출처
eq('[2] 낯선 https 출처', originAllowed('https://example.com'), false)
eq('[2] ★ 남의 vercel.app 은 거부', originAllowed('https://evil-site.vercel.app'), false)
eq('[2] 프로젝트명 앞부분만 흉내', originAllowed('https://autoevalrights.evil.com'), false)
eq('[2] 하위 도메인 흉내', originAllowed('https://362.parkmiyeong.com.evil.com'), false)
eq('[2] http 로 내려온 대표 도메인', originAllowed('http://362.parkmiyeong.com'), false)
eq('[2] 낯선 로컬호스트 흉내', originAllowed('http://localhost.evil.com'), false)
eq('[2] null 출처(샌드박스 iframe)', originAllowed('null'), false)
eq('[2] 깨진 값', originAllowed('not a url'), false)

// [3] 핸들러가 실제로 403 을 쓰는가 — 키가 있든 없든 Origin 검사가 먼저다
function mockRes() {
  const r = { code: null, body: null, headers: {} }
  r.setHeader = (k, v) => (r.headers[k] = v)
  r.status = (c) => ((r.code = c), r)
  r.json = (o) => ((r.body = o), r)
  return r
}
for (const [name, handler] of [['analyze', analyzeHandler], ['interpret', interpretHandler]]) {
  const res = mockRes()
  await handler({ method: 'POST', headers: { origin: 'https://example.com' }, body: {} }, res)
  eq(`[3] ${name}: 낯선 Origin → 403`, res.code, 403)
  eq(`[3] ${name}: error 코드`, res.body?.error, 'forbidden_origin')
  // Origin 없는 요청은 가드를 지나 다음 검사(키 없음 503 / 본문 400)로 간다
  const res2 = mockRes()
  await handler({ method: 'POST', headers: {}, body: {} }, res2)
  eq(`[3] ${name}: Origin 없으면 403 아님`, res2.code === 403, false)
}

console.log(fail ? `\n${fail} FAILED` : '\n모두 통과')
process.exit(fail ? 1 : 0)
