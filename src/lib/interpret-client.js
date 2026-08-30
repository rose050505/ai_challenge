/**
 * /api/interpret 호출 래퍼.
 *
 * ★ 절대 실패하지 않는다.
 *   AI 분류가 안 되면 수동 분류 모드로 전환한다. 기능이 죽지 않고 느려질 뿐이어야 한다.
 *
 * 회신 본문은 서버로만 보내고 저장하지 않는다.
 */
import { RESPONSE_SAMPLES_BY_ID, INTERPRET_FALLBACK_REASONS } from '../data/response-samples.js'

const CLIENT_TIMEOUT_MS = 25_000

function manualMode(reasonKey) {
  return {
    mode: 'manual',
    interpretation: null,
    notice: INTERPRET_FALLBACK_REASONS[reasonKey] ?? INTERPRET_FALLBACK_REASONS.default,
  }
}

/**
 * @param {{sampleId?: string|null, responseText: string}} input
 * @returns {Promise<{mode:'ai'|'cached'|'manual', interpretation: object|null, notice: string|null}>}
 */
export async function interpretResponse({ sampleId, responseText }) {
  // 샘플 회신은 API 없이 캐시된 해석으로 끝까지 동작한다.
  if (sampleId && RESPONSE_SAMPLES_BY_ID[sampleId]) {
    return {
      mode: 'cached',
      interpretation: RESPONSE_SAMPLES_BY_ID[sampleId].cached,
      notice: INTERPRET_FALLBACK_REASONS.sample,
    }
  }

  if (!responseText?.trim()) return manualMode('default')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS)
  try {
    const res = await fetch('/api/interpret', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ responseText }),
      signal: controller.signal,
    })
    if (!res.ok) {
      const body = await res.json().catch(() => null)
      return manualMode(body?.error ?? 'api_unavailable')
    }
    const body = await res.json().catch(() => null)
    if (!Array.isArray(body?.covered) || !Array.isArray(body?.missing)) {
      return manualMode('unparsable_response')
    }
    return { mode: 'ai', interpretation: body, notice: null }
  } catch (err) {
    // ★ 중단(타임아웃)과 그 밖의 실패를 구분해 사실대로 말한다 (analyze-client 와 같은 이유)
    return manualMode(err?.name === 'AbortError' ? 'timeout' : 'api_unavailable')
  } finally {
    clearTimeout(timer)
  }
}
