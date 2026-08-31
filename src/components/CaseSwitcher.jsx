import {
  COUNTERPARTY_TYPES,
  COUNTERPARTY_TYPES_BY_ID,
  RIGHTS_BY_ID,
  CORRECTION_ROUTING,
  CORRECTION_ROUTING_BY_ID,
  FORM_CORRECTION_REQUEST,
} from '../data/law.js'
import { useJourney } from '../lib/diagnosis-context.jsx'
import { MAX_FORM2_EXTRAS } from '../lib/journey-storage.js'
import { Basis } from './ui.jsx'

/**
 * 복수 기관 동시 행사 — 건 전환.
 *
 * 법 제36조의2 제1항의 상대방은 두 계층이다.
 *   (A) 개인신용평가회사   — 조문에 직접 명시
 *   (B) 금융회사            — 시행령 제31조의2 제1항 → 금융위원회법 제38조 각 호
 * 대출이 거절된 경우 **양쪽 모두에 각각** 요구할 수 있다.
 *
 * ★ 기본은 한 건이다. 두 번째 건은 사용자가 만들 때만 생긴다.
 * ★ 두 번째 건은 설명요구서(서식 1)만 갖는다.
 *   정정·재산출 요청서(서식 2)의 제출처는 정정할 정보의 **출처**에 따라
 *   라우팅이 판정하므로, 상대방을 임의로 바꿔 두 벌 만들 일이 아니다.
 */
export default function CaseSwitcher({ activeCase, isForm1 }) {
  const { journey, setSection } = useJourney()
  const form = journey.form ?? {}
  const second = form.second ?? null
  const baseCpId = journey.diagnosis?.counterpartyId ?? null
  const baseCp = COUNTERPARTY_TYPES_BY_ID[baseCpId] ?? null
  /** 아직 만들지 않은 쪽 */
  const otherCp = COUNTERPARTY_TYPES.find((c) => c.id !== baseCpId) ?? null

  // 진단에서 상대방을 아직 고르지 않았으면 건을 나눌 기준이 없다
  if (!baseCp || !otherCp) return null
  // 서식 2 화면에서는 건 개념이 없다 (위 주석 참조)
  if (!isForm1 && !second) return null

  const addSecond = () =>
    setSection(
      'form',
      (prev) => ({
        ...prev,
        activeCase: 'second',
        second: {
          counterpartyId: otherCp.id,
          form1: { selectedItems: null, hopeResult: '', consent: null },
        },
      }),
      { immediate: true },
    )

  const go = (which) => setSection('form', { activeCase: which }, { immediate: true })

  const secondCp = second ? COUNTERPARTY_TYPES_BY_ID[second.counterpartyId] : null
  const cur = activeCase === 'second' ? secondCp : baseCp

  return (
    <section className="no-print panel" aria-labelledby="case-heading">
      <h2 id="case-heading" className="text-lg font-bold text-gray-900">
        이 요구서를 받을 곳
      </h2>

      {second ? (
        <>
          <div className="mt-3 flex flex-col gap-2 sm:flex-row" role="group" aria-label="건 선택">
            {[
              { id: 'base', cp: baseCp, note: '진단에서 고르신 곳' },
              { id: 'second', cp: secondCp, note: '추가하신 곳' },
            ].map(({ id, cp, note }) => (
              <button
                key={id}
                type="button"
                onClick={() => go(id)}
                aria-pressed={activeCase === id}
                className={`flex-1 rounded-md border px-4 py-3 text-left ${
                  activeCase === id
                    ? 'border-ink-700 bg-ink-700 text-white'
                    : 'border-gray-400 bg-white hover:border-ink-400'
                }`}
              >
                <span className="block font-bold">
                  {activeCase === id && <span aria-hidden="true">✓ </span>}
                  {cp?.label}
                </span>
                <span
                  className={`mt-1 block text-sm ${
                    activeCase === id ? 'text-ink-100' : 'text-gray-600'
                  }`}
                >
                  {note}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-3 text-gray-700">
            두 건은 <b>따로 작성되고 따로 인쇄·제출 기록이 남습니다.</b> 지금 보고 계신 것은{' '}
            {cur?.label} 앞으로 보낼 서식입니다.
          </p>
        </>
      ) : (
        <>
          <p className="mt-2 text-gray-700">
            지금 서식은 <b>{baseCp.label}</b> 앞으로 만들어져 있습니다. 같은 일에 대해{' '}
            <b>{otherCp.label}</b>에도 <u>각각</u> 요구하실 수 있습니다.
          </p>
          <button type="button" onClick={addSecond} className="btn btn-secondary mt-3">
            {otherCp.label}용 서식도 만들기
          </button>
        </>
      )}

      <p className="mt-3">
        <Basis prefix="근거">{baseCp.basis}</Basis>
      </p>

      {/* ★ 요구 항목이 달라지는 지점 — R1 나목은 금융회사에만 적용된다 */}
      {cur?.id === 'CB' && <CbLimitNote />}
    </section>
  )
}

/**
 * 설명요구서와 정정·재산출 요청서는 제출처를 정하는 방식이 다르다.
 *
 *   설명요구서  — 상대방이 둘(법 제36조의2 제1항). 사용자가 양쪽에 각각 낼 수 있다.
 *   정정 요청서 — 제출처가 **정보의 출처**로 정해진다(고시 서식 [섹션 1]의 규칙).
 *                 사용자가 고르는 것이 아니라 앞 단계에서 판정된 결과다.
 *
 * 이 차이를 밝히지 않으면 "왜 정정 요청서는 두 벌이 안 되나"로 읽힌다.
 */
export function TwoFormsNote() {
  const { journey } = useJourney()
  const branch = CORRECTION_ROUTING_BY_ID[journey.diagnosis?.routingBranchId]
  return (
    <div className="no-print rounded-md border border-gray-400 bg-white p-3 text-gray-700">
      <p>
        <b>설명요구서</b>는 개인신용평가회사와 금융회사 <b>양쪽에 각각</b> 낼 수 있습니다.{' '}
        <b>정정·재산출 요청서</b>는 <b>그 정보를 보유한 곳</b>에 냅니다.
        {branch ? ' 어디인지는 앞에서 판정해 드렸습니다 — ' : ' 어디인지는 앞에서 판정해 드립니다.'}
        {branch && <b>{branch.submitToLabel}</b>}
        {branch && '.'}
      </p>
      <p className="mt-2">
        <Basis prefix="근거">{CORRECTION_ROUTING.basis}</Basis>
      </p>
    </div>
  )
}

/**
 * 서식 2를 여러 벌 만드는 경로.
 *
 * ★ 상대방을 고르는 기능이 **아니다.**
 *   라우팅이 other(타 금융회사)로 판정된 경우, 정정할 정보가 여러 회사에서 왔을 수 있다.
 *   그때는 회사마다 한 벌씩 필요하다. 제출처는 여전히 라우팅이 정한 규칙 그대로다.
 *   → 라우팅 규칙과 충돌하지 않는다. 그래서 이 경로만 지원한다.
 */
export function Form2CaseSwitcher() {
  const { journey, setSection } = useJourney()
  const form = journey.form ?? {}
  const branch = CORRECTION_ROUTING_BY_ID[journey.diagnosis?.routingBranchId]
  // 제출처가 "정보가 발생한 그 금융회사"인 경우에만 여러 벌이 성립한다
  if (!branch?.requiresRecipientInput) return null

  const extras = form.form2Extras ?? []
  const index = form.form2Index ?? 0
  const total = extras.length + 1

  const go = (i) => setSection('form', { form2Index: i }, { immediate: true })
  const add = () =>
    setSection(
      'form',
      (prev) => {
        const next = [...(prev.form2Extras ?? [])]
        if (next.length >= MAX_FORM2_EXTRAS) return prev
        next.push({ recipient: '', enabled: null, rows: null, favorable: null })
        return { ...prev, form2Extras: next, form2Index: next.length }
      },
      { immediate: true },
    )
  const removeCurrent = () =>
    setSection(
      'form',
      (prev) => {
        const next = [...(prev.form2Extras ?? [])]
        next.splice(index - 1, 1)
        return { ...prev, form2Extras: next, form2Index: 0 }
      },
      { immediate: true },
    )

  const nameOf = (i) => {
    const r = i === 0 ? (form.form2?.recipient ?? '') : (extras[i - 1]?.recipient ?? '')
    return r.trim() || `${i + 1}번째 회사`
  }

  return (
    <section className="no-print panel" aria-labelledby="form2-case-heading">
      <h2 id="form2-case-heading" className="text-lg font-bold text-gray-900">
        정정 요청서를 낼 회사
      </h2>
      <p className="mt-2 text-gray-700">
        {branch.submitToLabel}입니다. 고치려는 정보가 <b>여러 회사</b>에서 온 것이라면 회사마다
        한 벌씩 필요합니다. 제출처를 고르는 것이 아니라, 위 규칙이 그렇게 정하고 있습니다.
      </p>

      {total > 1 && (
        <div className="mt-3 flex flex-col gap-2 sm:flex-row sm:flex-wrap" role="group" aria-label="정정 요청서 건 선택">
          {Array.from({ length: total }, (_, i) => (
            <button
              key={i}
              type="button"
              onClick={() => go(i)}
              aria-pressed={index === i}
              className={`flex-1 rounded-md border px-3 py-2 text-left ${
                index === i
                  ? 'border-ink-700 bg-ink-700 text-white'
                  : 'border-gray-400 bg-white hover:border-ink-400'
              }`}
            >
              <span className="block font-bold">
                {index === i && <span aria-hidden="true">✓ </span>}
                {nameOf(i)}
              </span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        {extras.length < MAX_FORM2_EXTRAS && (
          <button type="button" onClick={add} className="btn btn-secondary">
            다른 회사 것도 만들기
          </button>
        )}
        {index > 0 && (
          <button type="button" onClick={removeCurrent} className="btn btn-quiet">
            이 건 지우기
          </button>
        )}
      </div>

      {total > 1 && (
        <p className="mt-3 text-sm text-gray-600">
          {total}건이 각각 따로 작성되고, 인쇄·제출 기록도 따로 남습니다. 서식 위쪽의 &ldquo;수신
          기관&rdquo; 칸에 회사 이름을 적으면 여기 이름도 그것으로 바뀝니다.
        </p>
      )}
      <p className="mt-2 text-sm text-gray-600">
        {FORM_CORRECTION_REQUEST.title}는 한 벌에 제2항 권리 3종이 모두 담깁니다. 권리별로 여러
        장을 만들 필요는 없습니다.
      </p>
    </section>
  )
}

/** CB사에는 "금융거래의 설정·유지 결정"을 물을 수 없다 */
function CbLimitNote() {
  const r1 = RIGHTS_BY_ID.R1
  const actB = r1.targetActs.find((a) => a.code === 'b')
  if (!actB) return null
  return (
    <div className="mt-3 rounded-md border border-amber-400 bg-amber-50 p-3">
      <p className="font-bold text-amber-900">
        <span aria-hidden="true">※ </span>
        개인신용평가회사에는 물을 수 없는 것이 하나 있습니다
      </p>
      <p className="mt-2 text-amber-900">
        &ldquo;{actB.text}&rdquo; 에 대한 설명 요구는 {actB.note} 개인신용평가회사는 개인신용평가
        자체에 대해서만 답할 수 있습니다.
      </p>
      <p className="mt-2">
        <Basis prefix="근거">{actB.basis}</Basis>
      </p>
    </div>
  )
}
