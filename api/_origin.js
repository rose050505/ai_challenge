/**
 * /api/* 의 Origin 가드.
 *
 * 왜 있나 — 두 함수는 Claude API 로 가는 프록시다. 아무 출처의 웹페이지가
 * 브라우저에서 호출할 수 있으면, 심사 기간(2026-09-07~11)에 제3자 사이트가
 * 우리 API 크레딧으로 무임승차할 수 있다. 브라우저는 교차 출처 POST 에
 * 반드시 Origin 을 실어 보내므로, 그 경로는 여기서 막힌다.
 *
 * 못 막는 것 — curl 등 브라우저 밖 요청은 Origin 을 위조하거나 뺄 수 있다.
 * 그래서 이것은 차단이 아니라 완화다. 요청 길이 제한(TRANSMIT_LIMITS)과
 * 함께 쓰인다.
 *
 * ★ Origin 이 **없는** 요청은 막지 않는다.
 *   same-origin 요청에 Origin 을 싣지 않는 브라우저·확장 환경이 있고,
 *   그 경우 사용자를 잘못 막는 비용이 무임승차를 막는 이득보다 크다.
 *
 * ★ 파일 이름이 _ 로 시작하므로 Vercel 은 이 파일을 함수로 만들지 않는다.
 */

/** 허용 출처. 대표 도메인 · 보험용 도메인 · 이 프로젝트의 Vercel 프리뷰 · 로컬 개발. */
const ALLOWED_HOSTS = new Set(['362.parkmiyeong.com', 'autoevalrights.vercel.app'])

/*
 * 프리뷰 배포(autoevalrights-<hash>-<team>.vercel.app)도 자기 /api 를 부른다.
 * `*.vercel.app` 전체를 열면 Vercel 에 배포한 **아무 사이트나** 통과하므로
 * 프로젝트 이름으로 시작하는 것만 허용한다.
 */
const PREVIEW_RE = /^autoevalrights-[a-z0-9-]+\.vercel\.app$/

export function originAllowed(origin) {
  if (!origin) return true
  let u
  try {
    u = new URL(origin)
  } catch {
    return false
  }
  if (u.protocol === 'http:') {
    // vite dev(5173)·preview(4400) — same-origin fetch POST 도 Origin 을 싣는다
    return u.hostname === 'localhost' || u.hostname === '127.0.0.1'
  }
  if (u.protocol !== 'https:') return false
  return ALLOWED_HOSTS.has(u.hostname) || PREVIEW_RE.test(u.hostname)
}

/**
 * 핸들러 맨 앞에서 부른다. 거부했으면 응답까지 쓰고 true 를 돌려준다.
 * 403 을 받은 클라이언트(우리 화면이라면)는 폴백 모드로 넘어간다.
 */
export function rejectForeignOrigin(req, res) {
  if (originAllowed(req.headers?.origin)) return false
  res.status(403).json({ error: 'forbidden_origin' })
  return true
}
