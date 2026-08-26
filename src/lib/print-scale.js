import { useCallback, useState } from 'react'

/**
 * 인쇄 글자 크기.
 *
 * 인쇄 기본값은 8.8pt 다. 고시 서식을 A4 한 장에 담기 위한 크기이지만,
 * 고령층은 자기가 낸 서류를 읽을 수 없다. 11pt 로 키우는 선택지를 둔다.
 *
 * ★ 값은 <html data-print-scale> 에 얹는다.
 *   실제 크기 변경은 index.css 의 --sheet-font-size / --sheet-row-height 한 곳에서만 일어나고,
 *   인쇄(.print-sheet)와 측정 영역(.print-metrics)이 **같은 변수**를 본다.
 *   그래서 화면이 예고한 쪽 수와 실제 인쇄가 어긋날 수 없다.
 *
 * ★ 속성을 setState 보다 **먼저** 얹는다.
 *   PagedSheet 는 매 렌더의 useLayoutEffect 에서 높이를 다시 잰다.
 *   속성을 effect 에서 얹으면 측정이 한 박자 빨라 옛 크기로 계산된다.
 */
const KEY = 'wy-print-scale'
export const PRINT_SCALES = [
  { id: 'base', label: '기본 (8.8pt)', hint: '고시 서식의 기본 크기입니다.' },
  { id: 'lg', label: '큰 글씨 (11pt)', hint: '읽기 편합니다. 대신 장수가 늘어날 수 있습니다.' },
]

function apply(v) {
  if (typeof document === 'undefined') return
  if (v === 'base') delete document.documentElement.dataset.printScale
  else document.documentElement.dataset.printScale = v
}

export function usePrintScale() {
  const [scale, setScaleState] = useState(() => {
    let v = 'base'
    try {
      const saved = localStorage.getItem(KEY)
      if (PRINT_SCALES.some((s) => s.id === saved)) v = saved
    } catch {
      /* 저장소를 못 쓰면 기본 크기로 둔다 */
    }
    apply(v)
    return v
  })

  const setScale = useCallback((v) => {
    apply(v) // ★ 렌더보다 먼저 (위 주석)
    try {
      localStorage.setItem(KEY, v)
    } catch {
      /* 무시 */
    }
    setScaleState(v)
  }, [])

  return { scale, setScale }
}
