import { useCallback, useEffect, useRef, useState } from 'react'

/**
 * 서식을 감싸는 가로 스크롤 영역.
 *
 * ── 왜 만들었나 (2026-08-31 사용자 지적) ────────────────────────────
 * 375px 에서 서식 표의 오른쪽("정정 또는 삭제 내용" 열)이 화면 밖으로 나가 있었다.
 * `overflow-x: auto` 는 걸려 있어서 **밀면 실제로 움직였다.** 그런데
 *   - 모바일의 겹침 스크롤 막대는 손을 대기 전에는 보이지 않고,
 *   - 서식이 흰 바탕이라 잘린 자리가 그냥 여백처럼 보인다.
 * 그래서 사용자에게는 "스크롤되는 영역"이 아니라 **깨진 화면**으로 읽혔다.
 * 되는 것과 되는 줄 아는 것은 다른 문제다.
 *
 * 두 가지를 함께 한다.
 *   1) 서식의 최소 폭을 낮춰 375px 에서는 **애초에 잘리지 않게** 한다
 *      (`.sheet-scroll > *` min-width, src/index.css)
 *   2) 그래도 좁은 화면(320px 등)에서는 잘릴 수 있으므로,
 *      **잴 때 실제로 넘칠 때만** 밀 수 있다고 알리고 가장자리에 그림자를 준다
 *
 * ★ 인쇄에는 영향이 없다. 최소 폭도 이 컴포넌트도 전부 `@media screen` 쪽 이야기이고,
 *   인쇄 조판은 `@page` 와 mm 치수가 정한다. 쪽 수 예고(.print-metrics)는
 *   화면 밖 고정 폭 영역에서 재므로 여기 폭이 바뀌어도 값이 달라지지 않는다.
 *
 * ★ 접근성 — 스크롤 영역에는 키보드로 닿을 수 있어야 한다.
 *   넘칠 때만 `tabindex=0` + `role="region"` 을 준다. 넘치지 않을 때 탭 정거장을
 *   하나 더 만들면 그건 그것대로 방해다.
 */
export default function SheetScroll({ children, label = '서식' }) {
  const ref = useRef(null)
  const [state, setState] = useState({ scrollable: false, atStart: true, atEnd: true })

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    // 소수점 반올림 때문에 1px 정도는 넘친 것으로 보지 않는다
    const scrollable = el.scrollWidth - el.clientWidth > 1
    const atStart = el.scrollLeft <= 1
    const atEnd = el.scrollLeft >= el.scrollWidth - el.clientWidth - 1
    setState((prev) =>
      prev.scrollable === scrollable && prev.atStart === atStart && prev.atEnd === atEnd
        ? prev
        : { scrollable, atStart, atEnd },
    )
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return
    measure()
    // 창 크기, 글자 크기, 서식 내용(칸이 늘어나는 textarea) 어느 쪽이 바뀌어도 다시 잰다
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    if (el.firstElementChild) ro.observe(el.firstElementChild)
    const mo = new MutationObserver(measure)
    mo.observe(el, { childList: true, subtree: true, characterData: true })
    window.addEventListener('resize', measure)
    return () => {
      ro.disconnect()
      mo.disconnect()
      window.removeEventListener('resize', measure)
    }
  }, [measure])

  const { scrollable, atStart, atEnd } = state

  return (
    <div
      className="sheet-scroll-wrap"
      data-scrollable={scrollable ? 'true' : 'false'}
      data-at-start={atStart ? 'true' : 'false'}
      data-at-end={atEnd ? 'true' : 'false'}
    >
      {scrollable && (
        <p className="no-print mb-1 text-sm text-gray-700" data-testid="sheet-scroll-hint">
          <span aria-hidden="true">↔ </span>
          서식이 화면보다 넓습니다. <b>좌우로 밀어서</b> 나머지 칸을 보실 수 있습니다.
        </p>
      )}
      <div
        ref={ref}
        onScroll={measure}
        className="sheet-scroll"
        {...(scrollable
          ? { tabIndex: 0, role: 'region', 'aria-label': `${label} — 좌우로 밀어서 볼 수 있습니다` }
          : null)}
      >
        {children}
      </div>
    </div>
  )
}
