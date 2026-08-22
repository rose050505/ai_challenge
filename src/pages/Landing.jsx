import { Link } from 'react-router-dom'
import { LAW_META, RIGHTS, DEFINITION_AUTOMATED_EVALUATION } from '../data/law.js'
import { SAMPLE_SCENARIOS } from '../data/samples.js'

// 법조문 텍스트는 전부 src/data/law.js 에서만 읽는다. 이 파일에 하드코딩하지 않는다.
export default function Landing() {
  const byParagraph = (n) => RIGHTS.filter((r) => r.paragraph === n)

  return (
    <div className="space-y-10 py-6">
      <section className="space-y-4">
        <h1 className="text-3xl font-bold leading-snug">
          대출이 거절됐을 때,
          <br />
          이유를 물어볼 법적 권리가 있습니다.
        </h1>
        <p className="text-gray-700">
          사람이 아니라 컴퓨터가 자동으로 심사했다면, 그 결과와 기준을 설명하라고 요구할 수
          있습니다. 유리한 정보를 내고, 틀린 정보를 고치고, 다시 계산해 달라고 요구할 수도
          있습니다.
        </p>
        <p className="text-sm text-gray-500">
          근거: {LAW_META.act.name} {LAW_META.act.article} · 시행 {LAW_META.act.effectiveDate} ·{' '}
          {LAW_META.act.revision}
        </p>
      </section>

      <section className="flex flex-wrap gap-3">
        <Link
          to="/diagnose"
          className="rounded bg-gray-900 px-5 py-3 text-white hover:bg-gray-700"
        >
          내 상황으로 시작하기
        </Link>
        <Link
          to={`/diagnose?sample=${SAMPLE_SCENARIOS[0].id}`}
          className="rounded border border-gray-900 px-5 py-3 hover:bg-gray-100"
        >
          샘플 시나리오로 체험하기
        </Link>
      </section>

      <section className="rounded border bg-gray-50 p-4">
        <h2 className="mb-1 font-semibold">{DEFINITION_AUTOMATED_EVALUATION.term}란</h2>
        <p className="text-sm text-gray-700">{DEFINITION_AUTOMATED_EVALUATION.text}</p>
        <p className="mt-2 text-xs text-gray-500">{DEFINITION_AUTOMATED_EVALUATION.basis}</p>
      </section>

      <section className="space-y-4">
        <h2 className="text-xl font-semibold">행사할 수 있는 권리 {RIGHTS.length}가지</h2>
        {[1, 2].map((p) => (
          <div key={p}>
            <h3 className="mb-2 text-sm font-semibold text-gray-600">
              {p === 1 ? '제1항 — 설명을 요구할 권리' : '제2항 — 능동적으로 대응할 권리'}
            </h3>
            <ul className="space-y-2">
              {byParagraph(p).map((r) => (
                <li key={r.id} className="rounded border p-3">
                  <div className="font-medium">
                    <span className="mr-2 text-gray-400">{r.id}</span>
                    {r.label}
                  </div>
                  <p className="mt-1 text-sm text-gray-700">{r.summary}</p>
                  <p className="mt-1 text-xs text-gray-500">{r.basis}</p>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </section>

      <section className="space-y-2 rounded border border-gray-300 p-4 text-sm text-gray-700">
        <p className="font-semibold">이 서비스에 대해</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>회원가입과 로그인이 없습니다. 바로 사용할 수 있습니다.</li>
          <li>주민등록번호는 입력받지 않습니다. 서식에서는 공란으로 출력됩니다.</li>
          <li>입력한 내용은 브라우저에만 있습니다. 서버에 저장하지 않습니다.</li>
          <li>새로고침하면 입력이 모두 사라집니다. 버그가 아니라 설계입니다.</li>
          <li>법률 자문이 아닙니다. 법령과 고시 서식의 내용을 정리해 보여줄 뿐입니다.</li>
        </ul>
      </section>
    </div>
  )
}
