import { LAW_META, LAW_SOURCES } from '../data/law.js'

/**
 * 법령 판본 표시.
 *
 * 법령은 개정된다. 우리가 **어느 판본을 보고 만들었는지** 밝혀야
 * "법에 근거한다"는 말이 검증 가능한 주장이 된다.
 *
 * ★ 작게 숨기지 않는다. 이건 각주가 아니라 근거다.
 * ★ 문자열은 전부 law.js 에서 온다. 여기에 조문도 판본도 적지 않는다.
 */
const ROWS = [
  { meta: LAW_META.act, src: LAW_SOURCES.act },
  { meta: LAW_META.decree, src: LAW_SOURCES.decree },
  { meta: LAW_META.fscAct, src: LAW_SOURCES.fscAct },
]

export default function LawVersions({ className = '' }) {
  return (
    <section
      aria-labelledby="law-versions-heading"
      className={`rounded-lg border border-ink-200 bg-ink-50 p-4 ${className}`}
    >
      <h2 id="law-versions-heading" className="font-bold text-ink-900">
        이 서비스가 기준으로 삼은 법령 판본
      </h2>
      <ul className="mt-3 space-y-2">
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
            <span className="tabular block text-gray-700">
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
          <span className="block text-gray-700">
            두 서식이 실린 금융위원회 고시입니다. 행정규칙은 조문 단위로 열리지 않아 규정
            전체가 열립니다.
          </span>
        </li>
      </ul>
      <p className="mt-3 text-gray-800">
        이 서비스는 위 판본을 기준으로 작성되었습니다. 이후 개정 사항은 반영되지 않았을 수
        있습니다.
      </p>
    </section>
  )
}
