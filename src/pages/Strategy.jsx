import { useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { R3_SCOPE, RIGHTS_BY_ID, INSTITUTION_OPTIONS } from '../data/law.js'
import { EVENT_TYPES_BY_ID } from '../data/events.js'
import { useJourney } from '../lib/diagnosis-context.jsx'
import { requestCandidates } from '../lib/analyze-client.js'
import { PageHeader, Basis, Card, Notice, Status, SlowHint, Elapsed } from '../components/ui.jsx'
import { Term } from '../components/Term.jsx'
import { ArchitectureDiagram } from '../components/Diagrams.jsx'
import { AI_PROCESSING } from '../data/privacy.js'

/**
 * 후보 목록에 붙는 "선정이유".
 *
 * ★ 이 한 줄이 이 화면의 존재 이유다.
 *   목록만 있으면 검색으로 대체된다. "당신이 쓴 이 대목 때문에 이걸 골랐습니다"라야
 *   사용자의 글을 읽었다는 뜻이 된다.
 *
 * ★ 그러므로 근거 없이 표시하지 않는다.
 *   - AI 응답의 선정이유는 서버(api/analyze.js groundedReason)에서 인용을 대조해
 *     사용자 서술에 없는 말을 인용했으면 버리고 온다.
 *   - 폴백(일반 목록)에는 선정이유가 없다. 그 차이를 화면에서 그대로 말한다.
 *   - 접어 두지 않는다. 부제 자리에 항상 보인다.
 */
function PickReason({ text }) {
  if (!text) return null
  return (
    <span className="mt-2 block rounded-md border-l-4 border-ink-400 bg-ink-50 px-3 py-2 text-gray-900">
      <span className="mr-1 font-bold text-ink-800">이걸 고른 이유</span>
      <span className="block">{text}</span>
    </span>
  )
}

/**
 * 이 목록이 어디서 왔는지.
 *
 * ★ 폴백을 AI 결과처럼 보이게 두면 그 자체가 거짓말이다.
 *   'ai'      — 적어주신 상황을 읽고 고른 것
 *   'cached'  — 샘플 시나리오의 준비된 예시 (result.notice 가 이미 말한다)
 *   'fallback'— 상황과 무관한 일반 목록. 선정이유가 없다.
 */
function SourceBanner({ source, hasSituation, stale }) {
  if (source === 'ai') {
    /*
     * ★ 진단이 바뀌었으면 이 문장은 더 이상 사실이 아니다. (2026-08-31)
     *   "적어주신 상황을 읽고 고른 목록입니다"라고 말하는데, 정작 항목의 선정이유는
     *   지금 진단에 없는 말을 인용하고 있게 된다.
     *   이 서비스의 차별점이 "인용을 서버가 대조한다"인데, 그 인용이 지금 화면의
     *   서술과 어긋나 보이면 그 주장까지 같이 흔들린다. 그래서 먼저 밝힌다.
     */
    if (stale) {
      return (
        <div className="rounded-md border-l-4 border-seal-400 bg-seal-50 p-4">
          <p className="font-bold text-gray-900">진단을 바꾸신 뒤의 목록입니다</p>
          <p className="mt-2 text-gray-800">
            아래 목록은 <b>지금 진단에 적혀 있는 상황이 아니라, 그 전에 적으셨던 서술</b>을 읽고
            만든 것입니다. 각 항목의 선정이유가 인용하는 말도 그때의 서술에서 온 것입니다.
            지금 상황으로 다시 만드시려면 아래 [다시 만들기]를 누르세요.
          </p>
        </div>
      )
    }
    return (
      <p className="rounded-md border-l-4 border-ink-600 bg-ink-50 p-3 text-ink-900">
        <b>적어주신 상황을 읽고 고른 목록입니다.</b> 각 항목에 어느 대목 때문에 골랐는지
        함께 적어 두었습니다.
      </p>
    )
  }
  /**
   * 샘플 시나리오는 캐시된 예시로 끝까지 돈다 — API 를 타지 않는다.
   * ★ 심사자든 사용자든 여기서 멈추면 **AI 가 한 번도 돌지 않은 화면**만 보고 간다.
   *   그래서 "본인 이야기로 바꾸면 그 내용으로 다시 찾아 드린다"를 이 자리에 둔다.
   *   새 판정 로직이 아니라, 이미 있는 경로(진단 3단계 서술 → /api/analyze)로 가는 안내다.
   */
  if (source === 'cached') {
    return (
      <div className="rounded-md border-l-4 border-seal-400 bg-seal-50 p-4">
        <p className="font-bold text-gray-900">지금은 샘플의 미리 준비된 예시입니다</p>
        <p className="mt-2 text-gray-800">
          <b>진단 3단계에 본인 상황을 적으시면</b>, 그 내용을 읽고 다시 찾아 드립니다. 그때는
          항목마다 <b>어느 대목 때문에 골랐는지</b>도 함께 적어 드립니다.
        </p>
        <Link to="/diagnose#reason" className="btn btn-secondary mt-3">
          내 상황으로 다시 찾기
        </Link>
      </div>
    )
  }
  if (source !== 'fallback') return null
  return (
    <div className="rounded-md border border-dashed border-gray-500 bg-gray-50 p-4">
      <p className="font-bold text-gray-900">
        <span aria-hidden="true">※ </span>일반 목록입니다
      </p>
      {hasSituation ? (
        <p className="mt-2 text-gray-800">
          이번에는 상황을 읽지 못해, 누구에게나 해당하는 항목만 보여드립니다. 그래서{' '}
          <b>왜 이 항목인지는 설명해 드리지 못합니다.</b> 아래 [다시 만들기]를 누르면 다시
          시도합니다.
        </p>
      ) : (
        <>
          <p className="mt-2 text-gray-800">
            상황을 적지 않으셔서 누구에게나 해당하는 항목만 보여드립니다.{' '}
            <b>상황을 적어주시면 왜 이 항목인지 설명해 드립니다.</b>
          </p>
          <Link to="/diagnose#reason" className="btn btn-secondary mt-3">
            상황을 적으러 가기
          </Link>
        </>
      )}
    </div>
  )
}

export default function Strategy() {
  const { journey, setSection } = useJourney()
  const diagnosis = journey.diagnosis
  // 저장된 후보가 있으면 다시 만들지 않고 그대로 이어서 보여준다
  const saved = journey.strategy
  const [state, setState] = useState(saved.candidates.length > 0 ? 'done' : 'idle')
  const [result, setResult] = useState(
    saved.candidates.length > 0
      ? { candidates: saved.candidates, notice: saved.notice, source: saved.source }
      : null,
  )
  const [picked, setPicked] = useState(saved.picked ?? [])

  /**
   * 저장된 후보가 **지금 진단**으로 만든 것인가.
   *
   * basedOn 이 없으면(옛 기록) 알 수 없다 → 낡았다고 단정하지 않는다.
   * 상황 서술·사건 유형·업권 중 하나라도 다르면 낡은 것으로 본다.
   */
  const stale =
    saved.source === 'ai' &&
    saved.basedOn != null &&
    ((saved.basedOn.reason ?? '') !== (diagnosis.reason ?? '') ||
      (saved.basedOn.eventId ?? null) !== (diagnosis.eventId ?? null) ||
      (saved.basedOn.institutionSectorId ?? '') !== (diagnosis.institutionSectorId ?? ''))

  const right = RIGHTS_BY_ID[R3_SCOPE.rightId]
  const event = EVENT_TYPES_BY_ID[diagnosis.eventId]
  const sector = INSTITUTION_OPTIONS.find((o) => o.id === diagnosis.institutionSectorId)

  /**
   * 진행 중인 호출이 있으면 새 호출을 내보내지 않는다.
   *
   * ★ 버튼은 state 가 'loading' 이 되면 화면에서 사라진다. 그건 **다시 그린 뒤**의 일이라,
   *   같은 프레임 안에서 연달아 눌리면(연타·느린 기기) 그만큼 요청이 나간다.
   *   적대적 감사에서 15연타 → /api 요청 15회를 확인했다. 비용도 문제지만,
   *   늦게 온 옛 응답이 새 응답을 덮어쓸 수 있는 것이 더 나쁘다.
   */
  const running = useRef(false)

  const run = async () => {
    if (running.current) return
    running.current = true
    setState('loading')
    try {
      const r = await requestCandidates({
        sampleId: diagnosis.sampleId,
        situation: diagnosis.reason,
        eventLabel: event?.label,
        sectorLabel: sector?.label,
      })
      setResult(r)
      const all = r.candidates.map((_, i) => i)
      setPicked(all)
      setState('done')
      // 단계 완료 — 바로 저장한다
      setSection(
        'strategy',
        {
          candidates: r.candidates,
          notice: r.notice ?? null,
          picked: all,
          source: r.source ?? null,
          // 무엇을 읽고 만들었는지 함께 남긴다. 진단이 나중에 바뀌면 이것으로 알아챈다.
          basedOn: {
            reason: diagnosis.reason ?? '',
            eventId: diagnosis.eventId ?? null,
            institutionSectorId: diagnosis.institutionSectorId ?? '',
          },
        },
        { immediate: true },
      )
    } finally {
      running.current = false
    }
  }

  const toggle = (i) =>
    setPicked((p) => {
      const next = p.includes(i) ? p.filter((x) => x !== i) : [...p, i]
      setSection('strategy', { picked: next })
      return next
    })

  const confirm = () => {
    setSection(
      'diagnosis',
      { selectedCandidates: picked.map((i) => result.candidates[i]) },
      { immediate: true },
    )
  }

  const selectedCount = picked.length

  return (
    <div className="space-y-8 py-8">
      <PageHeader
        kicker="대응 전략"
        title="무엇을 제출하면 유리할까요"
        description={`${right.label} — 법이 허용한 범위 안에서만 후보를 제안합니다.`}
      >
        <p className="mt-3">
          <Basis prefix="근거">{right.basis}</Basis>
        </p>
      </PageHeader>

      <section className="panel">
        <p className="font-bold text-gray-900">
          제출할 수 있는 <Term id="favorableInfo">정보의 법정 범위</Term>
        </p>
        <p className="mt-2 text-lg text-gray-900">&ldquo;{R3_SCOPE.definition}&rdquo;</p>
        <p className="mt-3 flex flex-wrap gap-2">
          <Basis>{R3_SCOPE.definitionBasis}</Basis>
        </p>
        <p className="mt-2 text-sm text-gray-700">
          이 범위는 <Term id="capacityInfo">{R3_SCOPE.categoryLabel}</Term>입니다. 범위 밖의
          항목(예: 성격, 학력)은 제안하지 않습니다.
        </p>
      </section>

      {/* AI가 어디까지 하고 어디부터 코드가 하는지 — 이 화면에서 가장 자주 나오는 질문이다 */}
      <section className="space-y-2">
        <h2 className="text-lg font-bold text-gray-900">이 화면에서 AI는 어디까지 하나요</h2>
        <ArchitectureDiagram className="rounded-lg border border-gray-200 bg-white p-4" />
      </section>

      {state === 'idle' && (
        <section className="space-y-4">
          {diagnosis.reason ? (
            <Card>
              <p className="font-bold text-gray-900">진단에서 적어주신 상황</p>
              <p className="mt-2 whitespace-pre-line text-gray-700">{diagnosis.reason}</p>
            </Card>
          ) : (
            <p className="rounded-md border border-dashed border-gray-400 p-4 text-gray-600">
              진단에서 상황을 적지 않으셨습니다. 일반적인 제출 항목 목록을 보여드립니다.
            </p>
          )}
          <button type="button" onClick={run} className="btn btn-primary">
            제출할 정보 후보 만들기
          </button>
          {/* ★ 무엇이 어디로 나가는지 입력란 옆에서 밝힌다. 링크 뒤에 숨기지 않는다.
                 (감사 지적: 어느 AI 인지, 어디로 가는지가 화면 어디에도 없었다) */}
          <div className="rounded-md border border-gray-300 bg-white p-3 text-sm text-gray-700">
            <p>
              <b>보내는 것</b> — {AI_PROCESSING.sent.strategy}
            </p>
            <p className="mt-1">
              <b>보내지 않는 것</b> — {AI_PROCESSING.notSent}
            </p>
            <p className="mt-2">{AI_PROCESSING.short}</p>
            <p className="mt-1 text-gray-600">{AI_PROCESSING.vendorCaveat}</p>
          </div>
        </section>
      )}

      {state === 'loading' && (
        <section className="card text-center">
          <Status className="font-bold text-gray-900">후보를 만들고 있습니다…</Status>
          {/* 실측 8초. 예상 시간을 미리 말해 두지 않으면 기다리다 새로고침한다. */}
          <p className="mt-1 text-gray-600">
            보통 10초 안팎, 최대 25초까지 걸릴 수 있습니다. 이 화면을 닫지 마세요.
          </p>
          <SlowHint />
          <Elapsed className="mt-2" />
          <div className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded bg-gray-200">
            <div className="h-full w-1/3 animate-pulse bg-ink-500" />
          </div>
        </section>
      )}

      {state === 'done' && result && (
        <section className="space-y-5">
          {result.notice && (
            <Notice title="안내" aria-live="polite">
              <p>{result.notice}</p>
            </Notice>
          )}

          <SourceBanner
            source={result.source}
            hasSituation={Boolean(diagnosis.reason?.trim())}
            stale={stale && result.source === saved.source}
          />

          <p className="rounded-md border border-gray-300 bg-white p-3 text-gray-700">
            이 제안은 참고용이며, 실제 제출 여부는 본인이 판단합니다. 법률 자문이 아닙니다.
          </p>

          <div>
            <p className="mb-3 font-bold text-gray-900" id="candidate-heading">
              서식에 넣을 항목을 고르세요{' '}
              <span className="tabular font-normal text-gray-600">
                ({selectedCount}/{result.candidates.length} 선택됨)
              </span>
            </p>
            <ul className="space-y-3" aria-labelledby="candidate-heading">
              {result.candidates.map((c, i) => (
                <Card as="li" key={i} className={picked.includes(i) ? 'border-ink-400' : ''}>
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={picked.includes(i)}
                      onChange={() => toggle(i)}
                      className="mt-1.5 h-5 w-5 shrink-0 accent-ink-700"
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold text-gray-900">{c['정보명']}</span>
                      {/* 부제 자리 — 접지 않는다 */}
                      <PickReason text={c['선정이유']} />
                      <span className="mt-2 block text-gray-700">{c['세부내용']}</span>
                      {c['증빙서류'] && (
                        <span className="mt-1 block text-sm text-gray-600">
                          발급처: {c['증빙서류']}
                        </span>
                      )}
                    </span>
                  </label>
                  <p className="mt-2 pl-8">
                    <Basis>{R3_SCOPE.definitionBasis}</Basis>
                  </p>
                </Card>
              ))}
            </ul>
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
            <Link
              to="/document?form=correctionRequest"
              onClick={confirm}
              aria-disabled={selectedCount === 0}
              className={`btn ${
                selectedCount ? 'btn-primary' : 'btn-primary pointer-events-none opacity-60'
              }`}
            >
              선택한 {selectedCount}개를 서식에 넣기
            </Link>
            <button type="button" onClick={run} className="btn btn-secondary">
              다시 만들기
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
