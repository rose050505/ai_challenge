import { useState } from 'react'
import { Link } from 'react-router-dom'
import { R3_SCOPE, RIGHTS_BY_ID, INSTITUTION_OPTIONS } from '../data/law.js'
import { EVENT_TYPES_BY_ID } from '../data/events.js'
import { useDiagnosis } from '../lib/diagnosis-context.jsx'
import { requestCandidates } from '../lib/analyze-client.js'

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

  const toggle = (i) =>
    setPicked((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))

  const confirm = () => {
    update({ selectedCandidates: picked.map((i) => result.candidates[i]) })
  }

  const selectedCount = picked.length

  return (
    <div className="space-y-6 py-6">
      <header className="space-y-1">
        <h1 className="text-2xl font-bold">대응 전략</h1>
        <p className="text-sm text-gray-600">
          {right.label} — {right.basis}
        </p>
      </header>

      <section className="rounded border bg-gray-50 p-4 text-sm">
        <p className="font-medium">제출할 수 있는 정보의 법정 범위</p>
        <p className="mt-1">
          &ldquo;{R3_SCOPE.definition}&rdquo;
        </p>
        <p className="mt-1 text-xs text-gray-500">
          {R3_SCOPE.categoryLabel} · {R3_SCOPE.definitionBasis}
        </p>
        <p className="mt-2 text-xs text-gray-600">
          이 범위 밖의 항목(예: 성격, 학력)은 제안하지 않습니다.
        </p>
      </section>

      {state === 'idle' && (
        <section className="space-y-3">
          {diagnosis.reason ? (
            <div className="rounded border p-3 text-sm">
              <p className="font-medium">진단에서 적어주신 상황</p>
              <p className="mt-1 whitespace-pre-line text-gray-700">{diagnosis.reason}</p>
            </div>
          ) : (
            <p className="rounded border border-dashed p-3 text-sm text-gray-600">
              진단에서 상황을 적지 않으셨습니다. 일반적인 제출 항목 목록을 보여드립니다.
            </p>
          )}
          <button
            type="button"
            onClick={run}
            className="rounded bg-gray-900 px-5 py-3 text-white hover:bg-gray-700"
          >
            제출할 정보 후보 만들기
          </button>
          <p className="text-xs text-gray-500">
            이름·주민등록번호·연락처는 전송하지 않습니다. 상황 서술만 보냅니다.
          </p>
        </section>
      )}

      {state === 'loading' && (
        <section className="rounded border p-6 text-center">
          <p className="font-medium">후보를 만들고 있습니다…</p>
          <p className="mt-1 text-sm text-gray-600">
            몇 초 걸릴 수 있습니다. 이 화면을 닫지 마세요.
          </p>
          <div className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded bg-gray-200">
            <div className="h-full w-1/3 animate-pulse bg-gray-500" />
          </div>
        </section>
      )}

      {state === 'done' && result && (
        <section className="space-y-4">
          {result.notice && (
            <p className="rounded border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
              {result.notice}
            </p>
          )}

          <div className="rounded border border-gray-300 p-3 text-sm">
            이 제안은 참고용이며, 실제 제출 여부는 본인이 판단합니다. 법률 자문이 아닙니다.
          </div>

          <div>
            <p className="mb-2 text-sm font-medium">
              서식에 넣을 항목을 고르세요 ({selectedCount}/{result.candidates.length})
            </p>
            <ul className="space-y-2">
              {result.candidates.map((c, i) => (
                <li key={i} className="rounded border p-3">
                  <label className="flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={picked.includes(i)}
                      onChange={() => toggle(i)}
                      className="mt-1"
                    />
                    <span className="flex-1">
                      <span className="block font-medium">{c['정보명']}</span>
                      <span className="mt-1 block text-sm text-gray-700">{c['세부내용']}</span>
                      {c['증빙서류'] && (
                        <span className="mt-1 block text-xs text-gray-600">
                          발급처: {c['증빙서류']}
                        </span>
                      )}
                      <span className="mt-1 block text-xs text-gray-500">
                        {R3_SCOPE.categoryLabel} · {R3_SCOPE.definitionBasis}
                      </span>
                    </span>
                  </label>
                </li>
              ))}
            </ul>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              to="/document?form=correctionRequest"
              onClick={confirm}
              className={`rounded px-5 py-3 text-white ${
                selectedCount ? 'bg-gray-900 hover:bg-gray-700' : 'pointer-events-none bg-gray-400'
              }`}
            >
              선택한 {selectedCount}개를 서식에 넣기
            </Link>
            <button
              type="button"
              onClick={run}
              className="rounded border px-4 py-3 hover:bg-gray-50"
            >
              다시 만들기
            </button>
          </div>
        </section>
      )}
    </div>
  )
}
