import { createContext, useCallback, useContext, useState } from 'react'
import { PLAIN_TEXTS } from '../data/plain.js'

/**
 * 쉬운 말 보기 — 전역 토글.
 *
 * 값은 이 브라우저에만 남는다(개인정보가 아니다). 여정 기록과는 별개다.
 * ★ 바뀌는 것은 우리가 쓴 설명문뿐이다. 조문 인용과 서식 원문은 건드리지 않는다.
 */
const KEY = 'wy-plain'
const PlainContext = createContext({ plain: false, setPlain: () => {} })

export function PlainProvider({ children }) {
  const [plain, setPlainState] = useState(() => {
    try {
      return localStorage.getItem(KEY) === '1'
    } catch {
      return false
    }
  })
  const setPlain = useCallback((v) => {
    setPlainState(v)
    try {
      localStorage.setItem(KEY, v ? '1' : '0')
    } catch {
      /* 무시 */
    }
  }, [])
  return <PlainContext.Provider value={{ plain, setPlain }}>{children}</PlainContext.Provider>
}

export const usePlain = () => useContext(PlainContext)

/**
 * 쉬운 말이 있으면 그것을, 없으면 원문을 그린다.
 * @param {string} props.id  PLAIN_TEXTS 의 키
 */
export function Plain({ id, children }) {
  const { plain } = usePlain()
  const alt = PLAIN_TEXTS[id]
  return <>{plain && alt ? alt : children}</>
}
