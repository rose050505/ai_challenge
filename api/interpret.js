/**
 * POST /api/interpret — 금융회사 회신 해석
 *
 * ── 역할 한정 (CLAUDE.md 원칙) ──────────────────────────────────
 * 법정 분류는 코드가, 자연어 해석만 AI가 한다.
 *
 * AI가 하는 것: 붙여넣은 회신 텍스트를 읽고
 *   - 시행령 §31-2⑧ 3유형 중 무엇이 설명됐고 무엇이 빠졌는지 분류
 *   - 기초정보 항목을 뽑아 5분류에 배치 (명백한 오분류는 코드가 보정)
 *   - 거절(법 §36-2③)인지, 설명 범위의 법정 제외(시행령 §31-2⑧3호 단서)인지 구분
 *
 * ★ AI는 이 둘을 혼동한 전력이 있다. 최종 판정은 applyInterpretGuards 가 한다.
 *   docs/cases/refusal-vs-proviso.md
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
import {
  RESPONSE_TYPES,
  RESPONSE_TYPE_IDS,
  RESPONSE_DISPOSITIONS_BY_ID,
  RESPONSE_LIMITATION,
  BASE_INFO_CATEGORIES,
  BASE_INFO_CATEGORIES_BY_ID,
  BASE_INFO_KEYWORD_RULES,
} from '../src/data/law.js'
import { TRANSMIT_LIMITS } from '../src/data/privacy.js'

const MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 4096
const TIMEOUT_MS = 22_000

/** 회신 텍스트 길이 상한. 화면의 maxLength 와 같은 상수를 읽는다. */
const MAX_RESPONSE_CHARS = TRANSMIT_LIMITS.responseText
/** 기초정보 항목 수 상한 */
const MAX_BASE_INFO_ITEMS = 20

const CATEGORY_LABELS = BASE_INFO_CATEGORIES.map((c) => c.label)
const FALLBACK_CATEGORY = BASE_INFO_CATEGORIES.find((c) => c.id === 'other').label

const D_REFUSED = RESPONSE_DISPOSITIONS_BY_ID.refused
const D_EXCLUDED = RESPONSE_DISPOSITIONS_BY_ID.excludedByProviso

/** 5분류의 법정 정의와 예시를 전부 주입한다. 분류명만 주고 알아서 판단하게 두지 않는다. */
const CATEGORY_BLOCK = BASE_INFO_CATEGORIES.map(
  (c) => `- ${c.label} (${c.definitionBasis})\n  법이 든 예: ${c.examples.join(', ')}`,
).join('\n')

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

[기초정보 항목 추출]
회신문에 개별 정보 항목이 열거되어 있으면 baseInfoItems 로 뽑으십시오.
각 항목의 "분류"는 반드시 아래 다섯 중 하나여야 합니다. 법이 정한 정의와 예시입니다.
${CATEGORY_BLOCK}
법이 예로 든 단어가 항목 이름에 그대로 나오면 그 분류를 쓰십시오.
특히 직업·재산·채무·소득·납세실적·건강보험 납부실적은 "신용거래능력 판단정보"입니다.
식별정보는 성명·주소·전화번호·개인식별번호·생체정보에 한정됩니다.
그 밖에 판단이 어려우면 "${FALLBACK_CATEGORY}"로 두십시오. 최대 ${MAX_BASE_INFO_ITEMS}개.
"내용"은 회신문에 적힌 값을 그대로 옮기십시오. 추측해서 채우지 마십시오.

[★ 반드시 구분할 것 — 거절과 법정 제외는 다른 개념입니다]

A. ${D_REFUSED.label} (${D_REFUSED.basis})
   ${D_REFUSED.text}
   요구에 응하지 않겠다는 취지일 때만 refused 를 true 로 하십시오.
   예: "동일한 거래에 대해 반복하여 요구하셨으므로 응할 수 없습니다",
       "다른 법령상 의무 때문에 안내가 불가합니다"

B. ${D_EXCLUDED.label} (${D_EXCLUDED.basis})
   ${D_EXCLUDED.text}
   해당 단서: "${RESPONSE_LIMITATION.proviso}"
   요구에는 답하면서 일부 내용만 제외한 취지일 때 excludedByProviso 를 true 로 하십시오.
   예: "가중치 산정 방식은 당사가 자체 개발·가공하여 생성한 정보이므로 제공 대상에서 제외됩니다",
       "세부 지표는 자체적으로 가공·추론하여 산출한 것으로 제공이 어렵습니다"

"제외", "제공 대상이 아님", "자체 개발", "자체 가공", "산출" 이라는 표현은
그 자체로 거절이 아닙니다. B입니다. refused 를 true 로 하지 마십시오.
회신이 세 유형에 모두 답하고 있다면 그것은 어떤 경우에도 거절이 아닙니다.

refusalReasonText 에는 A의 사유 문장을, provisoText 에는 B의 문장을
회신문에 적힌 그대로 옮기십시오. 없으면 빈 문자열로 두십시오. 지어내지 마십시오.

[응답 형식]
아래 JSON만 출력하십시오. 설명, 인사말, 마크다운 코드펜스를 붙이지 마십시오.
{
  "covered": ["result"],
  "missing": ["criteria", "baseInfo"],
  "baseInfoItems": [
    { "항목": "항목 이름", "내용": "회신에 적힌 값", "분류": "${CATEGORY_LABELS[0]}" }
  ],
  "refused": false,
  "refusalReasonText": "",
  "excludedByProviso": false,
  "provisoText": ""
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
 * 항목 이름을 법정 정의와 대조해 명백한 오분류만 바로잡는다. (테스트용 export)
 *
 * 항목 이름만 본다. 내용까지 보면 "총 대출 잔액 — 연체 없음" 같은 값에서
 * 엉뚱한 규칙이 걸린다.
 *
 * 보정한 경우 correctedFrom / correctionBasis 를 남긴다.
 * 화면은 이 값을 보고 사용자에게 "바꿀 수 있다"고 알린다. 최종 판단은 사용자 몫이다.
 */
export function correctCategory(name, claimed) {
  for (const rule of BASE_INFO_KEYWORD_RULES) {
    if (!rule.keywords.some((k) => name.includes(k))) continue
    const label = BASE_INFO_CATEGORIES_BY_ID[rule.categoryId].label
    if (label === claimed) break
    return { 분류: label, correctedFrom: claimed, correctionBasis: rule.basis }
  }
  return { 분류: claimed, correctedFrom: null, correctionBasis: null }
}

/**
 * 서버 가드. 클라이언트도 LLM도 믿지 않는다. (테스트용 export)
 * - covered/missing 은 세 리터럴 외 전부 버린다
 * - 분류는 5분류로 강제하고, 벗어나면 "기타 정보"로 귀속시킨 뒤 법정 정의로 보정한다
 * - baseInfoItems 는 최대 20개
 * - ★ 거절(법 §36-2③)과 법정 제외(시행령 §31-2⑧3호 단서)의 논리 검증
 */
export function applyInterpretGuards(parsed) {
  const pickIds = (arr) =>
    [...new Set((Array.isArray(arr) ? arr : []).filter((x) => RESPONSE_TYPE_IDS.includes(x)))]

  const covered = pickIds(parsed?.covered)
  // 같은 유형이 양쪽에 들어오면 covered 를 우선한다
  const claimedMissing = pickIds(parsed?.missing).filter((id) => !covered.includes(id))
  // 세 유형 중 covered 도 missing 도 아닌 것은 missing 으로 본다
  const missing = [
    ...new Set([
      ...claimedMissing,
      ...RESPONSE_TYPE_IDS.filter((id) => !covered.includes(id) && !claimedMissing.includes(id)),
    ]),
  ]

  const items = []
  for (const raw of Array.isArray(parsed?.baseInfoItems) ? parsed.baseInfoItems : []) {
    if (!raw || typeof raw !== 'object') continue
    const name = String(raw['항목'] ?? '').trim()
    const value = String(raw['내용'] ?? '').trim()
    if (!name) continue
    const claimed = String(raw['분류'] ?? '').trim()
    const normalized = CATEGORY_LABELS.includes(claimed) ? claimed : FALLBACK_CATEGORY
    items.push({ 항목: name, 내용: value, ...correctCategory(name, normalized) })
    if (items.length >= MAX_BASE_INFO_ITEMS) break
  }

  let refused = parsed?.refused === true
  let refusalReasonText = String(parsed?.refusalReasonText ?? '').trim()
  let excludedByProviso = parsed?.excludedByProviso === true
  let provisoText = String(parsed?.provisoText ?? '').trim()

  // ★ 논리 검증 — AI가 뭐라 하든 코드가 판정한다.
  //
  //   법 제36조의2 제3항의 "거절"은 요구 자체에 응하지 않은 것이다.
  //   세 유형을 모두 설명했다면 요구에 응한 것이므로 거절일 수 없다.
  //   (missing 은 위에서 세 유형으로 채워지므로, missing 이 비었다는 것과
  //    covered 가 세 유형을 모두 포함한다는 것은 같은 조건이다.)
  //
  //   이때 AI가 거절 사유라고 넘긴 문장은 시행령 제31조의2 제8항 제3호 단서의
  //   법정 제외(가공·추론 정보 제외)를 가리키는 것이므로 provisoText 로 옮긴다.
  if (refused && missing.length === 0) {
    refused = false
    if (refusalReasonText) {
      if (!provisoText) provisoText = refusalReasonText
      excludedByProviso = true
      refusalReasonText = ''
    }
  }

  return {
    covered,
    missing,
    baseInfoItems: items,
    refused,
    refusalReasonText,
    excludedByProviso,
    provisoText,
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
