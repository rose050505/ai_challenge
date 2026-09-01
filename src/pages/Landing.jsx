import { useEffect, useRef, useState } from 'react'
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
  hasProgress,
} from '../components/Journey.jsx'
import { useJourney } from '../lib/diagnosis-context.jsx'

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

/**
 * 진입 카드 — 첫 화면에서 **글을 읽지 않고** 자기 자리를 짚게 한다.
 *
 * ── 왜 넣었나 (2026-08-31 사용자 지적) ──────────────────────────
 * 첫 화면이 세로로 긴 글 흐름이라 "내가 지금 무엇을 할 수 있는지"가
 * 훑어서 보이지 않았다. 정부24 를 예로 드셨지만 **격자를 그대로 흉내 내지 않는다** —
 * 그쪽은 수백 개 민원 중 하나를 고르는 곳이고, 우리가 할 수 있는 일은 사실상 셋이다.
 * 가져온 것은 형태가 아니라 원리 둘이다:
 *   (가) 진입점을 눈으로 나열한다   (나) 폼을 첫 화면에 두지 않는다
 *
 * ★ 셋인 이유. 제목이 "지금 어떤 상황이신가요"이므로 **상황에 대한 답만** 넣는다.
 *   "둘러보고 싶다"는 상황이 아니라 태도라서 카드에서 뺐다(아래 한 줄로 내렸다).
 *   넷째 카드로 넣으면 격자는 2×2 로 예뻐지지만 묻는 말과 답이 어긋난다.
 *
 * ★ 아이콘을 쓰지 않는다. 이 셋을 구별해 줄 그림 기호가 마땅치 않고,
 *   뜻 없는 아이콘 줄은 장식이다. 대신 카드마다 **다음에 무슨 일이 일어나는지**
 *   한 줄과 목적지 이름을 둔다. 그것이 구별의 근거다.
 */
const ENTRY_CARDS = [
  {
    id: 'diagnose',
    to: '/diagnose',
    situation: '대출·카드 거절, 한도 축소, 금리 인상을 겪었습니다',
    next: '무슨 일이 있었는지 고르시면, 행사할 수 있는 권리와 근거 조문을 보여드립니다.',
    dest: '진단',
  },
  {
    id: 'response',
    to: '/response',
    situation: '금융회사에서 답변(회신)을 받았습니다',
    next: '받은 답변을 붙여넣으시면, 무엇을 받았고 무엇이 빠졌는지 가려 드립니다.',
    dest: '회신 해석',
  },
  {
    id: 'next',
    to: '/next',
    situation: '요구서를 만들었고, 낼 차례입니다',
    next: '어디에 어떻게 내는지, 답이 오지 않으면 무엇을 할 수 있는지 안내합니다.',
    dest: '이후 절차',
  },
]

function EntryCards({ onTour }) {
  /*
   * ★ 예시를 고르면 **진단이 통째로 예시로 바뀐다.** (2026-09-02 회귀 감사에서 실측)
   *   덮어써지는 것: 사건 유형 · 상대방 · 업권 · **직접 쓰신 서술**.
   *   남는 것: 이름·연락처와 서식에 쓰신 내용 (setSection('diagnosis') 만 하므로).
   *   둘러보기는 시작 전에 이 사실을 말하는데(TOUR_INTRO.overwriteWarning)
   *   예시 카드는 아무 말도 하지 않고 있었다. 되돌릴 수단도 없다 —
   *   진단 화면의 [지우고 내 상황으로 시작하기]는 되살리는 것이 아니라 더 지우는 것이다.
   *   그래서 **기록이 있을 때만** 무엇이 바뀌고 무엇이 남는지 먼저 말한다.
   */
  const { journey } = useJourney()
  const hasRecord = hasProgress(journey)
  /*
   * ★ 샘플을 **미리 채워 놓지 않는다.** (2026-09-01 사용자 지적)
   *   앞서는 [샘플로 체험하기]가 곧바로 `?sample=<첫 번째>` 로 진단을 채웠다.
   *   처음 온 사람이 남의 상황이 적힌 화면을 만나고, 그것이 자기 것인 줄 안다.
   *   → 누구의 예시로 볼지 **먼저 고르게** 한다. 새 화면을 만들지 않고 여기서 편다.
   *   심사 경로가 1회에서 2회 클릭이 되므로, 고르는 화면은 아주 가볍게 둔다.
   */
  const [pick, setPick] = useState(false)
  return (
    <section aria-labelledby="entry-heading" className="space-y-3">
      <h2 id="entry-heading" className="text-[1.375rem] font-semibold text-gray-900">
        지금 어떤 상황이신가요?
      </h2>
      {/* 375px 세로 1열, 768px 이상 2열. 셋째 칸이 한 자리 남지만
          "상황에 대한 답"만 넣기로 한 결과다. 자리를 채우려고 답을 지어내지 않는다. */}
      {/* 둘러보기 소개가 비추는 자리 — 처음 온 사람에게 "여기서 고르시면 됩니다"를
          말이 아니라 빛으로 가리킨다. */}
      <ul className="grid gap-2 md:grid-cols-2 md:gap-3" data-tour="entry">
        {ENTRY_CARDS.map((c) => (
          <li key={c.id}>
            <Link to={c.to} className="entry-card">
              <span className="block font-bold text-gray-900">{c.situation}</span>
              <span className="mt-1 block text-sm text-gray-700">{c.next}</span>
              <span className="mt-1 block text-sm font-semibold text-ink-800">
                {c.dest} 화면으로 <span aria-hidden="true">→</span>
              </span>
            </Link>
          </li>
        ))}
      </ul>
      {/* 상황이 아닌 두 갈래. 카드와 같은 무게로 두지 않는다.
          [샘플로 체험하기]는 심사 경로이므로 반드시 남긴다. */}
      <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-gray-700">
        <span>어느 것도 아니라면 —</span>
        <button type="button" onClick={onTour} className="btn btn-secondary">
          {TOUR_TITLE}
        </button>
        <button
          type="button"
          onClick={() => setPick((v) => !v)}
          aria-expanded={pick}
          aria-controls="sample-pick"
          className="btn btn-secondary"
        >
          샘플로 체험하기
        </button>
      </p>
      {/* ★ 접혀 있어도 요소는 남긴다. aria-controls 가 가리키는 id 가 없으면
          보조기술이 "무엇을 여는 단추인지" 알 수 없다. hidden 으로 감춘다. */}
      <div id="sample-pick" hidden={!pick} className="panel space-y-2">
          <p className="font-bold text-gray-900">어느 분의 예시로 보시겠어요?</p>
          <p className="text-sm text-gray-700">
            고르시면 그 상황이 채워진 채로 진단 화면이 열립니다. 채워진 값은 언제든 고쳐 쓰실 수
            있고, 하나라도 고치시면 그때부터 샘플이 아니라 <b>내 기록</b>이 됩니다.
          </p>
          {hasRecord && (
            <p className="rounded-md border border-amber-400 bg-amber-50 p-3 text-sm text-amber-900">
              <span aria-hidden="true">※ </span>
              지금 <b>진단에 적으신 내용이 예시로 바뀝니다</b> — 겪으신 일, 상대 기관, 직접 쓰신
              서술. 이름·연락처와 서식에 쓰신 내용은 그대로 남습니다. 되돌리기는 없으니, 남겨
              두실 내용이 있으면 먼저 아래 <b>[파일로 내보내기]</b>로 저장해 주세요.
            </p>
          )}
          <ul className="grid gap-2 md:grid-cols-3">
            {SAMPLE_SCENARIOS.map((sc) => (
              <li key={sc.id}>
                <Link to={`/diagnose?sample=${sc.id}`} className="pick-card">
                  <span className="block font-bold text-gray-900">{sc.title}</span>
                  {/* 진단 화면의 "이 샘플이 보여주는 것"과 같은 문장이다 (samples.js 한 곳) */}
                  <span className="mt-1 block text-sm text-gray-700">{sc.demonstrates}</span>
                  <span className="mt-1 block text-sm font-semibold text-ink-800">
                    이 예시로 보기 <span aria-hidden="true">→</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
      </div>
    </section>
  )
}

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
    <div className="space-y-6 pb-8 pt-3 sm:space-y-12 sm:py-12">
      {/* ── 이어서 하기 — 기록이 있을 때만 맨 위에 뜬다 ──────────
          ★ 여기서는 얇은 형태로 띄운다. 되돌아온 사람에게도 아래의
            [내 상황으로 시작하기]가 첫 화면 밖으로 밀려나면 안 된다. */}
      {/* 이어서 하기 카드와 히어로는 한 덩어리로 묶어 사이 여백을 줄인다.
          기록이 있는 사람에게도 버튼이 첫 화면 안에 남아야 한다. */}
      <div className="space-y-5">
      <ResumeCard compact />

      {/* ── 1. 무슨 서비스인가 ───────────────────────────────── */}
      {/*
        ★ 어두운 구간은 이 서비스에서 **여기 하나뿐**이다. (2026-08-31 디자인 감사)
          모든 화면·구획이 같은 밝기·같은 밀도이면 "따로 설계했다"는 인상이 생기지 않는다.
          그렇다고 아무 데나 어둡게 할 수는 없다 — /document 는 화면이 곧 인쇄물이고,
          권리 목록·서식·회신 해석은 읽어야 하는 본문이다.
          첫인상을 만드는 히어로 하나만 어둡게 하고, 나머지는 전부 밝게 둔다.
        ★ 인쇄 대비: 파일 끝의 @media print 가 이 블록을 흰 바탕·검은 글자로 되돌린다.
          배경 인쇄를 끈 채로 인쇄하면 흰 바탕에 흰 글자가 되기 때문이다.
      */}
      <section className="hero-dark on-dark space-y-3 rounded-md px-5 py-3.5 sm:space-y-4 sm:px-8 sm:py-9">
        {/* 서비스 부제는 화면 맨 위 머리말에 이미 있다. 여기서 되풀이하지 않는다. */}
        {/*
          ★ 제목을 사건 하나에 묶지 않는다. (2026-08-31)
            앞선 제목은 "대출이 거절됐을 때"로 시작했다. 그런데 이 서비스는
            신용대출 거절·한도 축소·카드 발급 거절·금리 인상·리스/할부 거절을
            모두 다룬다. 금리가 오른 사람에게 그 제목은 남의 이야기로 읽힌다.
            제목은 다섯 사건의 공통점(= AI 가 정한 심사 결과)을 말하고,
            사건 이름은 부제에서 늘어놓는다.
        */}
        <h1 className="text-[1.75rem] font-bold leading-tight text-white sm:text-[2.125rem]">
          <Plain id="landing.hero">
            AI가 내린 심사 결과,
            <br />
            이유를 <span className="text-ink-200">물을 수 있습니다</span>.
          </Plain>
        </h1>
        {/* 부제 — 어느 사건이 해당되는지, 무엇을 근거로 하는지, 우리가 무엇을 하는지.
            근거 배지는 이 문단 안에 인라인으로 둔다. 줄을 따로 만들면
            375×667 에서 버튼이 첫 화면 밖으로 밀린다(측정해서 정한 자리다). */}
        <p className="flex max-w-prose flex-wrap items-baseline gap-x-2 gap-y-1 text-lg text-ink-100 sm:text-xl">
          <span>
            <Plain id="landing.heroSub">
              대출·카드 거절, 한도 축소, 금리 인상 —{' '}
              <b className="text-white">
                {LAW_META.act.shortName} {LAW_META.act.article}
              </b>
              가 정한 권리입니다.
            </Plain>
          </span>
          <Basis prefix="근거">{`${LAW_META.act.shortName} ${LAW_META.act.article}`}</Basis>
        </p>

      </section>
      </div>

      {/* ── 2. 진입 카드 — 글을 읽기 전에 자기 자리를 짚는다 ──── */}
      <EntryCards onTour={start} />

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
          {/* ★ 서비스 이름을 문장 안에서 한 번은 쓴다 — 로고로만 있으면 이름이 남지 않는다.
              히어로 부제에 있던 문장을 여기로 내렸다(진입 카드가 그 일을 대신하므로
              부제에 두면 첫 화면만 두 줄 길어진다). */}
          <b>삼육이는 그 요구서를 대신 만들어 드립니다.</b>
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
      <section className="border-l-4 border-ink-600 pl-4">
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
        <h2 className="text-[1.375rem] font-semibold text-gray-900">무엇을 해 드리나요</h2>
        {/* 세 단계를 글로 읽기 전에 고리 하나로 먼저 보인다 */}
        <LoopDiagram className="py-2" />
        {/* ★ 상자를 없앴다. 세 단계는 카드가 아니라 목록이다 —
               한 화면에 상자가 서른 개 넘게 쌓이면 무엇이 중요한지 보이지 않는다.
               카드로 남기는 것은 히어로·자가진단·권리 5종뿐이다. */}
        <ol className="space-y-4">
          {STEPS.map((s) => (
            <li key={s.n} className="flex gap-3">
              <span className="numeric mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-ink-700 text-sm font-bold text-white">
                {s.n}
              </span>
              <span className="min-w-0">
                <span className="block font-bold text-gray-900">{s.title}</span>
                <span className="mt-1 block text-gray-700">{s.text}</span>
              </span>
            </li>
          ))}
        </ol>

        {/*
          ★ AI 를 어디까지 쓰는가 — 첫 화면에서 한 번은 말한다.
            (2026-09-01 심사 당일 감사) 5분 경로를 실제로 걸어 보니, 둘러보기를 본 사람도
            건너뛴 사람도 **5분 안에는 이 이야기를 만나지 못했다.** 그림이 있는 자리는
            /strategy 한 곳뿐인데, 둘러보기는 그 화면을 지나가지 않고 진입 카드도
            그쪽으로 가지 않는다. 그림을 여기 또 그리지는 않는다 — 두 줄로 말하고
            그림이 있는 자리로 보낸다.
        */}
        <p className="max-w-prose border-l-4 border-ink-600 pl-3 text-gray-700">
          <b className="text-gray-900">이 서비스에서 AI가 하는 일은 하나입니다</b> — 적으신
          상황을 읽어 맥락을 옮기는 것. 법조문·거절 사유·서식 문구·절차는 전부 코드 안의
          법령 상수가 정합니다. 그 사이에 서버 검산이 있어, AI가 낸 문장이 법의 구조에 맞지
          않으면 화면에 내보내지 않고 버립니다.{' '}
          <Link to="/strategy" className="font-bold text-ink-700 underline">
            어떻게 하는지 그림으로 보기 →
          </Link>
        </p>
      </section>

      {/* ── 7. 권리 목록 — 제도를 이해한 뒤에 읽는 자리 ───────── */}
      <section className="space-y-6">
        <h2 className="text-[1.375rem] font-semibold text-gray-900">
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
            <h3 className="mb-3 border-l-4 border-ink-600 pl-3 text-lg font-bold text-ink-800">
              {p === 1 ? '제1항 — 설명을 요구할 권리' : '제2항 — 능동적으로 대응할 권리'}
            </h3>
            <ul className="space-y-3">
              {byParagraph(p).map((r) => (
                <Card as="li" key={r.id}>
                  <div className="flex items-baseline gap-2">
                    <span className="tabular shrink-0 rounded-md bg-ink-100 px-2 py-0.5 text-sm font-bold text-ink-800">
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
        <h2 className="text-[1.375rem] font-semibold text-gray-900">말이 어렵다면</h2>
        <p className="text-gray-700">
          이 제도의 진짜 장벽은 권리가 없는 것이 아니라 용어입니다. 화면 곳곳의 점선 밑줄 친 말을
          누르면 그 자리에서 뜻을 볼 수 있고, 아래에 전부 모아 두었습니다.
        </p>
        <GlossaryList />
      </section>

      {/* ── 기록 보관 ─────────────────────────────────────────── */}
      <section className="space-y-3">
        <h2 className="text-[1.375rem] font-semibold text-gray-900">기록은 어디에 남나요</h2>
        <p className="text-gray-700">{STORAGE_SCOPE_TEXT}</p>
        <BackupPanel />
        <WhyNoLogin />
      </section>

      {/* ── 서비스 고지 ───────────────────────────────────────── */}
      {/* ★ 문구를 여기 적지 않는다. SERVICE_FACTS 한 곳에서만 고친다.
             (감사 지적: "서버로 전송되지 않습니다"가 사실과 달랐다 — 저장과 전송은 다른 말이다) */}
      <section>
        <h2 className="text-lg font-bold text-gray-900">이 서비스에 대해</h2>
        <ul className="mt-3 list-disc space-y-2 pl-5 text-gray-700">
          {SERVICE_FACTS.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>
    </div>
  )
}
