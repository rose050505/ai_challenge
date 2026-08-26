import { COUNTERPARTY_TYPES, COUNTERPARTY_TYPES_BY_ID, RIGHTS_BY_ID } from '../data/law.js'
import { useJourney } from '../lib/diagnosis-context.jsx'
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
      <h2 id="case-heading" className="font-bold text-gray-900">
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
                    : 'border-gray-300 bg-white hover:border-ink-400'
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

/** CB사에는 "금융거래의 설정·유지 결정"을 물을 수 없다 */
function CbLimitNote() {
  const r1 = RIGHTS_BY_ID.R1
  const actB = r1.targetActs.find((a) => a.code === 'b')
  if (!actB) return null
  return (
    <div className="mt-3 rounded-md border border-amber-300 bg-amber-50 p-3">
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
