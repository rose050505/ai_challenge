import { useEffect } from 'react'
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
import { useDiagnosis } from '../lib/diagnosis-context.jsx'
import { PageHeader, Basis, Card, Choice } from '../components/ui.jsx'
import { Term } from '../components/Term.jsx'

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

export default function Diagnose() {
  const [params] = useSearchParams()
  const { diagnosis, update } = useDiagnosis()
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

  // 랜딩의 [샘플 시나리오로 체험하기] 진입 시 입력을 미리 채운다.
  useEffect(() => {
    const s = SAMPLE_SCENARIOS_BY_ID[params.get('sample')]
    if (s) applySample(s)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params])

  const counterparty = COUNTERPARTY_TYPES.find((c) => c.id === counterpartyId)
  const needsSector = counterparty?.requiresInstitutionLookup === true
  const sector = INSTITUTION_OPTIONS.find((o) => o.id === institutionSectorId)
  const sectorDone =
    !needsSector || (sector && (sector.id !== 'other' || customInstitution.trim()))
  const ready = Boolean(eventId && counterparty && sectorDone)

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

      <section className="panel" aria-labelledby="sample-heading">
        <p id="sample-heading" className="mb-3 font-bold text-gray-900">
          샘플 시나리오로 바로 채우기
        </p>
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
      </section>

      <Step n={1} title="무슨 일이 있었나요?">
        <div className="grid gap-2 sm:grid-cols-2">
          {EVENT_TYPES.map((e) => (
            <Choice
              key={e.id}
              selected={eventId === e.id}
              onClick={() => update({ eventId: e.id, limitKind: null })}
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
                update({ counterpartyId: c.id, institutionSectorId: '', customInstitution: '' })
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
            onChange={(e) => update({ institutionSectorId: e.target.value, limitKind: null })}
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
                onChange={(e) => update({ customInstitution: e.target.value })}
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
                onClick={() => update({ limitKind: o.id })}
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
        hint="지금은 저장만 합니다. 이 내용을 해석하는 기능은 아직 연결하지 않았습니다."
      >
        <label htmlFor="reason" className="sr-only">
          짐작되는 사유
        </label>
        <textarea
          id="reason"
          value={reason}
          onChange={(e) => update({ reason: e.target.value })}
          rows={5}
          aria-describedby="reason-help"
          placeholder="예: 이직한 지 얼마 안 됐고 카드 사용 이력이 거의 없습니다."
          className="w-full rounded-md border border-gray-300 p-3"
        />
        <p id="reason-help" className="mt-2 text-sm text-gray-600">
          이름·주민등록번호·연락처 등 신원을 알 수 있는 내용은 쓰지 마세요.
        </p>
      </Step>

      {ready ? (
        <Result counterparty={counterparty} transaction={transaction} />
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
function RoutingDisclosure() {
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
      {isCorrectionRelated && <RoutingDisclosure />}
    </Card>
  )
}

function Result({ counterparty, transaction }) {
  const p1 = RIGHTS.filter((r) => r.paragraph === 1 && r.counterparties.includes(counterparty.id))
  const p2 = RIGHTS.filter((r) => r.paragraph === 2 && r.counterparties.includes(counterparty.id))

  return (
    <section className="space-y-6 border-t border-gray-200 pt-8">
      <h2 className="text-2xl font-bold text-gray-900">행사할 수 있는 권리</h2>

      {/* 사건 유형 × 업권 조합 판정. 애매하면 하위 호를 특정하지 않는다. */}
      <div className="panel">
        <p className="text-gray-800">
          <span className="font-bold">해당 거래 </span>
          {transaction.label}
        </p>
        <p className="mt-2">
          <Basis prefix="근거">{transaction.basis}</Basis>
        </p>
        {transaction.item && <p className="mt-2 text-sm text-gray-700">{transaction.item.text}</p>}
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
