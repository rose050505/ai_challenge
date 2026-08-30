import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { TOUR_ID, TOUR_STATIONS } from '../data/tour.js'
import { SAMPLE_SCENARIOS_BY_ID } from '../data/samples.js'
import { buildCorrectionRows } from './correction-rows.js'
import { useJourney } from './diagnosis-context.jsx'
import { hasProgress } from '../components/Journey.jsx'

/**
 * 둘러보기 진행 상태.
 *
 * ★ 상태를 라우터 안쪽(App)에 두는 이유
 *   투어는 네 화면을 건너다닌다. SPA 이므로 이 Provider 는 경로가 바뀌어도 살아 있고,
 *   그래서 진행 단계를 저장소에 쓰지 않아도 된다. 저장하는 것은 "봤다"는 사실 하나뿐이다.
 *
 * ★ 저장이 막힌 환경(시크릿 모드)에서도 동작해야 한다.
 *   읽기·쓰기를 모두 try/catch 로 감싸고, 실패하면 "안 본 것"으로 본다.
 *   그 환경에서는 방문할 때마다 자동으로 열린다 — 저장하지 않기로 한 대가이고, 버그가 아니다.
 */
const TourContext = createContext(null)

/** 'intro' → 0..n-1 → 'outro' */
export const INTRO = 'intro'
export const OUTRO = 'outro'

function seen() {
  try {
    return localStorage.getItem(TOUR_ID) === 'done'
  } catch {
    return false
  }
}

function markSeen() {
  try {
    localStorage.setItem(TOUR_ID, 'done')
  } catch {
    /* 저장이 막힌 환경. 이번 방문 동안만 안 뜨면 된다(아래 seenRef). */
  }
}

export function TourProvider({ children }) {
  const navigate = useNavigate()
  const { journey, setSection } = useJourney()
  const [step, setStep] = useState(null)
  /** 정거장 2의 시연(업권 바꿔 보기)이 켜져 있는가 */
  const [demo, setDemo] = useState(false)
  /** 저장이 막힌 환경에서도 이번 방문 동안은 다시 뜨지 않게 한다 */
  const seenRef = useRef(seen())
  /** 시연 전 값을 되돌리기 위한 보관 */
  const beforeDemo = useRef(null)

  const active = step !== null

  const finish = useCallback(() => {
    setStep(null)
    setDemo(false)
    seenRef.current = true
    markSeen()
  }, [])

  const start = useCallback(() => {
    setStep(INTRO)
  }, [])

  /** 랜딩에서 처음 온 사람에게만 자동으로 연다 */
  const shouldAutoOpen = useCallback(
    () => !seenRef.current && !hasProgress(journey),
    [journey],
  )

  /** 정거장 2의 시연을 끄고 샘플 값으로 되돌린다 */
  const resetDemo = useCallback(() => {
    if (beforeDemo.current) {
      setSection('diagnosis', beforeDemo.current, { immediate: true })
      beforeDemo.current = null
    }
    setDemo(false)
  }, [setSection])

  const toggleDemo = useCallback(() => {
    if (demo) return resetDemo()
    const d = journey.diagnosis
    beforeDemo.current = { eventId: d.eventId, institutionSectorId: d.institutionSectorId }
    // 위임 경로가 드러나는 조합. 카드 발급 거절은 업권과 무관하게 가목 2)로 정해진다.
    setSection(
      'diagnosis',
      { eventId: 'loanRejected', institutionSectorId: 'savingsBank' },
      { immediate: true },
    )
    setDemo(true)
  }, [demo, journey.diagnosis, resetDemo, setSection])

  /**
   * 정거장으로 이동한다.
   * ★ 새 판정을 만들지 않는다. 기존 딥링크로 보내고, 화면이 스스로 채우게 둔다.
   *   다만 정거장 4는 앞 화면에서 사용자가 체크했을 값이 필요하므로,
   *   /response 의 [서식 2 만들기]와 **같은 함수**로 그 행을 만들어 넘긴다.
   */
  const goTo = useCallback(
    (next) => {
      resetDemo()
      if (next === OUTRO) {
        setStep(OUTRO)
        return
      }
      const s = TOUR_STATIONS[next]
      if (!s) return
      if (s.id === 'form') {
        const items = journey.response?.interpretation?.baseInfoItems ?? []
        const errors = items.length > 0 ? [0] : []
        if (errors.length > 0) {
          setSection('response', { errors }, { immediate: true })
          setSection(
            'diagnosis',
            { correctionRows: buildCorrectionRows(items, errors) },
            { immediate: true },
          )
        }
      }
      setStep(next)
      navigate(s.to)
    },
    [journey.response, navigate, resetDemo, setSection],
  )

  const begin = useCallback(() => {
    // 정거장 2가 쓰는 샘플을 먼저 확정해 둔다. (딥링크가 다시 채우지만, 순서 의존을 없앤다)
    const sample = SAMPLE_SCENARIOS_BY_ID.returner
    if (sample) {
      setSection(
        'diagnosis',
        {
          eventId: sample.eventId,
          counterpartyId: sample.counterpartyId,
          institutionSectorId: sample.institutionSectorId ?? '',
          customInstitution: '',
          reason: sample.reason,
          routingBranchId: sample.routingBranchId,
          sampleId: sample.id,
          limitKind: null,
        },
        { immediate: true },
      )
    }
    goTo(0)
  }, [goTo, setSection])

  const value = useMemo(
    () => ({
      active,
      step,
      demo,
      start,
      begin,
      goTo,
      finish,
      toggleDemo,
      shouldAutoOpen,
      hasProgress: hasProgress(journey),
    }),
    [active, step, demo, start, begin, goTo, finish, toggleDemo, shouldAutoOpen, journey],
  )

  return <TourContext.Provider value={value}>{children}</TourContext.Provider>
}

export function useTour() {
  const ctx = useContext(TourContext)
  if (!ctx) throw new Error('useTour must be used within TourProvider')
  return ctx
}
