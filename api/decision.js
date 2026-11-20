/**
 * POST /api/decision — 확장 범위(개인정보 보호법 제37조의2)의 AI 두 가지 (2026-11-20)
 *
 *   mode: 'suggest'  사용자가 쓴 사정 → 「제출할 의견 · 정보」 후보
 *                    (시행령 제44조의2 제2항 제2호의 검토 요구에 담을 것)
 *   mode: 'reply'    기관 회신문 → 법정 설명 4항목(시행령 제44조의3 제2항) 중 어떤 문장이 무엇에 해당하나
 *
 * ── 절대 규칙 (analyze.js 와 같다) ─────────────────────────────────
 * - AI 는 권리 유무를 판단하지 않는다. 그 판정은 src/lib/pipa-judge.js 가 한다.
 * - 조문 문장은 src/data/law.js 의 상수를 프롬프트에 그대로 넣는다. AI 의 기억에 기대지 않는다.
 * - AI 가 「찾았다」고 한 것은 **원문에 그 문장이 실제로 있을 때만** 인정한다 (서버 대조).
 * - ANTHROPIC_API_KEY 는 서버 환경변수로만. 요청 · 응답을 로깅하지 않는다. 저장소를 두지 않는다.
 * ────────────────────────────────────────────────────────────────
 */
import Anthropic from '@anthropic-ai/sdk'
import { rejectForeignOrigin } from './_origin.js'
import {
  PIPA_DECISION_KINDS_BY_ID,
  PIPA_EXPLANATION_ITEMS,
  PIPA_SUGGEST_SCOPE,
} from '../src/data/law.js'
import { TRANSMIT_LIMITS } from '../src/data/privacy.js'

const MODEL = 'claude-sonnet-5'
const MAX_TOKENS = 2048
/** analyze.js 와 같은 이유로 22초, 재시도 없음 (그 파일의 TIMEOUT_MS 주석) */
const TIMEOUT_MS = 22_000

const squash = (s) => String(s ?? '').replace(/\s+/g, '')
const QUOTE_RE = /['‘"“]([^'’"”]{2,80})['’"”]/g

/* ─────────────────────────── suggest ─────────────────────────── */

export const SUGGEST_PROMPT = `당신은 대한민국 개인정보 보호법에 따른 요구서 작성을 돕는 보조 도구입니다.

[역할의 한계 — 반드시 지킬 것]
- 법률 자문을 하지 않습니다. 권리가 있는지, 결정이 위법한지, 결과가 바뀔지 판단하거나 단정하지 마십시오.
- 당신의 유일한 임무: 사용자가 쓴 사정을 읽고, 자동화된 결정에 **반영되지 않았을 수 있는 사용자 본인의 정보**를
  「제출할 의견」 후보로 정리하는 것입니다.

[근거 — ${PIPA_SUGGEST_SCOPE.basis}]
정보주체는 "${PIPA_SUGGEST_SCOPE.lawText}"를 요구할 수 있습니다.

[제안할 수 있는 것]
- 결정에 쓰였어야 할 사용자 본인의 사실 정보: 경력 · 자격 · 학습 이력 · 활동 기록 · 근무 기록 · 평가 기록 등.
- 그 정보를 보여 줄 자료(예: 경력증명서, 자격증 사본, 운행 기록 화면).
- 결정에 쓰인 정보가 틀렸거나 오래됐을 가능성(예: 이미 해결된 고객 신고가 남아 있음).

[절대 제안 금지]
- 사람됨 · 동정 · 외모 · 학벌 · 출신 지역 · 종교 · 정치 성향에 대한 판단이나 정보.
- 법적 결론(위법, 무효, 승소 등).

[선정이유]
각 후보마다 한 문장. 사용자 서술에 **실제로 있는 표현**을 작은따옴표로 인용하고, 그 대목 때문에 골랐다고 쓰십시오.
서술에 없는 사실을 지어내지 마십시오. 인용할 대목이 없으면 빈 문자열("")로 두십시오.
인용만 적지 말고, 왜 그 정보가 결정에 빠졌을 수 있는지 이어서 한 문장으로 쓰십시오.
예: "'지원서 양식에 경력을 넣을 칸이 없어서'라고 하셨으니, 자동 심사가 경력을 보지 못했을 수 있습니다."

[개인정보]
이름 · 주민등록번호 · 연락처 · 회사 실명을 묻거나 답에 넣지 마십시오.

[응답 형식]
아래 JSON만 출력하십시오. 설명 · 인사말 · 코드펜스를 붙이지 마십시오.
{
  "candidates": [
    { "정보": "짧은 명사구", "자료": "그 정보를 보여 줄 자료", "선정이유": "사용자 표현을 인용한 한 문장 또는 빈 문자열" }
  ]
}
후보는 최대 ${PIPA_SUGGEST_SCOPE.maxCandidates}개입니다.`

/**
 * 선정이유 가드 — analyze.js groundedReason 과 같은 규칙.
 *   null → 근거가 범주 밖(사람 평가 등). 항목째 버린다.
 *   ''   → 인용이 없거나 지어낸 인용, 또는 법적 결론. 이유만 버린다.
 * (테스트용 export)
 */
export function groundedSuggestReason(reason, story) {
  const text = String(reason ?? '').trim()
  if (!text) return ''
  if (PIPA_SUGGEST_SCOPE.deniedTerms.some((t) => text.includes(t))) return null
  if (PIPA_SUGGEST_SCOPE.verdictTerms.some((t) => text.includes(t))) return ''
  const hay = squash(story)
  if (!hay) return ''
  let quoted = 0
  for (const m of text.matchAll(QUOTE_RE)) {
    quoted += 1
    if (!hay.includes(squash(m[1]))) return ''
  }
  return quoted > 0 ? text : ''
}

/** 제안 가드. 범주 밖 항목을 버리고 개수를 자른다. (테스트용 export) */
export function guardSuggestions(candidates, story = '') {
  const out = []
  for (const c of candidates ?? []) {
    if (!c || typeof c !== 'object') continue
    const info = String(c['정보'] ?? '').trim().slice(0, 80)
    const doc = String(c['자료'] ?? '').trim().slice(0, 120)
    if (!info) continue
    const hay = `${info} ${doc}`
    if (PIPA_SUGGEST_SCOPE.deniedTerms.some((t) => hay.includes(t))) continue
    if (PIPA_SUGGEST_SCOPE.verdictTerms.some((t) => hay.includes(t))) continue
    const reason = groundedSuggestReason(c['선정이유'], story)
    if (reason === null) continue
    out.push({ 정보: info, 자료: doc, 선정이유: reason })
    if (out.length >= PIPA_SUGGEST_SCOPE.maxCandidates) break
  }
  return out
}

/* ──────────────────────────── reply ──────────────────────────── */

export const REPLY_PROMPT = `당신은 기관이 보낸 회신문에서 법이 정한 설명 항목에 해당하는 문장을 찾아 주는 보조 도구입니다.

[역할의 한계]
- 회신이 적법한지, 충분한지 평가하지 마십시오. 해당 문장을 **찾아서 그대로 옮기기만** 합니다.
- 회신문에 없는 내용을 지어내지 마십시오. 못 찾으면 found 를 false, quote 를 빈 문자열로 두십시오.
- quote 는 회신문의 문장을 **한 글자도 바꾸지 말고** 그대로 옮긴 연속된 부분이어야 합니다(최대 150자).

[법정 설명 항목 — 개인정보 보호법 시행령 제44조의3 제2항]
${PIPA_EXPLANATION_ITEMS.map((it, i) => `${i + 1}. (${it.id}) ${it.law}`).join('\n')}

[함께 찾을 것]
- refused: 요구를 거절한다는 문장
- extended: 처리 기간을 연장한다는 문장
- human: 사람이 다시 검토했다 / 하겠다는 문장

[응답 형식]
아래 JSON만 출력하십시오.
{
  "items": {
${PIPA_EXPLANATION_ITEMS.map((it) => `    "${it.id}": { "found": true, "quote": "회신문 원문 그대로" }`).join(',\n')}
  },
  "refused": { "found": false, "quote": "" },
  "extended": { "found": false, "quote": "" },
  "human": { "found": false, "quote": "" }
}`

const REPLY_FLAGS = ['refused', 'extended', 'human']

/**
 * 회신 가드 — AI 가 찾았다는 문장이 회신문에 **그대로** 있을 때만 found 를 인정한다.
 * 키는 법정 항목 id 와 세 표지로 고정한다. AI 가 다른 키를 만들어도 버린다.
 * (테스트용 export)
 */
export function guardReply(parsed, replyText) {
  const hay = squash(replyText)
  const pick = (v) => {
    const quote = String(v?.quote ?? '').trim().slice(0, 150)
    const ok = v?.found === true && squash(quote).length >= 4 && hay.includes(squash(quote))
    return ok ? { found: true, quote } : { found: false, quote: '' }
  }
  const items = {}
  for (const it of PIPA_EXPLANATION_ITEMS) items[it.id] = pick(parsed?.items?.[it.id])
  const flags = {}
  for (const f of REPLY_FLAGS) flags[f] = pick(parsed?.[f])
  return { items, ...flags }
}

/* ──────────────────────────── triage ─────────────────────────── */
/*
 * 세 질문 미리 답하기 (2026-11-20 개선).
 * ★ AI 는 「답의 후보」만 낸다. 화면은 그것을 미리 고른 상태로 보여 주고 사용자가 고칠 수 있다.
 *   권리 판정은 여전히 lib/pipa-judge.js 가 한다.
 * ★ 근거 인용이 원문(사정 서술 + 받은 결정 한 줄)에 없으면 그 답은 'unk'(모르겠어요)로 되돌린다.
 *   근거 없이 단정한 답은 쓰지 않는다.
 */
export const TRIAGE_OPTIONS = {
  auto: ['no', 'unk', 'yes'],
  big: ['yes', 'unk', 'no'],
  basis: ['unk', 'consent', 'contract', 'law'],
}

/*
 * ★ AI 에게는 yes/no 를 주지 않는다 (2026-11-21 운영 실측).
 *   「사람이 검토했나요?」에 yes/no 로 답하게 했더니 「AI 역량검사 결과로 안내받음」을 근거로
 *   yes(= 사람이 검토)를 골랐다. 질문의 방향과 값의 뜻이 엇갈린 것이다.
 *   그래서 AI 는 뜻이 스스로 드러나는 낱말로 답하고, 서버가 화면의 값으로 바꾼다.
 */
const TRIAGE_WORDS = {
  auto: { automatic: 'no', human: 'yes' },
  big: { large: 'yes', small: 'no' },
  basis: { consent: 'consent', contract: 'contract', law: 'law' },
}

export const TRIAGE_PROMPT = `당신은 사용자가 쓴 글에서 사실을 찾아 세 가지 사항의 답 후보를 고르는 보조 도구입니다.
법적 판단은 하지 않습니다. 글에 근거가 있을 때만 답을 고르고, 없으면 "unknown" 입니다.

[사항과 답]
auto  — 그 결정을 누가 내렸는가
        "automatic" : AI · 자동 심사 · 시스템 · 앱 알림처럼 사람 없이 내려졌다는 단서가 있음
        "human"     : 면접관 · 담당자 · 심사위원처럼 사람이 판단했다는 단서가 있음
big   — 결정이 삶에 준 영향
        "large" : 탈락 · 불합격 · 정지 · 거절 · 해지처럼 결과가 달라짐
        "small" : 안내 · 순서 변경처럼 결과가 달라지지 않음
basis — 결정의 근거
        "consent"  : 본인이 동의했다는 단서
        "contract" : 가입 · 계약 · 약관에 따른 것이라는 단서
        "law"      : 법에 정해져 있다는 단서

[규칙]
- quote 는 사용자 글에서 **한 글자도 바꾸지 않고** 옮긴 연속된 부분(최대 80자)이어야 합니다.
- 짐작으로 고르지 마십시오. 단서가 약하면 "unknown", quote 는 "".
- 플랫폼 일이라는 사실만으로 contract 라고 단정하지 마십시오. 약관 · 계약이라는 말이 있을 때만입니다.

[응답 형식] 아래 JSON만 출력하십시오.
{ "auto": {"answer":"automatic","quote":"..."}, "big": {"answer":"large","quote":"..."}, "basis": {"answer":"unknown","quote":""} }`

/** 답 후보 가드 — 허용된 낱말 + 원문 인용이 있을 때만 화면 값으로 바꿔 인정. (테스트용 export) */
export function guardTriage(parsed, source) {
  const hay = squash(source)
  const out = {}
  for (const q of Object.keys(TRIAGE_OPTIONS)) {
    const v = parsed?.[q]
    const mapped = TRIAGE_WORDS[q][String(v?.answer ?? '')]
    const quote = String(v?.quote ?? '').trim().slice(0, 80)
    const grounded = squash(quote).length >= 2 && hay.includes(squash(quote))
    out[q] = mapped && grounded ? { answer: mapped, quote } : { answer: 'unk', quote: '' }
  }
  return out
}

/* ──────────────────────────── polish ─────────────────────────── */
/*
 * 요구서에 들어갈 의견 문장 다듬기 (2026-11-20 개선).
 * 「빠졌어요」 같은 말투를 「누락되었습니다」 같은 서면 문장으로 바꾼다. 사실은 더하지 않는다.
 * ★ 가드: 원문에 없는 숫자가 나오면 버린다. 사람 평가 · 법적 단정이 있으면 버린다.
 *   길이가 원문의 두 배를 넘으면 버린다(말을 지어 붙인 것).
 */
export const POLISH_PROMPT = `당신은 사용자가 편하게 쓴 사정을 기관에 내는 서면의 문장으로 다듬는 보조 도구입니다.

[규칙]
- 사용자가 쓴 사실만 씁니다. 사실을 더하거나 빼거나 부풀리지 마십시오. 숫자 · 기간 · 날짜는 원문 그대로 둡니다.
- 존댓말 서면체(~습니다)로, 3~5문장. 감정 표현은 사실 진술로 바꿉니다 (예: "억울해요" → 빼거나 "확인을 요청합니다").
- 법적 결론(위법 · 무효 등)이나 상대에 대한 비난을 넣지 마십시오.
- 이름 · 연락처 · 회사 실명은 넣지 마십시오.

[응답 형식] 아래 JSON만 출력하십시오.
{ "opinion": "다듬은 문장" }`

const DIGITS_RE = /\d+(?:[.,]\d+)?/g

/** 다듬은 문장 가드. 통과하면 문자열, 아니면 null. (테스트용 export) */
export function guardPolish(opinion, story) {
  const text = String(opinion ?? '').trim()
  if (!text) return null
  if (text.length > Math.max(200, String(story).length * 2)) return null
  if (PIPA_SUGGEST_SCOPE.deniedTerms.some((t) => text.includes(t))) return null
  if (PIPA_SUGGEST_SCOPE.verdictTerms.some((t) => text.includes(t))) return null
  const src = String(story)
  for (const n of text.match(DIGITS_RE) ?? []) if (!src.includes(n)) return null
  return text
}

/* ─────────────────────────── 공통 ─────────────────────────── */

/** 코드펜스를 벗기고 가장 바깥 중괄호를 파싱. 실패하면 null. (테스트용 export) */
export function parseJsonObject(raw) {
  if (!raw) return null
  let text = String(raw).trim()
  const fence = text.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/)
  if (fence) text = fence[1].trim()
  else {
    const first = text.indexOf('{')
    const last = text.lastIndexOf('}')
    if (first !== -1 && last > first) text = text.slice(first, last + 1)
  }
  try {
    const v = JSON.parse(text)
    return v && typeof v === 'object' ? v : null
  } catch {
    return null
  }
}

async function callClaude(apiKey, system, user) {
  const client = new Anthropic({ apiKey, timeout: TIMEOUT_MS, maxRetries: 0 })
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    output_config: { effort: 'low' },
    system,
    messages: [{ role: 'user', content: user }],
  })
  if (response.stop_reason === 'refusal') return { refused: true }
  const text = response.content
    .filter((b) => b.type === 'text')
    .map((b) => b.text)
    .join('')
  return { text }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'method_not_allowed' })
  }
  if (rejectForeignOrigin(req, res)) return

  const apiKey = process.env.ANTHROPIC_API_KEY
  if (!apiKey) return res.status(503).json({ error: 'api_unavailable', reason: 'not_configured' })

  const body = typeof req.body === 'string' ? safeJson(req.body) : req.body
  const mode = body?.mode

  let system
  let user
  let finish
  if (mode === 'suggest') {
    const story = String(body?.story ?? '').slice(0, TRANSMIT_LIMITS.situation).trim()
    // 분야는 고정 목록의 id 로만 받는다. 이 화면이 다루는 갈래(pipa)만 통과한다.
    const kind = PIPA_DECISION_KINDS_BY_ID[body?.kindId]
    const what = String(body?.what ?? '').slice(0, 200).trim()
    if (!story) return res.status(400).json({ error: 'story_required' })
    if (!kind || kind.route !== 'pipa') return res.status(400).json({ error: 'kind_invalid' })
    system = SUGGEST_PROMPT
    user = [
      `결정 분야: ${kind.label}`,
      what && `받은 결정: ${what}`,
      `본인이 쓴 사정:\n${story}`,
      '',
      '제출하면 결정에 반영될 수 있는 본인 정보 후보를 JSON으로 제시하십시오.',
    ]
      .filter(Boolean)
      .join('\n')
    finish = (parsed) => {
      const candidates = guardSuggestions(parsed?.candidates, story)
      return candidates.length ? { status: 200, json: { candidates } } : { status: 502, json: { error: 'no_valid_candidates' } }
    }
  } else if (mode === 'triage') {
    const story = String(body?.story ?? '').slice(0, TRANSMIT_LIMITS.situation).trim()
    const what = String(body?.what ?? '').slice(0, 200).trim()
    const kind = PIPA_DECISION_KINDS_BY_ID[body?.kindId]
    if (!story && !what) return res.status(400).json({ error: 'story_required' })
    if (!kind || kind.route !== 'pipa') return res.status(400).json({ error: 'kind_invalid' })
    const source = `${what}\n${story}`
    system = TRIAGE_PROMPT
    user = `결정 분야: ${kind.label}\n받은 결정: ${what || '(없음)'}\n사용자가 쓴 사정:\n${story || '(없음)'}\n\n세 질문의 답 후보를 JSON으로 답하십시오.`
    finish = (parsed) => ({ status: 200, json: guardTriage(parsed, source) })
  } else if (mode === 'polish') {
    const story = String(body?.story ?? '').slice(0, TRANSMIT_LIMITS.situation).trim()
    if (!story) return res.status(400).json({ error: 'story_required' })
    system = POLISH_PROMPT
    user = `사용자가 쓴 사정:\n${story}\n\n서면 문장으로 다듬어 JSON으로 답하십시오.`
    finish = (parsed) => {
      const opinion = guardPolish(parsed?.opinion, story)
      return opinion ? { status: 200, json: { opinion } } : { status: 502, json: { error: 'no_valid_candidates' } }
    }
  } else if (mode === 'reply') {
    const replyText = String(body?.replyText ?? '').slice(0, TRANSMIT_LIMITS.responseText).trim()
    if (!replyText) return res.status(400).json({ error: 'reply_required' })
    system = REPLY_PROMPT
    user = `기관 회신문:\n<<<\n${replyText}\n>>>\n\n위 회신문에서 각 항목에 해당하는 문장을 찾아 JSON으로 답하십시오.`
    finish = (parsed) => ({ status: 200, json: guardReply(parsed, replyText) })
  } else {
    return res.status(400).json({ error: 'mode_invalid' })
  }

  try {
    const out = await callClaude(apiKey, system, user)
    if (out.refused) return res.status(422).json({ error: 'refused' })
    const parsed = parseJsonObject(out.text)
    if (!parsed) return res.status(502).json({ error: 'unparsable_response' })
    const { status, json } = finish(parsed)
    return res.status(status).json(json)
  } catch (err) {
    if (err instanceof Anthropic.APIConnectionTimeoutError) return res.status(504).json({ error: 'timeout' })
    if (err instanceof Anthropic.AuthenticationError) return res.status(503).json({ error: 'api_unavailable', reason: 'auth' })
    if (err instanceof Anthropic.RateLimitError) return res.status(429).json({ error: 'rate_limited' })
    if (err instanceof Anthropic.APIConnectionError) return res.status(503).json({ error: 'api_unavailable', reason: 'connection' })
    if (err instanceof Anthropic.APIError) return res.status(502).json({ error: 'api_error', status: err.status ?? null })
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
