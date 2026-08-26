/**
 * 서식 페이지 분할.
 *
 * ── 왜 CSS 로 못 하는가 ──────────────────────────────────────────
 * "- N / M -" 의 M(총 페이지 수)은 CSS 만으로는 알 수 없다.
 * `counter(pages)` 는 @page 여백 상자(@bottom-center)에서만 쓸 수 있는데
 * Chrome 은 @page 여백 상자를 구현하지 않는다. position: fixed 요소는 매 페이지
 * 반복되지만 내용이 모든 페이지에서 같으므로 N 을 바꿀 수 없다.
 *
 * 그래서 **페이지를 우리가 직접 나눈다.** 블록의 높이를 인쇄와 같은 조판으로
 * 재서(components/PagedSheet.jsx 의 숨은 측정 영역) 이 함수로 채워 넣는다.
 * 페이지 수가 정해지면 M 은 그냥 pages.length 다.
 * ────────────────────────────────────────────────────────────────
 *
 * 순수 함수다. DOM 을 모른다. 높이는 전부 px 로 받는다.
 */

/**
 * @typedef {Object} Block
 * @property {string} id
 * @property {string} [group]         같은 표에 속하는 행이면 표 id. 없으면 흐름 블록.
 * @property {boolean} [keepWithNext] 다음 블록과 떨어지면 안 된다 (섹션 제목)
 * @property {boolean} [keepWithPrev] 앞 블록과 떨어지면 안 된다 (서명란)
 */

/**
 * keepWithNext / keepWithPrev 로 이어진 블록들을 하나의 덩어리로 묶는다.
 * 덩어리는 되도록 통째로 한 페이지에 들어간다.
 */
export function buildChunks(blocks) {
  const chunks = []
  for (const b of blocks) {
    const last = chunks[chunks.length - 1]
    const glued = last && (last[last.length - 1].keepWithNext || b.keepWithPrev)
    if (glued) last.push(b)
    else chunks.push([b])
  }
  return chunks
}

/**
 * @param {Object} input
 * @param {Block[]} input.blocks
 * @param {Record<string, number>} input.heights          블록 id → 높이(px)
 * @param {Record<string, number>} input.groupHeadHeights 표 id → thead 높이(px)
 * @param {number} input.pageHeight      한 페이지의 본문 높이(px)
 * @param {number} [input.firstHeadHeight] 1페이지 머리(문서명) 높이
 * @param {number} [input.runHeadHeight]   2페이지 이후 반복 머리 높이
 * @param {number} [input.footHeight]      페이지 번호 줄 높이
 * @param {number} [input.gap]             블록 사이 간격(px)
 * @returns {{blocks: Block[]}[]} 페이지 배열
 */
export function paginate({
  blocks,
  heights = {},
  groupHeadHeights = {},
  pageHeight,
  firstHeadHeight = 0,
  runHeadHeight = 0,
  footHeight = 0,
  gap = 0,
}) {
  const pages = []
  let cur = null

  const newPage = () => {
    cur = { blocks: [], used: 0, groups: new Set() }
    pages.push(cur)
  }
  /** 현재 페이지가 담을 수 있는 높이. 1페이지는 문서명이, 2페이지부터는 반복 머리가 자리를 먹는다. */
  const capacity = () => pageHeight - footHeight - (pages.length === 1 ? firstHeadHeight : runHeadHeight)

  /**
   * 이 블록을 현재 페이지에 얹을 때 늘어나는 높이.
   * 표의 행은 그 페이지에서 처음 나올 때만 thead 와 블록 간격을 함께 먹는다.
   * (같은 표의 두 번째 행부터는 이미 열린 <table> 안에 붙으므로 간격이 없다)
   */
  const cost = (b, page) => {
    const opensBlock = !b.group || !page.groups.has(b.group)
    const lead = opensBlock && page.blocks.length > 0 ? gap : 0
    const head = b.group && !page.groups.has(b.group) ? (groupHeadHeights[b.group] ?? 0) : 0
    return (heights[b.id] ?? 0) + head + lead
  }

  newPage()
  for (const chunk of buildChunks(blocks)) {
    // 덩어리를 통째로 못 넣으면 먼저 페이지를 넘긴다.
    // 섹션 제목이 페이지 하단에 홀로 남는 것을 막는 장치다.
    const probe = { blocks: cur.blocks, groups: new Set(cur.groups) }
    let chunkHeight = 0
    for (const b of chunk) {
      chunkHeight += cost(b, probe)
      probe.blocks = [...probe.blocks, b]
      if (b.group) probe.groups.add(b.group)
    }
    if (cur.blocks.length > 0 && cur.used + chunkHeight > capacity()) newPage()

    for (const b of chunk) {
      // 덩어리 자체가 한 페이지보다 크면 여기서 쪼개진다 (행 하나는 절대 쪼개지 않는다)
      if (cur.blocks.length > 0 && cur.used + cost(b, cur) > capacity()) newPage()
      cur.used += cost(b, cur)
      cur.blocks.push(b)
      if (b.group) cur.groups.add(b.group)
    }
  }

  return pages.map((p) => ({ blocks: p.blocks }))
}
