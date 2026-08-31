import { LAW_META, LAW_SOURCES } from '../data/law.js'

/**
 * 법령 판본 표시.
 *
 * 법령은 개정된다. 우리가 **어느 판본을 보고 만들었는지** 밝혀야
 * "법에 근거한다"는 말이 검증 가능한 주장이 된다.
 *
 * ★ 작게 숨기지 않는다. 이건 각주가 아니라 근거다.
 * ★ 문자열은 전부 law.js 에서 온다. 여기에 조문도 판본도 적지 않는다.
 *
 * ── collapsed (2026-08-31 디자인 감사) ──────────────────────────
 * 이 블록이 여섯 화면 **전부**의 바닥에 같은 크기로 붙어 있었다.
 * 화면마다 끝 인상이 같아져서 "화면을 따로 설계했다"는 느낌을 지운다.
 * 그래서 랜딩에서만 펼치고, 나머지 다섯에서는 접힌 한 줄로 둔다.
 * ★ 숨기는 것이 아니다 — 접힌 상태에서도 **주 법률의 판본과 시행일이 보인다.**
 *   근거를 감추면 이 서비스의 주장이 검증 불가능해진다.
 * ★ <details> 이므로 자바스크립트 없이도 열리고, 인쇄에는 애초에 나가지 않는다.
 * ──────────────────────────────────────────────────────────────
 */
const ROWS = [
  { meta: LAW_META.act, src: LAW_SOURCES.act },
  { meta: LAW_META.decree, src: LAW_SOURCES.decree },
  { meta: LAW_META.fscAct, src: LAW_SOURCES.fscAct },
]

export default function LawVersions({ className = '', collapsed = false }) {
  const body = (
    <ul className={`space-y-2 ${collapsed ? 'mt-3 border-t border-ink-400 pt-3' : 'mt-3'}`}>
        {ROWS.map((r) => (
          <li key={r.meta.name}>
            <a
              href={r.src.url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold text-ink-800 underline underline-offset-2 hover:text-ink-900"
            >
              {r.meta.name}
              <span aria-hidden="true"> ↗</span>
              <span className="sr-only">— 국가법령정보센터에서 원문 보기, 새 탭에서 열립니다</span>
            </a>
            <span className="numeric block text-gray-700">
              [{r.meta.revision}] · 시행 {r.meta.effectiveDate}
            </span>
          </li>
        ))}
        <li>
          <a
            href={LAW_SOURCES.supervisionRule.url}
            target="_blank"
            rel="noopener noreferrer"
            className="font-bold text-ink-800 underline underline-offset-2 hover:text-ink-900"
          >
            {LAW_META.supervisionRule.name} {LAW_META.supervisionRule.article}
            <span aria-hidden="true"> ↗</span>
            <span className="sr-only">— 국가법령정보센터에서 원문 보기, 새 탭에서 열립니다</span>
          </a>
          {/* 판본은 2026-08-30 원문 대조에서 확인했다. 여기만 비어 있었다. */}
          <span className="numeric block text-gray-700">
            [{LAW_META.supervisionRule.revision}] · 시행 {LAW_META.supervisionRule.effectiveDate}
          </span>
          <span className="block text-gray-700">
            두 서식이 실린 금융위원회 고시입니다. 행정규칙은 조문 단위로 열리지 않아 규정
            전체가 열립니다.
          </span>
        </li>
    </ul>
  )

  if (collapsed) {
    return (
      <details className={`rounded-md border border-ink-400 bg-ink-50 px-4 py-2 ${className}`}>
        <summary className="flex min-h-11 cursor-pointer items-center text-ink-900">
          <span className="font-bold">법령 판본</span>
          <span className="numeric ml-2 text-gray-700">
            {LAW_META.act.revision} · 시행 {LAW_META.act.effectiveDate}
          </span>
        </summary>
        {body}
        <p className="mt-3 pb-2 text-gray-800">
          이 서비스는 위 판본을 기준으로 작성되었습니다. 이후 개정 사항은 반영되지 않았을 수
          있습니다.
        </p>
      </details>
    )
  }

  return (
    <section
      aria-labelledby="law-versions-heading"
      className={`rounded-md border border-ink-400 bg-ink-50 p-4 ${className}`}
    >
      <h2 id="law-versions-heading" className="text-lg font-bold text-ink-900">
        이 서비스가 기준으로 삼은 법령 판본
      </h2>
      {body}
      <p className="mt-3 text-gray-800">
        이 서비스는 위 판본을 기준으로 작성되었습니다. 이후 개정 사항은 반영되지 않았을 수
        있습니다.
      </p>
    </section>
  )
}
