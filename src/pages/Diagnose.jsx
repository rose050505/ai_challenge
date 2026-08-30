import { useEffect, useRef, useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  RIGHTS,
  COUNTERPARTY_TYPES,
  INSTITUTION_OPTIONS,
  CORRECTION_ROUTING,
  FORM_BY_RIGHT,
  FORMS_BY_ID,
  LAW_META,
  resolveTransactionBasis,
  needsLimitKind,
  LIMIT_KIND_QUESTION,
} from '../data/law.js'
import { EVENT_TYPES } from '../data/events.js'
import { SAMPLE_SCENARIOS, SAMPLE_SCENARIOS_BY_ID } from '../data/samples.js'
import { AI_PROCESSING, TRANSMIT_LIMITS, DIAGNOSE_REASON_HINT } from '../data/privacy.js'

/** 서버가 이 길이에서 잘라내므로(api/analyze.js) 화면에서 미리 막고 남은 글자 수를 보여 준다 */
const REASON_MAX = TRANSMIT_LIMITS.situation
import { useDiagnosis, useJourney } from '../lib/diagnosis-context.jsx'
import { PageHeader, Basis, Card, Choice, Notice } from '../components/ui.jsx'
import { Term } from '../components/Term.jsx'
import { RoutingDiagram } from '../components/Diagrams.jsx'

/** 단계 카드. 화면 전체의 제목-설명-본문 리듬을 여기 한 곳에서 정한다. */
function Step({ n, title, children, hint }) {
  return (
    <Card as="section" aria-label={`${n}단계 ${title}`}>
      <h2 className="flex items-baseline gap-2 text-lg font-bold text-gray-900">
        <span className="tabular shrink-0 rounded bg-ink-700 px-2 py-0.5 text-sm font-bold text-white">
          {n}단계
        </span>
        <span>{title}</span>
      </h2>
      {hint && <p className="mt-2 text-gray-600">{hint}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  )
}

/**
 * 진단을 고치면 이후 단계가 어떻게 되는지 알린다.
 *
 * ★ 조용히 지우지 않는다. 무엇이 남아 있고 무엇이 안 맞을 수 있는지 말한 뒤,
 *   지울지 말지는 사용자가 정한다.
 */
function DownstreamNotice({ changed }) {
  const { journey, setSection } = useJourney()
  const kept = []
  if ((journey.strategy?.candidates ?? []).length > 0) {
    kept.push(`대응 전략 후보 ${journey.strategy.candidates.length}개`)
  }
  const f = journey.form ?? {}
  if (f.personal?.name || f.form2?.rows || f.form2?.favorable || (f.form1?.selectedItems ?? []).length) {
    kept.push('서식 작성 내용')
  }
  if (journey.response?.interpretation) kept.push('회신 해석 결과')
  if (kept.length === 0) return null

  return (
    <Notice
      title={changed ? '진단을 바꾸셨습니다' : '이후 단계에 저장된 내용이 있습니다'}
      mark={changed ? '!' : 'i'}
    >
      <p>
        지금 저장돼 있는 것: <b>{kept.join(', ')}</b>.
      </p>
      <p className="mt-2">
        진단을 바꿔도 이 내용은 <b>지우지 않습니다.</b> 다만 대응 전략 후보는 진단 내용을 바탕으로
        만든 것이라, 진단이 달라지면 지금 상황과 맞지 않을 수 있습니다. 다시 만들지 여부는
        직접 정하세요.
      </p>
      {(journey.strategy?.candidates ?? []).length > 0 && (
        <button
          type="button"
          className="btn btn-secondary mt-3"
          onClick={() =>
            setSection(
              'strategy',
              { candidates: [], picked: [], notice: null },
              { immediate: true },
            )
          }
        >
          전략 후보 지우고 다시 만들기
        </button>
      )}
    </Notice>
  )
}

export default function Diagnose() {
  const [params] = useSearchParams()
  const { diagnosis, update } = useDiagnosis()
  /** 이 화면에 들어온 뒤 진단을 실제로 고쳤는지 (고쳤을 때만 경고 톤으로 바꾼다) */
  const [changed, setChanged] = useState(false)
  /**
   * 사용자가 직접 고친 것. 샘플을 불러온 뒤 하나라도 고치면 더 이상 샘플이 아니므로
   * sampleId 를 지운다 — 남겨 두면 /strategy 가 캐시된 샘플 답을 낸다.
   */
  const edit = (patch) => {
    setChanged(true)
    update({ ...patch, sampleId: null }, { immediate: true })
  }
  const {
    eventId,
    counterpartyId,
    institutionSectorId,
    customInstitution,
    reason,
    sampleId,
    limitKind,
  } = diagnosis

  const applySample = (s) =>
    update({
      eventId: s.eventId,
      counterpartyId: s.counterpartyId,
      institutionSectorId: s.institutionSectorId ?? '',
      customInstitution: '',
      reason: s.reason,
      routingBranchId: s.routingBranchId,
      sampleId: s.id,
      limitKind: s.limitKind ?? null,
    })

  /** 샘플 목록을 펼쳐 둘지. 샘플로 들어왔거나 샘플을 쓰는 중이면 펼친다. */
  const [sampleOpen, setSampleOpen] = useState(Boolean(params.get('sample')) || Boolean(sampleId))

  // 랜딩의 [샘플 시나리오로 체험하기] 진입 시 입력을 미리 채운다.
  useEffect(() => {
    const s = SAMPLE_SCENARIOS_BY_ID[params.get('sample')]
    if (s) {
      applySample(s)
      setSampleOpen(true)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const counterparty = COUNTERPARTY_TYPES.find((c) => c.id === counterpartyId)
  const needsSector = counterparty?.requiresInstitutionLookup === true
  const sector = INSTITUTION_OPTIONS.find((o) => o.id === institutionSectorId)
  const sectorDone =
    !needsSector || (sector && (sector.id !== 'other' || customInstitution.trim()))
  const ready = Boolean(eventId && counterparty && sectorDone)

  /**
   * 답을 다 고른 순간 결과로 데려간다.
   *
   * ★ 결과는 질문들 **아래**에 생긴다. 1280×800 에서 결과 제목이 y=1943 이었다.
   *   화면은 그대로 있으므로, 마지막 항목을 고른 사람은 아무 일도 일어나지 않은 것처럼 본다.
   *   (2026-08-31 실사용 시뮬레이션에서 확인)
   * ★ 이미 답이 채워진 채로 들어온 사람(이어서 하기)은 건드리지 않는다.
   *   화면을 마음대로 끌어내리면 그게 더 나쁘다. 그래서 **아니었다가 되는 순간**만 움직인다.
   */
  const resultRef = useRef(null)
  const wasReady = useRef(ready)
  useEffect(() => {
    if (ready && !wasReady.current) {
      const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
      resultRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
    }
    wasReady.current = ready
  }, [ready])

  // 사건 유형 × 업권 조합으로 법 제2조 제1호의3 가목의 어느 호인지 판정한다.
  // CB사에는 업권 개념이 없으므로 sectorId 를 넘기지 않는다.
  const sectorForLaw = needsSector ? institutionSectorId : null
  const askLimitKind = needsLimitKind(eventId, sectorForLaw)
  const transaction = resolveTransactionBasis(eventId, sectorForLaw, limitKind)
  const activeSample = SAMPLE_SCENARIOS_BY_ID[sampleId]

  return (
    <div className="space-y-6 py-6">
      <PageHeader
        kicker="진단"
        title="무슨 일이 있었는지 알려주세요"
        description="몇 가지만 고르면 행사할 수 있는 권리와 근거 조문을 보여드립니다."
      />

      <DownstreamNotice changed={changed} />

      {/*
        ── 샘플은 접어 둔다 ─────────────────────────────────────────
        ★ 펼쳐 두었더니 [내 상황으로 시작하기]로 들어온 사람이 **샘플을 자기 상황으로
          오인해 눌렀다.** 카드 글에 "카드 발급 거절" 같은 말이 들어 있어서, 1단계보다
          위에 있으면 먼저 눈에 걸린다. (2026-08-31 실사용 시뮬레이션에서 실제로 재현)
          375px 에서는 샘플 세 장이 첫 화면을 다 먹어 1단계가 화면 밖으로 밀리기도 했다.
        ★ 그렇다고 없애지 않는다. 심사자 체험 경로다. 랜딩의 [샘플 시나리오로 체험하기]는
          ?sample= 로 바로 채우므로 그 경로는 그대로다. 여기서는 접어 두고,
          그 주소로 들어왔거나 샘플을 쓰는 중이면 펼친 채로 시작한다.
        ─────────────────────────────────────────────────────────── */}
      <section className="panel" aria-labelledby="sample-heading">
        <h2 id="sample-heading">
          <button
            type="button"
            onClick={() => setSampleOpen((v) => !v)}
            aria-expanded={sampleOpen}
            aria-controls="sample-panel"
            className="flex w-full items-center justify-between gap-3 text-left font-bold text-gray-900"
          >
            <span>
              샘플 시나리오로 바로 채우기
              <span className="ml-2 text-sm font-normal text-gray-600">
                직접 겪은 일이 없어도 전체 흐름을 볼 수 있습니다 (3종)
              </span>
            </span>
            <span aria-hidden="true" className="shrink-0 text-gray-600">
              {sampleOpen ? '▲' : '▼'}
            </span>
          </button>
        </h2>
        <div id="sample-panel" hidden={!sampleOpen} className="mt-3">
        <div className="grid gap-2 sm:grid-cols-3">
          {SAMPLE_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => applySample(s)}
              aria-pressed={sampleId === s.id}
              className={`rounded-md border bg-white p-3 text-left ${
                sampleId === s.id
                  ? 'border-ink-700 ring-2 ring-ink-200'
                  : 'border-gray-300 hover:border-ink-400'
              }`}
            >
              <span className="block font-bold text-gray-900">
                {sampleId === s.id && <span aria-hidden="true">✓ </span>}
                {s.title}
              </span>
              <span className="mt-1 block text-sm text-gray-600">{s.summary}</span>
            </button>
          ))}
        </div>
        {activeSample && (
          <p className="mt-3 text-sm text-gray-700">
            <span className="font-bold">이 샘플이 보여주는 것: </span>
            {activeSample.demonstrates}
          </p>
        )}
        </div>
      </section>

      <Step n={1} title="무슨 일이 있었나요?">
        <div className="grid gap-2 sm:grid-cols-2">
          {EVENT_TYPES.map((e) => (
            <Choice
              key={e.id}
              selected={eventId === e.id}
              onClick={() => edit({ eventId: e.id, limitKind: null })}
            >
              {e.label}
            </Choice>
          ))}
        </div>
      </Step>

      <Step
        n={2}
        title="누구에게 요구할 것인가요?"
        hint="상대방은 두 종류입니다. 대출이 거절된 경우 양쪽 모두에 각각 요구할 수 있습니다."
      >
        <div className="space-y-2">
          {COUNTERPARTY_TYPES.map((c) => (
            <Choice
              key={c.id}
              selected={counterpartyId === c.id}
              onClick={() =>
                edit({ counterpartyId: c.id, institutionSectorId: '', customInstitution: '' })
              }
            >
              <span className="block font-medium">{c.label}</span>
              <span
                className={`mt-1 block ${
                  counterpartyId === c.id ? 'text-ink-100' : 'text-gray-600'
                }`}
              >
                {c.description}
              </span>
              <span
                className={`mt-2 block text-sm ${
                  counterpartyId === c.id ? 'text-ink-200' : 'text-gray-500'
                }`}
              >
                <span className="font-bold" aria-hidden="true">§ </span>
                {c.basisChain}
              </span>
            </Choice>
          ))}
        </div>
      </Step>

      {needsSector && (
        <Step
          n={3}
          title="어느 업권의 금융회사인가요?"
          hint="이 목록에 해당해야 법이 정한 상대방이 됩니다."
        >
          <label htmlFor="sector" className="sr-only">
            업권 선택
          </label>
          <select
            id="sector"
            value={institutionSectorId}
            onChange={(e) => edit({ institutionSectorId: e.target.value, limitKind: null })}
            className="w-full rounded-md border border-gray-300 bg-white p-3"
          >
            <option value="">선택하세요</option>
            {INSTITUTION_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>

          {sector && (
            <div className="mt-3">
              {/* 근거 조문 배지는 확인된 항목에만 표시한다 (TODO-1-partial) */}
              {sector.verified && sector.basis ? (
                <Basis prefix="근거">{sector.basis}</Basis>
              ) : (
                sector.uiNote && <p className="text-sm text-gray-600">{sector.uiNote}</p>
              )}
            </div>
          )}

          {sector?.id === 'other' && (
            <>
              <label htmlFor="customInstitution" className="mt-3 block font-bold text-gray-900">
                기관 종류를 직접 입력하세요
              </label>
              <input
                id="customInstitution"
                value={customInstitution}
                onChange={(e) => edit({ customInstitution: e.target.value })}
                placeholder="예: 상호금융조합"
                className="mt-1 w-full rounded-md border border-gray-300 p-3"
              />
            </>
          )}
        </Step>
      )}

      {/* 이 조합에서만 뜨는 하위 질문. 다른 조합에는 일괄 적용하지 않는다. */}
      {askLimitKind && (
        <Step n="3-1" title={LIMIT_KIND_QUESTION.question} hint="어떤 한도였는지에 따라 근거 조문이 달라집니다.">
          <div className="grid gap-2 sm:grid-cols-2">
            {LIMIT_KIND_QUESTION.options.map((o) => (
              <Choice
                key={o.id}
                selected={limitKind === o.id}
                onClick={() => edit({ limitKind: o.id })}
              >
                {o.label}
              </Choice>
            ))}
          </div>
        </Step>
      )}

      <Step
        n={needsSector ? 4 : 3}
        title="짐작되는 사유가 있나요? (선택)"
        /* ★ 이 서술이 곧 AI 입력이다(/api/analyze). 예전 문구는 "아직 연결하지 않았습니다"였는데
              사실이 아니었고, 무엇보다 사용자가 이 칸을 비우게 만들었다 — AI 가 동작할
              유일한 입력을 화면이 막고 있었다. 그래서 반대로 적는다. */
        hint={DIAGNOSE_REASON_HINT}
      >
        <label htmlFor="reason" className="sr-only">
          짐작되는 사유
        </label>
        <textarea
          id="reason"
          value={reason}
          /* ★ 샘플을 불러온 뒤 직접 고쳐 쓰면 더 이상 샘플이 아니다.
                sampleId 를 남겨 두면 캐시된 샘플 답이 나오고, 화면에는 사용자가 쓴 적 없는
                인용문이 남는다(감사 지적). /response 는 이미 같은 처리를 하고 있다. */
          onChange={(e) => update({ reason: e.target.value.slice(0, REASON_MAX), sampleId: null })}
          rows={5}
          maxLength={REASON_MAX}
          aria-describedby="reason-help"
          placeholder="예: 이직한 지 얼마 안 됐고 카드 사용 이력이 거의 없습니다."
          className="w-full rounded-md border border-gray-300 p-3"
        />
        <p className="mt-1 text-right text-sm tabular text-gray-600" aria-live="polite">
          {reason.length.toLocaleString()} / {REASON_MAX.toLocaleString()}자
        </p>
        <p id="reason-help" className="mt-2 text-sm text-gray-600">
          이름·주민등록번호·연락처 등 신원을 알 수 있는 내용은 쓰지 마세요.
        </p>
        <p className="mt-2 text-sm text-gray-600">{AI_PROCESSING.short}</p>
      </Step>

      {ready ? (
        <Result sectionRef={resultRef} counterparty={counterparty} transaction={transaction} />
      ) : (
        <p
          role="status"
          className="rounded-md border border-dashed border-gray-400 p-4 text-gray-600"
        >
          1~{needsSector ? 3 : 2}단계를 선택하면 행사 가능한 권리가 표시됩니다.
        </p>
      )}
    </div>
  )
}

/**
 * 정정 요청 상대방 3분기.
 * 결과 화면의 필수 단계가 아니라 R4·R5 카드 안의 펼침으로 둔다.
 * 정정 의사가 없는 사용자는 이 질문을 아예 보지 않는다.
 */
/** @param {boolean} withDiagram 그림은 한 화면에 한 번만. R4·R5 두 카드에 다 넣으면 같은 그림이 둘이 된다. */
function RoutingDisclosure({ withDiagram = false }) {
  const { diagnosis, update } = useDiagnosis()
  const branch = CORRECTION_ROUTING.branches.find((b) => b.id === diagnosis.routingBranchId)

  return (
    <details
      className="mt-4 rounded-md border border-amber-300 bg-amber-50"
      open={Boolean(branch)}
    >
      <summary className="cursor-pointer p-3 font-bold text-amber-900">
        정정을 요구하려면 먼저 확인할 것이 있습니다
      </summary>
      <div className="border-t border-amber-200 p-3">
        <p className="font-bold text-gray-900">{CORRECTION_ROUTING.question}</p>
        <p className="mt-1 text-gray-700">상대를 잘못 고르면 요청이 반려됩니다.</p>
        {/* 고르기 전에 세 갈래가 어디로 가는지 한 장으로 보인다 */}
        {withDiagram && (
          <RoutingDiagram className="mt-3 rounded-md border border-amber-200 bg-white p-3" />
        )}
        <div className="mt-3 space-y-2">
          {CORRECTION_ROUTING.branches.map((b) => (
            <Choice
              key={b.id}
              selected={branch?.id === b.id}
              onClick={() => update({ routingBranchId: b.id })}
            >
              <span className="block font-medium">{b.label}</span>
              <span
                className={`mt-1 block text-sm ${
                  branch?.id === b.id ? 'text-ink-100' : 'text-gray-600'
                }`}
              >
                {b.submitToLabel}
              </span>
            </Choice>
          ))}
        </div>

        {branch && (
          <div className="mt-4 rounded-md border border-gray-200 bg-white p-3">
            {branch.requiresPrecedingStep && (
              <p className="mb-2 font-bold text-gray-900">
                두 단계로 나눠 진행해야 합니다. 순서가 중요합니다.
              </p>
            )}
            <ol className="space-y-2">
              {branch.steps.map((s) => (
                <li key={s.order} className="text-gray-800">
                  <span className="mr-2 font-bold">{s.order}.</span>
                  {s.description}
                  <span className="ml-2 inline-block rounded bg-gray-100 px-2 py-0.5 text-sm text-gray-700">
                    {FORMS_BY_ID[s.formId].title} · {s.rights.join(', ')}
                  </span>
                </li>
              ))}
            </ol>
            {branch.note && <p className="mt-2 text-sm text-gray-600">{branch.note}</p>}
            {branch.requiresRecipientInput && (
              <p className="mt-2 text-sm text-gray-600">
                서식을 만들 때 수신 기관을 따로 지정해야 합니다.
              </p>
            )}
          </div>
        )}

        <p className="mt-4">
          <Basis prefix="근거">{CORRECTION_ROUTING.basis}</Basis>
        </p>
        <p className="mt-2 text-sm text-gray-600">{CORRECTION_ROUTING.ruleText}</p>
      </div>
    </details>
  )
}

function RightCard({ right, counterparty }) {
  const form = FORMS_BY_ID[FORM_BY_RIGHT[right.id]]
  // R1 나목처럼 상대방이 한정되는 대상 행위를 표시한다.
  const restricted = (right.targetActs ?? []).filter(
    (a) => a.counterpartyRestriction && !a.counterpartyRestriction.includes(counterparty.id),
  )
  // 정정 계열 권리에만 라우팅 분기를 붙인다.
  const isCorrectionRelated = right.id === 'R4' || right.id === 'R5'

  return (
    <Card as="li">
      <div className="flex items-baseline gap-2">
        <span className="tabular shrink-0 rounded bg-ink-100 px-2 py-0.5 text-sm font-bold text-ink-800">
          {right.id}
        </span>
        <span className="font-bold text-gray-900">{right.label}</span>
      </div>
      <p className="mt-2 text-gray-700">{right.summary}</p>
      <p className="mt-2 flex flex-wrap gap-2">
        <Basis prefix="근거">{right.basis}</Basis>
      </p>
      <p className="mt-2 text-sm text-gray-600">
        <span className="font-bold">행사 요건 </span>
        {right.requirement}
      </p>
      <p className="mt-2 text-sm text-gray-700">
        <span className="font-bold">제출 서식 </span>
        <Term id="noticedForm">{form.title}</Term>
      </p>
      {restricted.map((a) => (
        <p key={a.code} className="mt-3 rounded bg-amber-50 p-2 text-sm text-amber-900">
          <span aria-hidden="true">※ </span>
          {a.text} — {a.note} 지금 고른 상대방({counterparty.label})에는 이 대상 행위가 적용되지
          않습니다. ({a.basis})
        </p>
      ))}
      {isCorrectionRelated && <RoutingDisclosure withDiagram={right.id === 'R4'} />}
    </Card>
  )
}

function Result({ counterparty, transaction, sectionRef }) {
  const p1 = RIGHTS.filter((r) => r.paragraph === 1 && r.counterparties.includes(counterparty.id))
  const p2 = RIGHTS.filter((r) => r.paragraph === 2 && r.counterparties.includes(counterparty.id))

  return (
    <section ref={sectionRef} className="space-y-6 border-t border-gray-200 pt-8">
      <h2 className="text-2xl font-bold text-gray-900">행사할 수 있는 권리</h2>

      {/* 사건 유형 × 업권 조합 판정. 애매하면 하위 호를 특정하지 않는다. */}
      <div className="panel" data-tour="basis">
        <p className="text-gray-800">
          <span className="font-bold">해당 거래 </span>
          {transaction.label}
        </p>
        <p className="mt-2">
          <Basis prefix="근거">{transaction.basis}</Basis>
        </p>
        {/* 가목 4)처럼 시행령으로 위임된 경우 그 경로를 그대로 드러낸다 */}
        {transaction.basisChain && (
          <p className="mt-2">
            <Basis chain prefix="위임 경로" link={false}>
              {transaction.basisChain}
            </Basis>
          </p>
        )}
        {transaction.item && <p className="mt-2 text-sm text-gray-700">{transaction.item.text}</p>}
        {transaction.delegated && (
          <p className="mt-1 text-sm text-gray-700">{transaction.delegated.text}</p>
        )}
        {transaction.needsMoreInfo && (
          <p className="mt-3 rounded bg-amber-50 p-2 text-sm text-amber-900">
            위 &ldquo;{LIMIT_KIND_QUESTION.question}&rdquo;에 답하면 근거 조문을 특정할 수
            있습니다.
          </p>
        )}
        {transaction.caveat && !transaction.needsMoreInfo && (
          <p className="mt-3 rounded bg-amber-50 p-2 text-sm text-amber-900">
            {transaction.caveat}
          </p>
        )}
      </div>

      <div>
        <h3 className="mb-3 border-l-4 border-ink-600 pl-3 text-base font-bold text-ink-800">
          제1항 — 설명 요구
        </h3>
        <ul className="space-y-3">
          {p1.map((r) => (
            <RightCard key={r.id} right={r} counterparty={counterparty} />
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-3 border-l-4 border-ink-600 pl-3 text-base font-bold text-ink-800">
          제2항 — 능동적 대응
        </h3>
        <ul className="space-y-3">
          {p2.map((r) => (
            <RightCard key={r.id} right={r} counterparty={counterparty} />
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link to="/strategy" className="btn btn-primary">
          제출할 정보 정하러 가기
        </Link>
        <Link to="/document" className="btn btn-secondary">
          바로 서식 만들기
        </Link>
      </div>

      <p className="text-sm text-gray-500">
        {LAW_META.act.name} {LAW_META.act.article} / {LAW_META.decree.name}{' '}
        {LAW_META.decree.article} 기준. 법률 자문이 아닙니다.
      </p>
    </section>
  )
}
