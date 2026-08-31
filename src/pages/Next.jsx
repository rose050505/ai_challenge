import { Link } from 'react-router-dom'
import {
  EXERCISE_CHANNELS,
  EXERCISE_FORM_REQUIREMENT,
  RESPONSE_DUTY,
  RESPONSE_FORM,
  PROCESSING_DEADLINE,
  EXPLANATION_METHODS,
  REFUSAL_GROUNDS,
  REFUSAL_NOTICE_DUTY,
  POST_REFUSAL_PATHS,
  CORRECTION_ROUTING,
  CORRECTION_ROUTING_BY_ID,
  FORMS_BY_ID,
  FORM_CORRECTION_REQUEST,
  LAW_META,
} from '../data/law.js'
import { useJourney } from '../lib/diagnosis-context.jsx'
import { PageHeader, Basis, Notice } from '../components/ui.jsx'
import { Term } from '../components/Term.jsx'
import { SubmissionRecord } from '../components/Journey.jsx'
import NoReply from '../components/NoReply.jsx'
import Disclosure from '../components/Disclosure.jsx'

/**
 * 거절당한 뒤에 남은 경로.
 *
 * ★ 단정 범위를 넘지 않는다.
 *   - 과태료는 **제1항 위반에만** 있다. 제2항에는 없다는 사실을 함께 적는다.
 *   - 분쟁조정은 조정대상기관이 금융위원회법 제38조 각 호이므로 **금융회사에 한정**된다.
 *     CB사 포함 여부는 조문으로 확인되지 않았으므로 "확인되지 않음"으로 적는다.
 *   - 개인정보 분쟁조정 관할은 조문만으로 단정할 수 없어 넣지 않았다.
 *     대신 "확인하지 못했다"는 사실만 남긴다.
 *
 * ★ 우리는 법률자문을 하지 않는다. 섹션 전체에 그 고지를 단다.
 */
function PostRefusal({ defaultOpen }) {
  const p = POST_REFUSAL_PATHS
  return (
    <Section
      n="6."
      title="거절당했다면, 남은 경로"
      summary="과태료 · 손해배상 · 분쟁조정 — 조문으로 확인한 것만 적었습니다."
      defaultOpen={defaultOpen}
      note="아래는 법령 조문에 있는 것만 정리한 것입니다. 어느 것이 내 사안에 맞는지는 이 서비스가 판단하지 않습니다."
    >
      <ul className="space-y-4">
        {p.items.map((it) => (
          <li key={it.id} className="rounded-md border border-gray-400 p-4">
            <p className="font-bold text-gray-900">{it.title}</p>
            <p className="mt-2 text-gray-700">{it.text}</p>
            {it.amount && <p className="mt-2 font-bold text-ink-800">{it.amount}</p>}
            <p className="mt-2">
              <Basis prefix="근거">{it.basis}</Basis>
            </p>

            {it.highlight && <p className="mt-3 text-gray-800">{it.highlight}</p>}

            {/* ★ 과태료의 적용 범위 — 빼면 거짓이 된다 */}
            {it.scopeWarning && (
              <div className="mt-3 rounded-md border border-amber-400 bg-amber-50 p-3">
                <p className="text-amber-900">
                  <span aria-hidden="true">※ </span>
                  {it.scopeWarning}
                </p>
              </div>
            )}

            {it.scopeText && (
              <div className="mt-3 rounded-md bg-ink-50 p-3">
                <p className="text-ink-900">{it.scopeText}</p>
                <p className="mt-2">
                  <Basis prefix="근거">{it.scopeBasis}</Basis>
                </p>
              </div>
            )}

            {/* 확인하지 못한 것은 확인하지 못했다고 적는다 */}
            {it.unconfirmed && (
              <p className="mt-3 rounded-md border border-dashed border-gray-400 p-3 text-sm text-gray-700">
                <span aria-hidden="true">? </span>
                {it.unconfirmed}
              </p>
            )}

            {it.note && <p className="mt-3 text-sm text-gray-600">{it.note}</p>}
          </li>
        ))}
      </ul>

      <p className="mt-4 rounded-md border border-dashed border-gray-400 p-3 text-gray-700">
        {p.unexplored}
      </p>

      {/* ★ 이 선을 넘지 않는다 */}
      <Notice title="법률자문이 아닙니다" mark="!" className="mt-4">
        <p>{p.disclaimer}</p>
      </Notice>
    </Section>
  )
}

/**
 * 마지막 화면. 서식을 출력한 사용자가 "이제 뭘 하지"에서 막히지 않게 한다.
 *
 * ★ 법령에 있는 것만 쓴다. 없는 것은 없다고 쓴다.
 *   특히 처리 기한은 법령에 규정이 없다. 그 사실을 숨기지 않는다.
 *   법령 텍스트는 전부 src/data/law.js 에서 읽는다. 여기에 하드코딩하지 않는다.
 *
 * ★ 일곱 블록이 전부 접힌다(번호 붙은 여섯 + [회신이 오지 않으면]).
 *   지금 이 사람에게 필요한 것만 펼친 채로 시작한다(OPEN_RULE).
 *   내용을 줄이지는 않았다. 확인한 사실을 버리는 것과 읽히게 만드는 것은 다른 문제다.
 */
function Section({ n, title, children, note, summary, defaultOpen }) {
  return (
    <Disclosure n={n} title={title} summary={summary} defaultOpen={defaultOpen}>
      {note && <p className="mb-4 text-gray-600">{note}</p>}
      {children}
    </Disclosure>
  )
}

/**
 * 처음에 어느 섹션을 펼쳐 둘지.
 *
 * ★ 상황에 따라 다르다. 다 펼치면 접기 전과 같아지고,
 *   다 접으면 아무것도 읽히지 않는다.
 *     아직 안 냈다        → "어디로 내나요"
 *     냈다               → "언제 답이 오나요" + "회신이 오지 않으면"
 *     거절 회신을 해석했다 → "거절당하면"
 *   (겹치면 겹치는 대로 둘 다 펼친다. 접힌 것도 제목과 한 줄 요약으로 무슨 내용인지 보인다.)
 */
function openRule({ submitted, refused }) {
  return {
    channels: !submitted,
    contact: false,
    deadline: submitted,
    noReply: submitted,
    methods: false,
    refusal: refused,
    // 거절 회신을 해석하고 왔다면 남은 경로가 지금 필요한 정보다
    postRefusal: refused,
  }
}

export default function Next() {
  const { journey } = useJourney()
  const diagnosis = journey.diagnosis
  const branch = CORRECTION_ROUTING_BY_ID[diagnosis.routingBranchId]

  const submitted = Object.values(journey.milestones ?? {}).some((m) => m?.submittedAt)
  // /response 에서 거절로 판정된 회신을 해석하고 왔는가
  const refused = journey.response?.interpretation?.refused === true
  const open = openRule({ submitted, refused })

  return (
    <div className="space-y-6 py-8">
      <PageHeader
        kicker="이후 절차"
        title="서식을 출력했다면 여기서부터"
        description="법령에 정해진 것과 정해지지 않은 것을 그대로 구분해 알려드립니다."
      />

      {/* 제출 기록이 있으면 맨 위에. 카운트다운은 만들지 않는다 (법령에 기한 규정 없음) */}
      <SubmissionRecord />

      {/* 6. unknown 라우팅이었다면 순서를 먼저 다시 보여준다 */}
      {branch?.requiresPrecedingStep && (
        <Notice title="순서가 있습니다" mark="1">
          <p>정정 대상 정보의 출처를 모르는 경우라, 두 단계로 나눠 진행해야 합니다.</p>
          <ol className="mt-3 space-y-2">
            {branch.steps.map((s) => (
              <li key={s.order}>
                <span className="mr-2 font-bold">{s.order}.</span>
                {s.description}
                <span className="ml-2 inline-block rounded-md bg-white px-2 py-0.5 text-sm">
                  {FORMS_BY_ID[s.formId].title} · {s.rights.join(', ')}
                </span>
              </li>
            ))}
          </ol>
          <p className="mt-3 text-sm">
            1번의 답변으로 출처가 확인되면, 그 정보가 이 회사에서 만들어진 것인지 다른
            금융회사에서 온 것인지에 따라 2번의 제출처가 달라집니다.
          </p>
          <p className="mt-3">
            <Basis prefix="근거">{CORRECTION_ROUTING.basis}</Basis>
          </p>
        </Notice>
      )}

      {/* 1. 제출 채널 */}
      <Section
        n="1."
        title="어디로 내나요"
        summary="법령이 정한 제출 채널 네 가지. 온라인 제출도 허용됩니다."
        defaultOpen={open.channels}
        note="법령이 정한 제출 채널은 아래 네 가지입니다. 온라인 제출도 법적으로 허용됩니다."
      >
        <ul className="grid gap-2 sm:grid-cols-2">
          {EXERCISE_CHANNELS.map((c) => (
            <li key={c.id} className="rounded-md border border-gray-400 p-3">
              <span className="block font-bold text-gray-900">{c.label}</span>
              <span className="mt-2 block">
                <Basis>{c.basis}</Basis>
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-gray-700">
          다만 <b>금융회사마다 실제로 접수하는 창구가 다릅니다.</b> 제출 전에 해당 회사
          고객센터나 홈페이지에서 어느 채널로 받는지 확인하세요.
        </p>
        <p className="mt-3 text-gray-700">
          <Term id="noticedForm">고시 서식</Term> 요건: {EXERCISE_FORM_REQUIREMENT.text}
        </p>
        <p className="mt-2">
          <Basis prefix="근거">{EXERCISE_FORM_REQUIREMENT.basis}</Basis>
        </p>
      </Section>

      {/* 2. 회신 연락처 */}
      <Section
        n="2."
        title="회신은 어디로 받나요"
        summary="고시 서식에 연락처 칸이 없습니다. 여백에 직접 적으셔야 합니다."
        defaultOpen={open.contact}
      >
        <p className="text-gray-700">
          <b>{FORM_CORRECTION_REQUEST.title}</b>에는 연락처 칸이 없습니다. 이 서비스는 고시
          서식에 없는 칸을 임의로 추가하지 않습니다.
        </p>
        <p className="mt-3 text-gray-700">
          그래서 제출하실 때 <b>회신받을 연락처(휴대폰 또는 이메일)를 여백에 함께 기재</b>
          하시거나, 접수 창구에 구두로 알려 주세요. 연락처가 없으면 회신이 지연될 수 있습니다.
        </p>
        <p className="mt-3 text-sm text-gray-600">
          주민등록번호는 이 서비스가 수집하지 않습니다. 서식 1의 해당 칸은 공란으로 출력되니
          출력 후 직접 기재하세요.
        </p>
      </Section>

      {/* 3. 처리 기한 — 법령에 없다는 사실을 그대로 밝힌다 */}
      <Section
        n="3."
        title="언제 답이 오나요"
        summary="처리 기한 규정이 법령에 없습니다. 지어내지 않고 그 사실을 알려드립니다."
        defaultOpen={open.deadline}
      >
        <Notice title="법령에 기한 규정이 없습니다" mark="!">
          <p>{PROCESSING_DEADLINE.uiNotice}</p>
        </Notice>
        <p className="mt-4 text-gray-700">
          사업자는 요구에 따라 필요한 조치를 하고 그 결과를 설명할 의무가 있습니다. 다만
          <b> 며칠 안에 해야 하는지는 법률에도 시행령에도 규정되어 있지 않습니다.</b> 이
          서비스는 확인되지 않은 기한을 지어내지 않습니다.
        </p>
        <p className="mt-3 text-gray-700">{RESPONSE_DUTY.text}</p>
        <p className="mt-2">
          <Basis prefix="근거">{RESPONSE_DUTY.basis}</Basis>
        </p>
      </Section>

      {/* 3-2. 회신이 오지 않을 때 — 기한이 없으므로 실제 문제가 된다 */}
      <NoReply defaultOpen={open.noReply} />

      {/* 4. 어떤 답을 받게 되나 — 기대치 조정 */}
      <Section
        n="4."
        title="어떤 답을 받게 되나요"
        summary="회신 서식과 설명 방법이 법령에 정해져 있습니다. 평가 모델의 내부 로직은 받지 못할 수 있습니다."
        defaultOpen={open.methods}
        note="받게 될 답변의 형태가 법령에 정해져 있습니다. 미리 알고 있으면 실망이 줄어듭니다."
      >
        {/*
          내용(3유형)에 앞서 형식을 먼저 짚는다.
          ★ 서식 본문은 확인하지 못했다. 담는 내용을 설명하지 않는다.
        */}
        <div className="mb-4 rounded-md border border-gray-400 bg-gray-50 p-4">
          <p className="font-bold text-gray-900">회신에도 정해진 서식이 있습니다</p>
          <p className="mt-2 text-gray-700">{RESPONSE_FORM.notice}</p>
          <p className="mt-2 text-gray-700">
            그 서식은 <b>{RESPONSE_FORM.formNo} 「{RESPONSE_FORM.formName}」</b>입니다.
          </p>
          <blockquote className="mt-3 rounded-md border-l-4 border-gray-400 bg-white p-3 text-gray-800">
            {RESPONSE_FORM.ruleText}
          </blockquote>
          <p className="mt-3 text-sm text-gray-600">{RESPONSE_FORM.contentsUnverified}</p>
          <p className="mt-2 text-sm text-gray-600">{RESPONSE_FORM.noVerdictNote}</p>
          <p className="mt-3 flex flex-wrap gap-2">
            <Basis prefix="근거">{RESPONSE_FORM.basis}</Basis>
            <Basis prefix="관련">{RESPONSE_FORM.relatedBasis}</Basis>
          </p>
        </div>

        <ul className="space-y-3">
          {EXPLANATION_METHODS.map((m) => (
            <li key={m.id} className="rounded-md border border-gray-400 p-3">
              <div className="font-bold text-gray-900">
                <Term>{m.label}</Term>
              </div>
              <p className="mt-2 text-gray-700">{m.text}</p>
              {m.creditInfoTypes && (
                <p className="mt-2 text-sm text-gray-600">
                  신용정보 종류: {m.creditInfoTypes.join(' / ')}
                </p>
              )}
              {m.proviso && (
                <div className="mt-3 rounded-md border border-amber-400 bg-amber-50 p-3">
                  <p className="font-bold text-amber-900">{m.proviso}</p>
                  <p className="mt-2 text-sm text-amber-900">
                    금융회사가 <b>직접 입수한</b> 정보는 받을 수 있지만, 금융회사가 자체적으로
                    가공하거나 추론해 만든 정보는 제외될 수 있습니다. 즉{' '}
                    <b>평가 모델의 내부 로직 자체는 받지 못할 가능성이 높습니다.</b> 이것이 이
                    제도의 실질적인 한계입니다.
                  </p>
                </div>
              )}
              <p className="mt-3 flex flex-wrap gap-2">
                <Basis prefix="근거">{m.basis}</Basis>
                <Basis prefix="관련">{m.relatedRightBasis}</Basis>
              </p>
            </li>
          ))}
        </ul>
      </Section>

      {/* 5. 거절당하면 */}
      <Section
        n="5."
        title="거절당하면"
        summary="법령이 정한 거절 사유 네 가지. 이 외의 이유로는 거절할 수 없습니다."
        defaultOpen={open.refusal}
        note="법령이 정한 거절 사유는 아래 네 가지입니다. 이 외의 이유로는 거절할 수 없습니다."
      >
        <ul className="space-y-3">
          {REFUSAL_GROUNDS.map((d) => (
            <li key={d.id} className="rounded-md border border-gray-400 p-3">
              <div className="font-bold text-gray-900">{d.text}</div>
              <p className="mt-2 text-gray-700">{d.description}</p>
              <p className="mt-2">
                <Basis chain prefix="근거 체인">
                  {d.basisChain}
                </Basis>
              </p>
              {d.uiCaution && (
                <p className="mt-3 rounded-md bg-amber-50 p-2 text-sm text-amber-900">
                  <span aria-hidden="true">※ </span>
                  횟수만으로 자동 거절되는 것이 아닙니다. &ldquo;정당한 사유 없이&rdquo;가 함께
                  요구되는 요건입니다.
                </p>
              )}
            </li>
          ))}
        </ul>

        <div className="mt-4 panel">
          <p className="font-bold text-gray-900">거절당해도 이유를 들을 권리가 있습니다</p>
          <p className="mt-2 text-gray-700">{REFUSAL_NOTICE_DUTY.text}</p>
          <p className="mt-2">
            <Basis prefix="근거">{REFUSAL_NOTICE_DUTY.basis}</Basis>
          </p>
        </div>
      </Section>

      {/* 6. 거절당한 뒤에 남은 경로 — 조문으로 확인한 것만 */}
      <PostRefusal defaultOpen={open.postRefusal} />

      <div className="rounded-lg border-2 border-ink-700 bg-white p-5">
        <h2 className="text-lg font-bold text-gray-900">회신을 받으셨나요?</h2>
        <p className="mt-2 text-gray-700">
          금융회사가 보낸 회신을 붙여넣으면 무엇을 받았고 무엇이 빠졌는지 확인해 드립니다.
          틀린 <Term id="baseInfo">기초정보</Term>를 찾으면 정정·삭제 요구서로 바로 이어집니다.
        </p>
        <Link to="/response" className="btn btn-primary mt-4">
          회신 해석하러 가기
        </Link>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link to="/document" className="btn btn-secondary">
          서식으로 돌아가기
        </Link>
        <Link to="/" className="btn btn-quiet">
          처음으로
        </Link>
      </div>

      <p className="text-sm text-gray-500">
        {LAW_META.act.name} {LAW_META.act.article} / {LAW_META.decree.name}{' '}
        {LAW_META.decree.article} 기준. 법률 자문이 아닙니다.
      </p>
    </div>
  )
}
