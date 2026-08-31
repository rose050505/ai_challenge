import { useEffect, useId, useState } from 'react'

/**
 * 접기/펼치기 섹션.
 *
 * ── 왜 만들었나 ──────────────────────────────────────────────────
 * /next 는 한 화면에 7.2화면 분량(4,526자)이 펼쳐져 있었다.
 * 읽히지 않는 안내는 없는 것과 같다. 그렇다고 내용을 지우면 확인한 사실을 버리는 것이다.
 * 그래서 전부 접고, **지금 이 사람에게 필요한 것만 펼친 채로 시작**한다.
 * ────────────────────────────────────────────────────────────────
 *
 * ★ <details>/<summary> 대신 button + aria-expanded 를 쓴다.
 *   이미 NoReply 가 이 형태였고, 두 가지가 섞이면 같은 화면에서 여는 방법이 둘이 된다.
 *
 * ★ 접근성
 *   - 제목(h2) 안의 button 이므로 제목 목록으로 훑을 때도, Tab 으로도 닿는다.
 *   - aria-expanded 로 열림/닫힘을 낭독한다. 색이나 글리프에만 의존하지 않는다.
 *   - summary 는 닫힌 상태에서도 낭독된다. 제목만으로 내용을 짐작할 수 있게 한다.
 *
 * ★ 인쇄
 *   접힌 내용은 DOM 에 없으므로 CSS 로는 되살릴 수 없다.
 *   beforeprint 에서 전부 펼친다. 인쇄물에서 안내가 사라지면 안 된다.
 */
export default function Disclosure({ n, title, summary, defaultOpen = false, children }) {
  const [open, setOpen] = useState(defaultOpen)
  const uid = useId()
  const panelId = `disclosure-panel-${uid}`

  useEffect(() => {
    const expand = () => setOpen(true)
    window.addEventListener('beforeprint', expand)
    return () => window.removeEventListener('beforeprint', expand)
  }, [])

  return (
    <section className="rounded-lg border border-gray-400 bg-white">
      <h2>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          className="flex w-full items-start justify-between gap-3 rounded-lg px-4 py-4 text-left"
        >
          <span className="min-w-0 flex-1">
            <span className="flex items-baseline gap-2">
              {n != null && (
                <span className="tabular shrink-0 rounded-md bg-ink-700 px-2 py-0.5 text-sm font-bold text-white">
                  {n}
                </span>
              )}
              <span className="text-lg font-bold text-gray-900">{title}</span>
            </span>
            {summary && <span className="mt-1 block text-sm text-gray-600">{summary}</span>}
          </span>
          <span aria-hidden="true" className="shrink-0 text-xl text-ink-600">
            {open ? '−' : '+'}
          </span>
        </button>
      </h2>
      {open && (
        <div id={panelId} className="border-t border-gray-300 p-4">
          {children}
        </div>
      )}
    </section>
  )
}
