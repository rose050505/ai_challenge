import { useState } from 'react'
import { Link } from 'react-router-dom'
import { R3_SCOPE, RIGHTS_BY_ID, INSTITUTION_OPTIONS } from '../data/law.js'
import { EVENT_TYPES_BY_ID } from '../data/events.js'
import { useDiagnosis } from '../lib/diagnosis-context.jsx'
import { requestCandidates } from '../lib/analyze-client.js'
import { PageHeader, Basis, Card, Notice, Status } from '../components/ui.jsx'
import { Term } from '../components/Term.jsx'

export default function Strategy() {
  const { diagnosis, update } = useDiagnosis()
  const [state, setState] = useState('idle') // idle | loading | done
  const [result, setResult] = useState(null)
  const [picked, setPicked] = useState([])

  const right = RIGHTS_BY_ID[R3_SCOPE.rightId]
  const event = EVENT_TYPES_BY_ID[diagnosis.eventId]
  const sector = INSTITUTION_OPTIONS.find((o) => o.id === diagnosis.institutionSectorId)

  const run = async () => {
    setState('loading')
    const r = await requestCandidates({
      sampleId: diagnosis.sampleId,
      situation: diagnosis.reason,
      eventLabel: event?.label,
      sectorLabel: sector?.label,
    })
    setResult(r)
    setPicked(r.candidates.map((_, i) => i))
    setState('done')
  }

  const toggle = (i) => setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))

  const confirm = () => {
    update({ selectedCandidates: picked.map((i) => result.candidates[i]) })
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
          <p className="text-sm text-gray-600">
            이름·주민등록번호·연락처는 전송하지 않습니다. 상황 서술만 보냅니다.
          </p>
        </section>
      )}

      {state === 'loading' && (
        <section className="card text-center">
          <Status className="font-bold text-gray-900">후보를 만들고 있습니다…</Status>
          <p className="mt-1 text-gray-600">몇 초 걸릴 수 있습니다. 이 화면을 닫지 마세요.</p>
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
                      <span className="mt-1 block text-gray-700">{c['세부내용']}</span>
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
