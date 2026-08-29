import { useEffect, useMemo, useRef, useState } from 'react'
import { RESPONSE_DUTY, PROCESSING_DEADLINE } from '../data/law.js'
import { buildReminderDraft, REPEAT_LIMIT } from '../lib/reminder-draft.js'
import { useJourney } from '../lib/diagnosis-context.jsx'
import { daysSince, formatDate } from '../lib/journey-storage.js'
import { Basis, Notice } from './ui.jsx'
import { Plain } from '../lib/plain.jsx'

/**
 * 회신을 받지 못한 경우.
 *
 * ★ 법령에 처리 기한이 없다. 그러므로 "언제까지 기다려야 하는가"에
 *   우리가 답을 만들어 낼 수 없다. 만들면 그건 지어낸 법이다.
 *   할 수 있는 것은 두 가지다.
 *     1) 회신 의무 조문(시행령 제31조의2 제7항)이 있다는 사실을 알린다
 *     2) 다시 물어보는 문안을 만들어 준다
 *   "○일이 지나면 위법입니다" 같은 말은 어디에도 쓰지 않는다.
 *
 * ★ 재요청이 반복 행사로 계산될지는 법령에 정해져 있지 않다.
 *   시행령 제31조의2 제5항 제2호의 요건이 "정당한 사유 없이"이므로,
 *   회신을 못 받았다는 사실을 문안에 남기게 한다. 단정은 하지 않는다.
 */
export default function NoReply({ defaultOpen = false }) {
  const { journey } = useJourney()
  const [open, setOpen] = useState(defaultOpen)
  const [copied, setCopied] = useState('')
  const bodyRef = useRef(null)

  /** 제출 기록이 있으면 그 사실만 쓴다. 남은 날짜는 만들지 않는다. */
  const submitted = useMemo(() => {
    const entries = Object.entries(journey.milestones ?? {}).filter(([, v]) => v?.submittedAt)
    if (entries.length === 0) return null
    const [formId, m] = entries[0]
    return { formId, submittedAt: m.submittedAt, days: daysSince(m.submittedAt) }
  }, [journey.milestones])

  const draft = useMemo(
    () =>
      buildReminderDraft({
        formId: submitted?.formId ?? journey.form?.tab,
        personal: journey.form?.personal ?? {},
        submittedAt: submitted?.submittedAt ?? '',
        days: submitted?.days ?? null,
        recipientOrg: (journey.diagnosis?.customInstitution ?? '').trim(),
      }),
    [submitted, journey.form, journey.diagnosis],
  )
  const [edited, setEdited] = useState(null)
  const body = edited ?? draft.body

  // 접힌 내용은 DOM 에 없어 CSS 로 되살릴 수 없다. Disclosure 와 같은 규칙을 쓴다.
  useEffect(() => {
    const expand = () => setOpen(true)
    window.addEventListener('beforeprint', expand)
    return () => window.removeEventListener('beforeprint', expand)
  }, [])

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(body)
      setCopied('문안을 복사했습니다.')
    } catch {
      bodyRef.current?.focus()
      bodyRef.current?.select()
      setCopied('복사 권한이 없어 본문을 선택해 두었습니다. Ctrl+C(⌘+C)를 눌러 주세요.')
    }
  }

  return (
    <section className="rounded-lg border border-ink-200 bg-white" aria-labelledby="noreply-heading">
      <h2 id="noreply-heading">
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="noreply-panel"
          className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-4 text-left"
        >
          <span>
            <span className="block text-lg font-bold text-gray-900">회신이 오지 않으면</span>
            <span className="mt-0.5 block text-sm text-gray-600">
              {submitted
                ? `${formatDate(submitted.submittedAt)}에 제출하셨습니다. 다시 물어보는 문안을 만들어 드립니다.`
                : '다시 물어보는 문안을 만들어 드립니다.'}
            </span>
          </span>
          <span aria-hidden="true" className="shrink-0 text-xl text-ink-600">
            {open ? '−' : '+'}
          </span>
        </button>
      </h2>

      {open && (
        <div id="noreply-panel" className="space-y-4 border-t border-gray-200 p-4">
          {submitted && submitted.days != null && (
            <p className="rounded-md bg-ink-50 p-3 text-ink-900">
              제출한 지 <b className="tabular">{submitted.days}일</b> 지났습니다.
            </p>
          )}

          <Notice title="며칠까지 기다려야 하는지는 법에 없습니다" mark="!">
            <p>
              <Plain id="next.noDeadline">{PROCESSING_DEADLINE.uiNotice}</Plain>
            </p>
            <p className="mt-2 text-sm">
              그래서 이 서비스는 &ldquo;○일이 지나면 위법&rdquo; 같은 말을 하지 않습니다. 지어낸
              기한으로 잘못된 주장을 하시게 만들 수는 없습니다.
            </p>
          </Notice>

          <div>
            <p className="font-bold text-gray-900">다만 회신할 의무 자체는 규정돼 있습니다</p>
            <p className="mt-2 text-gray-700">{RESPONSE_DUTY.text}</p>
            <p className="mt-2">
              <Basis prefix="근거">{RESPONSE_DUTY.basis}</Basis>
            </p>
          </div>

          {/* ★ 재요청이 반복 행사로 계산될 수 있다는 사실을 먼저 알린다 */}
          <Notice title="다시 보내기 전에 알아 두실 것" mark="!">
            <p>{REPEAT_LIMIT.text}가 법령상 거절 사유의 하나입니다.</p>
            <p className="mt-2">
              <Basis chain prefix="근거 체인">
                {REPEAT_LIMIT.basisChain}
              </Basis>
            </p>
            <p className="mt-2 text-sm">
              다시 보내는 것이 여기서 말하는 &ldquo;반복 행사&rdquo;로 계산되는지는 법령에 정해져
              있지 않습니다. 다만 요건에 <b>&ldquo;정당한 사유 없이&rdquo;</b>가 붙어 있으므로,
              아래 문안은 <b>앞선 요구에 아직 회신을 받지 못했다</b>는 사실을 본문에 남깁니다.
            </p>
          </Notice>

          <div>
            <label htmlFor="reminder-body" className="block font-bold text-gray-900">
              다시 물어보는 문안 (고쳐 쓰셔도 됩니다)
            </label>
            <p className="mt-1 text-sm text-gray-600">
              제목: {draft.subject} · 새 요구서를 다시 내는 것이 아니라, 낸 것에 대한 회신을
              요청하는 문안입니다.
            </p>
            <textarea
              id="reminder-body"
              ref={bodyRef}
              value={body}
              onChange={(e) => setEdited(e.target.value)}
              rows={16}
              className="mt-2 w-full rounded-md border border-gray-300 p-3 font-mono text-sm leading-relaxed"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button type="button" className="btn btn-primary" onClick={copy}>
              문안 복사
            </button>
            {edited !== null && (
              <button type="button" className="btn btn-quiet" onClick={() => setEdited(null)}>
                초안으로 되돌리기
              </button>
            )}
          </div>
          <p role="status" aria-live="polite" className="min-h-6 text-sm text-ink-700">
            {copied}
          </p>
        </div>
      )}
    </section>
  )
}
