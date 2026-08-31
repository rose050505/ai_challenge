import { useEffect, useState } from 'react'
import { basisLink } from '../data/law.js'

/**
 * 표현 계층 공용 조각.
 *
 * ★ 여기에는 법령 텍스트가 없다. 전부 props 로 받는다.
 *   법조문 텍스트는 src/data/law.js 한 곳에만 존재한다.
 *
 * ★ 인쇄되는 서식 본문(.print-sheet)에는 이 조각들을 쓰지 않는다.
 *   여기서 쓰는 클래스는 index.css 의 @media screen 블록에만 정의돼 있다.
 */

/**
 * 화면 머리말.
 * 제목-설명 간격을 한 곳에서 정해 모든 화면의 리듬을 통일한다.
 */
export function PageHeader({ kicker, title, description, children }) {
  return (
    <header className="no-print border-b border-gray-300 pb-5">
      {kicker && (
        <p className="mb-1 text-sm font-semibold tracking-wide text-ink-600">{kicker}</p>
      )}
      <h1 className="text-[1.75rem] font-bold text-gray-900 sm:text-[2.125rem]">{title}</h1>
      {description && <p className="mt-2 max-w-prose text-gray-600">{description}</p>}
      {children}
    </header>
  )
}

/**
 * ★ 근거 조문 배지.
 *
 * 이 서비스에서 조문 표시는 장식이 아니라 신뢰의 근거다.
 * 어느 화면에 나오든 같은 시각 언어(§ 글리프 + 청람 칩 + 등폭 숫자)를 갖게 한다.
 * 스타일은 index.css 의 .basis 한 곳에만 있다.
 *
 * @param {string} [prefix] "근거", "근거 체인" 등 앞에 붙일 말
 * @param {boolean} [chain] 위임 경로처럼 긴 문자열이면 블록으로 흐른다
 */
export function Basis({ children, prefix, chain = false, className = '', link = true }) {
  if (!children) return null
  const inner = (
    <span>
      {prefix && <span className="font-semibold">{prefix} </span>}
      {children}
    </span>
  )
  const cls = `basis ${chain ? 'basis-chain' : ''} ${className}`

  /*
   * 원문으로 가는 길.
   * 주소는 law.js 가 만든다(basisLink). 화면에는 주소를 하나도 적지 않는다.
   * 배지 글자가 문자열일 때만 건다 — 여러 조각이 섞인 배지는 어느 조문인지 단정할 수 없다.
   */
  const target = link && typeof children === 'string' ? basisLink(children) : null
  if (!target) return <span className={cls}>{inner}</span>

  return (
    <a
      href={target.href}
      target="_blank"
      rel="noopener noreferrer"
      /* 이 배지가 <label> 안에 있을 때 체크박스까지 토글되지 않게 한다 */
      onClick={(e) => e.stopPropagation()}
      aria-label={`${children} — 국가법령정보센터에서 원문 보기, 새 탭에서 열립니다`}
      className={`${cls} basis-link`}
    >
      {inner}
      <span aria-hidden="true" className="basis-ext">
        ↗
      </span>
    </a>
  )
}

/** 기본 카드 */
export function Card({ children, className = '', as: Tag = 'div', ...rest }) {
  return (
    <Tag className={`card ${className}`} {...rest}>
      {children}
    </Tag>
  )
}

/**
 * 보충 설명 패널 (강조색).
 * 색만으로 뜻을 전하지 않도록 제목에 표식 문자를 함께 둔다.
 */
export function Notice({ title, children, mark = '!', className = '', ...rest }) {
  return (
    <div className={`panel-accent ${className}`} {...rest}>
      {title && (
        <p className="flex items-baseline gap-2 font-bold text-amber-900">
          <span
            aria-hidden="true"
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border border-amber-600 text-xs font-bold text-amber-800"
          >
            {mark}
          </span>
          <span>{title}</span>
        </p>
      )}
      <div className={title ? 'mt-2 text-amber-900' : 'text-amber-900'}>{children}</div>
    </div>
  )
}

/**
 * 선택 버튼.
 * 색만으로 선택 상태를 알리지 않는다. 체크 글리프와 aria-pressed 를 함께 준다.
 */
export function Choice({ selected, onClick, children, className = '' }) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={`flex w-full items-start gap-2 rounded-md border p-3 text-left transition-colors ${
        selected
          ? 'border-ink-700 bg-ink-700 text-white'
          : 'border-gray-400 bg-white hover:border-ink-400 hover:bg-ink-50'
      } ${className}`}
    >
      <span
        aria-hidden="true"
        className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-xs font-bold ${
          selected ? 'border-white bg-white text-ink-700' : 'border-gray-400 text-transparent'
        }`}
      >
        ✓
      </span>
      <span className="min-w-0 flex-1">{children}</span>
    </button>
  )
}

/** 진행 상태 문구를 스크린리더에도 알린다 */
export function Status({ children, className = '' }) {
  return (
    <p role="status" aria-live="polite" className={className}>
      {children}
    </p>
  )
}

/**
 * 응답이 느릴 때 무엇을 기다리는지 알려준다.
 *
 * API 클라이언트는 25초에서 끊고 폴백으로 넘어간다(analyze-client / interpret-client).
 * 그 사실을 화면에서도 같은 값으로 말해 준다. 사용자가 새로고침해 버리면
 * 입력이 아니라 흐름이 끊긴다.
 */
/**
 * 기다린 시간.
 *
 * ★ 남은 시간을 말하지 않는다. **지난 시간**만 말한다.
 *   얼마나 걸릴지는 우리가 모른다(모델·네트워크에 달렸다). 모르는 것을 세지 않는다.
 *   지난 시간은 사실이고, 화면이 멈춘 것이 아니라는 증거가 된다.
 *
 * ★ 스크린리더에는 읽히지 않게 한다. 1초마다 낭독되면 방해만 된다.
 *   기다리는 중이라는 사실은 옆의 role="status" 문장이 이미 한 번 알린다.
 */
export function Elapsed({ className = '' }) {
  const [sec, setSec] = useState(0)
  useEffect(() => {
    const t = setInterval(() => setSec((n) => n + 1), 1000)
    return () => clearInterval(t)
  }, [])
  if (sec < 2) return null
  return (
    <p aria-hidden="true" className={`tabular text-sm text-gray-600 ${className}`}>
      {sec}초째 기다리는 중
    </p>
  )
}

export function SlowHint({ afterMs = 8000, timeoutSec = 25 }) {
  const [slow, setSlow] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), afterMs)
    return () => clearTimeout(t)
  }, [afterMs])
  if (!slow) return null
  return (
    <p role="status" aria-live="polite" className="mt-2 text-gray-700">
      조금 더 걸리고 있습니다. {timeoutSec}초 안에 응답이 없으면 기본 목록으로 넘어가니
      새로고침하지 말고 기다려 주세요.
    </p>
  )
}
