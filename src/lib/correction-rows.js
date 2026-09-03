import { BASE_INFO_CATEGORIES, BASE_INFO_CATEGORIES_BY_ID } from '../data/law.js'

/**
 * 고른 항목 → 서식 2 섹션 2의 "현행 정보" 행.
 *
 * ★ /response 의 [서식 2 만들기]와 둘러보기가 같은 변환을 쓴다.
 *   두 곳에 같은 변환을 따로 쓰면 언젠가 갈라진다.
 *
 * 정정 내용은 만들지 않는다. 그건 사용자가 적을 몫이다.
 */
export function correctionRowsFrom(items) {
  return (items ?? []).filter(Boolean).map((item) => {
    // 분류를 알아볼 수 없으면 기타 정보로 보낸다 (journey-storage 의 귀속처와 같다).
    // ★ 자리 번호(BASE_INFO_CATEGORIES[4])로 찾지 않는다 — 목록 순서에 묶인다.
    const cat =
      BASE_INFO_CATEGORIES.find((c) => c.label === item.분류) ?? BASE_INFO_CATEGORIES_BY_ID.other
    return { categoryId: cat.id, current: `${item.항목}: ${item.내용}` }
  })
}

/**
 * 위치 인덱스로 고르는 옛 계약. 둘러보기가 쓴다.
 *
 * ★ /response 는 이제 이것을 쓰지 않는다. 그 화면의 선택은 위치가 아니라
 *   항목의 고유 열쇠로 관리한다 — 수동 분류 모드에서 앞 행이 사라지면
 *   위치가 밀려 **체크한 것이 조용히 다른 것을 가리켰다** (2026-09-03).
 */
export function buildCorrectionRows(items, errorIndexes) {
  return correctionRowsFrom((errorIndexes ?? []).map((i) => items?.[i]))
}
