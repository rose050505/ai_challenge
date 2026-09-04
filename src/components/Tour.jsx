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
  /**
   * ★ 구멍의 자리는 **문서 좌표**로 담고, 스크롤은 바깥 <g> 하나로 뺀다. (2026-09-04)
   *   화면 좌표로 담으면 스크롤할 때마다 값이 바뀐다. 거기에 transition 이 걸려 있으면
   *   강조 표시가 요소를 뒤늦게 따라가므로, 옛 코드는 스크롤이 시작되면 transition 을
   *   껐다 — 그런데 정거장을 옮길 때 **우리가 스스로** 스크롤하므로 그 한 줄이
   *   미끄러짐(①)을 매번 30~60ms 만에 죽였다. 375px 실기에서 "뚝뚝 넘어간다"의 원인이다.
   *   문서 좌표는 스크롤과 무관하므로 transition 이 겨룰 상대가 없다.
   *   → 안쪽 rect: 대상이 바뀔 때만 값이 바뀐다 (200ms 미끄러짐)
   *     바깥 <g>: 매 프레임 스크롤을 따라간다 (transition 없음)
   */
  const [box, setBox] = useState({ rects: [], off: 0 })
  /** 지금 강조 중인 요소들. 크기가 바뀌면 다시 잰다. */
  const watched = useRef([])
  const measure = useCallback(() => {
    if (!targets?.length) {
      watched.current = []
      setBox({ rects: [], off: window.scrollY })
      return []
    }
    const els = targets
      .map((t) => document.querySelector(`[data-tour="${t}"]`))
      .filter(Boolean)
    watched.current = els
    setBox({
      off: window.scrollY,
      rects: els.map((el) => {
        const r = el.getBoundingClientRect()
        return {
          x: r.left - 6 + window.scrollX,
          y: r.top - 6 + window.scrollY,
          w: r.width + 12,
          h: r.height + 12,
        }
      }),
    })
    return els
  }, [targets])

  useLayoutEffect(() => {
    let stop = false
    let tries = 0
    /*
     * ★ 새 정거장은 **맨 위에서 시작한다.** (2026-09-04 375px 실기 측정)
     *   정거장마다 화면이 바뀌는데(goTo 가 navigate 한다) 스크롤 값은 앞 화면 것이
     *   그대로 남는다. 게다가 앞 정거장의 부드러운 스크롤이 아직 흐르고 있고,
     *   새 화면이 더 짧으면 브라우저가 그 값을 잘라 낸다 —
     *   375px 에서 [다음] 직후 100ms 동안 2864 → 1416 → 1284 로 요동쳤다.
     *   그 요동은 어느 대상과도 관계가 없다. 대상을 찾기 전에 먼저 멈춰 세운다.
     *   (scrollTo(auto) 는 진행 중이던 부드러운 스크롤도 함께 끊는다)
     */
    if (targets?.length) window.scrollTo({ top: 0, behavior: 'auto' })
    const tick = () => {
      if (stop) return
      const els = measure()
      tries += 1
      if (els && els.length > 0) {
        /*
         * ★ 가운데로 스크롤하면 안 된다. 패널이 화면 아래 절반을 덮으므로
         *   가운데에 놓인 대상은 패널 뒤에 숨는다. 위쪽(머리말 바로 아래)에 붙인다.
         * ★ 부드럽게 움직인다 (2026-09-01). 즉시 점프하면 "어디서 어디로 갔는지"가
         *   보이지 않는다. 강조 표시는 바깥 <g> 가 매 프레임 스크롤을 따라가므로
         *   움직이는 동안에도 요소에 정확히 붙어 함께 미끄러진다.
         * ★ prefers-reduced-motion: reduce 면 즉시 이동한다.
         */
        const top = Math.max(0, els[0].getBoundingClientRect().top + window.scrollY - 96)
        const reduce =
          typeof window.matchMedia === 'function' &&
          window.matchMedia('(prefers-reduced-motion: reduce)').matches
        /*
         * ★ 부드럽게 훑는 거리를 **묶는다.** (2026-09-04 375px 실기 측정)
         *   정거장은 저마다 다른 화면이다(goTo 가 navigate 한다). 그래서 새 화면은
         *   앞 화면의 스크롤 값을 그대로 물려받은 채 열린다 — 375px 에서 그 거리가
         *   2,400px 이었고, 크롬의 부드러운 스크롤이 **800ms 넘게** 흘렀다.
         *   내용 전환은 200ms 에 끝나므로 배경만 한참 더 흐르고, 그것이 "뚝뚝"으로 읽힌다.
         *   (1280px 은 같은 자리가 1,600px 이라 덜 아팠다. 그래서 데스크톱만 멀쩡해 보였다)
         *   → 처음 보는 화면에는 지켜야 할 연속성이 없다. 대부분을 **즉시** 건너뛰고
         *     마지막 LEAD 만 부드럽게 미끄러진다. 그리면 폭과 무관하게 같은 길이다.
         *   두 번의 scrollTo 는 같은 작업 안에서 일어나므로 중간 자리는 그려지지 않는다.
         */
        const LEAD = reduce ? 0 : Math.min(SCROLL_LEAD_PX, top)
        if (LEAD > 0) window.scrollTo({ top: top - LEAD, behavior: 'auto' })
        window.scrollTo({ top, behavior: reduce ? 'auto' : 'smooth' })
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
  }, [measure, box.rects.length])

  return box
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
  const after = Math.min(Math.max(0, rects[0].y - 90), max) // useTargets 의 -96 과 같은 자리
  return Math.min(...rects.map((r) => r.y - after)) > window.innerHeight * 0.42
}

/** 정거장이 바뀔 때 **부드럽게** 훑는 거리. 나머지는 즉시 건너뛴다. (useTargets 주석) */
const SCROLL_LEAD_PX = 240

const FOCUSABLE = 'a[href],button:not([disabled]),input,select,textarea,[tabindex]:not([tabindex="-1"])'

/** 단위 사각형(1×1)을 그 자리·그 크기로 옮기는 transform (**문서 좌표**). 0 으로 줄어들지 않게 막는다. */
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
  const { rects, off } = useTargets(head?.targets, step)

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
   * ★ **스크롤로 끄지 않는다.** (2026-09-04)
   *   옛 코드는 스크롤이 시작되면 곧바로 껐다 — 구멍의 자리를 화면 좌표로 담고 있어서
   *   스크롤 중에 transition 이 남아 있으면 구멍이 요소를 뒤늦게 따라갔기 때문이다.
   *   그런데 정거장을 옮기면 우리가 스스로 스크롤한다. 그래서 미끄러짐이 30~60ms 만에
   *   죽었다(375px 실기 측정). 이제 자리를 문서 좌표로 담으므로 스크롤은 값을 바꾸지 않고,
   *   transition 과 겨루지 않는다. 시간으로만 끈다.
   */
  useEffect(() => {
    if (!active) return
    setMoving(true)
    const t = setTimeout(() => setMoving(false), 260)
    return () => clearTimeout(t)
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
  /*
   * ★ 시트냐 가운데 카드냐는 **잰 값이 아니라 선언된 대상**으로 정한다. (2026-09-04)
   *   rects 는 대상을 찾기까지 한두 프레임 비어 있다. 그 사이에 가운데 카드가 됐다가
   *   시트로 돌아오면, 클래스가 다시 붙으면서 tour-rise 가 **정거장마다 다시 재생**됐다
   *   (375px 실기 측정: 시트가 320px = 48vh 만큼 내려갔다 올라온다).
   *   데스크톱에는 이 규칙이 없어 나타나지 않았다 — 모바일만 뚝뚝 끊긴 이유의 하나다.
   *   ④ 는 "처음 뜰 때 올라온다"이지 "옮길 때마다 다시 올라온다"가 아니다.
   */
  const hasTargets = (head?.targets?.length ?? 0) > 0
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
            {/* 스크롤은 이 <g> 하나가 맡는다 (transition 없음). useTargets 주석 참조. */}
            <g style={{ transform: `translateY(${-off}px)` }}>
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
            </g>
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
        <g style={{ transform: `translateY(${-off}px)` }}>
          {rects.map((r, i) => (
            <rect
              key={i}
              /* 시험이 이 테두리를 다른 그림의 사각형과 헷갈리지 않게 하는 표식 */
              data-tour-hole=""
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
        </g>
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
          !hasTargets
            ? 'tour-card inset-x-3 top-1/2 max-h-[76vh] w-auto max-w-2xl -translate-y-1/2 sm:inset-x-0 sm:w-full'
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
