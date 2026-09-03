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
import { rejectForeignOrigin } from './_origin.js'
import { R3_SCOPE, BASE_INFO_CATEGORIES_BY_ID } from '../src/data/law.js'
import { TRANSMIT_LIMITS } from '../src/data/privacy.js'

const MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 2048
/** Vercel 함수 maxDuration(30s)보다 짧게 잡아 함수가 죽기 전에 우리가 에러를 반환한다 */
const TIMEOUT_MS = 22_000

/**
 * 사용자 서술 길이 상한. 프롬프트 폭주 방지.
 * ★ 화면의 입력 제한(maxLength)과 같은 값을 써야 한다. 여기서 말없이 자르면
 *   사용자는 뒷부분이 빠진 줄 모른다. 그래서 상수를 한 곳에서 읽는다.
 */
const MAX_SITUATION_CHARS = TRANSMIT_LIMITS.situation

const capacity = BASE_INFO_CATEGORIES_BY_ID[R3_SCOPE.categoryId]

/**
 * 시스템 프롬프트.
 * 법 조문 원문을 직접 박아 넣는다. LLM이 조문을 기억해서 쓰게 하지 않는다.
 */
/** 테스트에서 프롬프트에 법령 원문이 들어갔는지 확인할 수 있게 export 한다 */
export const SYSTEM_PROMPT = `당신은 대한민국 신용정보법에 따른 서류 작성을 돕는 보조 도구입니다.

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

[선정이유 — 왜 하필 이 사람에게 이 항목인가]
각 후보마다 "선정이유"를 한 문장으로 적으십시오.
- 사용자가 쓴 서술에 **실제로 있는 표현**을 작은따옴표로 인용하고, 그 대목 때문에 이 항목을
  골랐다고 쓰십시오. 인용은 사용자 문장에 그대로 있는 말이어야 합니다.
- 서술에 없는 사실을 지어내지 마십시오. 나이·소득·직장명을 추측해 쓰지 마십시오.
- 인용할 대목이 없으면 "선정이유"를 빈 문자열("")로 두십시오. 억지로 만들지 마십시오.
- 사람됨에 대한 판단(성실해 보인다, 안타깝다 등)을 근거로 들지 마십시오.
  위 법정 범주(직업·재산·채무·소득의 총액·납세실적) 안의 사실만 근거가 됩니다.
- 예: "'프리랜서로 3년'이라고 하셨는데, 고용 형태와 무관하게 소득의 지속성을 보여주는
  자료가 필요합니다."

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
      "선정이유": "사용자 표현을 인용한 한 문장. 인용할 것이 없으면 빈 문자열",
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

/** 인용 부호 안의 말. 작은따옴표·큰따옴표(전각 포함)를 모두 본다. */
const QUOTE_RE = /['\u2018"\u201c]([^'\u2019"\u201d]{2,80})['\u2019"\u201d]/g
const squash = (s) => String(s ?? '').replace(/\s+/g, '')

/**
 * 선정이유 가드.
 *
 * ★ 이 필드는 "AI가 사용자 글을 읽었다"는 주장이다. 근거 없이 표시하면 그 주장이 거짓이 된다.
 *   그래서 두 종류로 나눠 버린다.
 *     반환 null → 근거 자체가 법정 범주 밖이다. **항목째 버린다.**
 *                (예: "성실해 보이셔서" — 직업·재산·채무·소득·납세실적이 아니다)
 *     반환 ''   → 항목은 유효하나 이유를 확인할 수 없다. **이유만 버린다.**
 *                (인용이 없거나, 인용한 말이 사용자 서술에 없다 = 지어낸 인용)
 *
 * (테스트용으로 export)
 */
export function groundedReason(reason, situation) {
  const text = String(reason ?? '').trim()
  if (!text) return ''
  // 근거가 범주 밖이면 항목째 버린다
  if (R3_SCOPE.deniedTerms.some((t) => text.includes(t))) return null
  if (R3_SCOPE.reasonDeniedTerms.some((t) => text.includes(t))) return null

  const hay = squash(situation)
  if (!hay) return ''
  let quoted = 0
  for (const m of text.matchAll(QUOTE_RE)) {
    quoted += 1
    // 사용자가 쓰지 않은 말을 인용했다 → 환각. 이유를 버린다.
    if (!hay.includes(squash(m[1]))) return ''
  }
  // 인용이 하나도 없으면 사용자 글에서 왔는지 확인할 방법이 없다
  return quoted > 0 ? text : ''
}

/**
 * 서버 측 가드. 클라이언트를 믿지 않는다.
 * R3_SCOPE 밖 제안을 버리고, 최대 개수를 강제한다.
 * (테스트용으로 export)
 *
 * @param {object[]} candidates
 * @param {string} [situation] 선정이유의 인용을 대조할 사용자 서술
 */
export function applyGuards(candidates, situation = '') {
  const cleaned = []
  for (const c of candidates ?? []) {
    if (!c || typeof c !== 'object') continue
    const name = String(c['정보명'] ?? '').trim()
    const detail = String(c['세부내용'] ?? '').trim()
    if (!name || !detail) continue

    const haystack = `${name} ${detail} ${c['증빙서류'] ?? ''}`
    if (R3_SCOPE.deniedTerms.some((t) => haystack.includes(t))) continue

    const reason = groundedReason(c['선정이유'], situation)
    if (reason === null) continue

    cleaned.push({
      정보명: name,
      세부내용: detail,
      증빙서류: String(c['증빙서류'] ?? '').trim(),
      선정이유: reason,
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
  // ★ 키 확인보다 먼저 — 낯선 출처는 키가 있든 없든 403 이다 (_origin.js)
  if (rejectForeignOrigin(req, res)) return

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

    const candidates = applyGuards(parsed, situation)
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
