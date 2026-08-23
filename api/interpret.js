/**
 * POST /api/interpret — 금융회사 회신 해석
 *
 * ── 역할 한정 (CLAUDE.md 원칙) ──────────────────────────────────
 * 법정 분류는 코드가, 자연어 해석만 AI가 한다.
 *
 * AI가 하는 것: 붙여넣은 회신 텍스트를 읽고
 *   - 시행령 §31-2⑧ 3유형 중 무엇이 설명됐고 무엇이 빠졌는지 분류
 *   - 기초정보 항목을 뽑아 5분류에 배치
 *   - 거절 여부와 회신에 적힌 거절 사유 원문 추출
 *
 * AI가 하지 않는 것:
 *   - 회신이 적법한지 판단하지 않는다
 *   - 다음 행동을 지시하지 않는다 (코드가 정한다)
 *   - 거절 사유가 정당한지 평가하지 않는다
 *   - 법 조문을 생성하지 않는다
 *
 * ⚠️ 회신에는 개인 신용정보가 들어있다. 요청·응답을 로깅하지 않는다.
 *    서버 측 영속 저장소를 두지 않는다.
 * ────────────────────────────────────────────────────────────────
 */
import Anthropic from '@anthropic-ai/sdk'
import { RESPONSE_TYPES, RESPONSE_TYPE_IDS, BASE_INFO_CATEGORIES } from '../src/data/law.js'

const MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 4096
const TIMEOUT_MS = 22_000

/** 회신 텍스트 길이 상한 */
const MAX_RESPONSE_CHARS = 12_000
/** 기초정보 항목 수 상한 */
const MAX_BASE_INFO_ITEMS = 20

const CATEGORY_LABELS = BASE_INFO_CATEGORIES.map((c) => c.label)
const FALLBACK_CATEGORY = BASE_INFO_CATEGORIES.find((c) => c.id === 'other').label

const SYSTEM_PROMPT = `당신은 금융회사가 보낸 회신문을 읽고 분류하는 도구입니다.

[역할의 한계 — 반드시 지킬 것]
- 회신이 적법한지, 충분한지 판단하지 마십시오.
- 사용자에게 다음에 무엇을 하라고 지시하지 마십시오.
- 거절 사유가 정당한지 평가하지 마십시오.
- 법 조문을 만들거나 인용하지 마십시오.
- 당신의 임무는 오직 "회신문에 무엇이 적혀 있는가"를 분류하는 것입니다.

[분류 축 — 세 가지 유형]
${RESPONSE_TYPES.map((t) => `- ${t.id}: ${t.label}\n  (금융회사는 보통 이렇게 답합니다: ${t.text})`).join('\n')}

회신문에 각 유형의 내용이 실제로 담겨 있으면 covered 에, 없으면 missing 에 넣으십시오.
"자체 가공·추론한 정보라 제공할 수 없다"는 취지로 거절된 유형은 missing 에 넣으십시오.

[기초정보 항목 추출]
회신문에 개별 정보 항목이 열거되어 있으면 baseInfoItems 로 뽑으십시오.
각 항목의 "분류"는 반드시 아래 다섯 중 하나여야 합니다:
${CATEGORY_LABELS.map((l) => `- ${l}`).join('\n')}
판단이 어려우면 "${FALLBACK_CATEGORY}"로 두십시오. 최대 ${MAX_BASE_INFO_ITEMS}개.
"내용"은 회신문에 적힌 값을 그대로 옮기십시오. 추측해서 채우지 마십시오.

[거절 여부]
회신이 요구를 거절하는 취지이면 refused 를 true 로 하고,
회신문에 적힌 거절 사유 문장을 refusalReasonText 에 원문 그대로 옮기십시오.
사유가 적혀 있지 않으면 빈 문자열로 두십시오. 사유를 지어내지 마십시오.

[응답 형식]
아래 JSON만 출력하십시오. 설명, 인사말, 마크다운 코드펜스를 붙이지 마십시오.
{
  "covered": ["result"],
  "missing": ["criteria", "baseInfo"],
  "baseInfoItems": [
    { "항목": "항목 이름", "내용": "회신에 적힌 값", "분류": "${CATEGORY_LABELS[0]}" }
  ],
  "refused": false,
  "refusalReasonText": ""
}`

/** 마크다운 코드펜스를 벗기고 JSON 파싱. 실패하면 null. (테스트용 export) */
export function parseInterpretation(raw) {
  if (!raw) return null
  let text = raw.trim()
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fence) text = fence[1].trim()
  else {
    const first = text.indexOf('{')
    const last = text.lastIndexOf('}')
    if (first !== -1 && last > first) text = text.slice(first, last + 1)
  }
  try {
    const parsed = JSON.parse(text)
    return parsed && typeof parsed === 'object' ? parsed : null
  } catch {
    return null
  }
}

/**
 * 서버 가드. 클라이언트도 LLM도 믿지 않는다. (테스트용 export)
 * - covered/missing 은 세 리터럴 외 전부 버린다
 * - 분류는 5분류로 강제하고, 벗어나면 "기타 정보"로 귀속시킨다
 * - baseInfoItems 는 최대 20개
 */
export function applyInterpretGuards(parsed) {
  const pickIds = (arr) =>
    [...new Set((Array.isArray(arr) ? arr : []).filter((x) => RESPONSE_TYPE_IDS.includes(x)))]

  const covered = pickIds(parsed?.covered)
  // 같은 유형이 양쪽에 들어오면 covered 를 우선한다
  const missing = pickIds(parsed?.missing).filter((id) => !covered.includes(id))

  const items = []
  for (const raw of Array.isArray(parsed?.baseInfoItems) ? parsed.baseInfoItems : []) {
    if (!raw || typeof raw !== 'object') continue
    const name = String(raw['항목'] ?? '').trim()
    const value = String(raw['내용'] ?? '').trim()
    if (!name) continue
    const claimed = String(raw['분류'] ?? '').trim()
    const category = CATEGORY_LABELS.includes(claimed) ? claimed : FALLBACK_CATEGORY
    items.push({ 항목: name, 내용: value, 분류: category })
    if (items.length >= MAX_BASE_INFO_ITEMS) break
  }

  return {
    covered,
    // 세 유형 중 covered 도 missing 도 아닌 것은 missing 으로 본다
    missing: [...new Set([...missing, ...RESPONSE_TYPE_IDS.filter((id) => !covered.includes(id) && !missing.includes(id))])],
    baseInfoItems: items,
    refused: parsed?.refused === true,
    refusalReasonText: String(parsed?.refusalReasonText ?? '').trim(),
  }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) {
    return res.status(503).json({ error: 'api_unavailable', reason: 'not_configured' })
  }

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  const responseText = String(body?.responseText ?? '').slice(0, MAX_RESPONSE_CHARS).trim()
  if (!responseText) return res.status(400).json({ error: 'response_text_required' })

  const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 1 })

  try {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: MAX_TOKENS,
      output_config: { effort: 'low' },
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `아래는 금융회사로부터 받은 회신문입니다. 분류해 주십시오.\n\n---\n${responseText}\n---`,
        },
      ],
    })

    if (response.stop_reason === 'refusal') {
      return res.status(422).json({ error: 'refused_by_model' })
    }

    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')

    const parsed = parseInterpretation(text)
    if (!parsed) return res.status(502).json({ error: 'unparsable_response' })

    return res.status(200).json(applyInterpretGuards(parsed))
  } catch (err) {
    // 회신 본문은 로깅하지 않는다. 에러 종류만 구분한다.
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
