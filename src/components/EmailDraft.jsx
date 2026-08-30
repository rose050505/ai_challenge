import { useMemo, useRef, useState } from 'react'
import { EXERCISE_CHANNELS, EXERCISE_FORM_REQUIREMENT } from '../data/law.js'
import { buildEmailDraft, mailtoHref } from '../lib/email-draft.js'
import { Basis, Notice } from './ui.jsx'

const emailChannel = EXERCISE_CHANNELS.find((c) => c.id === 'email')

/**
 * 이메일 제출 초안.
 *
 * ★ 수신 주소는 우리가 채우지 않는다. 금융회사 이메일 주소를 추정해 넣지 않는다.
 * ★ 초안은 편집 가능하다. 사용자가 최종 문장의 주인이다.
 * ★ 인쇄 대상이 아니다(no-print). 화면 전용 기능이다.
 */
/**
 * @param {boolean} [props.open]  바깥에서 여닫을 때 (인쇄 후 화면의 [이메일 초안 열기])
 * @param {(v:boolean)=>void} [props.onOpenChange]
 */
export default function EmailDraft({ open: openProp, onOpenChange, ...props }) {
  const [openState, setOpenState] = useState(false)
  const controlled = openProp !== undefined
  const open = controlled ? openProp : openState
  const setOpen = (next) => {
    const v = typeof next === 'function' ? next(open) : next
    if (!controlled) setOpenState(v)
    onOpenChange?.(v)
  }
  const [to, setTo] = useState('')
  const [edited, setEdited] = useState(null)
  const [copied, setCopied] = useState('')
  const bodyRef = useRef(null)

  const draft = useMemo(() => buildEmailDraft(props), [props])
  const body = edited ?? draft.body

  const copy = async (text, what) => {
    try {
      await navigator.clipboard.writeText(text)
      setCopied(`${what}을(를) 복사했습니다.`)
    } catch {
      // 클립보드 권한이 없는 환경 — 사용자가 직접 복사할 수 있게 선택해 준다
      bodyRef.current?.focus()
      bodyRef.current?.select()
      setCopied('복사 권한이 없어 본문을 선택해 두었습니다. Ctrl+C(⌘+C)를 눌러 주세요.')
    }
  }

  return (
    <section id="email-draft" className="no-print rounded-lg border border-ink-200 bg-white">
      <h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={open ? 'email-draft-panel' : undefined}
          className="flex w-full items-center justify-between gap-3 rounded-lg px-4 py-4 text-left"
        >
          <span>
            <span className="block text-lg font-bold text-gray-900">이메일로 제출하기</span>
            <span className="mt-0.5 block text-sm text-gray-600">
              {emailChannel.label} 제출은 법이 인정하는 행사 방법입니다. 초안을 만들어 드립니다.
            </span>
          </span>
          <span aria-hidden="true" className="shrink-0 text-xl text-ink-600">
            {open ? '−' : '+'}
          </span>
        </button>
      </h2>

      {open && (
        <div id="email-draft-panel" className="space-y-4 border-t border-gray-200 p-4">
          <p className="text-sm text-gray-700">
            <Basis prefix="근거">{emailChannel.basis}</Basis>
          </p>

          <Notice title="이메일만으로는 끝나지 않습니다">
            <p className="text-sm">
              {EXERCISE_FORM_REQUIREMENT.text} 위에서 <b>인쇄한 서식을 첨부</b>하셔야 하고,{' '}
              <b>서명 또는 날인</b>이 필요합니다. 서식 없이 메일 본문만 보내면 요건을 채우지
              못합니다.
            </p>
            <p className="mt-2 text-sm">
              <Basis prefix="근거">{EXERCISE_FORM_REQUIREMENT.basis}</Basis>
            </p>
          </Notice>

          <div>
            <label htmlFor="email-to" className="block text-sm font-bold text-gray-900">
              받는 사람
            </label>
            <p id="email-to-help" className="mt-1 text-sm text-gray-600">
              이 서비스는 금융회사의 이메일 주소를 추정해 넣지 않습니다. 해당 회사 고객센터나
              홈페이지에서 접수 주소를 확인해 직접 넣으세요.
            </p>
            <input
              id="email-to"
              type="email"
              inputMode="email"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              aria-describedby="email-to-help"
              placeholder="예: privacy@example.co.kr"
              className="mt-2 w-full rounded-md border border-gray-300 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="email-subject" className="block text-sm font-bold text-gray-900">
              제목
            </label>
            <input
              id="email-subject"
              readOnly
              value={draft.subject}
              className="mt-2 w-full rounded-md border border-gray-300 bg-gray-50 px-3 py-2"
            />
          </div>

          <div>
            <label htmlFor="email-body" className="block text-sm font-bold text-gray-900">
              본문 (고쳐 쓰셔도 됩니다)
            </label>
            <textarea
              id="email-body"
              ref={bodyRef}
              value={body}
              onChange={(e) => setEdited(e.target.value)}
              rows={18}
              className="mt-2 w-full rounded-md border border-gray-300 p-3 font-mono text-sm leading-relaxed"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <a
              className="btn btn-primary"
              href={mailtoHref({ to, subject: draft.subject, body })}
            >
              메일 앱 열기
            </a>
            <button type="button" className="btn btn-secondary" onClick={() => copy(body, '본문')}>
              본문 복사하기
            </button>
            <button
              type="button"
              className="btn btn-quiet"
              onClick={() => copy(draft.subject, '제목')}
            >
              제목 복사하기
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

          <p className="text-sm text-gray-600">
            메일 앱이 열리지 않으면 [본문 복사하기]를 눌러 쓰시던 메일에 붙여 넣으세요. 본문이 길면
            일부 메일 앱이 링크로 여는 것을 막습니다.
          </p>
        </div>
      )}
    </section>
  )
}
