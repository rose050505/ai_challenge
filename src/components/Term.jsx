import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react'
import { GLOSSARY, GLOSSARY_BY_ID, GLOSSARY_BY_TERM } from '../data/glossary.js'
import { Basis } from './ui.jsx'

/**
 * 좁은 화면인가.
 *
 * ★ 왜 화면 폭으로 갈라야 하는가 (2026-09-03 실기 확인).
 *   팝오버는 용어가 놓인 자리에서 오른쪽으로 펼쳐진다. 375px 에서는 폭이 318px 이라
 *   용어가 왼쪽 끝(x≈16)에 있을 때만 겨우 들어오고, 문장 중간에만 놓여도
 *   **오른쪽이 화면 밖으로 나가 글자가 잘렸다.** 17개 용어를 전 화면에서 열어 보니
 *   16개가 넘쳤고, 그중 12개는 문서 자체를 가로로 밀어 배경까지 흔들었다.
 *   좁은 화면에서 자리를 계산해 밀어 넣으면 팝오버가 용어에서 멀어져 무엇에 대한
 *   설명인지 흐려진다. 그래서 좁은 화면에서는 **자리를 아예 고정한다** — 아래 시트.
 *   어느 용어에서 열든 같은 자리에 같은 폭으로 뜨고, 넘칠 여지가 없다.
 *
 * 640px 은 Tailwind 의 `sm` 경계와 같다. 이 서비스가 화면을 가르는 다른 자리와 맞춘다.
 */
const NARROW_MAX = 639
function useNarrow() {
  const [narrow, setNarrow] = useState(
    () => typeof window !== 'undefined' && window.innerWidth <= NARROW_MAX,
  )
  useEffect(() => {
    const mq = window.matchMedia(`(max-width: ${NARROW_MAX}px)`)
    const on = () => setNarrow(mq.matches)
    on()
    mq.addEventListener?.('change', on)
    return () => mq.removeEventListener?.('change', on)
  }, [])
  return narrow
}

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
  const panelRef = useRef(null)
  const narrow = useNarrow()
  /** 넓은 화면에서 뷰포트 안으로 밀어 넣은 거리(px)와 위로 뒤집었는지 */
  const [fit, setFit] = useState({ dx: 0, above: false })

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

  /*
   * 넓은 화면의 자리 보정.
   * 좁은 화면은 아래 시트라 보정할 것이 없다 — 언제나 뷰포트 안이다.
   * 그린 뒤에 재고 옮긴다. 용어가 문장 어디에 놓일지는 글자 크기·번역·줄바꿈에
   * 따라 달라져서, 미리 계산할 수 없다.
   */
  useLayoutEffect(() => {
    if (!open || narrow) {
      setFit({ dx: 0, above: false })
      return
    }
    const el = panelRef.current
    const trig = wrapRef.current
    if (!el || !trig) return
    const M = 8
    const vw = document.documentElement.clientWidth
    const vh = window.innerHeight
    // 보정 전 자리에서 잰다 (dx=0, 아래쪽)
    const r0 = el.getBoundingClientRect()
    const base = r0.left - fit.dx
    let dx = 0
    if (base + r0.width > vw - M) dx = vw - M - (base + r0.width)
    if (base + dx < M) dx = M - base
    const t = trig.getBoundingClientRect()
    // 아래로 넘치고 위에 자리가 있으면 뒤집는다
    const below = t.bottom + 4 + r0.height
    const above = below > vh - M && r0.height + 4 <= t.top - M
    setFit({ dx, above })
    // fit 은 이 계산의 결과다. 의존성에 넣으면 스스로를 다시 부른다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, narrow])

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
          ref={panelRef}
          id={panelId}
          role="note"
          className={
            narrow
              ? /* 좁은 화면 — 아래 시트. 자리를 계산하지 않으므로 어느 용어에서 열어도
                   결과가 같다. 긴 풀이는 시트 안에서 세로로 굴린다. */
                'fixed inset-x-3 bottom-3 z-50 block max-h-[70vh] overflow-y-auto overscroll-contain rounded-lg border border-ink-300 bg-white p-4 text-left shadow-2xl'
              : `absolute left-0 z-30 block w-[min(23rem,85vw)] rounded-md border border-ink-300 bg-white p-3 text-left shadow-lg ${
                  fit.above ? 'bottom-full mb-1' : 'top-full mt-1'
                }`
          }
          style={narrow ? undefined : { left: fit.dx }}
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
