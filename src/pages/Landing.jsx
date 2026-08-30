import { useEffect, useRef } from 'react'
import { Link } from 'react-router-dom'
import { LAW_META, RIGHTS, DEFINITION_AUTOMATED_EVALUATION } from '../data/law.js'
import { SAMPLE_SCENARIOS } from '../data/samples.js'
import { SERVICE_FACTS } from '../data/privacy.js'
import { Basis, Card } from '../components/ui.jsx'
import { Term, GlossaryList } from '../components/Term.jsx'
import SelfCheck from '../components/SelfCheck.jsx'
import LawVersions from '../components/LawVersions.jsx'
import { LoopDiagram } from '../components/Diagrams.jsx'
import { Plain } from '../lib/plain.jsx'
import { useTour } from '../lib/tour.jsx'
import { TOUR_TITLE } from '../data/tour.js'
import {
  ResumeCard,
  BackupPanel,
  WhyNoLogin,
  SubmissionRecord,
  STORAGE_SCOPE_TEXT,
} from '../components/Journey.jsx'

/**
 * 첫 화면.
 *
 * ── 순서를 정한 기준 ────────────────────────────────────────────
 * 처음 온 사람이 15초 안에 "나에게 필요한지" 판단할 수 있어야 한다.
 * 권리 5종을 나열하는 것은 이미 제도를 이해한 사람에게 유용하고,
 * 처음 온 사람에게는 읽어야 할 목록이 하나 더 생긴 것일 뿐이다.
 *
 *   1) 무슨 서비스인가 (제목 + 한 줄)
 *   2) 바로 해 볼 수 있는 두 갈래 — 심사자는 여기서 샘플로 들어간다
 *   3) 자가진단 "혹시 이런 일이 있으셨나요?"  ← 나에게 필요한지 여기서 판단된다
 *   4) 왜 물어볼 수 있는가 (근거 조문 + 설명)
 *   5) 자동화평가란 무엇이고 왜 그걸 먼저 물어야 하는가
 *   6) 무엇을 해 주는 서비스인가 (3단계)
 *   7) 그제서야 권리 5종
 *
 * ★ 375×667(가장 흔한 소형 화면)에서 **버튼이 첫 화면 안에 있어야 한다.**
 *   측정해 보니 설명 문단과 근거 배지를 먼저 두었을 때 버튼이 801px에 있었다.
 *   읽히지 않는 설명은 없는 것과 같고, 눌리지 않는 버튼은 더 그렇다.
 *   그래서 제목 → 한 줄 → 버튼 → 자가진단 을 먼저 두고,
 *   긴 설명과 근거 배지는 그 아래로 내렸다. (내용은 하나도 빼지 않았다)
 * ────────────────────────────────────────────────────────────────
 *
 * 법조문 텍스트는 전부 src/data/law.js 에서만 읽는다. 이 파일에 하드코딩하지 않는다.
 */

/** 우리가 하는 일 — 법령 주장이 아니므로 근거 배지를 붙이지 않는다 */
const STEPS = [
  {
    n: '1',
    title: '어떤 권리를 쓸 수 있는지 가려 드립니다',
    text: '겪으신 일과 상대 기관을 고르면, 행사할 수 있는 권리를 근거 조문과 함께 보여줍니다.',
  },
  {
    n: '2',
    title: '고시 서식을 채워 인쇄해 드립니다',
    text: '금융위원회 고시 서식 그대로입니다. 인쇄해서 서명하고 내시면 됩니다.',
  },
  {
    n: '3',
    title: '회신이 오면 읽어 드립니다',
    text: '설명이 빠진 항목이 무엇인지 가려내고, 다음에 무엇을 요구할지 이어 드립니다.',
  },
]

export default function Landing() {
  const byParagraph = (n) => RIGHTS.filter((r) => r.paragraph === n)
  const { start, shouldAutoOpen } = useTour()

  /**
   * 처음 온 사람에게는 한 번만 저절로 열린다.
   * ★ 진행 중인 기록이 있으면 열지 않는다. 하던 일을 가로채지 않는다.
   * ★ 저장이 막힌 환경(시크릿 모드)에서는 "봤다"를 기억할 수 없어 매번 열린다.
   *   저장하지 않기로 한 대가이고, 버튼 하나로 닫힌다.
   */
  const autoTried = useRef(false)
  useEffect(() => {
    if (autoTried.current) return
    autoTried.current = true
    if (shouldAutoOpen()) start()
  }, [shouldAutoOpen, start])

  return (
    <div className="space-y-12 pb-8 pt-5 sm:py-12">
      {/* ── 이어서 하기 — 기록이 있을 때만 맨 위에 뜬다 ──────────
          ★ 여기서는 얇은 형태로 띄운다. 되돌아온 사람에게도 아래의
            [내 상황으로 시작하기]가 첫 화면 밖으로 밀려나면 안 된다. */}
      {/* 이어서 하기 카드와 히어로는 한 덩어리로 묶어 사이 여백을 줄인다.
          기록이 있는 사람에게도 버튼이 첫 화면 안에 남아야 한다. */}
      <div className="space-y-5">
      <ResumeCard compact />

      {/* ── 1. 무슨 서비스인가 ───────────────────────────────── */}
      <section className="space-y-4">
        {/* 서비스 부제는 화면 맨 위 머리말에 이미 있다. 여기서 되풀이하지 않는다. */}
        <h1 className="text-3xl font-bold leading-tight text-gray-900 sm:text-4xl">
          대출이 거절됐을 때,
          <br />
          이유를 물어볼 <span className="text-ink-700">법적 권리</span>가 있습니다.
        </h1>
        {/* 서비스가 무엇인지 한 줄. "왜요?"는 이제 이름이 아니라 설명 문장이다. */}
        <p className="max-w-prose text-lg text-gray-800 sm:text-xl">
          AI가 내린 결정에도 <b className="text-ink-800">&ldquo;왜요?&rdquo;</b>라고 물을 수
          있습니다.
          <b> 삼육이는 그 요구서를 대신 만들어 드립니다.</b>
        </p>

        {/* ── 2. 바로 해 보기 — 제목 바로 아래 ───────────────── */}
        <div className="flex flex-col gap-3 pt-1 sm:flex-row sm:flex-wrap">
          <Link to="/diagnose" className="btn btn-primary">
            내 상황으로 시작하기
          </Link>
          <Link to={`/diagnose?sample=${SAMPLE_SCENARIOS[0].id}`} className="btn btn-secondary">
            샘플 시나리오로 체험하기
          </Link>
          {/* 서식 생성기로 오해받는 지점을 여기서 막는다 */}
          <button type="button" onClick={start} className="btn btn-quiet">
            {TOUR_TITLE}
          </button>
        </div>

      </section>
      </div>

      {/* ── 3. 자가진단 — 나에게 필요한지 여기서 판단된다 ────── */}
      <SelfCheck />

      {/* 제출한 기록이 있으면 여기서 회신 해석으로 이어 준다 */}
      <SubmissionRecord />

      {/* ── 4. 왜 물어볼 수 있는가 — 근거 조문은 여기서 밝힌다 ── */}
      <section className="space-y-4">
        {/* ★ 이름의 유래는 서비스 설명의 일부다. 이름만 두고 유래를 숨기지 않는다.
            자리는 이 섹션의 첫 줄이다 — 이름 → 그 조문 → 그 조문의 판본이 한 덩어리로 읽힌다.
            제목 위나 버튼 아래에 두면(둘 다 측정해 봤다) 버튼이나 자가진단이
            375×667 첫 화면 밖으로 밀린다. */}
        <p className="flex max-w-prose flex-wrap items-baseline gap-x-2 gap-y-1 text-lg text-gray-900">
          <span>
            이름은{' '}
            <b className="text-ink-800">
              {LAW_META.act.shortName} {LAW_META.act.article}
            </b>
            에서 왔습니다. <b>이 조문 하나가 이 서비스의 전부입니다.</b>
          </span>
          <Basis prefix="이름의 유래">{`${LAW_META.act.shortName} ${LAW_META.act.article}`}</Basis>
        </p>
        <p className="max-w-prose text-gray-700">
          <Plain id="landing.lead">
          컴퓨터가 자동으로 심사했다면 그 결과와 기준을 설명하라고 요구할 수 있습니다.{' '}
          <Term id="favorableInfo">유리한 정보</Term>를 내고, 틀린 정보를{' '}
          <Term id="correction">고치고</Term>, 다시 계산해 달라고(
          <Term id="recompute">재산출</Term>) 요구할 수도 있습니다.{' '}
          <b>이 서비스는 그 요구서를 대신 만들어 드립니다.</b>
          </Plain>
        </p>
        <p>
          <Basis chain prefix="근거">
            {LAW_META.act.name} {LAW_META.act.article} · 시행 {LAW_META.act.effectiveDate} ·{' '}
            {LAW_META.act.revision}
          </Basis>
        </p>
        {/* ★ 판본 표시는 각주가 아니라 근거다.
            바닥글에 두었을 때 이 화면의 91% 지점(모바일 8.8화면 아래)에 묻혔다.
            "왜 물어볼 수 있는가"를 말하는 이 자리가 제자리다.
            (바닥글의 같은 블록은 이 화면에서만 감춘다 — 두 번 보일 이유가 없다) */}
        <LawVersions />
      </section>

      {/* ── 5. 자동화평가란 ──────────────────────────────────── */}
      <section className="panel">
        <h2 className="text-lg font-bold text-gray-900">
          <Term id="automatedEvaluation">{DEFINITION_AUTOMATED_EVALUATION.term}</Term>란
        </h2>
        <p className="mt-2 text-gray-800">{DEFINITION_AUTOMATED_EVALUATION.text}</p>
        {/* 핵심 요건은 "종사자가 관여하지 아니하고". R1 이 첫 단계인 이유다. */}
        <p className="mt-3 text-gray-800">
          핵심은 <b>&ldquo;{DEFINITION_AUTOMATED_EVALUATION.keyRequirement}&rdquo;</b> 입니다.{' '}
          <Plain id="landing.autoEvalWhy">{DEFINITION_AUTOMATED_EVALUATION.whyR1First}</Plain>
        </p>
        <p className="mt-3">
          <Basis prefix="근거">{DEFINITION_AUTOMATED_EVALUATION.basis}</Basis>
        </p>
      </section>

      {/* ── 6. 무엇을 해 주는가 ──────────────────────────────── */}
      <section className="space-y-4">
        <h2 className="text-2xl font-bold text-gray-900">무엇을 해 드리나요</h2>
        {/* 세 단계를 글로 읽기 전에 고리 하나로 먼저 보인다 */}
        <LoopDiagram className="rounded-lg border border-gray-200 bg-white p-4" />
        <ol className="space-y-3">
          {STEPS.map((s) => (
            <Card as="li" key={s.n}>
              <div className="flex items-baseline gap-2">
                <span className="tabular shrink-0 rounded bg-ink-700 px-2 py-0.5 text-sm font-bold text-white">
                  {s.n}
                </span>
                <span className="font-bold text-gray-900">{s.title}</span>
              </div>
              <p className="mt-2 text-gray-700">{s.text}</p>
            </Card>
          ))}
        </ol>
      </section>

      {/* ── 7. 권리 목록 — 제도를 이해한 뒤에 읽는 자리 ───────── */}
      <section className="space-y-6">
        <h2 className="text-2xl font-bold text-gray-900">
          행사할 수 있는 권리 {RIGHTS.length}가지
        </h2>
        <p className="max-w-prose text-gray-700">
          <Plain id="landing.rightsIntro">
            아래는 법 조문을 그대로 나눈 목록입니다. 지금 다 읽지 않으셔도 됩니다 — 진단을
            하시면 그중 어느 것이 해당되는지 골라 드립니다.
          </Plain>
        </p>
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
                  <p className="mt-2 text-gray-700">
                    <Plain id={`right.${r.id}`}>{r.summary}</Plain>
                  </p>
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

      {/* ── 기록 보관 ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-2xl font-bold text-gray-900">기록은 어디에 남나요</h2>
        <p className="text-gray-700">{STORAGE_SCOPE_TEXT}</p>
        <BackupPanel />
        <WhyNoLogin />
      </section>

      {/* ── 서비스 고지 ───────────────────────────────────────── */}
      {/* ★ 문구를 여기 적지 않는다. SERVICE_FACTS 한 곳에서만 고친다.
             (감사 지적: "서버로 전송되지 않습니다"가 사실과 달랐다 — 저장과 전송은 다른 말이다) */}
      <section className="card">
        <h2 className="font-bold text-gray-900">이 서비스에 대해</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-gray-700">
          {SERVICE_FACTS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
