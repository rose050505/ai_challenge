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
} from '../data/law.js'
import { SAMPLE_SCENARIOS, SAMPLE_SCENARIOS_BY_ID } from '../data/samples.js'
import { useDiagnosis } from '../lib/diagnosis-context.jsx'

/**
 * 1단계 선택지. 법령 텍스트가 아니라 사용자가 겪은 일의 분류다.
 *
 * 현재는 **맥락 수집용**이다. 결과 분기에는 아직 쓰이지 않는다.
 * 이후 /strategy 의 LLM 입력이 되고, 서식 1 ①번 항목의 맥락이 된다.
 *
 * TODO-2 해소 시 조문 매핑:
 *   각 사건이 법 제2조제1호의3 가목 1)~4)의 어느 거래에 해당하는지 확정되면
 *   여기에 근거 조문을 붙이고 결과 분기에 반영한다. 그 전까지 추측하지 말 것.
 */
const EVENT_TYPES = [
  { id: 'loanRejected', label: '신용대출이 거절됐다' },
  { id: 'limitReduced', label: '한도가 축소됐다' },
  { id: 'cardRejected', label: '카드 발급이 거절됐다' },
  { id: 'rateRaised', label: '금리가 인상됐다' },
]

function Step({ n, title, children, hint }) {
  return (
    <section className="rounded border p-4">
      <h2 className="font-semibold">
        <span className="mr-2 text-gray-400">{n}단계</span>
        {title}
      </h2>
      {hint && <p className="mt-1 text-sm text-gray-600">{hint}</p>}
      <div className="mt-3">{children}</div>
    </section>
  )
}

function Choice({ selected, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`w-full rounded border p-3 text-left ${
        selected ? 'border-gray-900 bg-gray-900 text-white' : 'hover:bg-gray-50'
      }`}
    >
      {children}
    </button>
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
  const activeSample = SAMPLE_SCENARIOS_BY_ID[sampleId]

  return (
    <div className="space-y-6 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">진단</h1>
        <p className="text-sm text-gray-600">
          몇 가지만 고르면 행사할 수 있는 권리와 근거 조문을 보여드립니다.
        </p>
      </header>

      <section className="rounded border bg-gray-50 p-3">
        <p className="mb-2 text-sm font-medium">샘플 시나리오로 바로 채우기</p>
        <div className="grid gap-2 sm:grid-cols-3">
          {SAMPLE_SCENARIOS.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => applySample(s)}
              className={`rounded border p-2 text-left text-sm ${
                sampleId === s.id ? 'border-gray-900 bg-white' : 'bg-white hover:bg-gray-100'
              }`}
            >
              <span className="block font-medium">{s.title}</span>
              <span className="block text-xs text-gray-600">{s.summary}</span>
            </button>
          ))}
        </div>
        {activeSample && (
          <p className="mt-2 text-xs text-gray-700">
            <span className="font-medium">이 샘플이 보여주는 것: </span>
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
              onClick={() => update({ eventId: e.id })}
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
                className={`mt-1 block text-sm ${
                  counterpartyId === c.id ? 'text-gray-200' : 'text-gray-600'
                }`}
              >
                {c.description}
              </span>
              <span
                className={`mt-1 block text-xs ${
                  counterpartyId === c.id ? 'text-gray-300' : 'text-gray-500'
                }`}
              >
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
          <select
            value={institutionSectorId}
            onChange={(e) => update({ institutionSectorId: e.target.value })}
            className="w-full rounded border p-2"
          >
            <option value="">선택하세요</option>
            {INSTITUTION_OPTIONS.map((o) => (
              <option key={o.id} value={o.id}>
                {o.label}
              </option>
            ))}
          </select>

          {sector && (
            <div className="mt-2 text-xs text-gray-600">
              {/* 근거 조문 배지는 확인된 항목에만 표시한다 (TODO-1-partial) */}
              {sector.verified && sector.basis ? (
                <span className="rounded bg-gray-100 px-2 py-1">근거: {sector.basis}</span>
              ) : (
                sector.uiNote && <span>{sector.uiNote}</span>
              )}
            </div>
          )}

          {sector?.id === 'other' && (
            <input
              value={customInstitution}
              onChange={(e) => update({ customInstitution: e.target.value })}
              placeholder="기관 종류를 직접 입력하세요"
              className="mt-2 w-full rounded border p-2"
            />
          )}
        </Step>
      )}

      <Step
        n={needsSector ? 4 : 3}
        title="짐작되는 사유가 있나요? (선택)"
        hint="지금은 저장만 합니다. 이 내용을 해석하는 기능은 아직 연결하지 않았습니다."
      >
        <textarea
          value={reason}
          onChange={(e) => update({ reason: e.target.value })}
          rows={5}
          placeholder="예: 이직한 지 얼마 안 됐고 카드 사용 이력이 거의 없습니다."
          className="w-full rounded border p-2"
        />
        <p className="mt-2 text-xs text-gray-500">
          이름·주민등록번호·연락처 등 신원을 알 수 있는 내용은 쓰지 마세요.
        </p>
      </Step>

      {ready ? (
        <Result counterparty={counterparty} />
      ) : (
        <p className="rounded border border-dashed p-4 text-sm text-gray-500">
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
    <details className="mt-3 rounded border border-amber-300 bg-amber-50" open={Boolean(branch)}>
      <summary className="cursor-pointer p-2 text-sm font-medium">
        정정을 요구하려면 먼저 확인할 것이 있습니다
      </summary>
      <div className="border-t border-amber-200 p-3">
        <p className="font-medium">{CORRECTION_ROUTING.question}</p>
        <p className="mt-1 text-sm text-gray-700">
          상대를 잘못 고르면 요청이 반려됩니다.
        </p>
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
                  branch?.id === b.id ? 'text-gray-200' : 'text-gray-600'
                }`}
              >
                {b.submitToLabel}
              </span>
            </Choice>
          ))}
        </div>

        {branch && (
          <div className="mt-4 rounded border bg-white p-3">
            {branch.requiresPrecedingStep && (
              <p className="mb-2 text-sm font-medium">
                두 단계로 나눠 진행해야 합니다. 순서가 중요합니다.
              </p>
            )}
            <ol className="space-y-2">
              {branch.steps.map((s) => (
                <li key={s.order} className="text-sm">
                  <span className="mr-2 font-semibold">{s.order}.</span>
                  {s.description}
                  <span className="ml-2 rounded bg-gray-100 px-2 py-0.5 text-xs">
                    {FORMS_BY_ID[s.formId].title} · {s.rights.join(', ')}
                  </span>
                </li>
              ))}
            </ol>
            {branch.note && <p className="mt-2 text-xs text-gray-600">{branch.note}</p>}
            {branch.requiresRecipientInput && (
              <p className="mt-2 text-xs text-gray-600">
                서식을 만들 때 수신 기관을 따로 지정해야 합니다.
              </p>
            )}
          </div>
        )}

        <p className="mt-3 text-xs text-gray-500">근거: {CORRECTION_ROUTING.basis}</p>
        <p className="mt-1 text-xs text-gray-600">{CORRECTION_ROUTING.ruleText}</p>
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
    <li className="rounded border p-3">
      <div className="font-medium">
        <span className="mr-2 text-gray-400">{right.id}</span>
        {right.label}
      </div>
      <p className="mt-1 text-sm text-gray-700">{right.summary}</p>
      <p className="mt-1 text-xs text-gray-500">근거: {right.basis}</p>
      <p className="mt-1 text-xs text-gray-500">행사 요건: {right.requirement}</p>
      <p className="mt-2 text-xs">
        <span className="rounded bg-gray-100 px-2 py-1">제출 서식: {form.title}</span>
      </p>
      {restricted.map((a) => (
        <p key={a.code} className="mt-2 text-xs text-amber-700">
          참고: {a.text} — {a.note} 지금 고른 상대방({counterparty.label})에는 이 대상 행위가
          적용되지 않습니다. ({a.basis})
        </p>
      ))}
      {isCorrectionRelated && <RoutingDisclosure />}
    </li>
  )
}

function Result({ counterparty }) {
  const p1 = RIGHTS.filter((r) => r.paragraph === 1 && r.counterparties.includes(counterparty.id))
  const p2 = RIGHTS.filter((r) => r.paragraph === 2 && r.counterparties.includes(counterparty.id))

  return (
    <section className="space-y-6 border-t pt-6">
      <h2 className="text-xl font-bold">행사할 수 있는 권리</h2>

      <div>
        <h3 className="mb-2 font-semibold">제1항 — 설명 요구</h3>
        <ul className="space-y-2">
          {p1.map((r) => (
            <RightCard key={r.id} right={r} counterparty={counterparty} />
          ))}
        </ul>
      </div>

      <div>
        <h3 className="mb-2 font-semibold">제2항 — 능동적 대응</h3>
        <ul className="space-y-2">
          {p2.map((r) => (
            <RightCard key={r.id} right={r} counterparty={counterparty} />
          ))}
        </ul>
      </div>

      <Link
        to="/document"
        className="inline-block rounded bg-gray-900 px-5 py-3 text-white hover:bg-gray-700"
      >
        서식 만들러 가기
      </Link>

      <p className="text-xs text-gray-500">
        {LAW_META.act.name} {LAW_META.act.article} / {LAW_META.decree.name}{' '}
        {LAW_META.decree.article} 기준. 법률 자문이 아닙니다.
      </p>
    </section>
  )
}
