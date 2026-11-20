/**
 * /api/decision 호출 래퍼 (확장 범위, 2026-11-20).
 *
 * ★ 절대 실패하지 않는다 — analyze-client.js 와 같은 약속.
 *   제안이 안 되면 분야별 일반 목록, 회신 해석이 안 되면 「직접 체크」로 끝까지 간다.
 * 서버로는 사정 서술 · 받은 결정 한 줄 · 분야 id, 또는 회신문만 보낸다.
 * 이름 · 연락처 · 회사명 칸의 값은 보내지 않는다.
 */
import { DECISION_GENERIC } from '../data/decision-samples.js'
import { FALLBACK_REASONS } from '../data/strategy-fallback.js'

const CLIENT_TIMEOUT_MS = 25_000

async function post(payload) {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS)
  try {
    const res = await fetch('/api/decision', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })
    const body = await res.json().catch(() => null)
    if (!res.ok) return { error: body?.reason === 'not_configured' ? 'not_configured' : body?.error ?? 'api_unavailable' }
    if (body === null) return { error: 'unparsable_response' }
    return { body }
  } catch (err) {
    return { error: err?.name === 'AbortError' ? 'timeout' : 'api_unavailable' }
  } finally {
    clearTimeout(timer)
  }
}

/** @returns {Promise<{candidates: object[], source: 'ai'|'fallback', notice: string|null}>} */
export async function requestSuggestions({ kindId, what, story }) {
  const generic = DECISION_GENERIC[kindId] ?? DECISION_GENERIC.other
  if (!story?.trim()) return { candidates: generic, source: 'fallback', notice: FALLBACK_REASONS.default }
  const { body, error } = await post({ mode: 'suggest', kindId, what, story })
  if (error || !Array.isArray(body?.candidates) || body.candidates.length === 0) {
    return { candidates: generic, source: 'fallback', notice: FALLBACK_REASONS[error] ?? FALLBACK_REASONS.default }
  }
  return { candidates: body.candidates, source: 'ai', notice: null }
}

/**
 * @returns {Promise<{result: object|null, source: 'ai'|'manual', notice: string|null}>}
 *   result = { items: {id: {found, quote}}, refused, extended, human }
 */
export async function requestReplyCheck(replyText) {
  if (!replyText?.trim()) return { result: null, source: 'manual', notice: null }
  const { body, error } = await post({ mode: 'reply', replyText })
  if (error || !body?.items) {
    const why = (FALLBACK_REASONS[error] ?? FALLBACK_REASONS.default).replace('기본 목록을 보여드립니다.', '')
    return { result: null, source: 'manual', notice: `${why}회신에 있는 항목을 직접 체크해 주세요.`.trim() }
  }
  return { result: body, source: 'ai', notice: null }
}

/**
 * 세 질문 미리 답하기. 실패하면 null — 화면은 사용자가 직접 고르게 둔다.
 * @returns {Promise<{result: {auto,big,basis}|null, notice: string|null}>}
 */
export async function requestTriage({ kindId, what, story }) {
  if (!story?.trim() && !what?.trim()) return { result: null, notice: null }
  const { body, error } = await post({ mode: 'triage', kindId, what, story })
  if (error || !body?.auto) {
    const why = (FALLBACK_REASONS[error] ?? FALLBACK_REASONS.default).replace('기본 목록을 보여드립니다.', '')
    return { result: null, notice: `${why}세 질문은 직접 골라 주세요.`.trim() }
  }
  return { result: body, notice: null }
}

/** 의견 문장 다듬기. 실패하면 null — 원문을 그대로 쓴다. */
export async function requestPolish(story) {
  if (!story?.trim()) return { opinion: null, notice: null }
  const { body, error } = await post({ mode: 'polish', story })
  if (error || !body?.opinion) {
    const why = (FALLBACK_REASONS[error] ?? FALLBACK_REASONS.default).replace('기본 목록을 보여드립니다.', '')
    return { opinion: null, notice: `${why}적으신 문장을 그대로 씁니다.`.trim() }
  }
  return { opinion: body.opinion, notice: null }
}
