import { useState } from 'react'
import { useSearchParams, Link } from 'react-router-dom'
import {
  FORM_EXPLANATION_REQUEST,
  FORM_CORRECTION_REQUEST,
  FORM_REQUEST_ITEMS,
  FORM_SECTION1_REFUSAL_NOTICE,
  FORM_SECTION1_DISCREPANCY,
  FORM1_TEXTS,
  FORM1_APPLICANT_FIELDS,
  FORM_SIGNATURE_TEXTS,
  BASE_INFO_CATEGORIES,
  CORRECTION_ROUTING_BY_ID,
  INSTITUTION_OPTIONS,
  RIGHTS_BY_ID,
} from '../data/law.js'
import { useDiagnosis } from '../lib/diagnosis-context.jsx'
import { neutralizeInstitution } from '../lib/neutralize.js'

/* ── 공용 조각 ───────────────────────────────────────────────── */

/**
 * 체크박스.
 * 브라우저 기본 체크박스는 인쇄 시 체크 표시가 빠지거나 컬러로 나오므로,
 * 인쇄에서는 테두리 + 체크문자 글리프로 바꿔 출력한다. 값은 하나를 공유한다.
 */
function Checkbox({ checked, onChange, disabled, children }) {
  return (
    <label className={`flex items-start gap-2 ${disabled ? 'text-gray-400' : 'cursor-pointer'}`}>
      <input
        type="checkbox"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 print:hidden"
      />
      <span className="mt-0.5 hidden h-3 w-3 shrink-0 items-center justify-center border border-black text-[9px] leading-none text-black print:inline-flex">
        {checked ? '✓' : ''}
      </span>
      <span>{children}</span>
    </label>
  )
}

/**
 * 서식 입력칸.
 * <input> 은 넘치는 글자를 인쇄에서 잘라먹으므로, 인쇄 시에는 같은 값을
 * 줄바꿈되는 span 으로 바꿔 출력한다. 화면용/인쇄용 DOM 을 두 벌로 두지 않기 위해
 * 같은 값을 공유하고 표시만 전환한다.
 */
function Field({ value, onChange, placeholder, className = '' }) {
  return (
    <>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={`${className} outline-none placeholder:text-gray-300 print:hidden`}
      />
      <span className="hidden whitespace-pre-wrap break-words print:inline">{value}</span>
    </>
  )
}

/** 인쇄되는 서식 본문 껍데기 */
function Sheet({ title, subtitle, children }) {
  return (
    <article className="print-sheet rounded border bg-white p-6 print:rounded-none print:border-0 print:p-0">
      <h2 className="text-center text-lg font-bold print:text-base">{title}</h2>
      {subtitle && <p className="text-center text-sm">{subtitle}</p>}
      <div className="mt-5 space-y-4 print:mt-2 print:space-y-2">{children}</div>
    </article>
  )
}

/** 서명란 — 날짜 표기는 두되 서명은 반드시 공란 */
function SignatureBlock() {
  return (
    <div className="pt-6 text-right text-sm print:pt-2">
      <p>{FORM_SIGNATURE_TEXTS.dateMark}</p>
      <p className="mt-2 whitespace-nowrap">
        {FORM_SIGNATURE_TEXTS.applicantLabel}
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        {FORM_SIGNATURE_TEXTS.signatureMark}
      </p>
    </div>
  )
}

/** 사용자 입력이 들어가는 밑줄 칸 */
function Blank({ value }) {
  return (
    <span className="inline-block min-w-32 border-b border-gray-500 px-1 text-center">
      {value || ' '}
    </span>
  )
}

/* ── 서식 1 : 자동화평가 결과에 대한 설명요구서 (R1, R2) ────────── */

function Form1({ selectedItems, toggleItem, personal, setPersonal, consent, setConsent, hopeResult, setHopeResult }) {
  return (
    <Sheet title={FORM_EXPLANATION_REQUEST.title} subtitle={FORM_EXPLANATION_REQUEST.subtitle}>
      <section>
        <h3 className="font-semibold">1. {FORM1_TEXTS.overviewTitle}</h3>
        <p className="mt-1 text-sm">{FORM1_TEXTS.overviewBody}</p>
        <p className="mt-2 text-sm">{FORM1_TEXTS.refusalLead}</p>
        {/* 고시 서식의 고정 안내문. 원문 그대로 렌더링한다 (verbatim). 문구 수정 금지. */}
        <ul className="mt-1 list-disc pl-5 text-sm">
          {FORM_SECTION1_REFUSAL_NOTICE.items.map((t) => (
            <li key={t}>{t}</li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-semibold">2. {FORM1_TEXTS.requestSectionTitle}</h3>
        <p className="mt-1 text-sm">
          <Blank value={personal.name} />
          {FORM1_TEXTS.requestLeadBefore}
          {FORM1_TEXTS.requestLeadAfter}
        </p>
        <ul className="mt-2 space-y-1 text-sm">
          {FORM_REQUEST_ITEMS.map((it) => (
            <li key={it.id}>
              <Checkbox checked={selectedItems.includes(it.id)} onChange={() => toggleItem(it.id)}>
                {it.marker} {it.label}
              </Checkbox>
              {/* ①의 부기란. 작성 시점에 모를 수 있으므로 필수 입력이 아니다. */}
              {it.annotationLabel && selectedItems.includes(it.id) && (
                <div className="mt-1 pl-6 text-sm">
                  ({it.annotationLabel} :{' '}
                  <Field
                    value={hopeResult}
                    onChange={setHopeResult}
                    placeholder={it.annotationHint}
                    className="w-64 border-b border-gray-400 px-1"
                  />
                  )
                </div>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3 className="font-semibold">3. {FORM1_TEXTS.applicantSectionTitle}</h3>
        <table className="mt-1 w-full border-collapse text-sm">
          <tbody>
            {FORM1_APPLICANT_FIELDS.map((f) => (
              <tr key={f.id}>
                <th className="w-28 border p-1 text-left">{f.label}</th>
                <td className="border p-1">
                  {f.input ? (
                    <Field
                      value={personal[f.id] ?? ''}
                      onChange={(v) => setPersonal(f.id, v)}
                      className="w-full"
                    />
                  ) : (
                    <>
                      {/* 입력받지 않는다. 공란으로 출력하고 직접 기재하게 한다. */}
                      <span className="tracking-widest">{f.placeholderMark}</span>
                      <span className="ml-3 text-xs text-gray-600">({f.note})</span>
                    </>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className="text-sm">
        <p>{FORM1_TEXTS.consentText}</p>
        {/* 기본값을 우리가 정하지 않는다. 둘 다 비워둔 상태로 출력해도 무방하다. */}
        <div className="mt-1 flex justify-end gap-6">
          <Checkbox
            checked={consent === 'agree'}
            onChange={() => setConsent(consent === 'agree' ? null : 'agree')}
          >
            {FORM1_TEXTS.consentAgreeLabel}
          </Checkbox>
          <Checkbox
            checked={consent === 'disagree'}
            onChange={() => setConsent(consent === 'disagree' ? null : 'disagree')}
          >
            {FORM1_TEXTS.consentDisagreeLabel}
          </Checkbox>
        </div>
      </section>

      <SignatureBlock />
    </Sheet>
  )
}

/* ── 서식 2 : 기초정보 정정·삭제 및 자동화평가 재산출 요청서 (R3~R5) ── */

function Form2({ enabled, personal, setPersonal, rows, setRow, favorable, setFavorable, recipient, setRecipient, needsRecipient, institutionShortLabel, s2HasContent }) {
  const [s1, s2, s3, s4] = FORM_CORRECTION_REQUEST.sections
  const s4Blocked = Boolean(s4.dependsOn) && !s2HasContent

  return (
    <Sheet title={FORM_CORRECTION_REQUEST.title} subtitle={FORM_CORRECTION_REQUEST.subtitle}>
      {/* 서식 원문에는 없는 칸. other 분기에서 수신처가 이 회사와 달라지므로 필요하다. */}
      {needsRecipient && (
        <section className="text-sm">
          <span className="font-semibold">수신 기관 : </span>
          <Field
            value={recipient}
            onChange={setRecipient}
            placeholder="정정 대상 정보가 발생한 금융회사명"
            className="w-72 border-b border-gray-500 px-1"
          />
        </section>
      )}

      <section>
        <h3 className="font-semibold">1. {s1.title}</h3>
        {/* 원문 전문(verbatimText) 확보 시 그걸 쓰고, 기관명만 중립적으로 치환한다. */}
        {/* 기관명("저축은행")만 업권 shortLabel 로 치환한다. "당사"는 건드리지 않는다. */}
        <p className="mt-1 whitespace-pre-line text-sm">
          {neutralizeInstitution(s1.verbatimText, s1.substitution, institutionShortLabel)}
        </p>
      </section>

      {enabled.s2 && (
        <section>
          <h3 className="font-semibold">
            2. {s2.title} <span className="text-xs font-normal">({s2.basis})</span>
          </h3>
          <p className="mt-1 text-sm">
            <Blank value={personal.name} />
            {neutralizeInstitution(s2.leadRest, s1.substitution, institutionShortLabel)}
          </p>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr>
                {s2.table.columns.map((c) => (
                  <th key={c.id} className="border p-1">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* "구 분" 행은 5종 고정. 해당 없는 분류는 비워둔다. */}
              {BASE_INFO_CATEGORIES.map((cat) => (
                <tr key={cat.id}>
                  <th className="w-36 border p-1 text-left font-normal align-top">
                    {cat.label}
                    {/* 법정 예시 힌트. 화면 전용이라 인쇄에는 나가지 않는다. */}
                    <details className="no-print mt-1 font-normal">
                      <summary className="cursor-pointer text-xs text-gray-500">
                        무엇을 적나요?
                      </summary>
                      <ul className="mt-1 list-disc pl-4 text-xs text-gray-600">
                        {cat.examples.map((ex) => (
                          <li key={ex}>{ex}</li>
                        ))}
                      </ul>
                      <p className="mt-1 text-[10px] text-gray-400">{cat.definitionBasis}</p>
                    </details>
                  </th>
                  <td className="border p-1">
                    <Field
                      value={rows[cat.id]?.current ?? ''}
                      onChange={(v) => setRow(cat.id, 'current', v)}
                      className="w-full"
                    />
                  </td>
                  <td className="border p-1">
                    <Field
                      value={rows[cat.id]?.correction ?? ''}
                      onChange={(v) => setRow(cat.id, 'correction', v)}
                      className="w-full"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {enabled.s3 && (
        <section>
          <h3 className="font-semibold">
            3. {s3.title} <span className="text-xs font-normal">({s3.basis})</span>
          </h3>
          <p className="mt-1 text-sm">
            {s3.headerText} <span className="text-xs">{s3.headerNote}</span>
          </p>
          <table className="mt-2 w-full border-collapse text-sm">
            <thead>
              <tr>
                {s3.table.columns.map((c) => (
                  <th key={c.id} className="border p-1">
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {/* 지금은 빈 표다. /strategy 연결은 다음 단계. */}
              {favorable.map((row, i) => (
                <tr key={i}>
                  <td className="w-1/3 border p-1">
                    <Field
                      value={row.infoName}
                      onChange={(v) => setFavorable(i, 'infoName', v)}
                      placeholder={i === 0 ? s3.table.example.infoName : ''}
                      className="w-full"
                    />
                  </td>
                  <td className="border p-1">
                    <Field
                      value={row.detail}
                      onChange={(v) => setFavorable(i, 'detail', v)}
                      placeholder={i === 0 ? s3.table.example.detail : ''}
                      className="w-full"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}

      {/* s4 는 s2 에 의존한다. 정정할 내용이 없으면 재산출 요구도 성립하지 않는다. */}
      {enabled.s4 && !s4Blocked && (
        <section>
          <h3 className="font-semibold">
            4. {s4.title} <span className="text-xs font-normal">({s4.basis})</span>
          </h3>
          <p className="mt-1 text-sm">{s4.fixedText}</p>
        </section>
      )}

      <section className="text-sm">
        <p>※ {FORM_CORRECTION_REQUEST.attachment.label}</p>
      </section>

      <SignatureBlock />
    </Sheet>
  )
}

/* ── 화면 ────────────────────────────────────────────────────── */

export default function Document() {
  const { diagnosis } = useDiagnosis()
  const branch = CORRECTION_ROUTING_BY_ID[diagnosis.routingBranchId]
  const sector = INSTITUTION_OPTIONS.find((o) => o.id === diagnosis.institutionSectorId)
  /**
   * 서식 본문 치환값은 업권 shortLabel 이다.
   * 직접 입력한 기관명(customInstitution)이나 수신 기관 입력값을 쓰지 않는다.
   * 서식 원문의 그 자리는 회사명이 아니라 업권명 자리이기 때문이다.
   */
  const institutionShortLabel = sector?.shortLabel ?? null

  // 라우팅이 unknown 이면 서식 1이 선행 단계이므로 서식 1 탭에서 시작한다.
  // ?form=<서식 id> 로 특정 서식을 바로 열 수 있다.
  const [params] = useSearchParams()
  const [tab, setTab] = useState(
    params.get('form') === FORM_CORRECTION_REQUEST.id
      ? FORM_CORRECTION_REQUEST.id
      : FORM_EXPLANATION_REQUEST.id,
  )

  // 서식 1 — unknown 분기는 선행 단계가 지정한 요청 항목(기초정보의 개요)을 미리 선택한다.
  /**
   * 서식 1 요청 항목.
   * /response 에서 "설명되지 않음"으로 판정된 유형이 있으면 그것만 선택된 상태로 시작한다.
   * 없으면 라우팅 선행 단계가 지정한 항목을 쓴다.
   */
  const [selectedItems, setSelectedItems] = useState(
    (diagnosis.missingRequestItems ?? []).length > 0
      ? diagnosis.missingRequestItems
      : (branch?.steps?.[0]?.requestItemIds ?? []),
  )
  const [hopeResult, setHopeResult] = useState('')
  const [consent, setConsent] = useState(null)

  // 인적사항은 브라우저 메모리에만 둔다. 서버로 보내지 않는다.
  const [personal, setPersonalState] = useState({ name: '', phone: '', email: '' })
  const setPersonal = (k, v) => setPersonalState((p) => ({ ...p, [k]: v }))

  // 서식 2
  const [enabled, setEnabled] = useState({ s2: true, s3: true, s4: true })
  /**
   * 섹션 2 정정·삭제 표.
   * /response 에서 "사실과 다르다"고 표시한 항목이 "현행 정보" 칸으로 들어온다.
   * "정정 또는 삭제 내용" 칸은 사용자가 직접 채운다.
   * 같은 분류에 여러 건이면 줄바꿈으로 합친다.
   */
  const [rows, setRows] = useState(() => {
    const init = {}
    for (const r of diagnosis.correctionRows ?? []) {
      const prev = init[r.categoryId]?.current
      init[r.categoryId] = { current: prev ? `${prev}\n${r.current}` : r.current, correction: '' }
    }
    return init
  })
  /**
   * 섹션 3은 /strategy 에서 고른 후보로 채워진다.
   * 아직 안 거쳤으면 빈 표 3행으로 시작한다.
   */
  const [favorable, setFavorable] = useState(() => {
    const picked = (diagnosis.selectedCandidates ?? []).map((c) => ({
      infoName: c['정보명'] ?? '',
      detail: c['세부내용'] ?? '',
    }))
    const blanks = Math.max(0, 3 - picked.length)
    return [...picked, ...Array.from({ length: blanks }, () => ({ infoName: '', detail: '' }))]
  })
  const [recipient, setRecipient] = useState('')

  const s2HasContent = Object.values(rows).some(
    (r) => (r?.current ?? '').trim() || (r?.correction ?? '').trim(),
  )

  const toggleItem = (id) =>
    setSelectedItems((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const setRow = (catId, field, value) =>
    setRows((prev) => ({ ...prev, [catId]: { ...prev[catId], [field]: value } }))
  const setFavorableCell = (i, field, value) =>
    setFavorable((prev) => prev.map((r, idx) => (idx === i ? { ...r, [field]: value } : r)))

  const s4 = FORM_CORRECTION_REQUEST.sections[3]
  const isForm1 = tab === FORM_EXPLANATION_REQUEST.id

  return (
    <div className="space-y-5 py-6">
      <header className="no-print space-y-1">
        <h1 className="text-2xl font-bold">서식 생성</h1>
        <p className="text-sm text-gray-600">
          화면에서 채운 내용이 그대로 인쇄됩니다. 서버로 전송하지 않으며 새로고침하면 사라집니다.
        </p>
      </header>

      {branch?.requiresPrecedingStep && (
        <div className="no-print rounded border border-amber-300 bg-amber-50 p-3 text-sm">
          <p className="font-medium">순서가 있습니다.</p>
          <ol className="mt-1 space-y-1">
            {branch.steps.map((st) => (
              <li key={st.order}>
                {st.order}. {st.description}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="no-print flex flex-wrap gap-2">
        {[FORM_EXPLANATION_REQUEST, FORM_CORRECTION_REQUEST].map((f, i) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setTab(f.id)}
            className={`rounded border px-4 py-2 text-left text-sm ${
              tab === f.id ? 'border-gray-900 bg-gray-900 text-white' : 'hover:bg-gray-50'
            }`}
          >
            서식 {i + 1} · {f.title}
            <span className="ml-2 text-xs opacity-80">{f.coveredRights.join(', ')}</span>
          </button>
        ))}
      </div>

      {/* 서식 밖 안내. 인쇄되는 서식 본문에는 넣지 않는다 (renderOutsideFormOnly). */}
      {isForm1 && (
        <div className="no-print rounded border bg-gray-50 p-3 text-sm">
          <p className="font-medium">고시 서식 안내문에 대한 보충</p>
          <p className="mt-1">{FORM_SECTION1_DISCREPANCY.correction}</p>
          <p className="mt-1 text-xs text-gray-500">
            근거 체인: {FORM_SECTION1_DISCREPANCY.basisChain}
          </p>
        </div>
      )}

      {!isForm1 && (
        <div className="no-print space-y-2 rounded border bg-gray-50 p-3 text-sm">
          <p className="font-medium">넣을 섹션을 고르세요</p>
          {FORM_CORRECTION_REQUEST.sections
            .filter((sec) => sec.toggleable)
            .map((sec) => {
              const blocked = Boolean(sec.dependsOn) && !s2HasContent
              return (
                <div key={sec.id}>
                  <Checkbox
                    checked={enabled[sec.id] && !blocked}
                    disabled={blocked}
                    onChange={(v) => setEnabled((p) => ({ ...p, [sec.id]: v }))}
                  >
                    {sec.title} — {RIGHTS_BY_ID[sec.right].label}{' '}
                    <span className="text-xs text-gray-500">({sec.basis})</span>
                  </Checkbox>
                  {blocked && <p className="pl-6 text-xs text-amber-700">{sec.dependsOn.message}</p>}
                </div>
              )
            })}
          {(diagnosis.correctionRows ?? []).length > 0 && (
            <p className="text-xs text-gray-600">
              회신 해석에서 표시하신 {diagnosis.correctionRows.length}건이 섹션 2의 &ldquo;현행
              정보&rdquo; 칸에 채워졌습니다. &ldquo;정정 또는 삭제 내용&rdquo;은 직접 적어
              주세요.
            </p>
          )}
          {(diagnosis.selectedCandidates ?? []).length > 0 && (
            <p className="text-xs text-gray-600">
              대응 전략에서 고른 {diagnosis.selectedCandidates.length}개 항목이 섹션 3에
              채워졌습니다. 세부 수치는 직접 확인해 수정하세요.
            </p>
          )}
          {!FORM_CORRECTION_REQUEST.sections[0].verbatimVerified && (
            <p className="border-t pt-2 text-xs text-amber-700">
              섹션 1 원문은 확보했으나 아직 원본과 대조하지 않았습니다. 제출 전 실물 서식과
              대조해 주세요.
            </p>
          )}
          <p className="text-xs text-gray-500">{FORM_CORRECTION_REQUEST.attachment.rationale}</p>
        </div>
      )}

      {isForm1 ? (
        <Form1
          selectedItems={selectedItems}
          toggleItem={toggleItem}
          personal={personal}
          setPersonal={setPersonal}
          consent={consent}
          setConsent={setConsent}
          hopeResult={hopeResult}
          setHopeResult={setHopeResult}
        />
      ) : (
        <Form2
          enabled={enabled}
          personal={personal}
          setPersonal={setPersonal}
          rows={rows}
          setRow={setRow}
          favorable={favorable}
          setFavorable={setFavorableCell}
          recipient={recipient}
          setRecipient={setRecipient}
          needsRecipient={Boolean(branch?.requiresRecipientInput)}
          institutionShortLabel={institutionShortLabel}
          s2HasContent={s2HasContent}
        />
      )}

      <div className="no-print flex flex-wrap items-center gap-3">
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded bg-gray-900 px-5 py-3 text-white hover:bg-gray-700"
        >
          인쇄 / PDF로 저장
        </button>
        <Link to="/next" className="rounded border px-5 py-3 hover:bg-gray-50">
          출력했다면, 이후 절차 보기
        </Link>
        <p className="text-xs text-gray-500">
          인쇄 대화상자에서 용지를 A4, 배율 100%로 두세요. 지금 보고 있는 서식만 인쇄됩니다.
        </p>
      </div>
      {/* s4 의존 규칙 근거를 화면에도 남긴다 */}
      {!isForm1 && s4.dependsOn && (
        <p className="no-print text-xs text-gray-500">{s4.dependsOn.message}</p>
      )}
    </div>
  )
}
