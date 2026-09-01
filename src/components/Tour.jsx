import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
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
        return {
          x: r.left - 6,
          y: r.top - 6,
          w: r.width + 12,
          h: r.height + 12,
          /* ★ 문서 좌표도 같이 담는다. 패널 자리를 **스크롤이 끝난 뒤** 기준으로
             정하려면 화면 좌표만으로는 안 된다 (placeTopFor 주석 참조). */
          docY: r.top - 6 + window.scrollY,
        }
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
         *   가운데에 놓인 대상은 패널 뒤에 숨는다. 위쪽(머리말 바로 아래)에 붙인다.
         * ★ 부드럽게 움직인다 (2026-09-01). 즉시 점프하면 "어디서 어디로 갔는지"가
         *   보이지 않는다. 움직이는 동안에도 scroll 리스너가 계속 다시 재므로
         *   강조 표시는 요소에 정확히 붙어 함께 미끄러진다.
         * ★ prefers-reduced-motion: reduce 면 즉시 이동한다.
         */
        const top = els[0].getBoundingClientRect().top + window.scrollY - 96
        const reduce =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
        window.scrollTo({ top: Math.max(0, top), behavior: reduce ? 'auto' : 'smooth' })
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

/**
 * 패널을 위에 붙일 것인가.
 *
 * ★ **지금 대상이 어디 있는지로 정하면 안 된다.** (2026-09-01 심사 당일 감사)
 *   정거장이 열리면 곧바로 대상을 화면 위쪽(96px)으로 스크롤한다. 그런데 그 스크롤은
 *   부드럽게 진행되므로, 첫 그림 시점의 대상은 아직 화면 **아래쪽**에 있다.
 *   그 값으로 정하면 패널이 위에 붙었다가 스크롤이 끝난 뒤 아래로 내려온다 —
 *   1280px 첫 방문에서 패널이 y=16 → y=608 로 592px 뛰었다(레이아웃 이동 0.233).
 *   그래서 **스크롤이 끝난 뒤 대상이 놓일 자리**를 미리 계산해서 정한다.
 *   그 값은 스크롤 도중에도 변하지 않으므로 패널은 처음부터 제자리에 그려진다.
 *
 *   여전히 위에 붙는 경우가 있다 — 페이지가 짧아 더 스크롤할 수 없어 대상이
 *   화면 아래쪽에 남는 경우다. 그때는 설명이 설명 대상을 가리지 않게 위로 올린다.
 */
function placeTopFor(rects) {
  if (!rects.length || typeof window === 'undefined') return false
  const max = Math.max(0, document.documentElement.scrollHeight - window.innerHeight)
  const after = Math.min(Math.max(0, rects[0].docY - 90), max) // useTargets 의 -96 과 같은 자리
  return Math.min(...rects.map((r) => r.docY - after)) > window.innerHeight * 0.42
}

const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'

/** 단위 사각형(1×1)을 그 자리·그 크기로 옮기는 transform. 0 으로 줄어들지 않게 막는다. */
const holeTransform = (r) =>
  `translate(${r.x}px, ${r.y}px) scale(${Math.max(r.w, 1)}, ${Math.max(r.h, 1)})`

export default function Tour() {
  const { active, step, demo, begin, goTo, finish, toggleDemo, hasProgress } = useTour()
  const panelRef = useRef(null)
  /*
   * ★ 움직임 (2026-09-01 사용자 진단 — 375px 실기)
   *   "다음을 누를 때 뚝뚝 넘어가서 지금 웹을 설명하는 건지 느껴지지 않는다."
   *   원인은 **모든 것이 즉시 점프**하는 것이다. 눈이 인과를 따라가지 못한다.
   *   dir  — 내용이 어느 쪽에서 들어올지 ([다음] 오른쪽 / [이전] 왼쪽)
   *   moving — 강조 표시가 미끄러지는 짧은 구간. 이때만 transition 을 켠다.
   *   ★ 항상 켜 두면 안 된다. 배경이 스크롤될 때마다 다시 재는데,
   *     그때도 transition 이 걸려 있으면 강조 표시가 요소를 **뒤늦게 따라간다.**
   */
  const [dir, setDir] = useState(1)
  const [moving, setMoving] = useState(false)
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
    const body = panelRef.current?.querySelector('[data-tour-body]')
    if (body) body.scrollTop = 0
  }, [active, step])

  /*
   * 정거장이 바뀐 직후 260ms 동안만 강조 표시에 transition 을 건다.
   * ★ 배경이 스크롤되기 시작하면 곧바로 끈다. 스크롤 중에는 리스너가 매 프레임
   *   다시 재는데, 그때 transition 이 남아 있으면 강조 표시가 요소를 **뒤늦게 따라가** 어긋난다.
   *   (스크롤이 있는 경우의 "이동"은 배경과 함께 미끄러지는 것으로 이미 보인다)
   */
  useEffect(() => {
    if (!active) return
    setMoving(true)
    const off = () => setMoving(false)
    const t = setTimeout(off, 260)
    window.addEventListener('scroll', off, true)
    return () => {
      clearTimeout(t)
      window.removeEventListener('scroll', off, true)
    }
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
  /* 대상이 아래쪽에 남는 경우(짧은 페이지 등)에만 패널을 위로 올린다. placeTopFor 참조. */
  const placeTop = placeTopFor(rects)
  const prev = () => {
    setDir(-1)
    if (step === OUTRO) return goTo(total - 1)
    if (isStation && step > 0) return goTo(step - 1)
    return goTo(INTRO) // 소개로 돌아가는 대신 아무것도 하지 않는다
  }
  const next = () => {
    setDir(1)
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
            {/*
              ★ 위치·크기를 x/y/width/height 대신 **transform 으로** 준다.
                단위 사각형(1×1)을 옮기고 늘린다. 그래야 transform 하나만으로
                다음 대상까지 미끄러져 갈 수 있다 — layout 을 건드리지 않는다.
            */}
            {rects.map((r, i) => (
              <rect
                key={i}
                x="0"
                y="0"
                width="1"
                height="1"
                fill="#000"
                className={moving ? 'tour-hole-move' : undefined}
                style={{ transform: holeTransform(r), transformOrigin: '0 0' }}
              />
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
            x="0"
            y="0"
            width="1"
            height="1"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            /* 늘려도 선 굵기는 그대로여야 한다 */
            vectorEffect="non-scaling-stroke"
            className={moving ? 'tour-hole-move' : undefined}
            style={{ transform: holeTransform(r), transformOrigin: '0 0' }}
          />
        ))}
      </svg>

      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="tour-title"
        tabIndex={-1}
        data-tour-panel="1"
        /*
         * ★ 자리
         *   (2026-08-31) 강조할 것이 없으면 화면 가운데 카드로 띄운다.
         *   (2026-09-01) **모바일은 하단 시트다.** 375px 에서 패널이 화면을 거의 다
         *     덮어, 강조된 배경이 보이지 않았다. 그래서 "화면 안의 이 부분"이라는
         *     투어의 전제가 전달되지 않고 모달만 연달아 뜨는 것으로 느껴졌다.
         *     → 아래에 붙이고 높이를 48vh 로 묶는다. **위 절반은 배경이 보인다.**
         *     데스크톱(sm 이상)은 화면이 넓어 문제가 없으므로 현행 그대로 둔다.
         */
        className={`fixed z-50 mx-auto flex flex-col overflow-hidden rounded-md border-2 border-ink-700 bg-white p-4 shadow-2xl outline-none sm:p-5 ${
          rects.length === 0
            ? 'inset-x-3 top-1/2 max-h-[76vh] w-auto max-w-2xl -translate-y-1/2 sm:inset-x-0 sm:w-full'
            : `tour-sheet inset-x-0 bottom-0 max-h-[48vh] w-full max-w-2xl sm:max-h-[60vh] ${
                placeTop ? 'sm:bottom-auto sm:top-4' : 'sm:bottom-4'
              }`
        }`}
      >
        {/*
          ★ key 가 바뀌면 다시 마운트되고, 그때 tour-in 애니메이션이 돈다.
            [다음]이면 오른쪽에서, [이전]이면 왼쪽에서 들어온다.
          ★ **스크롤은 이 안에서만** 일어난다. (2026-09-01)
            시트 높이를 48vh 로 묶으면 정거장 1(시연 버튼이 있는 칸)은 넘친다.
            패널 전체가 스크롤되면 [다음]이 아래로 밀려 보이지 않는다 —
            내용만 스크롤하고 단추 줄은 시트 바닥에 붙여 둔다.
            다시 마운트되므로 앞 정거장의 스크롤 위치도 따라오지 않는다.
        */}
        <div
          key={String(step)}
          data-tour-body="1"
          className={`tour-page min-h-0 flex-1 overflow-y-auto${dir < 0 ? ' tour-page-back' : ''}`}
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

        {/* 마무리에서만 뜨는 길 하나. TOUR_OUTRO.link 주석 참조. */}
        {head.link && (
          <p className="mt-3">
            <Link
              to={head.link.to}
              onClick={finish}
              className="font-bold text-ink-700 underline"
            >
              {head.link.label}
            </Link>
          </p>
        )}

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

        </div>

        <div className="mt-3 shrink-0 border-t border-gray-300 pt-3">
        <div className="flex flex-wrap items-center gap-2">
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
        <p className="mt-2 text-sm text-gray-600">
          {step === INTRO
            ? '건너뛰셔도 지금 보시던 화면에서 그대로 이어서 쓰실 수 있습니다. Esc 로도 닫힙니다.'
            : 'Esc 로도 닫힙니다.'}
        </p>
        </div>
      </div>
    </div>
  )
}
