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
                <th key={c.id} className={c.className} style={c.style}>
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
  const signature = useRef('')

  const measure = useCallback(() => {
    const root = measureRef.current
    if (!root) return
    const h = (el) => (el ? el.getBoundingClientRect().height : 0)

    const heights = {}
    root.querySelectorAll('[data-mid]').forEach((el) => {
      heights[el.getAttribute('data-mid')] = h(el)
    })
    const groupHeadHeights = {}
    root.querySelectorAll('[data-mghead]').forEach((el) => {
      groupHeadHeights[el.getAttribute('data-mghead')] = h(el)
    })

    const next = paginate({
      blocks,
      heights,
      groupHeadHeights,
      pageHeight: (PAGE_CONTENT_HEIGHT_MM - PAGE_SAFETY_MM) * MM_TO_PX,
      firstHeadHeight: h(root.querySelector('[data-mhead="first"]')),
      runHeadHeight: h(root.querySelector('[data-mhead="run"]')),
      footHeight: h(root.querySelector('[data-mfoot]')),
      gap: BLOCK_GAP_PT * PT_TO_PX,
    })

    // 결과가 그대로면 setState 하지 않는다 (측정 → 렌더 → 측정 무한루프 방지)
    const sig = next.map((p) => p.blocks.map((b) => b.id).join(',')).join('|')
    if (sig === signature.current) return
    signature.current = sig
    setPages(next)
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
    onPageCount?.(total)
  }, [total, onPageCount])

  const flowBlocks = blocks.filter((b) => !b.group)

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
          <div className="print-metrics" style={{ width: `${PAGE_CONTENT_WIDTH_MM}mm` }}>
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
                        <th key={c.id} className={c.className} style={c.style}>
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
        {(pages ?? [{ blocks }]).map((page, i) => (
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
            <div className="paged-body">{renderBlocks(page.blocks, groups)}</div>
            <PageFoot n={i + 1} total={total} />
          </section>
        ))}
      </article>
    </>
  )
}
