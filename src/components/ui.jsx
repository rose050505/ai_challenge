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
    <header className="no-print border-b border-gray-200 pb-5">
      {kicker && (
        <p className="mb-1 text-sm font-semibold tracking-wide text-ink-600">{kicker}</p>
      )}
      <h1 className="text-2xl font-bold text-gray-900 sm:text-3xl">{title}</h1>
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
export function Basis({ children, prefix, chain = false, className = '' }) {
  if (!children) return null
  return (
    <span className={`basis ${chain ? 'basis-chain' : ''} ${className}`}>
      <span>
        {prefix && <span className="font-semibold">{prefix} </span>}
        {children}
      </span>
    </span>
  )
}

/** 섹션 번호가 붙는 제목 (진단 단계 / 이후 절차 항목에 공통으로 쓴다) */
export function SectionTitle({ n, children, as: Tag = 'h2' }) {
  return (
    <Tag className="flex items-baseline gap-2 text-lg font-bold text-gray-900">
      {n != null && (
        <span className="tabular shrink-0 rounded bg-ink-700 px-2 py-0.5 text-sm font-bold text-white">
          {n}
        </span>
      )}
      <span>{children}</span>
    </Tag>
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
          : 'border-gray-300 bg-white hover:border-ink-400 hover:bg-ink-50'
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
