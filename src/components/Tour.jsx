import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { INTRO, OUTRO, useTour } from '../lib/tour.jsx'
import { TOUR_INTRO, TOUR_OUTRO, TOUR_STATIONS, TOUR_TITLE } from '../data/tour.js'

/**
 * 둘러보기 오버레이.
 *
 * ── 만드는 방식 ──────────────────────────────────────────────────
 * ★ 외부 라이브러리를 쓰지 않는다. 심사 기간에 외부 요청은 실패 지점이다.
 *   구멍 뚫린 어둠은 SVG mask 로 만든다. box-shadow 로는 구멍을 두 개 낼 수 없다.
 * ────────────────────────────────────────────────────────────────
 *
 * ★ 접근성
 *   - role="dialog" aria-modal, 단계마다 패널로 포커스를 옮긴다.
 *   - Tab 은 패널 안에서만 돈다(포커스 트랩). 뒤 화면은 설명 대상이지 조작 대상이 아니다.
 *   - Esc 는 건너뛰기. 갇히는 곳이 없어야 한다.
 *   - 본문은 눈으로 읽는 순서와 낭독 순서가 같다.
 */

/** 강조할 요소를 찾는다. 화면이 아직 안 그려졌을 수 있으므로 잠깐 기다린다. */
function useTargets(targets, step) {
  const [rects, setRects] = useState([])
  /** 지금 강조 중인 요소들. 크기가 바뀌면 다시 잰다. */
  const watched = useRef([])
  const measure = useCallback(() => {
    if (!targets?.length) {
      watched.current = []
      setRects([])
      return []
    }
    const els = targets
      .map((t) => document.querySelector(`[data-tour="${t}"]`))
      .filter(Boolean)
    watched.current = els
    setRects(
      els.map((el) => {
        const r = el.getBoundingClientRect()
        return { x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 }
      }),
    )
    return els
  }, [targets])

  useLayoutEffect(() => {
    let stop = false
    let tries = 0
    const tick = () => {
      if (stop) return
      const els = measure()
      tries += 1
      if (els && els.length > 0) {
        /*
         * ★ 가운데로 스크롤하면 안 된다. 패널이 화면 아래 절반을 덮으므로
         *   가운데에 놓인 대상은 패널 뒤에 숨는다. 위쪽에 붙인다.
         */
        const top = els[0].getBoundingClientRect().top + window.scrollY - 96
        window.scrollTo({ top: Math.max(0, top), behavior: 'auto' })
        setTimeout(measure, 60)
        return
      }
      // 정거장 3은 해석이 끝나야 대상이 생긴다. 3초까지 기다린다.
      if (tries < 30) setTimeout(tick, 100)
    }
    tick()
    return () => {
      stop = true
    }
  }, [measure, step])

  useEffect(() => {
    const on = () => measure()
    window.addEventListener('scroll', on, true)
    window.addEventListener('resize', on)
    /*
     * ★ 강조 대상은 투어 중에도 커진다 (정거장 2의 시연이 근거 문장을 늘린다).
     *   스크롤·리사이즈만 듣고 있으면 구멍이 옛 크기로 남아 내용이 어둠에 잘린다.
     */
    let ro = null
    if (typeof ResizeObserver !== 'undefined') {
      ro = new ResizeObserver(on)
      watched.current.forEach((el) => ro.observe(el))
    }
    return () => {
      window.removeEventListener('scroll', on, true)
      window.removeEventListener('resize', on)
      ro?.disconnect()
    }
  }, [measure, rects.length])

  return rects
}

const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'

export default function Tour() {
  const { active, step, demo, begin, goTo, finish, toggleDemo, hasProgress } = useTour()
  const panelRef = useRef(null)
  const isStation = typeof step === 'number'
  const station = isStation ? TOUR_STATIONS[step] : null
  /*
   * ★ 소개·마무리도 강조 대상을 가질 수 있다. (2026-08-31)
   *   소개에서 첫 화면의 자가진단을 비추기 위해 head 를 훅보다 먼저 구한다.
   */
  const head = step === INTRO ? TOUR_INTRO : step === OUTRO ? TOUR_OUTRO : station
  const rects = useTargets(head?.targets, step)

  // 단계가 바뀔 때마다 패널로 포커스를 옮긴다. 스크린리더가 새 내용을 읽는다.
  useEffect(() => {
    if (!active) return
    panelRef.current?.focus()
    /*
     * ★ 패널을 맨 위로 되돌린다. (2026-08-31 사용자 지적 — 실기에서 발견)
     *   패널은 overflow-y-auto 다. 앞 정거장에서 [다음]을 누르려고 안쪽을 내려 두면
     *   그 scrollTop 이 그대로 남아, 다음 정거장의 글이 **중간부터** 보였다.
     *   [이전]으로 돌아갈 때도 같다. focus() 뒤에 되돌린다 —
     *   focus() 가 스크롤을 건드릴 수 있으므로 순서가 중요하다.
     */
    if (panelRef.current) panelRef.current.scrollTop = 0
  }, [active, step])

  // 포커스 트랩 + Esc
  useEffect(() => {
    if (!active) return
    const onKey = (e) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        finish()
        return
      }
      if (e.key !== 'Tab') return
      const nodes = [...(panelRef.current?.querySelectorAll(FOCUSABLE) ?? [])].filter(
        (n) => n.offsetParent !== null,
      )
      if (nodes.length === 0) return
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const cur = document.activeElement
      if (e.shiftKey && (cur === first || cur === panelRef.current)) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && cur === last) {
        e.preventDefault()
        first.focus()
      } else if (!panelRef.current?.contains(cur)) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', onKey, true)
    return () => document.removeEventListener('keydown', onKey, true)
  }, [active, finish])

  if (!active) return null

  const total = TOUR_STATIONS.length
  /*
   * 그래도 대상이 아래쪽에 남는 경우(더 스크롤할 여지가 없는 짧은 페이지 등)에는
   * 패널을 위로 올린다. 설명이 설명 대상을 가리면 투어가 아니다.
   */
  const placeTop =
    rects.length > 0 &&
    Math.min(...rects.map((r) => r.y)) > (typeof window === 'undefined' ? 0 : window.innerHeight) * 0.42
  const prev = () => {
    if (step === OUTRO) return goTo(total - 1)
    if (isStation && step > 0) return goTo(step - 1)
    return goTo(INTRO) // 소개로 돌아가는 대신 아무것도 하지 않는다
  }
  const next = () => {
    if (step === INTRO) return begin()
    if (isStation && step < total - 1) return goTo(step + 1)
    if (isStation) return goTo(OUTRO)
    return finish()
  }

  return (
    <div className="no-print">
      {/* 어둠 + 구멍. 구멍이 없으면 화면 전체를 덮는다. */}
      <svg
        aria-hidden="true"
        className="fixed inset-0 z-40 h-full w-full text-ink-300"
        style={{ pointerEvents: 'auto' }}
      >
        <defs>
          <mask id="tour-mask">
            <rect x="0" y="0" width="100%" height="100%" fill="#fff" />
            {rects.map((r, i) => (
              <rect key={i} x={r.x} y={r.y} width={r.w} height={r.h} rx="8" fill="#000" />
            ))}
          </mask>
        </defs>
        <rect
          x="0"
          y="0"
          width="100%"
          height="100%"
          fill="rgba(20,31,49,0.62)"
          mask="url(#tour-mask)"
        />
        {rects.map((r, i) => (
          <rect
            key={i}
            x={r.x}
            y={r.y}
            width={r.w}
            height={r.h}
            rx="8"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
          />
        ))}
      </svg>

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        /*
         * ★ 자리 (2026-08-31 디자인 감사)
         *   정거장에서는 강조된 요소를 가리면 안 되므로 위/아래로 붙인다.
         *   그런데 **강조할 요소가 없는 첫 화면·마무리**에서도 아래에 붙어 있었고,
         *   375×667 에서 그 위 가장자리가 부제 한 줄을 가로로 잘랐다.
         *   가릴 것이 없을 때는 화면 가운데에 카드로 띄운다 — 자른 것이 아니라
         *   덮은 것으로 읽힌다.
         */
        className={`fixed z-50 mx-auto max-h-[80vh] overflow-y-auto rounded-md border-2 border-ink-700 bg-white p-5 shadow-2xl outline-none ${
          rects.length === 0
            ? 'inset-x-3 top-1/2 max-h-[76vh] w-auto max-w-2xl -translate-y-1/2 sm:inset-x-0 sm:w-full'
            : `inset-x-0 max-h-[60vh] w-full max-w-2xl ${
                placeTop ? 'top-0 sm:top-4' : 'bottom-0 sm:bottom-4'
              }`
        }`}
      >
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-sm font-semibold tracking-wide text-ink-600">{TOUR_TITLE}</p>
          {isStation && (
            <p className="tabular text-sm text-gray-600">
              {step + 1} / {total}
            </p>
          )}
        </div>

        <h2 id="tour-title" className="mt-1 text-[1.375rem] font-semibold text-gray-900">
          {head.title}
        </h2>

        <div className="mt-3 space-y-2 text-gray-800">
          {head.body.map((p, i) => (
            <p key={i}>{p}</p>
          ))}
        </div>

        {/* 진행 중인 기록을 덮어쓴다는 사실은 시작 전에 말한다 */}
        {step === INTRO && hasProgress && (
          <p className="mt-3 rounded-md border border-amber-400 bg-amber-50 p-3 text-amber-900">
            <span aria-hidden="true">※ </span>
            {TOUR_INTRO.overwriteWarning}
          </p>
        )}

        {station?.action && (
          <div className="mt-3 rounded-md border border-gray-400 bg-gray-50 p-3">
            <button type="button" onClick={toggleDemo} className="btn btn-secondary">
              {demo ? station.action.off : station.action.on}
            </button>
            <p className="mt-2 text-sm text-gray-700">{station.action.note}</p>
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center gap-2">
          <button type="button" onClick={next} className="btn btn-primary">
            {step === INTRO ? '시작하기' : step === OUTRO ? '닫기' : '다음'}
          </button>
          {isStation && step > 0 && (
            <button type="button" onClick={prev} className="btn btn-secondary">
              이전
            </button>
          )}
          {step !== OUTRO && (
            <button type="button" onClick={finish} className="btn btn-quiet ml-auto">
              건너뛰기
            </button>
          )}
        </div>
        {/* ★ 안내 줄은 소개에서 한 번만 길게 말한다. (2026-08-31, 375px 실기)
            정거장마다 두 줄을 되풀이하면 그만큼 패널이 커지고, 커진 패널이
            정작 이 정거장이 비추는 것을 덮는다. */}
        <p className="mt-3 text-sm text-gray-600">
          {step === INTRO
            ? '건너뛰셔도 지금 보시던 화면에서 그대로 이어서 쓰실 수 있습니다. Esc 로도 닫힙니다.'
            : 'Esc 로도 닫힙니다.'}
        </p>
      </div>
    </div>
  )
}
