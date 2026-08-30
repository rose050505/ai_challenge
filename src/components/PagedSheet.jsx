import { cloneElement, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { SheetModeContext } from '../lib/sheet-mode.js'
import { paginate } from '../lib/paginate.js'

/**
 * 여러 장이 될 수 있는 법정 서식.
 *
 * ── 총 페이지 수(M)를 어떻게 아는가 ──────────────────────────────
 * CSS 로는 알 수 없다(paginate.js 머리 주석 참고). 그래서:
 *   1. 화면 밖 숨은 영역에 **인쇄와 같은 조판**(.print-metrics)으로 블록을 한 번 그린다
 *   2. 각 블록의 높이를 px 로 잰다
 *   3. A4 본문 높이에 맞춰 블록을 페이지에 채운다 (paginate)
 *   4. 페이지 수가 정해졌으므로 M = pages.length. 각 페이지에 "- N / M -" 을 박는다
 * 조판을 두 벌 만들지 않기 위해 측정 영역과 인쇄 영역은 **같은 JSX** 를 쓴다.
 * 다른 것은 SheetModeContext 값뿐이다.
 * ────────────────────────────────────────────────────────────────
 */

/**
 * @page { size: A4; margin: 20mm 14mm } 에서 나오는 본문 영역.
 * ★ index.css 의 @page 여백과 .paged-page 의 min-height 와 반드시 함께 움직인다.
 *   가로 210 - 14×2 = 182 / 세로 297 - 20×2 = 257
 */
export const PAGE_CONTENT_WIDTH_MM = 182
export const PAGE_CONTENT_HEIGHT_MM = 257
/**
 * 조판 오차 여유.
 * 측정은 화면 렌더러, 실제 조판은 인쇄 렌더러가 한다. 반올림 차이로 마지막 블록이
 * 한 줄 넘치면 브라우저가 임의로 페이지를 밀어 N/M 표기가 어긋난다.
 * 여유를 두어 그런 일이 없게 한다. (넘치는 쪽보다 조금 이르게 끊는 쪽이 안전하다)
 */
export const PAGE_SAFETY_MM = 8
/** 블록 사이 간격. index.css 의 .paged-block + .paged-block 값과 같아야 한다. */
const BLOCK_GAP_PT = 6

const MM_TO_PX = 96 / 25.4
const PT_TO_PX = 96 / 72

/** 페이지 번호 줄. 낱장이 분리돼도 몇 쪽인지 알 수 있어야 한다. */
function PageFoot({ n, total }) {
  return (
    <div className="paged-foot" aria-hidden={total === 1 ? 'true' : undefined}>
      - {n} / {total} -
    </div>
  )
}

/** 2페이지 이후 상단에 반복되는 머리. 문서명 + 신청인 성명. */
function RunHead({ title, name }) {
  return (
    <div className="paged-runhead">
      <span>{title}</span>
      <span className="whitespace-nowrap">
        신청인{' '}
        {name?.trim() ? (
          name.trim()
        ) : (
          /* 성명을 안 채웠으면 손으로 쓸 자리를 남긴다 */
          <span className="inline-block w-24 border-b border-black align-bottom" />
        )}
      </span>
    </div>
  )
}

/** 한 페이지 안의 블록들을 그린다. 같은 표의 연속된 행은 하나의 <table> 로 묶는다. */
function renderBlocks(blocks, groups) {
  const out = []
  let i = 0
  while (i < blocks.length) {
    const b = blocks[i]
    if (!b.group) {
      out.push(
        <div key={b.id} className="paged-block">
          {b.node}
        </div>,
      )
      i += 1
      continue
    }
    const group = groups.find((g) => g.id === b.group)
    const rows = []
    while (i < blocks.length && blocks[i].group === b.group) {
      rows.push(blocks[i])
      i += 1
    }
    // 표가 페이지를 넘어가면 다음 페이지의 표에도 같은 열 이름이 다시 붙는다
    out.push(
      <div key={b.id} className="paged-block">
        <table className={group.tableClassName}>
          <thead>
            <tr>
              {group.columns.map((c) => (
                <th key={c.id} scope="col" className={c.className} style={c.style}>
                  {c.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>{rows.map((r) => r.node)}</tbody>
        </table>
      </div>,
    )
  }
  return out
}

export default function PagedSheet({ title, subtitle, applicantName, blocks, groups, onPageCount }) {
  const measureRef = useRef(null)
  const [pages, setPages] = useState(null)
  /** 한 행이 한 쪽보다 커서 쪽 수 예고가 실제보다 적을 수 있는 상태 */
  const [oversize, setOversize] = useState(false)
  const signature = useRef('')

  const measure = useCallback(() => {
    const root = measureRef.current
    if (!root) return
    const h = (el) => (el ? el.getBoundingClientRect().height : 0)

    const heights = {}
    let tallest = 0
    root.querySelectorAll('[data-mid]').forEach((el) => {
      const height = h(el)
      heights[el.getAttribute('data-mid')] = height
      if (height > tallest) tallest = height
    })
    const groupHeadHeights = {}
    root.querySelectorAll('[data-mghead]').forEach((el) => {
      groupHeadHeights[el.getAttribute('data-mghead')] = h(el)
    })

    const pageHeight = (PAGE_CONTENT_HEIGHT_MM - PAGE_SAFETY_MM) * MM_TO_PX
    const runHeadHeight = h(root.querySelector('[data-mhead="run"]'))
    const footHeight = h(root.querySelector('[data-mfoot]'))

    /**
     * 한 덩어리가 한 쪽보다 큰가.
     *
     * ★ 표의 행은 절대 쪼개지 않는다(paginate.js). 행 하나가 한 쪽보다 크면
     *   브라우저가 알아서 넘겨 인쇄하고, **우리 예고보다 실제 쪽 수가 많아진다.**
     *   (내용이 잘리지는 않는다 — 확인함. 다만 숫자가 틀린다.)
     *   틀릴 수 있다는 것을 아는데 가만히 있지 않는다. 화면에 그렇다고 적는다.
     * ★ 여기서 함께 판정한다. 따로 한 번 더 훑으면 글자 하나 칠 때마다
     *   레이아웃 읽기가 두 배가 된다 (2026-08-31 성능 점검에서 확인).
     */
    setOversize((prev) => {
      const now = tallest > pageHeight - footHeight - runHeadHeight
      return prev === now ? prev : now
    })

    const next = paginate({
      blocks,
      heights,
      groupHeadHeights,
      pageHeight,
      firstHeadHeight: h(root.querySelector('[data-mhead="first"]')),
      runHeadHeight,
      footHeight,
      gap: BLOCK_GAP_PT * PT_TO_PX,
    })

    // 결과가 그대로면 setState 하지 않는다 (측정 → 렌더 → 측정 무한루프 방지)
    const sig = next.map((p) => p.blocks.map((b) => b.id).join(',')).join('|')
    if (sig === signature.current) return
    signature.current = sig
    /**
     * ★ 블록 **덩어리**를 상태에 담지 않는다. id 만 담는다.
     *
     *   담았더니 이런 일이 생겼다: 사용자가 서식 2의 칸에 글자를 넣으면 blocks 의
     *   node 는 새로 만들어지는데, 쪽 나눔이 그대로면 위 signature 검사에 걸려
     *   setPages 를 건너뛴다. 그러면 화면과 **인쇄물**은 예전 node 를 계속 그린다.
     *   → 방금 적은 값이 종이에서 빠진다. (2026-08-31 Phase 0 에서 PDF 로 확인)
     *   id 만 담고 그릴 때 지금의 blocks 에서 찾으면 이 어긋남이 원천적으로 없다.
     */
    setPages(next.map((p) => p.blocks.map((b) => b.id)))
  }, [blocks])

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

  const total = pages?.length ?? 1
  useEffect(() => {
    onPageCount?.(total, { oversize })
  }, [total, oversize, onPageCount])

  const flowBlocks = blocks.filter((b) => !b.group)

  /** 쪽 나눔은 id 로만 기억한다. 그릴 때 **지금의** blocks 에서 찾는다 (위 setPages 주석). */
  const byId = new Map(blocks.map((b) => [b.id, b]))
  const resolve = (ids) => ids.map((id) => byId.get(id)).filter(Boolean)
  const pageIdLists = pages ?? [blocks.map((b) => b.id)]

  return (
    <>
      {/* ── 숨은 측정 영역 ──────────────────────────────────────
          인쇄와 같은 조판(.print-metrics)으로 한 번 그려 높이만 잰다.
          화면에도 인쇄에도 나가지 않는다. 포커스도 잡히지 않는다. */}
      <div
        ref={measureRef}
        aria-hidden="true"
        className="no-print pointer-events-none fixed top-0 left-[-10000px] invisible"
      >
        <SheetModeContext.Provider value="measure">
          {/* ★ zoom 이 걸리므로 너비를 배율로 나눠야 실제 인쇄 폭과 같아진다 */}
          <div
            className="print-metrics"
            style={{ width: `calc(${PAGE_CONTENT_WIDTH_MM}mm / var(--sheet-zoom))` }}
          >
            <div data-mhead="first">
              <h2 className="paged-title">{title}</h2>
              {subtitle && <p className="paged-subtitle">{subtitle}</p>}
            </div>
            <div data-mhead="run">
              <RunHead title={title} name={applicantName} />
            </div>
            <div data-mfoot>
              <PageFoot n={1} total={9} />
            </div>
            {flowBlocks.map((b) => (
              <div key={b.id} data-mid={b.id}>
                {b.node}
              </div>
            ))}
            {groups.map((g) => {
              const rows = blocks.filter((b) => b.group === g.id)
              if (rows.length === 0) return null
              return (
                <table key={g.id} className={g.tableClassName}>
                  <thead data-mghead={g.id}>
                    <tr>
                      {g.columns.map((c) => (
                        <th key={c.id} scope="col" className={c.className} style={c.style}>
                          {c.label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>{rows.map((r) => cloneElement(r.node, { 'data-mid': r.id }))}</tbody>
                </table>
              )
            })}
          </div>
        </SheetModeContext.Provider>
      </div>

      {/* ── 실제로 보이고 인쇄되는 서식 ────────────────────────── */}
      <article className="print-sheet print-paged rounded border bg-white p-6 print:rounded-none print:border-0 print:p-0">
        {pageIdLists.map((ids, i) => (
          <section key={i} className="paged-page">
            {i === 0 ? (
              <div className="paged-head">
                <h2 className="paged-title">{title}</h2>
                {subtitle && <p className="paged-subtitle">{subtitle}</p>}
              </div>
            ) : (
              <div className="paged-head">
                <RunHead title={title} name={applicantName} />
              </div>
            )}
            <div className="paged-body">{renderBlocks(resolve(ids), groups)}</div>
            <PageFoot n={i + 1} total={total} />
          </section>
        ))}
      </article>
    </>
  )
}
