import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import {
  RESPONSE_TYPES,
  RESPONSE_TYPE_IDS,
  RESPONSE_TYPES_BY_ID,
  RESPONSE_LIMITATION,
  BASE_INFO_CATEGORIES,
  REFUSAL_GROUNDS,
  REFUSAL_NOTICE_DUTY,
  RIGHTS_BY_ID,
  R3_SCOPE,
  FORM_EXPLANATION_REQUEST,
  FORM_CORRECTION_REQUEST,
  AMBIGUOUS_CATEGORY_ITEMS,
  isAmbiguousCategoryItem,
  BASE_INFO_CATEGORIES_BY_ID,
} from '../data/law.js'
import { RESPONSE_SAMPLES } from '../data/response-samples.js'
import { useDiagnosis } from '../lib/diagnosis-context.jsx'
import { interpretResponse } from '../lib/interpret-client.js'
import { PageHeader, Basis, Notice, Status } from '../components/ui.jsx'
import { Term } from '../components/Term.jsx'

/**
 * 회신 해석기.
 *
 * ★ 법정 분류는 코드가, 자연어 해석만 AI가 한다.
 *   "다음에 무엇을 할지"는 AI가 아니라 아래 decideNextAction 이 결정한다.
 *
 * 독립 진입 가능. 진단을 거치지 않아도 동작한다.
 */

/**
 * 다음 행동 판정 — 코드가 결정한다. AI에게 맡기지 않는다.
 *
 * ★ excludedByProviso 는 여기서 보지 않는다. 의도적이다.
 *   시행령 §31-2⑧3호 단서의 법정 제외는 거절이 아니라 정상 회신이므로,
 *   거절 분기로 보내면 안 된다. 세 유형을 다 받았고 오류가 없으면
 *   제외가 적용됐더라도 'done'(유리한 정보 제출) 분기로 간다.
 *   RESPONSE_DISPOSITIONS 참조.
 */
function decideNextAction({ interpretation, errorCount }) {
  if (errorCount > 0) {
    return {
      id: 'correct',
      title: '틀린 기초정보를 정정하고 재산출을 요구하세요',
      detail: `사실과 다르다고 표시한 ${errorCount}건이 서식 2의 정정·삭제 표로 넘어갑니다.`,
      rights: ['R4', 'R5'],
      to: '/document?form=correctionRequest',
      cta: '서식 2 만들기',
    }
  }
  if (interpretation.refused) {
    return {
      id: 'refused',
      title: '거절 사유를 확인하세요',
      detail:
        '거절에는 법령이 정한 사유가 있어야 하고, 사업자는 그 근거와 사유를 안내할 의무가 있습니다.',
      rights: [],
      to: '/next',
      cta: '이후 절차 보기',
    }
  }
  if (interpretation.missing.length > 0) {
    return {
      id: 'reRequest',
      title: '설명되지 않은 항목을 다시 요구하세요',
      detail: `누락된 ${interpretation.missing.length}개 항목만 선택된 상태로 서식 1이 준비됩니다.`,
      rights: ['R2'],
      to: '/document',
      cta: '서식 1 다시 만들기',
    }
  }
  return {
    id: 'done',
    title: '확인이 끝났습니다',
    detail:
      '요구한 세 유형을 모두 설명받았고, 기초정보에서 사실과 다른 내용도 찾지 못하셨습니다. ' +
      '이제 유리한 정보를 제출해 재산출을 요구할 수 있습니다.',
    rights: ['R3'],
    to: '/strategy',
    cta: '제출할 정보 정하러 가기',
  }
}

/**
 * 받음/못 받음 표시.
 * 색만으로 알리지 않는다. 글리프(✓ / ✕)와 글자("받음" / "못 받음")를 함께 둔다.
 */
function TypeRow({ type, got }) {
  return (
    <li
      className={`rounded-md border p-3 ${
        got ? 'border-gray-200 bg-white' : 'border-amber-300 bg-amber-50'
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`mt-0.5 flex shrink-0 items-center gap-1 rounded px-2 py-0.5 text-sm font-bold ${
            got ? 'bg-ink-100 text-ink-800' : 'bg-amber-200 text-amber-900'
          }`}
        >
          <span aria-hidden="true">{got ? '✓' : '✕'}</span>
          {got ? '받음' : '못 받음'}
        </span>
        <div className="min-w-0">
          <span className="block font-bold text-gray-900">
            <Term>{type.label}</Term>
          </span>
          <span className="mt-2 flex flex-wrap gap-2">
            <Basis prefix="근거">{type.basis}</Basis>
            <Basis prefix="관련">{type.relatedRightBasis}</Basis>
          </span>
        </div>
      </div>
    </li>
  )
}

export default function Response() {
  const navigate = useNavigate()
  const { update } = useDiagnosis()
  const [text, setText] = useState('')
  const [sampleId, setSampleId] = useState(null)
  const [state, setState] = useState('idle') // idle | loading | done
  const [result, setResult] = useState(null)
  const [errors, setErrors] = useState([]) // 사실과 다르다고 체크한 baseInfoItems 인덱스
  // 사용자가 직접 고친 분류. 분류는 정정 요구의 근거이므로 최종 판단은 사용자 몫이다.
  const [catOverrides, setCatOverrides] = useState({})
  // 수동 모드 상태
  const [manualCovered, setManualCovered] = useState([])
  const [manualItems, setManualItems] = useState([
    { 항목: '', 내용: '', 분류: BASE_INFO_CATEGORIES[0].label },
  ])

  const run = async () => {
    setState('loading')
    const r = await interpretResponse({ sampleId, responseText: text })
    setResult(r)
    setErrors([])
    setCatOverrides({})
    if (r.mode === 'manual') {
      setManualCovered([])
      setManualItems([{ 항목: '', 내용: '', 분류: BASE_INFO_CATEGORIES[0].label }])
    }
    setState('done')
  }

  const pickSample = (s) => {
    setSampleId(s.id)
    setText(s.text)
    setState('idle')
    setResult(null)
    setCatOverrides({})
  }

  // 수동 모드에서 만든 해석 결과를 AI 결과와 같은 모양으로 맞춘다
  const manualInterpretation = {
    covered: manualCovered,
    missing: RESPONSE_TYPE_IDS.filter((id) => !manualCovered.includes(id)),
    baseInfoItems: manualItems.filter((i) => i.항목.trim()),
    refused: false,
    refusalReasonText: '',
    excludedByProviso: false,
    provisoText: '',
  }

  const interpretation =
    result?.mode === 'manual' ? manualInterpretation : (result?.interpretation ?? null)

  // 서버가 법정 정의로 보정한 분류 위에 사용자의 선택을 덮어쓴다.
  const items = (interpretation?.baseInfoItems ?? []).map((it, i) =>
    catOverrides[i] ? { ...it, 분류: catOverrides[i] } : it,
  )
  // 수동 모드에서는 표 안에서 이미 분류를 고르므로 별도 보정 UI를 띄우지 않는다.
  const showCategoryPicker = result?.mode !== 'manual'
  const excluded = interpretation?.excludedByProviso === true

  const toggleError = (i) =>
    setErrors((p) => (p.includes(i) ? p.filter((x) => x !== i) : [...p, i]))

  const goNext = (action) => {
    // 회신에서 읽은 값을 서식으로 넘긴다. 정정 내용은 사용자가 채운다.
    const rows = errors.map((i) => {
      const item = items[i]
      const cat = BASE_INFO_CATEGORIES.find((c) => c.label === item.분류) ?? BASE_INFO_CATEGORIES[4]
      return { categoryId: cat.id, current: `${item.항목}: ${item.내용}` }
    })
    update({
      correctionRows: rows,
      missingRequestItems: action.id === 'reRequest' ? interpretation.missing : [],
    })
    navigate(action.to)
  }

  const action = interpretation
    ? decideNextAction({ interpretation, errorCount: errors.length })
    : null

  return (
    <div className="space-y-6 py-8">
      <PageHeader
        kicker="회신 해석"
        title="받은 답변서를 읽어 드립니다"
        description="법이 정한 세 유형 중 무엇을 받았고 무엇이 빠졌는지 알려드립니다. 진단을 거치지 않고 바로 사용하셔도 됩니다."
      />

      {state === 'idle' && (
        <>
          <section className="panel" aria-labelledby="response-sample-heading">
            <p id="response-sample-heading" className="mb-3 font-bold text-gray-900">
              회신문이 없다면 샘플로 체험해 보세요
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {RESPONSE_SAMPLES.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => pickSample(s)}
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
                  <span className="mt-2 block text-sm text-ink-700">→ {s.demonstrates}</span>
                </button>
              ))}
            </div>
          </section>

          <section className="space-y-3">
            <label className="block font-bold text-gray-900" htmlFor="responseText">
              받으신 답변서의 내용을 그대로 붙여넣으세요.
            </label>
            <p id="responseText-help" className="text-gray-600">
              개인정보가 포함된 부분은 지우고 넣으셔도 됩니다.
            </p>
            <textarea
              id="responseText"
              value={text}
              onChange={(e) => {
                setText(e.target.value)
                setSampleId(null)
              }}
              rows={14}
              aria-describedby="responseText-help"
              placeholder="예: 귀하께서 요청하신 자동화평가 결과에 대한 설명을 아래와 같이 안내드립니다…"
              className="w-full rounded-md border border-gray-300 p-3 font-mono text-sm leading-relaxed"
            />
            <button
              type="button"
              onClick={run}
              disabled={!text.trim()}
              className="btn btn-primary"
            >
              회신 해석하기
            </button>
            <p className="text-sm text-gray-600">
              붙여넣은 내용은 저장되지 않습니다. 새로고침하면 사라집니다.
            </p>
          </section>
        </>
      )}

      {state === 'loading' && (
        <section className="card text-center">
          <Status className="font-bold text-gray-900">회신을 읽고 있습니다…</Status>
          <p className="mt-1 text-gray-600">몇 초 걸릴 수 있습니다.</p>
          <div className="mx-auto mt-4 h-1 w-48 overflow-hidden rounded bg-gray-200">
            <div className="h-full w-1/3 animate-pulse bg-ink-500" />
          </div>
        </section>
      )}

      {state === 'done' && result && (
        <section className="space-y-6">
          {result.notice && (
            <Notice title="안내" aria-live="polite">
              <p>{result.notice}</p>
            </Notice>
          )}

          {/* 수동 분류 모드 */}
          {result.mode === 'manual' && (
            <div className="space-y-5 rounded-lg border-2 border-ink-300 bg-white p-4">
              <div>
                <p className="text-lg font-bold text-gray-900">직접 분류하기</p>
                <p className="mt-1 text-gray-600">
                  받으신 회신에 어떤 내용이 있었는지 직접 표시해 주세요. 이후 단계는 동일하게
                  진행됩니다.
                </p>
              </div>
              <fieldset>
                <legend className="mb-2 font-bold text-gray-900">회신에 담겨 있던 내용</legend>
                <ul className="space-y-2">
                  {RESPONSE_TYPES.map((t) => (
                    <li key={t.id}>
                      <label className="flex cursor-pointer items-start gap-3">
                        <input
                          type="checkbox"
                          checked={manualCovered.includes(t.id)}
                          onChange={() =>
                            setManualCovered((p) =>
                              p.includes(t.id) ? p.filter((x) => x !== t.id) : [...p, t.id],
                            )
                          }
                          className="mt-1 h-5 w-5 shrink-0 accent-ink-700"
                        />
                        <span className="min-w-0">
                          <span className="block">{t.label}</span>
                          <span className="mt-1 block">
                            <Basis>{t.basis}</Basis>
                          </span>
                        </span>
                      </label>
                    </li>
                  ))}
                </ul>
              </fieldset>
              <div>
                <p className="mb-2 font-bold text-gray-900" id="manual-items-heading">
                  회신에 적힌 기초정보 항목
                </p>
                {/* 375px 에서 세 칸 표가 넘치므로 가로 스크롤을 허용한다 */}
                <div className="overflow-x-auto">
                  <table
                    className="w-full min-w-[30rem] border-collapse text-sm"
                    aria-labelledby="manual-items-heading"
                  >
                    <thead>
                      <tr className="bg-gray-100">
                        <th scope="col" className="border border-gray-300 p-2 text-left">
                          항목
                        </th>
                        <th scope="col" className="border border-gray-300 p-2 text-left">
                          내용
                        </th>
                        <th scope="col" className="border border-gray-300 p-2 text-left">
                          분류
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {manualItems.map((it, i) => (
                        <tr key={i}>
                          <td className="border border-gray-300 p-1">
                            <input
                              value={it.항목}
                              aria-label={`${i + 1}번째 항목 이름`}
                              onChange={(e) =>
                                setManualItems((p) =>
                                  p.map((x, j) => (j === i ? { ...x, 항목: e.target.value } : x)),
                                )
                              }
                              className="w-full p-1"
                            />
                          </td>
                          <td className="border border-gray-300 p-1">
                            <input
                              value={it.내용}
                              aria-label={`${i + 1}번째 항목 내용`}
                              onChange={(e) =>
                                setManualItems((p) =>
                                  p.map((x, j) => (j === i ? { ...x, 내용: e.target.value } : x)),
                                )
                              }
                              className="w-full p-1"
                            />
                          </td>
                          <td className="border border-gray-300 p-1">
                            <select
                              value={it.분류}
                              aria-label={`${i + 1}번째 항목 분류`}
                              onChange={(e) =>
                                setManualItems((p) =>
                                  p.map((x, j) => (j === i ? { ...x, 분류: e.target.value } : x)),
                                )
                              }
                              className="w-full p-1"
                            >
                              {BASE_INFO_CATEGORIES.map((c) => (
                                <option key={c.id} value={c.label}>
                                  {c.label}
                                </option>
                              ))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <button
                  type="button"
                  onClick={() =>
                    setManualItems((p) => [
                      ...p,
                      { 항목: '', 내용: '', 분류: BASE_INFO_CATEGORIES[0].label },
                    ])
                  }
                  className="btn btn-quiet mt-3"
                >
                  행 추가
                </button>
              </div>
            </div>
          )}

          {/* (1) 무엇을 받았고 무엇을 못 받았나 */}
          <div>
            <h2 className="mb-3 text-xl font-bold text-gray-900">무엇을 받았나요</h2>
            <ul className="space-y-2">
              {RESPONSE_TYPES.map((t) => (
                <TypeRow key={t.id} type={t} got={interpretation.covered.includes(t.id)} />
              ))}
            </ul>
            {interpretation.missing.length > 0 && (
              <Notice className="mt-3" title="설명되지 않은 항목이 있습니다">
                <p>
                  {interpretation.missing.map((id) => RESPONSE_TYPES_BY_ID[id].label).join(', ')}
                </p>
              </Notice>
            )}
          </div>

          {/* (2) 제도의 한계 — 반드시 표시. 실제 적용된 회신이면 강조한다. */}
          <div
            className={
              excluded
                ? 'rounded-lg border-2 border-amber-600 bg-amber-50 p-5'
                : 'rounded-lg border border-gray-300 bg-white p-5'
            }
          >
            <h2 className="flex items-baseline gap-2 text-xl font-bold text-gray-900">
              {excluded && (
                <span
                  aria-hidden="true"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-amber-600 text-sm font-bold text-amber-800"
                >
                  !
                </span>
              )}
              <span>
                {excluded ? '이번 회신에 적용된 제외입니다' : '받을 수 없는 것이 있습니다'}
              </span>
            </h2>
            {excluded && (
              <>
                <p className="mt-3 font-bold text-amber-900">
                  {RESPONSE_LIMITATION.appliedNotice}
                </p>
                {interpretation.provisoText && (
                  <blockquote className="mt-3 rounded-md border-l-4 border-amber-400 bg-white p-3 whitespace-pre-line text-gray-800">
                    {interpretation.provisoText}
                  </blockquote>
                )}
                <p className="mt-3 rounded-md border border-gray-200 bg-white p-3 text-gray-800">
                  {RESPONSE_LIMITATION.notRefusalNote}
                </p>
              </>
            )}
            <p className="mt-4 font-bold text-gray-900">{RESPONSE_LIMITATION.proviso}</p>
            <p className="mt-2 text-gray-700">{RESPONSE_LIMITATION.explanation}</p>
            <p className="mt-2 text-gray-700">{RESPONSE_LIMITATION.consequence}</p>
            <p className="mt-3">
              <Basis prefix="근거">{RESPONSE_LIMITATION.basis}</Basis>
            </p>
            <p className="mt-3 text-sm text-gray-600">
              이것은 이 서비스의 한계가 아니라 제도의 설계입니다. 회신이 부실하다고 느껴지더라도
              그 상당 부분은 법이 제외를 허용한 범위입니다.
            </p>
          </div>

          {/* (3) 받은 기초정보 검토 */}
          <div>
            <h2 className="mb-3 text-xl font-bold text-gray-900">
              받은 <Term id="baseInfo">기초정보</Term>를 확인하세요
            </h2>
            {items.length === 0 ? (
              <p className="rounded-md border border-dashed border-gray-400 p-3 text-gray-600">
                회신에서 개별 기초정보 항목을 찾지 못했습니다.
              </p>
            ) : (
              <>
                <p className="mb-3 text-gray-600">
                  사실과 다른 항목에 표시하세요. 표시한 항목이 정정·삭제 요구서로 넘어갑니다.
                </p>
                {BASE_INFO_CATEGORIES.map((cat) => {
                  const rows = items
                    .map((it, i) => ({ it, i }))
                    .filter(({ it }) => it.분류 === cat.label)
                  if (rows.length === 0) return null
                  return (
                    <div key={cat.id} className="mb-4">
                      <p className="flex flex-wrap items-center gap-2 font-bold text-gray-900">
                        <Term>{cat.label}</Term>
                        <Basis>{cat.lawBasis}</Basis>
                      </p>
                      <ul className="mt-2 space-y-2">
                        {rows.map(({ it, i }) => (
                          <li
                            key={i}
                            className={`rounded-md border p-3 ${
                              errors.includes(i)
                                ? 'border-amber-500 bg-amber-50'
                                : 'border-gray-200 bg-white'
                            }`}
                          >
                            <label className="flex cursor-pointer items-start gap-3">
                              <input
                                type="checkbox"
                                checked={errors.includes(i)}
                                onChange={() => toggleError(i)}
                                className="mt-1 h-5 w-5 shrink-0 accent-ink-700"
                              />
                              <span className="min-w-0 flex-1">
                                <span className="font-bold text-gray-900">{it.항목}</span>
                                {it.내용 && <span className="text-gray-700"> — {it.내용}</span>}
                                <span className="mt-0.5 block text-sm text-gray-600">
                                  {errors.includes(i) ? (
                                    <>
                                      <span aria-hidden="true">✓ </span>
                                      사실과 다르다고 표시했습니다
                                    </>
                                  ) : (
                                    '이 정보가 사실과 다릅니다'
                                  )}
                                </span>
                              </span>
                            </label>
                            {showCategoryPicker && (
                              <div className="mt-2 pl-8">
                                <label
                                  htmlFor={`cat-${i}`}
                                  className="mr-2 text-sm text-gray-600"
                                >
                                  분류
                                </label>
                                <select
                                  id={`cat-${i}`}
                                  value={it.분류}
                                  onChange={(e) =>
                                    setCatOverrides((p) => ({ ...p, [i]: e.target.value }))
                                  }
                                  className="rounded border border-gray-300 bg-white px-2 py-1 text-sm"
                                >
                                  {BASE_INFO_CATEGORIES.map((c) => (
                                    <option key={c.id} value={c.label}>
                                      {c.label}
                                    </option>
                                  ))}
                                </select>
                                {it.correctedFrom && catOverrides[i] === undefined && (
                                  <p className="mt-2 text-sm text-gray-600">
                                    AI는 「{it.correctedFrom}」로 분류했으나 법 정의에 따라
                                    바로잡았습니다. 다르다고 보시면 직접 고치세요.{' '}
                                    <Basis>{it.correctionBasis}</Basis>
                                  </p>
                                )}
                                {/* ★ 두 분류에 모두 걸리는 항목. 코드가 정하지 않고 사용자가 고른다. */}
                                {isAmbiguousCategoryItem(it.항목) && (
                                  <div className="mt-2 rounded-md border border-amber-300 bg-amber-50 p-2 text-sm text-amber-900">
                                    <p>
                                      <span aria-hidden="true">※ </span>
                                      {AMBIGUOUS_CATEGORY_ITEMS.notice}
                                    </p>
                                    <ul className="mt-2 space-y-1">
                                      {AMBIGUOUS_CATEGORY_ITEMS.candidates.map((c) => (
                                        <li key={c.categoryId}>
                                          <b>
                                            {BASE_INFO_CATEGORIES_BY_ID[c.categoryId].label}
                                          </b>{' '}
                                          — {c.perspective} <Basis>{c.basis}</Basis>
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            )}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )
                })}
              </>
            )}
          </div>

          {/* (4) 거절당한 경우 */}
          {interpretation.refused && (
            <div className="rounded-lg border-2 border-amber-600 bg-amber-50 p-5">
              <h2 className="flex items-baseline gap-2 text-xl font-bold text-gray-900">
                <span
                  aria-hidden="true"
                  className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 border-amber-600 text-sm font-bold text-amber-800"
                >
                  ✕
                </span>
                <span>거절된 회신입니다</span>
              </h2>
              {interpretation.refusalReasonText ? (
                <div className="mt-3 rounded-md border border-gray-200 bg-white p-3">
                  <p className="font-bold text-gray-900">회신에 적힌 사유</p>
                  <p className="mt-1 whitespace-pre-line text-gray-700">
                    {interpretation.refusalReasonText}
                  </p>
                </div>
              ) : (
                <p className="mt-3 rounded-md border border-gray-200 bg-white p-3 text-gray-800">
                  회신에서 거절 사유를 찾지 못했습니다. 사업자는 거절의 근거와 사유를 안내할
                  의무가 있습니다. 사유를 받지 못하셨다면 다시 요구할 수 있습니다.
                </p>
              )}
              <p className="mt-4 font-bold text-gray-900">
                법령이 정한 거절 사유는 아래 네 가지입니다
              </p>
              <ul className="mt-2 space-y-2">
                {REFUSAL_GROUNDS.map((d) => (
                  <li key={d.id} className="rounded-md border border-gray-200 bg-white p-3">
                    <p className="text-gray-800">{d.text}</p>
                    <p className="mt-2">
                      <Basis chain prefix="근거 체인">
                        {d.basisChain}
                      </Basis>
                    </p>
                    {d.uiCaution && (
                      <p className="mt-2 text-sm text-amber-900">
                        <span aria-hidden="true">※ </span>
                        횟수만으로 자동 거절되는 것이 아닙니다. &ldquo;정당한 사유 없이&rdquo;가
                        함께 요구되는 요건입니다.
                      </p>
                    )}
                  </li>
                ))}
              </ul>
              <div className="mt-3 rounded-md border border-gray-200 bg-white p-3">
                <p className="text-gray-800">{REFUSAL_NOTICE_DUTY.text}</p>
                <p className="mt-2">
                  <Basis prefix="근거">{REFUSAL_NOTICE_DUTY.basis}</Basis>
                </p>
              </div>
            </div>
          )}

          {/* (5) 다음 행동 — 코드가 결정한다 */}
          {action && (
            <div className="rounded-lg border-2 border-ink-700 bg-white p-5" role="region" aria-live="polite">
              <p className="text-sm font-semibold tracking-wide text-ink-600">다음 행동</p>
              <h2 className="mt-1 text-xl font-bold text-gray-900">{action.title}</h2>
              <p className="mt-2 text-gray-700">{action.detail}</p>
              {action.rights.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {action.rights.map((rid) => (
                    <li key={rid} className="text-gray-700">
                      <span className="font-bold">{RIGHTS_BY_ID[rid].label}</span>{' '}
                      <Basis>{RIGHTS_BY_ID[rid].basis}</Basis>
                    </li>
                  ))}
                </ul>
              )}
              {action.id === 'done' && (
                <p className="mt-3 text-sm text-gray-600">
                  제출할 수 있는 정보의 법정 범위: {R3_SCOPE.definition}{' '}
                  <Basis>{R3_SCOPE.definitionBasis}</Basis>
                </p>
              )}
              {action.id === 'reRequest' && (
                <p className="mt-3 text-sm text-gray-600">
                  사용할 서식: {FORM_EXPLANATION_REQUEST.title}
                </p>
              )}
              {action.id === 'correct' && (
                <p className="mt-3 text-sm text-gray-600">
                  사용할 서식: {FORM_CORRECTION_REQUEST.title}
                </p>
              )}
              <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <button type="button" onClick={() => goNext(action)} className="btn btn-primary">
                  {action.cta}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setState('idle')
                    setResult(null)
                  }}
                  className="btn btn-secondary"
                >
                  다른 회신 넣기
                </button>
                <Link to="/next" className="btn btn-quiet">
                  이후 절차 보기
                </Link>
              </div>
            </div>
          )}

          <p className="text-sm text-gray-500">
            이 해석은 참고용이며 법률 자문이 아닙니다. 회신의 적법성 판단은 포함하지 않습니다.
          </p>
        </section>
      )}
    </div>
  )
}
