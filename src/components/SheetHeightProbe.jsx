import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SheetModeContext } from '../lib/sheet-mode.js'
import { PAGE_CONTENT_WIDTH_MM, PAGE_CONTENT_HEIGHT_MM } from './PagedSheet.jsx'

const MM_TO_PX = 96 / 25.4

/**
 * 나누지 않는 서식은 페이지 상자를 우리가 만들지 않는다. 브라우저가 인쇄 영역
 * (297mm − 위아래 여백 20mm×2 = 257mm) 안에서 흐르는 대로 끊는다.
 * 그래서 PagedSheet 의 안전 여유(8mm)를 빼지 않고, 반올림 오차만큼만 뺀다.
 */
const SAFETY_MM = 2

/**
 * 나누지 않는 서식(서식 1)의 **예상 페이지 수를 실제로 잰다.**
 *
 * ★ 왜 필요한가.
 *   서식 1은 지금까지 화면에 "1페이지"라고 **고정 문구**로 적혀 있었다.
 *   열 번의 실측에서 모두 한 장이었지만, 그건 측정값이 아니라 가정이다.
 *   확인하지 않은 것을 표시하지 않는다는 이 프로젝트의 원칙은 법령에만 적용되는 게 아니다.
 *
 * 방법은 PagedSheet 와 같다. 인쇄와 같은 조판(.print-metrics)으로 화면 밖에 한 번 그려
 * 전체 높이를 재고, 인쇄 영역 높이로 나눈다.
 * 서식 1은 우리가 페이지를 나누지 않으므로 브라우저가 흐르는 대로 끊는다.
 * → ceil(전체 높이 / 페이지 높이) 가 그 결과와 같다.
 *
 * 큰 글씨 인쇄(--sheet-zoom)도 자동으로 반영된다. 같은 변수를 보기 때문이다.
 *
 * ── 정확도 (2026-08-29 실측) ──────────────────────────────────────
 * 빈 서식 ~ 긴 이름까지 실제 입력 범위에서는 예고 = 실제 (기본·큰 글씨 모두).
 * 다만 한 칸에 1,000자를 넣는 식으로 **한 섹션이 한 장보다 커지면** 어긋난다
 * (측정 788mm → 예고 4쪽, 실제 5쪽). 그 안에서는 표의 행이 쪼개지지 않아
 * 브라우저가 우리보다 여백을 더 남기기 때문이다.
 * → 두 장 이상이 되면 화면에서 "인쇄 미리보기로 확인해 달라"고 함께 안내한다.
 * ────────────────────────────────────────────────────────────────
 */
export default function SheetHeightProbe({ children, onPageCount }) {
  const ref = useRef(null)
  const [count, setCount] = useState(1)

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    const page = (PAGE_CONTENT_HEIGHT_MM - SAFETY_MM) * MM_TO_PX
    const h = (node) => (node ? node.getBoundingClientRect().height : 0)

    /**
     * ★ 전체 높이를 페이지 높이로 나누면 틀린다.
     *   브라우저는 아무 데서나 끊지 않는다. `.print-sheet section { break-inside: avoid }`
     *   때문에 **섹션 경계에서** 끊는다. 그래서 마지막 페이지에 여백이 남고,
     *   단순 나눗셈은 쪽 수를 **적게** 잡는다 (실측: 924mm 를 4쪽으로 봤으나 실제 5쪽).
     *   섹션 단위로 채워 넣는 방식으로 브라우저와 같은 규칙을 쓴다.
     */
    const body = el.querySelector('[data-sheet-body]')
    const head = h(el.querySelector('[data-sheet-head]'))
    const blocks = body ? [...body.children].map(h) : []
    if (blocks.length === 0) {
      const total = el.getBoundingClientRect().height
      if (!total) return
      const n = Math.max(1, Math.ceil(total / page - 0.001))
      setCount((prev) => (prev === n ? prev : n))
      return
    }

    // 블록 사이 간격 (space-y-2 = 0.5rem)
    const gap = body ? parseFloat(getComputedStyle(body).rowGap || '0') || 8 : 8
    const headGap = body ? parseFloat(getComputedStyle(body).marginTop || '0') || 0 : 0

    const start = head + headGap
    let pages = 1
    let used = start
    let first = true
    for (const bh of blocks) {
      const need = bh + (first ? 0 : gap)
      if (used + need <= page) {
        used += need
      } else {
        // 다음 장에서 이 블록을 다시 시작한다
        pages += 1
        used = bh
        // 블록 하나가 한 장보다 크면 브라우저가 그 안에서 끊는다
        while (used > page) {
          pages += 1
          used -= page
        }
      }
      first = false
    }
    const n = Math.max(1, pages)
    setCount((prev) => (prev === n ? prev : n))
  }, [])

  useLayoutEffect(measure)

  // 글꼴이 늦게 붙으면 높이가 달라진다. 붙은 뒤 한 번 더 잰다.
  useEffect(() => {
    let alive = true
    document.fonts?.ready?.then(() => {
      if (alive) measure()
    })
    return () => {
      alive = false
    }
  }, [measure])

  useEffect(() => {
    onPageCount?.(count)
  }, [count, onPageCount])

  return (
    <div
      aria-hidden="true"
      className="no-print pointer-events-none fixed top-0 left-[-10000px] invisible"
    >
      <SheetModeContext.Provider value="measure">
        {/* ★ zoom 이 걸리므로 너비를 배율로 나눠야 실제 인쇄 폭과 같아진다 */}
        <div
          ref={ref}
          className="print-metrics"
          style={{ width: `calc(${PAGE_CONTENT_WIDTH_MM}mm / var(--sheet-zoom))` }}
        >
          {children}
        </div>
      </SheetModeContext.Provider>
    </div>
  )
}
