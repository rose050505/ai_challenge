/**
 * /api/analyze 호출 래퍼.
 *
 * ★ 절대 실패하지 않는다. 어떤 경로로 실패하든 폴백 후보를 돌려준다.
 *   "AI 응답을 받지 못했습니다"로 끝나는 화면이 있으면 심사 중 결격이다.
 *
 * 서버로는 상황 서술만 보낸다. 이름·연락처·주민등록번호는 보내지 않는다.
 */
import { CACHED_CANDIDATES, GENERIC_CHECKLIST, FALLBACK_REASONS } from '../data/strategy-fallback.js'

/** 클라이언트 측 안전장치. 서버가 죽어도 화면이 멈추지 않게 한다. */
const CLIENT_TIMEOUT_MS = 25_000

function fallback(reasonKey) {
  return {
    candidates: GENERIC_CHECKLIST,
    source: 'fallback',
    notice: FALLBACK_REASONS[reasonKey] ?? FALLBACK_REASONS.default,
  }
}

/**
 * @param {{sampleId?: string|null, situation: string, eventLabel?: string, sectorLabel?: string}} input
 */
export async function requestCandidates({ sampleId, situation, eventLabel, sectorLabel }) {
  // 샘플 시나리오는 API 없이 캐시된 응답으로 끝까지 동작한다.
  if (sampleId && CACHED_CANDIDATES[sampleId]) {
    return {
      candidates: CACHED_CANDIDATES[sampleId],
      source: 'cached',
      notice: FALLBACK_REASONS.sample,
    }
  }

  if (!situation?.trim()) return fallback('default')

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), CLIENT_TIMEOUT_MS)

  try {
    const res = await fetch('/api/analyze', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ situation, eventLabel, sectorLabel }),
      signal: controller.signal,
    })

    if (!res.ok) {
      const body = await res.json().catch(() => null)
      return fallback(body?.error ?? 'api_unavailable')
    }

    const body = await res.json()
    if (!Array.isArray(body?.candidates) || body.candidates.length === 0) {
      return fallback('no_valid_candidates')
    }
    return { candidates: body.candidates, source: 'ai', notice: null }
  } catch {
    // 네트워크 단절, 타임아웃, JSON 파싱 실패 — 전부 폴백으로 흡수한다.
    return fallback('timeout')
  } finally {
    clearTimeout(timer)
  }
}
