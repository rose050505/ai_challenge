/**
 * /diagnose 1단계 선택지 — 사용자가 겪은 일의 분류.
 *
 * 법령 텍스트가 아니다. 근거 조문 판정은 src/data/law.js 의
 * resolveTransactionBasis(eventId, sectorId) 가 담당한다.
 * 여기 id 는 그 함수의 키이므로 바꾸면 매핑이 깨진다.
 */
export const EVENT_TYPES = [
  { id: 'loanRejected', label: '신용대출이 거절됐다' },
  { id: 'limitReduced', label: '한도가 축소됐다' },
  { id: 'cardRejected', label: '카드 발급이 거절됐다' },
  { id: 'rateRaised', label: '금리가 인상됐다' },
  { id: 'leaseRejected', label: '리스·할부가 거절됐다' },
]

export const EVENT_TYPES_BY_ID = Object.fromEntries(EVENT_TYPES.map((e) => [e.id, e]))
