import { BASE_INFO_CATEGORIES_BY_ID, RESPONSE_FORM } from '../data/law.js'
import { Basis } from './ui.jsx'

/**
 * 회신의 **형식**에도 법정 기준이 있다는 축.
 *
 * ★ /response 와 /next 가 같은 말을 한다. 두 곳에 따로 적혀 있었고, 정본을 받아
 *   내용이 길어지면서 두 벌을 맞춰 쓰는 일이 위험해졌다. 한 곳으로 모은다.
 *
 * ★ 정본 본문을 통째로 옮기지 않는다. (2026-09-04)
 *   이 서식은 **금융회사가** 쓰는 것이지 사용자가 쓰는 것이 아니다. 재현할 이유가 없다.
 *   사용자에게 필요한 것은 "무엇이 적혀 있어야 하는가" — 그것만 구조로 안내한다.
 *
 * ★ 위법이라고 단정하지 않는 이유가 **추측에서 정본으로** 바뀌었다.
 *   그전에는 "실무 관행을 확인하지 않았다"였다. 이제는 작성요령이 자체 서식과
 *   자체 분류를 명시적으로 허용한다. 근거가 있는 말은 근거와 함께 한다.
 */
export default function ResponseFormNotice({ className = '' }) {
  const [s1, s2, s3] = RESPONSE_FORM.sections
  const cats = s2.categoryOrder.map((id) => BASE_INFO_CATEGORIES_BY_ID[id])

  return (
    <div className={`rounded-md border border-gray-400 bg-gray-50 p-4 ${className}`}>
      <p className="font-bold text-gray-900">회신에도 정해진 서식이 있습니다</p>
      <p className="mt-2 text-gray-700">{RESPONSE_FORM.notice}</p>
      <p className="mt-2 text-gray-700">
        그 서식은{' '}
        <b>
          {RESPONSE_FORM.formNo} 「{RESPONSE_FORM.formName}」
        </b>
        입니다.
      </p>
      <blockquote className="mt-3 rounded-md border-l-4 border-gray-400 bg-white p-3 text-gray-800">
        {RESPONSE_FORM.ruleText}
      </blockquote>

      {/* 무엇이 담기는가 — 정본이 정한 절 구성 */}
      <p className="mt-4 font-bold text-gray-900">회신에 무엇이 담기나요</p>
      <ol className="mt-2 space-y-3">
        <li className="rounded-md border border-gray-400 bg-white p-3">
          <p className="font-bold text-gray-900">
            {s1.no}. {s1.title}
          </p>
          <p className="mt-1 text-sm text-gray-700">{s1.fields.join(' · ')}</p>
        </li>
        <li className="rounded-md border border-gray-400 bg-white p-3">
          <p className="font-bold text-gray-900">
            {s2.no}. {s2.title}
          </p>
          <p className="mt-1 text-sm text-gray-700">{s2.fields.join(' · ')}</p>
          {/* 정본 표기는 세 「판단정보」를 붙여 쓴다. 화면 용어와 다른 것은 그 때문이다. */}
          <ul className="mt-2 space-y-1 text-sm text-gray-800">
            {cats.map((c, i) => (
              <li key={c.id}>
                {['①', '②', '③', '④', '⑤'][i]} {c.noticeFormLabel ?? c.label}
              </li>
            ))}
          </ul>
          {/* ★ 사용자가 요구할 근거가 되는 두 칸 */}
          <p className="mt-2 text-sm text-gray-800">
            <b>반영비중</b>은 다섯 분류마다 백분율로 적히게 되어 있습니다. 받으신 회신에
            그 숫자가 없다면 그것을 근거로 다시 요구하실 수 있습니다.
          </p>
          <p className="mt-2 text-sm text-gray-800">
            <b>입수 경로</b>는 정보마다 적히게 되어 있습니다 —{' '}
            {RESPONSE_FORM.sourceRoutes.values.join(' / ')}.
          </p>
          {/* ★ 이 칸이 정정 요청을 어디로 낼지 정한다 (CORRECTION_ROUTING) */}
          <p className="mt-1 text-sm text-gray-800">{RESPONSE_FORM.sourceRoutes.routingHint}</p>
          <p className="mt-1">
            <Basis prefix="근거">{RESPONSE_FORM.sourceRoutes.basis}</Basis>
          </p>
        </li>
        <li className="rounded-md border border-gray-400 bg-white p-3">
          <p className="font-bold text-gray-900">
            {s3.no}. {s3.title}
          </p>
          <p className="mt-1 text-sm text-gray-700">{s3.note}</p>
        </li>
      </ol>

      {/* 형식이 달라도 되는 이유 — 정본이 그렇게 정하고 있다 */}
      <p className="mt-4 text-sm text-gray-700">{RESPONSE_FORM.noVerdictNote}</p>
      <blockquote className="mt-2 rounded-md border-l-4 border-gray-400 bg-white p-3 text-sm text-gray-800">
        <p>{RESPONSE_FORM.ownFormAllowed.formText}</p>
        <p className="mt-1">{RESPONSE_FORM.ownFormAllowed.itemsText}</p>
        <p className="mt-2">
          <Basis prefix="근거">{RESPONSE_FORM.ownFormAllowed.basis}</Basis>
        </p>
      </blockquote>

      <p className="mt-3 flex flex-wrap gap-2">
        <Basis prefix="근거">{RESPONSE_FORM.basis}</Basis>
        <Basis prefix="관련">{RESPONSE_FORM.relatedBasis}</Basis>
      </p>
    </div>
  )
}
