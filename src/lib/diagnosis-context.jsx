import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react'
import {
  EMPTY_DIAGNOSIS,
  EMPTY_JOURNEY,
  buildExport,
  clearJourney,
  exportFileName,
  isStorageAvailable,
  loadJourney,
  parseImport,
  saveJourney,
} from './journey-storage.js'

/**
 * 여정 전체를 담는 공유 상태.
 *
 * ── 저장 원칙 ────────────────────────────────────────────────────
 * 서버에 보내지 않는다. 계정도 로그인도 없다.
 * 기록은 **지금 쓰는 브라우저의 localStorage** 에만 있다.
 * 다른 기기로 옮기려면 파일로 내보내고 불러온다.
 *
 * 저장이 안 되는 환경(시크릿 모드 등)에서도 기능은 그대로 동작해야 한다.
 * 그때는 storageAvailable 이 false 가 되고 화면이 그 사실을 알린다.
 * ────────────────────────────────────────────────────────────────
 *
 * 기존 화면들은 useDiagnosis() 로 진단 부분만 쓴다. 그 계약은 그대로 둔다.
 */
const JourneyContext = createContext(null)

/** 타이핑이 멈춘 뒤 저장하기까지 기다리는 시간 (타이핑 중마다 쓰지 않는다) */
const IDLE_SAVE_MS = 1500

export function DiagnosisProvider({ children }) {
  /**
   * ★ 첫 렌더에서 바로 복원한다 (useEffect 가 아니라 useState 초기화).
   *   화면들이 useState 초기값으로 저장된 내용을 읽기 때문에, 한 박자 늦게 복원하면
   *   빈 서식이 먼저 그려지고 사용자가 채운 내용이 사라진 것처럼 보인다.
   *   localStorage 읽기는 동기이므로 여기서 해도 된다.
   */
  const [boot] = useState(() => {
    const available = isStorageAvailable()
    if (!available) return { available, journey: EMPTY_JOURNEY, found: false }
    const { journey: loaded, found } = loadJourney()
    return { available, journey: found ? loaded : EMPTY_JOURNEY, found }
  })
  const [journey, setJourney] = useState(boot.journey)
  const [storageAvailable] = useState(boot.available)
  const [restored, setRestored] = useState(boot.found)
  const [savedAt, setSavedAt] = useState(boot.journey.updatedAt ?? null)
  /** 파일을 불러오거나 초기화했을 때 화면들을 다시 마운트시키기 위한 세대 번호 */
  const [generation, setGeneration] = useState(0)
  /**
   * 화면을 다시 마운트하면 그 안의 안내 문구도 함께 사라진다.
   * "불러왔습니다" 같은 알림은 화면 바깥(App)에서 띄운다.
   */
  const [flash, setFlash] = useState(null)
  const ready = useRef(true)
  const timer = useRef(null)
  const latest = useRef(journey)
  latest.current = journey
  /**
   * "단계 완료" 저장 표시.
   * setJourney 직후에는 아직 새 값이 반영되지 않았으므로 그 자리에서 저장하면
   * 이전 값이 기록된다. 커밋이 끝난 뒤(useEffect)에 저장한다.
   */
  const immediate = useRef(false)

  // ── 저장 ──────────────────────────────────────────────────
  const flush = useCallback(() => {
    if (!ready.current || !storageAvailable) return
    const stamped = { ...latest.current, updatedAt: new Date().toISOString() }
    if (saveJourney(stamped)) setSavedAt(stamped.updatedAt)
  }, [storageAvailable])

  // 단계 완료로 표시된 변경은 커밋 직후 바로 저장한다
  useEffect(() => {
    if (!immediate.current) return
    immediate.current = false
    clearTimeout(timer.current)
    flush()
  }, [journey, flush])

  /** 입력이 멈춘 뒤 저장한다. 단계 완료 시점에는 immediate 로 바로 저장한다. */
  const scheduleSave = useCallback(() => {
    if (!ready.current || !storageAvailable) return
    clearTimeout(timer.current)
    timer.current = setTimeout(flush, IDLE_SAVE_MS)
  }, [flush, storageAvailable])

  // 탭을 닫거나 숨길 때 마지막으로 한 번 더 (대기 중이던 저장을 잃지 않게)
  useEffect(() => {
    const onHide = () => {
      clearTimeout(timer.current)
      flush()
    }
    window.addEventListener('pagehide', onHide)
    document.addEventListener('visibilitychange', onHide)
    return () => {
      window.removeEventListener('pagehide', onHide)
      document.removeEventListener('visibilitychange', onHide)
      clearTimeout(timer.current)
    }
  }, [flush])

  /** 한 구역을 갈아 끼운다. immediate=true 면 단계 완료로 보고 바로 저장한다. */
  const setSection = useCallback(
    (section, patch, { immediate: immediateSave = false } = {}) => {
      setJourney((j) => {
        const prev = j[section]
        const next = typeof patch === 'function' ? patch(prev) : { ...prev, ...patch }
        return { ...j, [section]: next }
      })
      if (immediateSave) immediate.current = true
      else scheduleSave()
    },
    [scheduleSave],
  )

  const reset = useCallback(() => {
    clearTimeout(timer.current)
    immediate.current = false
    setJourney(EMPTY_JOURNEY)
    setRestored(false)
    setSavedAt(null)
    setGeneration((g) => g + 1)
    clearJourney()
  }, [])

  const replace = useCallback((next) => {
    clearTimeout(timer.current)
    setJourney(next)
    setRestored(true)
    setGeneration((g) => g + 1)
    immediate.current = true
  }, [])

  /** 파일로 내보낸다. 브라우저 밖으로 나가는 유일한 경로다. */
  const exportToFile = useCallback(() => {
    const blob = new Blob([JSON.stringify(buildExport(latest.current), null, 2)], {
      type: 'application/json',
    })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = exportFileName()
    document.body.appendChild(a)
    a.click()
    a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return a.download
  }, [])

  /** @returns {{ok: true} | {ok: false, error: string}} */
  const importFromText = useCallback(
    (text) => {
      const result = parseImport(text)
      if (!result.ok) return result
      replace(result.journey)
      setFlash({ kind: 'ok', text: '기록을 불러왔습니다. 이어서 진행하실 수 있습니다.' })
      return { ok: true }
    },
    [replace],
  )

  const value = useMemo(
    () => ({
      journey,
      setSection,
      reset,
      replace,
      exportToFile,
      importFromText,
      flush,
      storageAvailable,
      restored,
      savedAt,
      generation,
      flash,
      clearFlash: () => setFlash(null),
      // ── 기존 계약 (진단 부분만 쓰는 화면들) ──
      diagnosis: journey.diagnosis,
      update: (patch, opts) => setSection('diagnosis', patch, opts),
    }),
    [
      journey,
      setSection,
      reset,
      replace,
      exportToFile,
      importFromText,
      flush,
      storageAvailable,
      restored,
      savedAt,
      generation,
      flash,
    ],
  )

  return <JourneyContext.Provider value={value}>{children}</JourneyContext.Provider>
}

function useJourneyContext() {
  const ctx = useContext(JourneyContext)
  if (!ctx) throw new Error('useJourney must be used within DiagnosisProvider')
  return ctx
}

/** 여정 전체 */
export const useJourney = useJourneyContext

/** 진단 부분만 쓰는 화면용 (기존 계약 유지) */
export function useDiagnosis() {
  const { diagnosis, update, reset } = useJourneyContext()
  return { diagnosis, update, reset }
}

export { EMPTY_DIAGNOSIS }
