import { useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  FORMS_BY_ID,
  COUNTERPARTY_TYPES_BY_ID,
} from '../data/law.js'
import { useJourney } from '../lib/diagnosis-context.jsx'
import { formatWhen, formatDate, daysSince } from '../lib/journey-storage.js'
import { Notice, Card } from './ui.jsx'

/**
 * 여정 관리 UI.
 *
 * ★ 저장 위치를 애매하게 쓰지 않는다.
 *   "이 기록은 지금 사용 중인 브라우저에만 저장됩니다."
 *   오해가 생기면 신뢰를 잃는다. 이 문장은 여러 곳에서 같은 말로 반복한다.
 */

/**
 * 여정 기록 키 → 사람이 읽는 이름.
 * 복수 기관 동시 행사에서 두 번째 건은 키가 `<서식id>:second` 다.
 */
export function milestoneLabel(key, journey) {
  const [formId, tag] = String(key).split(':')
  const title = FORMS_BY_ID[formId]?.title ?? ''
  if (!tag) return title
  // 설명요구서의 두 번째 건 — 상대방으로 구분한다
  if (tag === 'second') {
    const cp = COUNTERPARTY_TYPES_BY_ID[journey?.form?.second?.counterpartyId]
    return cp ? `${title} (${cp.label})` : title
  }
  // 정정 요청서의 추가 건 — 수신 기관으로 구분한다
  const m = /^r(\d+)$/.exec(tag)
  if (m) {
    const extra = journey?.form?.form2Extras?.[Number(m[1]) - 1]
    const who = (extra?.recipient ?? '').trim()
    return who ? `${title} (${who})` : `${title} (${Number(m[1]) + 1}번째)`
  }
  return title
}

export const STORAGE_SCOPE_TEXT =
  '이 기록은 지금 사용 중인 브라우저에만 저장됩니다. 다른 기기나 시크릿 모드에서는 보이지 않습니다.'

/** 여정이 어디까지 왔는지. 이어서 할 지점을 정한다. */
export function lastStep(journey) {
  const m = journey.milestones ?? {}
  const submitted = Object.entries(m).find(([, v]) => v?.submittedAt)
  if (submitted) {
    return { label: '제출 기록', to: '/next', detail: `${milestoneLabel(submitted[0], journey)} 제출` }
  }
  const printed = Object.entries(m).find(([, v]) => v?.printedAt)
  if (printed) {
    return { label: '서식 인쇄', to: '/document', detail: `${milestoneLabel(printed[0], journey)} 인쇄` }
  }
  if (journey.response?.interpretation) return { label: '회신 해석', to: '/response', detail: '해석 결과 저장됨' }
  const f = journey.form ?? {}
  const hasForm =
    f.personal?.name ||
    (f.form1?.selectedItems ?? []).length > 0 ||
    f.form2?.rows ||
    f.form2?.favorable
  if (hasForm) return { label: '서식 작성', to: '/document', detail: '작성 중' }
  if ((journey.strategy?.candidates ?? []).length > 0)
    return { label: '대응 전략', to: '/strategy', detail: '후보 목록 저장됨' }
  if (journey.diagnosis?.counterpartyId) return { label: '진단', to: '/diagnose', detail: '선택 저장됨' }
  if (journey.diagnosis?.eventId) return { label: '진단', to: '/diagnose', detail: '작성 중' }
  return null
}

/** 여정에 남길 만한 내용이 있는가 */
export function hasProgress(journey) {
  return lastStep(journey) !== null
}

/* ── 헤더의 저장 표시 ─────────────────────────────────────────── */

/**
 * 은근한 저장 표시. 화면을 방해하지 않게 헤더 구석에만 둔다.
 * 저장이 안 되는 환경이면 그 사실을 알린다 (조용히 실패하지 않는다).
 */
export function SaveStatus() {
  const { savedAt, storageAvailable } = useJourney()
  const when = formatWhen(savedAt)

  if (!storageAvailable) {
    return (
      <span className="text-sm text-amber-800" title="시크릿 모드이거나 브라우저가 저장을 막고 있습니다">
        <span aria-hidden="true">⚠ </span>
        자동 저장 안 됨
      </span>
    )
  }
  if (!when) return null
  return (
    <span className="text-sm text-gray-500" role="status" aria-live="polite">
      <span aria-hidden="true">✓ </span>
      저장됨 · {when}
    </span>
  )
}

/**
 * 화면 바깥 알림.
 * 파일을 불러오면 화면이 다시 마운트되므로, 알림은 마운트 밖에 있어야 살아남는다.
 */
export function JourneyFlash() {
  const { flash, clearFlash } = useJourney()
  if (!flash) return null
  return (
    <div className="no-print mx-auto max-w-3xl px-4 pt-4">
      <p
        role="status"
        aria-live="polite"
        className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-ink-300 bg-ink-50 p-3 text-ink-800"
      >
        <span>
          <span aria-hidden="true">✓ </span>
          {flash.text}
        </span>
        <button type="button" onClick={clearFlash} className="btn btn-quiet">
          닫기
        </button>
      </p>
    </div>
  )
}

/* ── 이어서 하기 카드 ─────────────────────────────────────────── */

export function ResumeCard() {
  const { journey, reset } = useJourney()
  const step = lastStep(journey)
  const [confirming, setConfirming] = useState(false)
  if (!step) return null

  const when = formatWhen(journey.updatedAt)

  return (
    <section className="rounded-lg border-2 border-ink-700 bg-white p-5" aria-labelledby="resume-heading">
      <p className="text-sm font-semibold tracking-wide text-ink-600">이어서 하기</p>
      <h2 id="resume-heading" className="mt-1 text-xl font-bold text-gray-900">
        진행 중인 기록이 있습니다
      </h2>
      <dl className="mt-3 grid gap-1 text-gray-700 sm:grid-cols-[7rem_1fr]">
        <dt className="font-bold">마지막 단계</dt>
        <dd>
          {step.label}
          {step.detail && <span className="text-gray-600"> — {step.detail}</span>}
        </dd>
        <dt className="font-bold">마지막 수정</dt>
        <dd>{when ?? '기록 없음'}</dd>
      </dl>
      <p className="mt-3 text-sm text-gray-600">{STORAGE_SCOPE_TEXT}</p>

      <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link to={step.to} className="btn btn-primary">
          이어서 하기
        </Link>
        {confirming ? (
          <span className="flex flex-wrap items-center gap-2 rounded-md border border-amber-300 bg-amber-50 p-2">
            <span className="text-sm text-amber-900">저장된 기록을 모두 지울까요?</span>
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => {
                reset()
                setConfirming(false)
              }}
            >
              지우고 처음부터
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setConfirming(false)}>
              그대로 두기
            </button>
          </span>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={() => setConfirming(true)}>
            처음부터
          </button>
        )}
      </div>
    </section>
  )
}

/* ── 내보내기 / 불러오기 ──────────────────────────────────────── */

/**
 * 파일 백업.
 *
 * ★ 내보낸 파일에는 회신에서 읽은 신용정보가 들어갈 수 있다. 반드시 경고한다.
 */
export function BackupPanel({ compact = false }) {
  const { exportToFile, importFromText, journey, storageAvailable } = useJourney()
  const [message, setMessage] = useState(null)
  const [error, setError] = useState(null)
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  const readFile = (file) => {
    setError(null)
    setMessage(null)
    if (!file) return
    const reader = new FileReader()
    reader.onerror = () => setError('파일을 읽지 못했습니다. 다시 시도해 주세요.')
    reader.onload = () => {
      // 성공하면 화면이 다시 마운트되므로 여기의 message 는 사라진다.
      // 성공 알림은 App 이 화면 바깥에서 띄운다 (context 의 flash).
      const result = importFromText(String(reader.result ?? ''))
      if (!result.ok) setError(result.error)
    }
    reader.readAsText(file)
  }

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    readFile(e.dataTransfer?.files?.[0])
  }

  return (
    <div className="space-y-3">
      {!compact && (
        <Notice title="내보낸 파일에는 신용정보가 들어 있을 수 있습니다">
          <p>
            회신에서 읽은 기초정보(연체 이력, 소득, 대출 잔액 등)가 파일에 포함될 수 있습니다.
            <b> 공유하지 마시고 안전한 곳에 보관하세요.</b>
          </p>
        </Notice>
      )}

      <div
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        className={`rounded-lg border-2 border-dashed p-4 ${
          dragging ? 'border-ink-600 bg-ink-50' : 'border-gray-300'
        }`}
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => {
              const name = exportToFile()
              setError(null)
              setMessage(`${name} 로 내보냈습니다.`)
            }}
          >
            파일로 내보내기
          </button>
          <button type="button" className="btn btn-secondary" onClick={() => inputRef.current?.click()}>
            파일에서 불러오기
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="application/json,.json"
            className="sr-only"
            aria-label="기록 파일 선택"
            onChange={(e) => {
              readFile(e.target.files?.[0])
              e.target.value = ''
            }}
          />
        </div>
        <p className="mt-3 text-sm text-gray-600">
          이 상자에 파일을 끌어다 놓아도 됩니다. 불러오면 지금 기록을 덮어씁니다.
        </p>
      </div>

      {message && (
        <p role="status" aria-live="polite" className="rounded-md bg-ink-50 p-3 text-ink-800">
          {message}
        </p>
      )}
      {error && (
        <p
          role="alert"
          aria-live="assertive"
          className="rounded-md border border-amber-600 bg-amber-50 p-3 text-amber-900"
        >
          <span aria-hidden="true">✕ </span>
          {error}
        </p>
      )}

      {!storageAvailable && (
        <p className="rounded-md border border-amber-300 bg-amber-50 p-3 text-amber-900">
          이 브라우저에서는 자동 저장을 쓸 수 없습니다(시크릿 모드이거나 저장이 차단돼
          있습니다). 화면을 닫으면 입력이 사라지므로, 작업을 마치기 전에 위 [파일로
          내보내기]로 보관해 두세요. 다른 기능은 모두 그대로 동작합니다.
        </p>
      )}

      {journey.updatedAt && (
        <p className="text-sm text-gray-600">
          마지막 저장 {formatWhen(journey.updatedAt)} · {STORAGE_SCOPE_TEXT}
        </p>
      )}
    </div>
  )
}

/* ── 왜 로그인이 없나 ─────────────────────────────────────────── */

/**
 * ★ 근거 조문을 붙이지 않는다.
 *   이건 법이 시킨 것이 아니라 우리가 택한 설계다.
 *   법령 근거가 없는 주장에 조문 배지를 다는 것은 이 서비스의 규칙 위반이다.
 */
export function WhyNoLogin() {
  return (
    <details className="rounded-lg border border-gray-200 bg-white">
      <summary className="cursor-pointer rounded-lg px-4 py-3 font-bold text-gray-900">
        왜 로그인이 없나요?
      </summary>
      <div className="space-y-3 border-t border-gray-200 p-4 text-gray-700">
        <p>
          설명요구서와 회신에는 소득, 채무, 연체 이력 같은 <b>신용정보</b>가 담깁니다.
        </p>
        <p>
          그런 정보를 서버에 보관하지 않기로 했습니다. 보관하지 않으면 유출될 것도, 잘못 다룰
          것도 없습니다.
        </p>
        <p>
          그래서 계정이 없습니다. 기록은 <b>사용자의 브라우저에만</b> 남고, 우리는 그 내용을 볼
          수 없습니다.
        </p>
        <p>
          대신 <b>파일로 내보내기</b>를 두었습니다. 다른 기기로 옮기거나 백업할 때 쓰시면 됩니다.
          어디에 둘지는 사용자가 정합니다.
        </p>
        <p className="text-sm text-gray-600">
          이것은 법이 요구하는 방식이 아니라 이 서비스가 택한 설계입니다.
        </p>
      </div>
    </details>
  )
}

/* ── 제출 기록 ────────────────────────────────────────────────── */


/**
 * 제출 기록 표시.
 *
 * ★ "○일 남았습니다" 같은 카운트다운을 만들지 않는다. 법령에 처리 기한 규정이 없다.
 *   "제출한 지 ○일 지났습니다"는 사실이므로 표시한다.
 */
export function SubmissionRecord({ showLink = true }) {
  const { journey } = useJourney()
  // 서식별 · 건별로 모두 센다 (복수 기관 동시 행사에서 두 건이 될 수 있다)
  const submitted = Object.entries(journey.milestones ?? {})
    .filter(([, m]) => m?.submittedAt)
    .map(([key, m]) => ({ key, title: milestoneLabel(key, journey), m }))
  if (submitted.length === 0) return null

  return (
    <Card>
      <h2 className="text-lg font-bold text-gray-900">제출 기록</h2>
      <ul className="mt-3 space-y-2">
        {submitted.map(({ key, title, m }) => {
          const days = daysSince(m.submittedAt)
          return (
            <li key={key} className="text-gray-800">
              <b>
                {formatDate(m.submittedAt)}에 {title}를 제출하셨습니다.
              </b>
              {days !== null && (
                <span className="text-gray-600">
                  {' '}
                  제출한 지 {days === 0 ? '오늘로 하루도 지나지 않았습니다' : `${days}일 지났습니다`}
                  .
                </span>
              )}
            </li>
          )
        })}
      </ul>
      <p className="mt-3 text-gray-700">
        회신을 받으셨다면 내용을 해석해 드립니다.
      </p>
      {showLink && (
        <Link to="/response" className="btn btn-primary mt-3">
          회신 해석하기
        </Link>
      )}
    </Card>
  )
}
