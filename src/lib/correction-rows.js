import { BASE_INFO_CATEGORIES } from '../data/law.js'

/**
 * 회신 해석에서 "사실과 다르다"고 표시한 항목 → 서식 2 섹션 2의 "현행 정보" 행.
 *
 * ★ /response 의 [서식 2 만들기]와 둘러보기가 같은 함수를 쓴다.
 *   두 곳에 같은 변환을 따로 쓰면 언젠가 갈라진다.
 *
 * 정정 내용은 만들지 않는다. 그건 사용자가 적을 몫이다.
 */
export function buildCorrectionRows(items, errorIndexes) {
  return (errorIndexes ?? [])
    .map((i) => items?.[i])
    .filter(Boolean)
    .map((item) => {
      const cat =
        BASE_INFO_CATEGORIES.find((c) => c.label === item.분류) ?? BASE_INFO_CATEGORIES[4]
      return { categoryId: cat.id, current: `${item.항목}: ${item.내용}` }
    })
}
