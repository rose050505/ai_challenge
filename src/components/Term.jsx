import { useEffect, useId, useRef, useState } from 'react'
import { GLOSSARY, GLOSSARY_BY_ID, GLOSSARY_BY_TERM } from '../data/glossary.js'
import { Basis } from './ui.jsx'

/**
 * 용어 풀이.
 *
 * ── 왜 이 방식인가 ─────────────────────────────────────────────
 * 호버 툴팁은 쓰지 않는다. 모바일에 호버가 없고, 키보드 사용자에게도 닿지 않는다.
 * 대신 <button aria-expanded> + 펼침 패널로 만든다.
 *   - 탭으로 도달하고 Enter/Space 로 열린다
 *   - Esc 로 닫힌다
 *   - 바깥을 누르면 닫힌다
 *   - 색이 아니라 점선 밑줄 + ? 표식으로 "누를 수 있음"을 알린다
 *
 * 문단(<p>) 안에 들어가므로 패널도 <span> 으로 만든다. (블록 요소는 <p> 안에 못 넣는다)
 * ────────────────────────────────────────────────────────────────
 *
 * @param {string} [id]  glossary.js 의 항목 id
 * @param {React.ReactNode} children  화면에 보일 말. 생략하면 항목의 term 을 쓴다.
 */
export function Term({ id, children }) {
  const entry =
    (id && GLOSSARY_BY_ID[id]) ||
    (typeof children === 'string' && GLOSSARY_BY_TERM[children]) ||
    null
  const [open, setOpen] = useState(false)
  const panelId = useId()
  const wrapRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e) => {
      if (e.key === 'Escape') setOpen(false)
    }
    const onDown = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('keydown', onKey)
    document.addEventListener('pointerdown', onDown)
    return () => {
      document.removeEventListener('keydown', onKey)
      document.removeEventListener('pointerdown', onDown)
    }
  }, [open])

  // 용어집에 없는 말이면 아무 장식 없이 그대로 보여준다 (조용히 실패한다)
  if (!entry) return <>{children}</>

  return (
    <span ref={wrapRef} className="relative inline-block">
      <button
        type="button"
        className="term-trigger"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`${entry.term} — 용어 풀이 ${open ? '닫기' : '보기'}`}
        onClick={() => setOpen((v) => !v)}
      >
        {children ?? entry.term}
      </button>
      {open && (
        <span
          id={panelId}
          role="note"
          className="absolute left-0 top-full z-30 mt-1 block w-[min(23rem,85vw)] rounded-md border border-ink-300 bg-white p-3 text-left shadow-lg"
        >
          <TermBody entry={entry} onClose={() => setOpen(false)} />
        </span>
      )}
    </span>
  )
}

function TermBody({ entry, onClose }) {
  return (
    <>
      <span className="flex items-start justify-between gap-2">
        <span className="block text-base font-bold text-gray-900">{entry.term}</span>
        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="shrink-0 rounded-md px-2 text-sm text-gray-500 hover:bg-gray-100"
            aria-label="용어 풀이 닫기"
          >
            닫기
          </button>
        )}
      </span>
      <span className="mt-1 block text-sm leading-relaxed text-gray-800">{entry.plain}</span>
      {entry.extra && (
        <span className="mt-2 block text-sm leading-relaxed text-gray-600">{entry.extra}</span>
      )}
      {entry.statutory && (
        <span className="mt-2 block rounded-md border-l-2 border-ink-300 bg-ink-50 px-2 py-1 text-sm leading-relaxed text-gray-700">
          <span className="block text-xs font-semibold text-ink-700">법령 원문</span>
          {entry.statutory}
        </span>
      )}
      {entry.unverifiedNote && (
        <span className="mt-2 block rounded-md bg-amber-50 px-2 py-1 text-sm leading-relaxed text-amber-900">
          {entry.unverifiedNote}
        </span>
      )}
      <span className="mt-2 block">
        <Basis chain>{entry.basis}</Basis>
      </span>
    </>
  )
}

/**
 * 전체 용어집.
 * 낱개 풀이를 못 보고 지나친 사용자를 위해 한 곳에 모아 둔다.
 * <details> 이므로 자바스크립트 없이도 열린다.
 */
export function GlossaryList() {
  return (
    <details className="no-print rounded-lg border border-gray-400 bg-white">
      <summary className="cursor-pointer rounded-lg px-4 py-3 font-bold text-gray-900">
        이 서비스에 나오는 말들 ({GLOSSARY.length}개)
      </summary>
      <div className="border-t border-gray-300 p-4">
        <p className="mb-3 text-sm text-gray-600">
          법령의 정의를 쉬운 말로 옮긴 것입니다. 각 항목에 근거 조문을 함께 표시합니다.
        </p>
        <dl className="space-y-4">
          {GLOSSARY.map((g) => (
            <div key={g.id} className="border-t border-gray-300 pt-3 first:border-t-0 first:pt-0">
              <dt className="font-bold text-gray-900">
                {g.term}
                {g.aliases?.length > 0 && (
                  <span className="ml-2 text-sm font-normal text-gray-500">
                    ({g.aliases.join(', ')})
                  </span>
                )}
              </dt>
              <dd className="mt-1">
                <TermBody entry={g} />
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </details>
  )
}
