import { Link } from 'react-router-dom'
import { LAW_META, RIGHTS, DEFINITION_AUTOMATED_EVALUATION } from '../data/law.js'
import { SAMPLE_SCENARIOS } from '../data/samples.js'
import { Basis, Card } from '../components/ui.jsx'
import { Term, GlossaryList } from '../components/Term.jsx'

// 법조문 텍스트는 전부 src/data/law.js 에서만 읽는다. 이 파일에 하드코딩하지 않는다.
export default function Landing() {
  const byParagraph = (n) => RIGHTS.filter((r) => r.paragraph === n)

  return (
    <div className="space-y-12 py-8 sm:py-12">
      {/* ── 도입 ─────────────────────────────────────────────── */}
      <section className="space-y-5">
        <p className="text-sm font-semibold tracking-wide text-ink-600">
          자동화평가 설명·이의제기 도우미
        </p>
        <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">
          대출이 거절됐을 때,
          <br />
          이유를 물어볼 <span className="text-ink-700">법적 권리</span>가 있습니다.
        </h1>
        {/* 서비스명의 의미를 여기서 드러낸다 */}
        <p className="max-w-prose text-lg text-gray-800 sm:text-xl">
          AI가 내린 결정에 <b className="text-ink-800">&ldquo;왜요?&rdquo;</b>라고 물을 권리.
          그게 이 서비스의 이름입니다.
        </p>
        <p className="max-w-prose text-gray-700">
          사람이 아니라 컴퓨터가 자동으로 심사했다면, 그 결과와 기준을 설명하라고 요구할 수
          있습니다. <Term id="favorableInfo">유리한 정보</Term>를 내고, 틀린 정보를{' '}
          <Term id="correction">고치고</Term>, 다시 계산해 달라고(
          <Term id="recompute">재산출</Term>) 요구할 수도 있습니다.
        </p>
        <p>
          <Basis chain prefix="근거">
            {LAW_META.act.name} {LAW_META.act.article} · 시행 {LAW_META.act.effectiveDate} ·{' '}
            {LAW_META.act.revision}
          </Basis>
        </p>
      </section>

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link to="/diagnose" className="btn btn-primary">
          내 상황으로 시작하기
        </Link>
        <Link to={`/diagnose?sample=${SAMPLE_SCENARIOS[0].id}`} className="btn btn-secondary">
          샘플 시나리오로 체험하기
        </Link>
      </section>

      {/* ── 자동화평가란 ──────────────────────────────────────── */}
      <section className="panel">
        <h2 className="text-lg font-bold text-gray-900">
          <Term id="automatedEvaluation">{DEFINITION_AUTOMATED_EVALUATION.term}</Term>란
        </h2>
        <p className="mt-2 text-gray-800">{DEFINITION_AUTOMATED_EVALUATION.text}</p>
        {/* 핵심 요건은 "종사자가 관여하지 아니하고". R1 이 첫 단계인 이유다. */}
        <p className="mt-3 text-gray-800">
          핵심은 <b>&ldquo;{DEFINITION_AUTOMATED_EVALUATION.keyRequirement}&rdquo;</b> 입니다.{' '}
          {DEFINITION_AUTOMATED_EVALUATION.whyR1First}
        </p>
        <p className="mt-3">
          <Basis prefix="근거">{DEFINITION_AUTOMATED_EVALUATION.basis}</Basis>
        </p>
      </section>

      {/* ── 권리 목록 ─────────────────────────────────────────── */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">
          행사할 수 있는 권리 {RIGHTS.length}가지
        </h2>
        {[1, 2].map((p) => (
          <div key={p}>
            <h3 className="mb-3 border-l-4 border-ink-600 pl-3 text-base font-bold text-ink-800">
              {p === 1 ? '제1항 — 설명을 요구할 권리' : '제2항 — 능동적으로 대응할 권리'}
            </h3>
            <ul className="space-y-3">
              {byParagraph(p).map((r) => (
                <Card as="li" key={r.id}>
                  <div className="flex items-baseline gap-2">
                    <span className="tabular shrink-0 rounded bg-ink-100 px-2 py-0.5 text-sm font-bold text-ink-800">
                      {r.id}
                    </span>
                    <span className="font-bold text-gray-900">{r.label}</span>
                  </div>
                  <p className="mt-2 text-gray-700">{r.summary}</p>
                  <p className="mt-2">
                    <Basis prefix="근거">{r.basis}</Basis>
                  </p>
                </Card>
              ))}
            </ul>
          </div>
        ))}
      </section>

      {/* ── 용어집 ────────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-gray-900">말이 어렵다면</h2>
        <p className="text-gray-700">
          이 제도의 진짜 장벽은 권리가 없는 것이 아니라 용어입니다. 화면 곳곳의 점선 밑줄 친 말을
          누르면 그 자리에서 뜻을 볼 수 있고, 아래에 전부 모아 두었습니다.
        </p>
        <GlossaryList />
      </section>

      {/* ── 서비스 고지 ───────────────────────────────────────── */}
      <section className="card">
        <h2 className="font-bold text-gray-900">이 서비스에 대해</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-gray-700">
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
