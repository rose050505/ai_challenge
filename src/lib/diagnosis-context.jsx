import { createContext, useContext, useMemo, useState } from 'react'

/**
 * /diagnose 의 선택을 /document 로 넘기기 위한 공유 상태.
 * 외부 상태 라이브러리를 쓰지 않는다 (CLAUDE.md: React state만).
 *
 * 서버로 보내지 않고 저장하지도 않는다. 새로고침하면 사라진다 — 설계다.
 */
const DiagnosisContext = createContext(null)

const EMPTY = {
  eventId: null,
  counterpartyId: null,
  institutionSectorId: '',
  customInstitution: '',
  reason: '',
  routingBranchId: null,
  sampleId: null,
  /** 한도 축소 × 은행 조합에서만 쓰인다 ('loan' | 'card') */
  limitKind: null,
  /** /strategy 에서 사용자가 고른 R3 후보. 서식 2 섹션 3으로 넘어간다. */
  selectedCandidates: [],
  /** /response 에서 "사실과 다르다"고 표시한 항목. 서식 2 섹션 2로 넘어간다. */
  correctionRows: [],
  /** /response 에서 설명되지 않은 것으로 판정된 유형. 서식 1 재요구에 쓴다. */
  missingRequestItems: [],
}

export function DiagnosisProvider({ children }) {
  const [diagnosis, setDiagnosis] = useState(EMPTY)
  const value = useMemo(
    () => ({
      diagnosis,
      update: (patch) => setDiagnosis((d) => ({ ...d, ...patch })),
      reset: () => setDiagnosis(EMPTY),
    }),
    [diagnosis],
  )
  return <DiagnosisContext.Provider value={value}>{children}</DiagnosisContext.Provider>
}

export function useDiagnosis() {
  const ctx = useContext(DiagnosisContext)
  if (!ctx) throw new Error('useDiagnosis must be used within DiagnosisProvider')
  return ctx
}
