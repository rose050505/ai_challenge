import { useState } from 'react'
import { Link } from 'react-router-dom'
import { SELF_CHECK_ITEMS, SELF_CHECK_NONE } from '../data/self-check.js'
import { DEFINITION_AUTOMATED_EVALUATION, RIGHTS_BY_ID } from '../data/law.js'
import { Basis } from './ui.jsx'
import { Plain } from '../lib/plain.jsx'

/**
 * 자가진단.
 *
 * 이 제도의 가장 큰 장벽은 "내가 자동화평가를 받았다"는 사실조차 모르는 것이다.
 * 진단 화면은 이미 "무슨 일이 있었나"부터 묻지만, 그 앞 단계가 비어 있었다.
 *
 * ★ 단정하지 않는다.
 *   법이 말하는 자동화평가의 요건은 "종사자가 평가 업무에 관여하지 아니하고"인데,
 *   그것은 금융회사만 아는 사실이다. 우리는 알 수 없고 추측해서도 안 된다.
 *   그래서 결론은 "자동화평가입니다"가 아니라
 *   "자동화평가였는지부터 물어볼 수 있습니다" 여야 한다. 그것이 R1 이고, 이 제도의 설계다.
 */
export default function SelfCheck() {
  const [picked, setPicked] = useState([])
  const r1 = RIGHTS_BY_ID.R1
  const any = picked.length > 0

  const toggle = (id) =>
    setPicked((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]))

  return (
    <section aria-labelledby="self-check-heading" className="panel" data-tour="selfcheck">
      <h2 id="self-check-heading" className="text-[1.375rem] font-semibold text-gray-900">
        혹시 이런 일이 있으셨나요?
      </h2>
      <p className="mt-2 text-gray-700">
        <Plain id="selfcheck.lead">
          해당하는 것을 눌러 보세요. 아무것도 입력하지 않아도 되고, 어디에도 전송되지 않습니다.
        </Plain>
      </p>

      <ul className="mt-4 space-y-2">
        {SELF_CHECK_ITEMS.map((item) => {
          const on = picked.includes(item.id)
          return (
            <li key={item.id}>
              <label
                className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${
                  on ? 'border-ink-600 bg-ink-50' : 'border-gray-400 bg-white'
                }`}
              >
                <input
                  type="checkbox"
                  checked={on}
                  onChange={() => toggle(item.id)}
                  className="mt-1 h-5 w-5 shrink-0 accent-ink-700"
                />
                <span className="min-w-0 flex-1">
                  <span className="block text-gray-900">{item.label}</span>
                  {on && <span className="mt-1 block text-sm text-gray-700">{item.why}</span>}
                </span>
              </label>
            </li>
          )
        })}
      </ul>

      {/* 결과는 낭독되어야 한다. 체크에 따라 내용이 바뀌는 영역이다. */}
      <div
        role="status"
        aria-live="polite"
        className="mt-5 rounded-md border-2 border-ink-700 bg-white p-4"
      >
        {any ? (
          <>
            <p className="text-lg font-bold text-gray-900">
              {picked.length}개 해당 — 자동화평가였을 <u>가능성</u>이 있습니다.
            </p>
            <p className="mt-2 text-gray-800">
              다만 이 서비스는 그것을 <b>확인해 드릴 수 없습니다.</b> 법이 말하는 자동화평가는
              &ldquo;{DEFINITION_AUTOMATED_EVALUATION.keyRequirement}&rdquo; 처리한 경우인데, 사람이
              심사에 개입했는지는 그 회사만 알기 때문입니다.
            </p>
            <p className="mt-2">
              <Basis prefix="근거">{DEFINITION_AUTOMATED_EVALUATION.basis}</Basis>
            </p>
            <p className="mt-3 text-gray-800">
              그래서 <b>맨 먼저 물어볼 것이 &ldquo;자동화평가를 했습니까&rdquo;</b> 입니다. 법은 그
              질문을 할 권리를 따로 두었습니다 — {r1.label}.
            </p>
            <p className="mt-2">
              <Basis prefix="근거">{r1.basis}</Basis>
            </p>
          </>
        ) : (
          <p className="text-gray-800">{SELF_CHECK_NONE}</p>
        )}
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <Link to="/diagnose" className="btn btn-primary">
            {any ? '이 상황으로 진단 시작하기' : '진단 시작하기'}
          </Link>
        </div>
      </div>
    </section>
  )
}
