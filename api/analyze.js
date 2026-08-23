/**
 * POST /api/analyze — R3(유리한 정보 제출) 후보 생성
 *
 * 이 서비스에서 LLM이 실제로 일하는 유일한 지점이다.
 *
 * ── 절대 규칙 (CLAUDE.md) ────────────────────────────────────────
 * - AI는 법을 해석하지 않는다. 사용자 상황을 R3_SCOPE 안의 항목으로 번역할 뿐이다.
 * - 법조문·거절 사유·서식 문구·절차·기한은 LLM이 생성하지 않는다.
 *   전부 src/data/law.js 의 상수를 쓰고, 프롬프트에도 그 원문을 직접 넣는다.
 *   (LLM의 기억에 의존하지 않는다)
 * - ANTHROPIC_API_KEY 는 서버 환경변수로만 접근한다. 클라이언트에 절대 노출하지 않는다.
 * - 요청/응답을 로깅하지 않는다. 개인 상황 서술이 들어온다.
 * - 서버 측 영속 저장소를 두지 않는다.
 * ────────────────────────────────────────────────────────────────
 */
import Anthropic from '@anthropic-ai/sdk'
import { R3_SCOPE, BASE_INFO_CATEGORIES_BY_ID } from '../src/data/law.js'

const MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 2048
/** Vercel 함수 maxDuration(30s)보다 짧게 잡아 함수가 죽기 전에 우리가 에러를 반환한다 */
const TIMEOUT_MS = 22_000

/** 사용자 서술 길이 상한. 프롬프트 폭주 방지. */
const MAX_SITUATION_CHARS = 2000

const capacity = BASE_INFO_CATEGORIES_BY_ID[R3_SCOPE.categoryId]

/**
 * 시스템 프롬프트.
 * 법 조문 원문을 직접 박아 넣는다. LLM이 조문을 기억해서 쓰게 하지 않는다.
 */
const SYSTEM_PROMPT = `당신은 대한민국 신용정보법에 따른 서류 작성을 돕는 보조 도구입니다.

[역할의 한계 — 반드시 지킬 것]
- 당신은 법률 자문을 하지 않습니다. 서류에 적을 항목을 정리해 주는 서류 작성 보조입니다.
- 법 조문을 해석하거나 새로 만들지 마십시오. 조문 내용은 아래에 주어진 것이 전부입니다.
- 사용자의 상황을 아래 법정 범주 안의 "제출 가능한 정보 항목"으로 번역하는 것이 유일한 임무입니다.
- 승소 가능성, 권리 유무, 법적 효과를 단정하지 마십시오.

[근거 조문 — ${R3_SCOPE.rightBasis}]
신용정보주체는 자동화평가 결과의 산출에 유리하다고 판단되는 정보를 제출할 수 있습니다.

[제출할 수 있는 정보의 법정 범주 — ${R3_SCOPE.definitionBasis} "${R3_SCOPE.categoryLabel}"]
"${R3_SCOPE.definition}"

이 정의에 포함되는 것만 제안하십시오. 법이 열거한 항목: ${capacity.examples.join(', ')}.

[범주 밖 — 절대 제안 금지]
${R3_SCOPE.outOfScopeNote}
다음은 어떤 경우에도 제안하지 마십시오: ${R3_SCOPE.deniedTerms.join(', ')}.

[출력 형식 — 고시 서식의 예시를 따를 것]
공식 서식에 실린 예시:
  정보명: ${R3_SCOPE.formExample.infoName}
  세부내용: ${R3_SCOPE.formExample.detail}

세부내용은 기간과 실적을 구체적인 수치로 적는 형태여야 합니다.
사용자가 실제 수치를 모를 수 있으므로, 사용자가 채워 넣을 자리를 남겨도 됩니다.

[개인정보]
사용자에게 이름, 주민등록번호, 연락처, 계좌번호를 묻지 마십시오.
제안에도 개인 식별정보를 포함하지 마십시오.

[응답 형식]
아래 JSON만 출력하십시오. 설명, 인사말, 마크다운 코드펜스를 붙이지 마십시오.
{
  "candidates": [
    {
      "정보명": "짧은 명사구",
      "세부내용": "기간·실적을 구체적 수치로",
      "증빙서류": "어디서 발급받는지",
      "근거범주": "${R3_SCOPE.categoryLabel}"
    }
  ]
}
후보는 최대 ${R3_SCOPE.maxCandidates}개입니다.`

/** 마크다운 코드펜스를 벗기고 JSON 파싱. 실패하면 null. (테스트용으로 export) */
export function parseCandidates(raw) {
  if (!raw) return null
  let text = raw.trim()
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fence) text = fence[1].trim()
  else {
    // 앞뒤에 잡소리가 붙은 경우 가장 바깥 중괄호만 추출
    const first = text.indexOf('{')
    const last = text.lastIndexOf('}')
    if (first !== -1 && last > first) text = text.slice(first, last + 1)
  }
  try {
    const parsed = JSON.parse(text)
    return Array.isArray(parsed?.candidates) ? parsed.candidates : null
  } catch {
    return null
  }
}

/**
 * 서버 측 가드. 클라이언트를 믿지 않는다.
 * R3_SCOPE 밖 제안을 버리고, 최대 개수를 강제한다.
 * (테스트용으로 export)
 */
export function applyGuards(candidates) {
  const cleaned = []
  for (const c of candidates ?? []) {
    if (!c || typeof c !== 'object') continue
    const name = String(c['정보명'] ?? '').trim()
    const detail = String(c['세부내용'] ?? '').trim()
    if (!name || !detail) continue

    const haystack = `${name} ${detail} ${c['증빙서류'] ?? ''}`
    if (R3_SCOPE.deniedTerms.some((t) => haystack.includes(t))) continue

    cleaned.push({
      정보명: name,
      세부내용: detail,
      증빙서류: String(c['증빙서류'] ?? '').trim(),
      // 근거범주는 LLM이 정하게 두지 않는다. 법정 범주로 고정한다.
      근거범주: R3_SCOPE.categoryLabel,
    })
    if (cleaned.length >= R3_SCOPE.maxCandidates) break
  }
  return cleaned
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    // 키가 없어도 화면은 폴백으로 계속 간다. 클라이언트가 이 코드를 보고 폴백한다.
    return res.status(503).json({ error: 'api_unavailable', reason: 'not_configured' })
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  const situation = String(body?.situation ?? '').slice(0, MAX_SITUATION_CHARS).trim()
  const eventLabel = String(body?.eventLabel ?? '').slice(0, 100)
  const sectorLabel = String(body?.sectorLabel ?? '').slice(0, 100)

  if (!situation) {
    return res.status(400).json({ error: 'situation_required' })
  }

  const userPrompt = [
    eventLabel && `겪은 일: ${eventLabel}`,
    sectorLabel && `상대 기관 업권: ${sectorLabel}`,
    `본인이 짐작하는 사유:\n${situation}`,
    '',
    '위 상황에서 제출하면 유리할 수 있는 정보 후보를 JSON으로 제시하십시오.',
  ]
    .filter(Boolean)
    .join('\n')

  const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 })

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      // 단순 번역 작업이므로 낮은 effort 로 비용과 지연을 줄인다.
      output_config: { effort: 'low' },
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    })

    if (response.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'refused' })
    }

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')

    const parsed = parseCandidates(text)
    if (!parsed) {
      // 파싱 실패. 클라이언트가 폴백을 쓰게 한다.
      return res.status(502).json({ error: 'unparsable_response' })
    }

    const candidates = applyGuards(parsed)
    if (candidates.length === 0) {
      return res.status(502).json({ error: 'no_valid_candidates' })
    }

    return res.status(200).json({ candidates })
  } catch (err) {
    // 요청 본문과 응답은 로깅하지 않는다. 에러 종류만 구분해 돌려준다.
    if (err instanceof Anthropic.APIConnectionTimeoutError) {
      return res.status(504).json({ error: 'timeout' })
    }
    if (err instanceof Anthropic.AuthenticationError) {
      return res.status(503).json({ error: 'api_unavailable', reason: 'auth' })
    }
    if (err instanceof Anthropic.RateLimitError) {
      return res.status(429).json({ error: 'rate_limited' })
    }
    if (err instanceof Anthropic.APIConnectionError) {
      return res.status(503).json({ error: 'api_unavailable', reason: 'connection' })
    }
    if (err instanceof Anthropic.APIError) {
      return res.status(502).json({ error: 'api_error', status: err.status ?? null })
    }
    return res.status(500).json({ error: 'internal_error' })
  }
}

function safeJson(s) {
  try {
    return JSON.parse(s)
  } catch {
    return null
  }
}
