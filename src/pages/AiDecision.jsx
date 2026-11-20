/**
 * /ai-decision — 확장 범위: 개인정보 보호법 제37조의2 「자동화된 결정」 (2026-11-20)
 *
 * 채용 · 플랫폼처럼 신용평가가 아닌 AI 결정에 「거부 · 설명 · 검토」를 요구하는 흐름.
 * 네 단계: 무슨 결정 → 권리 확인 → 요구서 → 회신 확인.
 *
 * ★ 역할 분담은 신용 분야와 같다.
 *   권리 판정      lib/pipa-judge.js (코드)
 *   조문 · 문구    data/law.js 의 PIPA_* 상수
 *   AI             /api/decision — 사정 → 제출할 정보 후보, 회신문 → 법정 항목 문장 찾기
 *                  찾았다는 문장은 서버가 원문과 대조한 것만 온다.
 *
 * ★ 이 화면은 기록을 저장하지 않는다 (신용 분야의 여정 저장과 다르다).
 *   새로고침하면 사라진다는 것을 화면이 말한다. 이름 · 연락처 칸은 아예 없다 — 인쇄 뒤 손으로 쓴다.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader, Basis, Card, Notice, Choice, Status } from '../components/ui.jsx'
import {
  PIPA_META,
  PIPA_DECISION_KINDS,
  PIPA_DECISION_KINDS_BY_ID,
  PIPA_ROUTE_NOTES,
  PIPA_QUESTIONS,
  PIPA_RIGHTS,
  PIPA_EXPLANATION_ITEMS,
  PIPA_DEADLINE,
  PIPA_REFUSAL_DUTY,
  PIPA_REMEDIES,
  PIPA_FORM_TEXTS,
  PIPA_SUGGEST_SCOPE,
} from '../data/law.js'
import { DECISION_SAMPLES, DECISION_SAMPLES_BY_ID } from '../data/decision-samples.js'
import { AI_PROCESSING, TRANSMIT_LIMITS } from '../data/privacy.js'
import { judgePipa, checkReply } from '../lib/pipa-judge.js'
import { requestSuggestions, requestReplyCheck } from '../lib/decision-client.js'

const STEPS = ['무슨 결정', '권리 확인', '요구서', '회신 확인']
const ITEM_IDS = PIPA_EXPLANATION_ITEMS.map((i) => i.id)
const TIMINGS = [
  { id: 'in', label: '30일 안에 받았어요' },
  { id: 'ext', label: '연장한다는 안내를 받았어요' },
  { id: 'none', label: '30일이 지나도 답이 없어요' },
]

const EMPTY = {
  kindId: null,
  answers: {},
  org: '',
  when: '',
  what: '',
  story: '',
  picked: [],
  reply: '',
  timing: null,
  present: {},
}

function fmtDate(s) {
  if (!s) return '____년 __월 __일'
  const [y, m, d] = s.split('-')
  return `${y}년 ${Number(m)}월 ${Number(d)}일`
}

function Stepper({ step, onGo, reachable }) {
  return (
    <ol className="no-print mt-5 flex flex-wrap gap-2" aria-label="진행 단계">
      {STEPS.map((label, i) => {
        const n = i + 1
        const cur = n === step
        return (
          <li key={label}>
            <button
              type="button"
              disabled={!reachable(n)}
              onClick={() => onGo(n)}
              aria-current={cur ? 'step' : undefined}
              className={`min-h-11 rounded-md border px-3 text-sm ${
                cur
                  ? 'border-ink-700 bg-ink-700 text-white'
                  : n < step
                    ? 'border-ink-200 bg-ink-50 text-ink-800'
                    : 'border-gray-300 bg-white text-gray-600'
              } disabled:cursor-not-allowed disabled:opacity-50`}
            >
              {n} {label}
            </button>
          </li>
        )
      })}
    </ol>
  )
}

function RightCard({ right, ok }) {
  return (
    <li
      className={`rounded-md border p-3 ${ok ? 'border-ink-300 bg-ink-50' : 'border-gray-300 bg-gray-50'}`}
    >
      <p className="font-bold text-gray-900">
        <span className={ok ? 'text-ink-800' : 'text-gray-600'}>
          <span aria-hidden="true">{ok ? '✓ ' : '✕ '}</span>
          {ok ? '쓸 수 있어요' : '쓸 수 없어요'}
        </span>{' '}
        · {right.label}
      </p>
      <p className="mt-1 text-sm text-gray-700">{right.summary}</p>
      <p className="mt-1 flex flex-wrap gap-1">
        <Basis>{right.basis}</Basis>
        <Basis>{right.actionBasis}</Basis>
      </p>
    </li>
  )
}

export default function AiDecision() {
  const [params, setParams] = useSearchParams()
  const [step, setStep] = useState(1)
  const [s, setS] = useState(EMPTY)
  const [sampleId, setSampleId] = useState(null)
  const [suggest, setSuggest] = useState({ state: 'idle' })
  const [replyAi, setReplyAi] = useState({ state: 'idle' })
  const set = (patch) => setS((p) => ({ ...p, ...patch }))

  // ?sample=hire | platform — 랜딩에서 바로 채운다
  useEffect(() => {
    const id = params.get('sample')
    const sm = id && DECISION_SAMPLES_BY_ID[id]
    if (!sm) return
    setS({
      ...EMPTY,
      kindId: sm.kindId,
      answers: sm.answers,
      org: sm.org,
      when: sm.when,
      what: sm.what,
      story: sm.story,
      reply: sm.reply,
      timing: sm.replyTiming,
    })
    setSampleId(sm.id)
    setSuggest({ state: 'idle' })
    setReplyAi({ state: 'idle' })
    setStep(2)
  }, [params])

  const kind = s.kindId ? PIPA_DECISION_KINDS_BY_ID[s.kindId] : null
  const verdict = useMemo(() => judgePipa(s.answers), [s.answers])
  const reply = checkReply(s.present, s.timing, ITEM_IDS)

  const reachable = (n) =>
    n === 1 ||
    (n === 2 && kind?.route === 'pipa') ||
    (n >= 3 && kind?.route === 'pipa' && verdict.applies)

  const go = (n) => {
    setStep(n)
    window.scrollTo({ top: 0 })
  }

  const loadSample = (id) => setParams({ sample: id })
  const restart = () => {
    setParams({})
    setS(EMPTY)
    setSampleId(null)
    setSuggest({ state: 'idle' })
    setReplyAi({ state: 'idle' })
    go(1)
  }

  async function askSuggest() {
    setSuggest({ state: 'loading' })
    const r = await requestSuggestions({ kindId: s.kindId, what: s.what, story: s.story })
    setSuggest({ state: 'done', ...r })
  }

  async function askReply() {
    setReplyAi({ state: 'loading' })
    const r = await requestReplyCheck(s.reply)
    setReplyAi({ state: 'done', ...r })
    if (r.result) {
      // AI 가 찾은 항목만 미리 체크한다. 사람이 고칠 수 있다.
      set({ present: Object.fromEntries(ITEM_IDS.map((id) => [id, r.result.items[id]?.found === true])) })
      if (r.result.extended?.found && !s.timing) set({ timing: 'ext' })
    }
  }

  // ★ 함수형 갱신 — 빠르게 두 번 누르면 앞의 선택이 사라지던 것을 막는다
  const togglePick = (c) =>
    setS((prev) => ({
      ...prev,
      picked: prev.picked.some((p) => p.정보 === c.정보)
        ? prev.picked.filter((p) => p.정보 !== c.정보)
        : [...prev.picked, c],
    }))

  const opinion = [
    s.story.trim(),
    ...s.picked.map((p) => `· ${p.정보}${p.자료 ? ` (제출 자료: ${p.자료})` : ''}`),
  ]
    .filter(Boolean)
    .join('\n')

  return (
    <div className="space-y-6 py-6">
      <PageHeader
        kicker="확장 범위 · 개인정보 보호법 제37조의2"
        title="AI가 내린 결정에 「왜?」라고 묻기"
        description="채용 탈락이나 플랫폼 계정 정지처럼 사람 없이 내려진 결정에, 법이 준 거부 · 설명 · 검토 요구를 서류로 만듭니다."
      >
        <Stepper step={step} onGo={go} reachable={reachable} />
      </PageHeader>

      {sampleId && (
        <p className="no-print rounded-md border border-ink-200 bg-ink-50 p-3 text-sm text-ink-900">
          <b>샘플</b> — {DECISION_SAMPLES_BY_ID[sampleId].title}. 값을 고쳐 써 보셔도 됩니다.{' '}
          <button type="button" className="underline" onClick={restart}>
            비우고 처음부터
          </button>
        </p>
      )}

      {/* ── 1. 무슨 결정 ── */}
      {step === 1 && (
        <section className="no-print space-y-4" aria-labelledby="s1">
          <h2 id="s1" className="text-xl font-bold text-gray-900">
            무슨 결정을 받았나요?
          </h2>
          <p className="text-gray-700">가장 가까운 것을 고르세요. 결정 분야에 따라 적용되는 법이 다릅니다.</p>
          <div className="grid gap-2">
            {PIPA_DECISION_KINDS.map((k) => (
              <Choice
                key={k.id}
                selected={s.kindId === k.id}
                onClick={() => set({ kindId: k.id, answers: {}, picked: [] })}
              >
                <span className="block font-semibold">{k.label}</span>
                <span className="block text-sm opacity-80">{k.hint}</span>
              </Choice>
            ))}
          </div>

          {kind && kind.route !== 'pipa' && (
            <Notice title={PIPA_ROUTE_NOTES[kind.route].title}>
              <p>{PIPA_ROUTE_NOTES[kind.route].body}</p>
              <p className="mt-2">
                <Basis>{PIPA_ROUTE_NOTES[kind.route].basis}</Basis>
              </p>
              {kind.route === 'credit' && (
                <p className="mt-3">
                  <Link to="/diagnose" className="btn btn-primary">
                    신용 분야 진단으로 가기 <span aria-hidden="true">→</span>
                  </Link>
                </p>
              )}
            </Notice>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 text-sm text-gray-700">
              <span>예시로 보기:</span>
              {DECISION_SAMPLES.map((sm) => (
                <button key={sm.id} type="button" className="btn btn-secondary" onClick={() => loadSample(sm.id)}>
                  {sm.kindId === 'hire' ? '채용 탈락' : '계정 정지'}
                </button>
              ))}
            </div>
            <button type="button" className="btn btn-primary" disabled={kind?.route !== 'pipa'} onClick={() => go(2)}>
              다음
            </button>
          </div>
        </section>
      )}

      {/* ── 2. 권리 확인 ── */}
      {step === 2 && (
        <section className="no-print space-y-5" aria-labelledby="s2">
          <div>
            <h2 id="s2" className="text-xl font-bold text-gray-900">
              세 가지만 확인할게요
            </h2>
            <p className="mt-1 text-gray-700">
              「모르겠어요」도 괜찮습니다. 모르는 부분은 요구서에서 기관에 직접 묻게 써 드립니다.
            </p>
          </div>
          {PIPA_QUESTIONS.filter((q) => q.id === 'auto' || s.answers.auto !== 'yes').map((q) => (
            <fieldset key={q.id} className="space-y-2">
              <legend className="font-bold text-gray-900">{q.title}</legend>
              <p className="text-sm text-gray-600">
                {q.help} <Basis>{q.basis}</Basis>
              </p>
              <div className="grid gap-2 sm:grid-cols-2">
                {q.options.map((o) => (
                  <Choice
                    key={o.id}
                    selected={s.answers[q.id] === o.id}
                    onClick={() => set({ answers: { ...s.answers, [q.id]: o.id } })}
                  >
                    {o.label}
                  </Choice>
                ))}
              </div>
            </fieldset>
          ))}

          {verdict.complete && (
            <Card className="space-y-3" data-testid="pipa-verdict">
              <h3 className="font-bold text-gray-900">
                내가 쓸 수 있는 권리{' '}
                <span className="ml-1 rounded-full border border-ink-200 bg-white px-2 py-0.5 text-xs font-semibold text-ink-700">
                  코드가 조문대로 판정
                </span>
              </h3>
              {verdict.applies && (
                <ul className="grid gap-2">
                  {PIPA_RIGHTS.map((r) => (
                    <RightCard key={r.id} right={r} ok={verdict[r.id]} />
                  ))}
                </ul>
              )}
              {verdict.notes.map((n) => (
                <Notice key={n.id}>
                  {n.text} <Basis>{n.basis}</Basis>
                </Notice>
              ))}
              {verdict.applies && (
                <p className="text-sm text-gray-700">
                  {PIPA_DEADLINE.text} <Basis>{PIPA_DEADLINE.basis}</Basis>
                </p>
              )}
            </Card>
          )}

          <div className="flex justify-between gap-3">
            <button type="button" className="btn btn-secondary" onClick={() => go(1)}>
              이전
            </button>
            <button type="button" className="btn btn-primary" disabled={!verdict.applies} onClick={() => go(3)}>
              요구서 쓰기
            </button>
          </div>
        </section>
      )}

      {/* ── 3. 요구서 ── */}
      {step === 3 && (
        <section className="space-y-5" aria-labelledby="s3">
          <div className="no-print space-y-4">
            <div>
              <h2 id="s3" className="text-xl font-bold text-gray-900">
                요구서를 채워요
              </h2>
              <p className="mt-1 text-gray-700">
                이름 · 연락처 · 주민등록번호 칸은 화면에 없습니다. 인쇄한 뒤 손으로 적어 내세요. 이 화면은
                기록을 저장하지 않아 새로고침하면 사라집니다.
              </p>
            </div>
            <label className="block">
              <span className="font-semibold text-gray-900">결정을 한 곳</span>
              <input className="rounded-md border border-gray-400 bg-white p-3 mt-1 w-full" value={s.org} maxLength={80} onChange={(e) => set({ org: e.target.value })} placeholder="예: ○○주식회사 채용팀" />
            </label>
            <label className="block">
              <span className="font-semibold text-gray-900">결정을 통보받은 날</span>
              <input type="date" className="rounded-md border border-gray-400 bg-white p-3 mt-1 w-full" value={s.when} onChange={(e) => set({ when: e.target.value })} />
            </label>
            <label className="block">
              <span className="font-semibold text-gray-900">어떤 결정이었나요?</span>
              <input className="rounded-md border border-gray-400 bg-white p-3 mt-1 w-full" value={s.what} maxLength={200} onChange={(e) => set({ what: e.target.value })} placeholder="예: 서류 전형 불합격 (AI 역량검사 결과로 안내받음)" />
            </label>
            <label className="block">
              <span className="font-semibold text-gray-900">짐작되는 이유나 억울한 점</span>
              <span className="block text-sm text-gray-600">
                신원을 알 수 있는 내용(이름 · 연락처 · 회사 실명)은 쓰지 마세요. 최대 {TRANSMIT_LIMITS.situation.toLocaleString()}자.
              </span>
              <textarea className="rounded-md border border-gray-400 bg-white p-3 mt-1 min-h-28 w-full" value={s.story} maxLength={TRANSMIT_LIMITS.situation} onChange={(e) => set({ story: e.target.value })} />
            </label>

            {verdict.review && (
              <Card className="space-y-3" data-testid="pipa-suggest">
                <h3 className="font-bold text-gray-900">AI에게 「내야 할 정보」 찾아 달라기</h3>
                <p className="text-sm text-gray-700">
                  적으신 사정을 읽고, 결정에 반영되지 않았을 수 있는 내 정보를 후보로 찾습니다. 고르신 것은
                  요구서의 검토 요구 칸에 들어갑니다. <Basis>{PIPA_SUGGEST_SCOPE.basis}</Basis>
                </p>
                <p className="text-xs text-gray-600">
                  {AI_PROCESSING.short} 보내는 것: {AI_PROCESSING.sent.decisionSuggest}. 결정을 한 곳의 이름은
                  보내지 않습니다.
                </p>
                <button type="button" className="btn btn-primary" disabled={!s.story.trim() || suggest.state === 'loading'} onClick={askSuggest}>
                  {suggest.state === 'loading' ? '찾는 중…' : '후보 찾기'}
                </button>
                {suggest.state === 'loading' && <Status>AI가 사정을 읽고 있어요. 길면 20초쯤 걸립니다.</Status>}
                {suggest.state === 'done' && (
                  <div className="space-y-2">
                    <p className="text-sm font-semibold text-gray-800">
                      {suggest.source === 'ai'
                        ? 'AI의 제안 — 법률 자문이 아닙니다. 인용한 말은 적으신 글에 실제로 있는 것만 보여 드려요.'
                        : `일반 목록 — ${suggest.notice}`}
                    </p>
                    <ul className="grid gap-2">
                      {suggest.candidates.map((c) => {
                        const on = s.picked.some((p) => p.정보 === c.정보)
                        return (
                          <li key={c.정보}>
                            <Choice selected={on} onClick={() => togglePick(c)}>
                              <span className="block font-semibold">{c.정보}</span>
                              {c.자료 && <span className="block text-sm opacity-90">자료: {c.자료}</span>}
                              {c.선정이유 && <span className="mt-1 block text-sm opacity-80">왜: {c.선정이유}</span>}
                            </Choice>
                          </li>
                        )
                      })}
                    </ul>
                  </div>
                )}
              </Card>
            )}
          </div>

          {/* 인쇄되는 본문 — 이 아래만 종이에 나온다 */}
          <article className="rounded-md border border-gray-400 bg-white p-5 text-[0.95rem] leading-relaxed text-gray-900 print:border-0 print:p-0 print:text-[10.5pt]" data-testid="pipa-letter">
            <h3 className="mb-4 text-center text-lg font-bold tracking-wider">{PIPA_FORM_TEXTS.title}</h3>
            <table className="w-full border-collapse text-left">
              <tbody>
                {[
                  ['받는 곳', s.org || '(결정을 한 곳)'],
                  ['결정 통보일', fmtDate(s.when)],
                  ['결정 내용', s.what || '(결정 내용)'],
                  ['요구인', PIPA_FORM_TEXTS.applicantRow],
                ].map(([k, v]) => (
                  <tr key={k}>
                    <th className="w-28 border border-gray-500 bg-gray-100 px-2 py-1 font-semibold">{k}</th>
                    <td className="border border-gray-500 px-2 py-1 whitespace-pre-wrap">{v}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3">{PIPA_FORM_TEXTS.intro}</p>
            <ol className="mt-2 list-decimal space-y-2 pl-5">
              {verdict.askAutomated && <li>{PIPA_FORM_TEXTS.askAutomated}</li>}
              {verdict.refuse && <li>{PIPA_FORM_TEXTS.refuse}</li>}
              {verdict.explain && (
                <li>
                  {PIPA_FORM_TEXTS.explain}
                  <ol className="mt-1 list-[circle] pl-5">
                    {PIPA_EXPLANATION_ITEMS.map((it) => (
                      <li key={it.id}>{it.law}</li>
                    ))}
                  </ol>
                </li>
              )}
              {verdict.review && (
                <li>
                  {PIPA_FORM_TEXTS.review}
                  {opinion && <p className="mt-1 whitespace-pre-wrap border-l-2 border-gray-400 pl-2">{opinion}</p>}
                </li>
              )}
            </ol>
            <p className="mt-3">{PIPA_FORM_TEXTS.deadline}</p>
            <p className="mt-2 text-sm">{PIPA_FORM_TEXTS.procedure}</p>
            <p className="mt-6 text-right">{PIPA_FORM_TEXTS.signature}</p>
          </article>

          <div className="no-print flex flex-wrap justify-between gap-3">
            <button type="button" className="btn btn-secondary" onClick={() => go(2)}>
              이전
            </button>
            <span className="flex flex-wrap gap-2">
              <button type="button" className="btn btn-secondary" onClick={() => window.print()}>
                인쇄 / PDF로 저장
              </button>
              <button type="button" className="btn btn-primary" onClick={() => go(4)}>
                회신을 받았어요
              </button>
            </span>
          </div>
        </section>
      )}

      {/* ── 4. 회신 확인 ── */}
      {step === 4 && (
        <section className="no-print space-y-5" aria-labelledby="s4">
          <div>
            <h2 id="s4" className="text-xl font-bold text-gray-900">
              회신에 법이 정한 설명이 다 들어 있나요?
            </h2>
            <p className="mt-1 text-gray-700">
              설명에는 아래 네 가지가 들어가야 합니다. <Basis>{PIPA_EXPLANATION_ITEMS[0].basis.replace(' 제1호', '')}</Basis>
            </p>
          </div>

          <Card className="space-y-3" data-testid="pipa-reply">
            <label className="block">
              <span className="font-semibold text-gray-900">받은 회신을 붙여 넣으세요 (선택)</span>
              <span className="block text-xs text-gray-600">
                {AI_PROCESSING.short} 회신문에 개인정보가 있을 수 있으니 이름 · 연락처는 지우고 붙여 넣으세요.
              </span>
              <textarea className="rounded-md border border-gray-400 bg-white p-3 mt-1 min-h-28 w-full" value={s.reply} maxLength={TRANSMIT_LIMITS.responseText} onChange={(e) => set({ reply: e.target.value })} />
            </label>
            <button type="button" className="btn btn-primary" disabled={!s.reply.trim() || replyAi.state === 'loading'} onClick={askReply}>
              {replyAi.state === 'loading' ? '읽는 중…' : 'AI로 항목 찾기'}
            </button>
            {replyAi.state === 'loading' && <Status>AI가 회신을 읽고 있어요.</Status>}
            {replyAi.state === 'done' && (
              <p className="text-sm text-gray-700">
                {replyAi.source === 'ai'
                  ? 'AI가 찾은 문장으로 아래를 미리 체크했어요. 문장이 회신에 그대로 있는 것만 체크됩니다. 틀리면 고쳐 주세요.'
                  : replyAi.notice}
              </p>
            )}
          </Card>

          <ul className="divide-y divide-gray-200 rounded-md border border-gray-300 bg-white">
            {PIPA_EXPLANATION_ITEMS.map((it) => {
              const q = replyAi.result?.items?.[it.id]
              return (
                <li key={it.id} className="p-3">
                  <label className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      className="mt-1 h-5 w-5"
                      checked={!!s.present[it.id]}
                      onChange={(e) => { const v = e.target.checked; setS((p) => ({ ...p, present: { ...p.present, [it.id]: v } })) }}
                    />
                    <span>
                      <span className="block font-semibold text-gray-900">{it.label}</span>
                      <span className="block text-sm text-gray-600">{it.plain}</span>
                      {q?.found && <span className="mt-1 block text-sm text-ink-800">회신 속 문장: “{q.quote}”</span>}
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>

          {replyAi.result?.refused?.found && (
            <Notice title="거절한다는 문장이 있어요">
              “{replyAi.result.refused.quote}” — {PIPA_REFUSAL_DUTY.text} <Basis>{PIPA_REFUSAL_DUTY.basis}</Basis>
            </Notice>
          )}
          {replyAi.result?.human?.found && (
            <p className="rounded-md border border-ink-200 bg-ink-50 p-3 text-sm text-ink-900">
              사람이 다시 본다는 문장이 있어요: “{replyAi.result.human.quote}”
            </p>
          )}

          <fieldset className="space-y-2">
            <legend className="font-bold text-gray-900">회신을 언제 받았나요?</legend>
            <div className="grid gap-2 sm:grid-cols-3">
              {TIMINGS.map((t) => (
                <Choice key={t.id} selected={s.timing === t.id} onClick={() => set({ timing: t.id })}>
                  {t.label}
                </Choice>
              ))}
            </div>
          </fieldset>

          <div data-testid="pipa-reply-result" className="space-y-3">
            {reply.overdue && (
              <Notice title="기한을 넘겼어요">
                {PIPA_DEADLINE.text} <Basis>{PIPA_DEADLINE.basis}</Basis>
              </Notice>
            )}
            {reply.extended && (
              <p className="text-sm text-gray-700">
                연장은 사유를 알리고 30일씩 {PIPA_DEADLINE.maxExtensions}번까지만 할 수 있습니다. 안내받은 날짜를 적어 두세요.{' '}
                <Basis>{PIPA_DEADLINE.basis}</Basis>
              </p>
            )}
            {s.timing && s.timing !== 'none' && (
              <Card>
                {reply.complete ? (
                  <p className="font-bold text-ink-800">✓ 법이 정한 네 항목이 다 들어 있어요.</p>
                ) : (
                  <>
                    <p className="font-bold text-gray-900">빠진 설명 {reply.missing.length}가지</p>
                    <p className="mt-1 text-gray-700">
                      {reply.missing.map((id) => PIPA_EXPLANATION_ITEMS.find((i) => i.id === id).label).join(' · ')} —
                      이 항목만 다시 설명해 달라고 요구할 수 있어요. {PIPA_REFUSAL_DUTY.text}{' '}
                      <Basis>{PIPA_REFUSAL_DUTY.basis}</Basis>
                    </p>
                  </>
                )}
              </Card>
            )}
            {(reply.overdue || (s.timing && !reply.complete)) && (
              <Card>
                <p className="font-bold text-gray-900">다음에 갈 곳</p>
                <ul className="mt-2 space-y-1 text-gray-700">
                  {PIPA_REMEDIES.map((r) => (
                    <li key={r.id}>
                      <b>{r.label}</b>
                      {r.contact && ` (${r.contact})`} — {r.what} {r.basis && <Basis>{r.basis}</Basis>}
                    </li>
                  ))}
                </ul>
              </Card>
            )}
          </div>

          <div className="flex justify-between gap-3">
            <button type="button" className="btn btn-secondary" onClick={() => go(3)}>
              이전
            </button>
            <button type="button" className="btn btn-secondary" onClick={restart}>
              처음부터
            </button>
          </div>
        </section>
      )}

      <p className="no-print border-t border-gray-300 pt-4 text-xs text-gray-600">
        근거: {PIPA_META.act.name} [{PIPA_META.act.revision}] {PIPA_META.act.article} · {PIPA_META.decree.name} [
        {PIPA_META.decree.revision}] {PIPA_META.decree.article} — 국가법령정보센터 원문 {PIPA_META.verifiedAt} 확인. 법률
        자문이 아니며, 개별 사안의 적용 여부는 기관의 판단과 분쟁조정 절차로 정해집니다.
      </p>
    </div>
  )
}
