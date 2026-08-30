import { useEffect, useRef, useState } from 'react'
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
  BASE_INFO_CATEGORIES_BY_ID,
  CORRECTION_ROUTING_BY_ID,
  INSTITUTION_OPTIONS,
  RIGHTS_BY_ID,
  COUNTERPARTY_TYPES,
  COUNTERPARTY_TYPES_BY_ID,
} from '../data/law.js'
import { useJourney } from '../lib/diagnosis-context.jsx'
import { STORAGE_FACTS } from '../data/privacy.js'
import { neutralizeInstitution } from '../lib/neutralize.js'
import { PageHeader, Basis, Notice } from '../components/ui.jsx'
import { Term } from '../components/Term.jsx'
import EmailDraft from '../components/EmailDraft.jsx'
import {
  PrintSetupNotice,
  PrePrintPanel,
  usePrintAck,
  pageCountUncertain,
} from '../components/PrintSetup.jsx'
import { preflightIssues } from '../lib/preflight.js'
import { usePrintScale, PRINT_SCALES } from '../lib/print-scale.js'
import PagedSheet from '../components/PagedSheet.jsx'
import SheetHeightProbe from '../components/SheetHeightProbe.jsx'
import { useSheetMode } from '../lib/sheet-mode.js'
import { BackupPanel, STORAGE_SCOPE_TEXT } from '../components/Journey.jsx'
import CaseSwitcher, { Form2CaseSwitcher, TwoFormsNote } from '../components/CaseSwitcher.jsx'
import { Plain } from '../lib/plain.jsx'
import { formatWhen, formatDate, todayInputValue } from '../lib/journey-storage.js'

/* ── 공용 조각 ───────────────────────────────────────────────── */

/**
 * 체크박스.
 * 브라우저 기본 체크박스는 인쇄 시 체크 표시가 빠지거나 컬러로 나오므로,
 * 인쇄에서는 테두리 + 체크문자 글리프로 바꿔 출력한다. 값은 하나를 공유한다.
 */
function Checkbox({ checked, onChange, disabled, children }) {
  const measuring = useSheetMode() === 'measure'
  return (
    <label className={`flex items-start gap-2 ${disabled ? 'text-gray-400' : 'cursor-pointer'}`}>
      {!measuring && (
        <input
          type="checkbox"
          checked={checked}
          disabled={disabled}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-1 print:hidden"
        />
      )}
      <span
        className={`mt-0.5 h-3 w-3 shrink-0 items-center justify-center border border-black text-[9px] leading-none text-black print:inline-flex ${
          measuring ? 'inline-flex' : 'hidden'
        }`}
      >
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
 *
 * 포커스 링을 지우지 않는다. index.css 의 :focus-visible 이 표시한다.
 */
/**
 * ★ label 은 필수다.
 *   서식의 칸은 표의 행·열 제목으로만 뜻이 정해져 있어, 눈으로 보면 알 수 있지만
 *   스크린리더로는 "편집 창"이라고만 읽힌다. 어느 칸인지 함께 읽히게 한다.
 */
function Field({ value, onChange, placeholder, label, className = '' }) {
  const measuring = useSheetMode() === 'measure'
  // 측정 영역에는 인쇄에 실제로 나가는 모양(줄바꿈되는 span)만 그린다.
  // 입력칸을 그대로 두면 여러 줄로 접히는 긴 값의 높이를 놓친다.
  if (measuring) {
    return <span className="inline whitespace-pre-wrap break-words">{value}</span>
  }
  return (
    <>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={label}
        className={`${className} placeholder:text-gray-500 print:hidden`}
      />
      <span className="hidden whitespace-pre-wrap break-words print:inline">{value}</span>
    </>
  )
}

/**
 * 인쇄되는 서식 본문 껍데기.
 *
 * ★ 측정 모드에서는 `print:` 변형과 **같은 값**을 직접 쓴다.
 *   측정 영역은 화면 미디어에서 그려지므로 print: 변형이 걸리지 않는다.
 *   화면용 여백(p-6, mt-5, space-y-4)이 그대로 재이면 쪽 수를 과대평가한다.
 *   실제로 그 때문에 큰 글씨에서 1쪽짜리를 2쪽으로 예고했다.
 */
function Sheet({ title, subtitle, children }) {
  const measuring = useSheetMode() === 'measure'
  return (
    <article
      className={`print-sheet bg-white ${
        measuring ? 'rounded-none border-0 p-0' : 'rounded border p-6'
      } print:rounded-none print:border-0 print:p-0`}
    >
      <h2
        data-sheet-head
        className={`text-center font-bold ${measuring ? 'text-base' : 'text-lg'} print:text-base`}
      >
        {title}
      </h2>
      {subtitle && <p className="text-center text-sm">{subtitle}</p>}
      <div
        data-sheet-body
        className={`${measuring ? 'mt-2 space-y-2' : 'mt-5 space-y-4'} print:mt-2 print:space-y-2`}
      >
        {children}
      </div>
    </article>
  )
}

/**
 * 서명란 — 날짜 표기는 두되 서명은 반드시 공란.
 * paged=true 면 위 여백을 블록 간격에 맡긴다 (측정과 인쇄가 어긋나지 않게).
 *
 * mark 는 서식별 원문 표기다. 서식 2는 원본 대조에서 "(서명 / 인)" 임을 확인했고,
 * 서식 1은 원본 대조를 하지 않았으므로 공용 기본값을 그대로 쓴다.
 */
function SignatureBlock({ paged = false, mark = FORM_SIGNATURE_TEXTS.signatureMark }) {
  const measuring = useSheetMode() === 'measure'
  return (
    <div
      className={`text-right text-sm ${
        paged ? '' : measuring ? 'pt-2' : 'pt-6 print:pt-2'
      }`}
    >
      <p>{FORM_SIGNATURE_TEXTS.dateMark}</p>
      <p className="mt-2 whitespace-nowrap">
        {FORM_SIGNATURE_TEXTS.applicantLabel}
        &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;
        {mark}
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
                    label={it.annotationLabel}
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
                      label={f.label}
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

/**
 * 서식 2 를 **블록 목록**으로 만든다.
 *
 * 왜 통짜 JSX 가 아니라 블록인가:
 *   정정할 항목이 많은 사용자는 이 서식이 두 장이 된다. 그 사람이 이 서비스를
 *   가장 필요로 하는 사람이므로 내용을 잘라내지 않는다. 대신 페이지를 제대로 나눈다.
 *   페이지 번호 "- N / M -" 의 M 을 알려면 우리가 직접 나눠야 하고(paginate.js),
 *   그러려면 서식이 "쪼갤 수 있는 단위"로 표현돼 있어야 한다.
 *
 * 블록 규칙:
 *   group        — 같은 표에 속하는 행. 페이지가 갈리면 열 이름(thead)이 다시 붙는다.
 *   keepWithNext — 섹션 제목. 첫 행과 떨어져 페이지 하단에 홀로 남지 않게 한다.
 *   keepWithPrev — 서명란. 홀로 다음 장으로 넘어가지 않게 앞 블록과 붙인다.
 */
function form2Blocks({
  enabled,
  personal,
  rows,
  setRow,
  favorable,
  setFavorable,
  recipient,
  setRecipient,
  needsRecipient,
  institutionShortLabel,
  s2HasContent,
}) {
  const [s1, s2, s3, s4] = FORM_CORRECTION_REQUEST.sections
  const s4Blocked = Boolean(s4.dependsOn) && !s2HasContent

  const blocks = []
  const groups = []

  // 서식 원문에는 없는 칸. other 분기에서 수신처가 이 회사와 달라지므로 필요하다.
  if (needsRecipient) {
    blocks.push({
      id: 'recipient',
      node: (
        <section className="text-sm">
          <span className="font-semibold">수신 기관 : </span>
          <Field
            value={recipient}
            onChange={setRecipient}
            placeholder="정정 대상 정보가 발생한 금융회사명"
            label="수신 기관"
            className="w-72 border-b border-gray-500 px-1"
          />
        </section>
      ),
    })
  }

  // 섹션 1 안내문. 첫 블록이므로 자연히 1페이지에만 놓인다. 뒤 페이지에 반복하지 않는다.
  blocks.push({
    id: 's1',
    node: (
      <section>
        <h3 className="font-semibold">1. {s1.title}</h3>
        {/* 원문 전문(verbatimText) 확보 시 그걸 쓰고, 기관명만 중립적으로 치환한다. */}
        {/* 기관명("저축은행")만 업권 shortLabel 로 치환한다. "당사"는 건드리지 않는다. */}
        <p className="mt-1 whitespace-pre-line text-sm">
          {neutralizeInstitution(s1.verbatimText, s1.substitution, institutionShortLabel)}
        </p>
      </section>
    ),
  })

  if (enabled.s2) {
    // ★ table-fixed + 명시 너비.
    //   표가 페이지를 넘어가면 장마다 <table> 이 새로 생기는데, auto 레이아웃이면
    //   장마다 열 너비가 내용에 따라 달라져 같은 표로 보이지 않는다.
    const S2_WIDTHS = ['22%', '39%', '39%']
    groups.push({
      id: 'S2',
      tableClassName: 'w-full table-fixed border-collapse text-sm',
      columns: s2.table.columns.map((c, i) => ({
        id: c.id,
        label: c.label,
        className: 'border p-1',
        style: { width: S2_WIDTHS[i] },
      })),
    })
    blocks.push({
      id: 's2-head',
      keepWithNext: true,
      node: (
        <section>
          <h3 className="font-semibold">
            2. {s2.title} <span className="text-xs font-normal">({s2.basis})</span>
          </h3>
          <p className="mt-1 text-sm">
            <Blank value={personal.name} />
            {neutralizeInstitution(s2.leadRest, s1.substitution, institutionShortLabel)}
          </p>
        </section>
      ),
    })
    // "구 분" 행은 5종 고정. 해당 없는 분류는 비워둔다.
    for (const cat of BASE_INFO_CATEGORIES) {
      // 서식에 인쇄되는 라벨은 원문 표기(formLabel)를 쓴다. 화면 용어(label)와 별개다.
      const formLabel = cat.formLabel ?? cat.label
      blocks.push({
        id: `s2-${cat.id}`,
        group: 'S2',
        node: (
          <tr key={cat.id}>
            <th className="border p-1 text-left align-top font-normal">
              {formLabel}
              {/* 법정 예시 힌트. 화면 전용이라 인쇄에는 나가지 않는다. */}
              <details className="no-print mt-1 font-normal">
                <summary className="cursor-pointer text-xs text-gray-500">무엇을 적나요?</summary>
                <ul className="mt-1 list-disc pl-4 text-xs text-gray-600">
                  {cat.examples.map((ex) => (
                    <li key={ex}>{ex}</li>
                  ))}
                </ul>
                <p className="mt-1 text-[10px] text-gray-500">{cat.definitionBasis}</p>
              </details>
            </th>
            <td className="border p-1">
              <Field
                value={rows[cat.id]?.current ?? ''}
                onChange={(v) => setRow(cat.id, 'current', v)}
                label={`${formLabel} — ${s2.table.columns[1].label}`}
                className="w-full"
              />
            </td>
            <td className="border p-1">
              <Field
                value={rows[cat.id]?.correction ?? ''}
                onChange={(v) => setRow(cat.id, 'correction', v)}
                label={`${formLabel} — ${s2.table.columns[2].label}`}
                className="w-full"
              />
            </td>
          </tr>
        ),
      })
    }
  }

  if (enabled.s3) {
    const S3_WIDTHS = ['33%', '67%']
    groups.push({
      id: 'S3',
      tableClassName: 'w-full table-fixed border-collapse text-sm',
      columns: s3.table.columns.map((c, i) => ({
        id: c.id,
        label: c.label,
        className: 'border p-1',
        style: { width: S3_WIDTHS[i] },
      })),
    })
    blocks.push({
      id: 's3-head',
      keepWithNext: true,
      node: (
        <section>
          <h3 className="font-semibold">
            3. {s3.title} <span className="text-xs font-normal">({s3.basis})</span>
          </h3>
          <p className="mt-1 text-sm">
            {s3.headerText} <span className="text-xs">{s3.headerNote}</span>
          </p>
        </section>
      ),
    })
    favorable.forEach((row, i) => {
      blocks.push({
        id: `s3-${i}`,
        group: 'S3',
        node: (
          <tr key={i}>
            <td className="border p-1">
              <Field
                value={row.infoName}
                onChange={(v) => setFavorable(i, 'infoName', v)}
                placeholder={i === 0 ? s3.table.example.infoName : ''}
                label={`${i + 1}번째 ${s3.table.columns[0].label}`}
                className="w-full"
              />
            </td>
            <td className="border p-1">
              <Field
                value={row.detail}
                onChange={(v) => setFavorable(i, 'detail', v)}
                placeholder={i === 0 ? s3.table.example.detail : ''}
                label={`${i + 1}번째 ${s3.table.columns[1].label}`}
                className="w-full"
              />
            </td>
          </tr>
        ),
      })
    })
  }

  // s4 는 s2 에 의존한다. 정정할 내용이 없으면 재산출 요구도 성립하지 않는다.
  if (enabled.s4 && !s4Blocked) {
    blocks.push({
      id: 's4',
      node: (
        <section>
          <h3 className="font-semibold">
            4. {s4.title} <span className="text-xs font-normal">({s4.basis})</span>
          </h3>
          <p className="mt-1 text-sm">{s4.fixedText}</p>
        </section>
      ),
    })
  }

  blocks.push({
    id: 'attachment',
    keepWithNext: true,
    node: (
      <section className="text-sm">
        <p>※ {FORM_CORRECTION_REQUEST.attachment.label}</p>
      </section>
    ),
  })

  // 서명란은 마지막 블록이므로 언제나 마지막 페이지에 놓인다.
  // keepWithPrev 로 앞 블록과 묶어 서명란만 홀로 넘어가는 것도 막는다.
  blocks.push({
    id: 'signature',
    keepWithPrev: true,
    node: <SignatureBlock paged mark={FORM_CORRECTION_REQUEST.signature.signatureMark} />,
  })

  return { blocks, groups }
}

/* ── 화면 ────────────────────────────────────────────────────── */

/**
 * 복수 기관 동시 행사.
 *
 * 진단 화면은 "대출이 거절된 경우 양쪽 모두에 각각 요구할 수 있습니다"라고 안내한다
 * (법 제36조의2 제1항 — 개인신용평가회사와 금융회사가 각각 상대방이 된다).
 * 그런데 서식은 한 벌만 만들어 줬다. 말과 기능이 어긋나 있었다.
 *
 * ★ 기본은 한 건이다. 필요할 때 두 번째 건을 **추가**한다.
 *   화면을 늘 두 갈래로 보여주면 대부분의 사용자에게는 방해일 뿐이다.
 *
 * 건이 바뀌면 작성 내용이 통째로 달라지므로 key 로 다시 마운트한다.
 * (화면들이 useState 초기값으로 저장 내용을 읽기 때문이다)
 */
export default function Document() {
  const { journey, setSection } = useJourney()
  const [params] = useSearchParams()
  const d = journey.diagnosis
  /**
   * 서식 2로 가려는 요청은 언제나 기본 건이다.
   * 두 번째 건에는 서식 2가 없으므로, 두 번째 건을 보던 중에
   * /response 나 /strategy 에서 서식 2로 넘어오면 갈 곳이 없어진다.
   */
  const wantsForm2 =
    params.get('form') === FORM_CORRECTION_REQUEST.id ||
    (d.correctionRows ?? []).length > 0 ||
    (d.selectedCandidates ?? []).length > 0
  const stored = journey.form?.second ? (journey.form?.activeCase ?? 'base') : 'base'
  const active = wantsForm2 ? 'base' : stored
  /** 서식 2를 여러 벌 만든 경우 지금 보고 있는 건 (0 = 기본) */
  const form2Index = journey.form?.form2Index ?? 0

  useEffect(() => {
    if (active !== stored) setSection('form', { activeCase: active }, { immediate: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active, stored])

  return (
    <DocumentSheet
      key={`${active}:${form2Index}`}
      activeCase={active}
      form2Index={form2Index}
    />
  )
}

function DocumentSheet({ activeCase, form2Index }) {
  const { journey, setSection, storageAvailable } = useJourney()
  const diagnosis = journey.diagnosis
  /** 저장된 서식 작성 내용. 없으면 각 항목의 기본값을 쓴다. */
  const savedForm = journey.form ?? {}
  const isSecond = activeCase === 'second'
  const secondCase = savedForm.second ?? null
  /**
   * 두 번째 건은 설명요구서(서식 1)만 갖는다.
   * 서식 2의 제출처는 정보의 출처에 따라 라우팅이 판정하므로 임의로 두 벌 만들지 않는다.
   */
  const savedF1 = (isSecond ? secondCase?.form1 : savedForm.form1) ?? {}
  /** 서식 2 건 — 0 이면 기본, 1 이상이면 추가 건 (라우팅이 other 일 때만 생긴다) */
  const savedF2 =
    (form2Index > 0 ? savedForm.form2Extras?.[form2Index - 1] : savedForm.form2) ?? {}
  /** 이 건의 상대방 (기본 건은 진단이 정한 상대방) */
  const caseCounterpartyId = isSecond
    ? (secondCase?.counterpartyId ?? null)
    : (diagnosis.counterpartyId ?? null)
  const caseCounterparty = COUNTERPARTY_TYPES_BY_ID[caseCounterpartyId] ?? null
  /** 여정 기록에서 두 건을 구분한다 */
  const caseKey = isSecond ? ':second' : ''
  const branch = CORRECTION_ROUTING_BY_ID[diagnosis.routingBranchId]
  const sector = INSTITUTION_OPTIONS.find((o) => o.id === diagnosis.institutionSectorId)
  /**
   * 서식 본문 치환값은 업권 shortLabel 이다.
   * 직접 입력한 기관명(customInstitution)이나 수신 기관 입력값을 쓰지 않는다.
   * 서식 원문의 그 자리는 회사명이 아니라 업권명 자리이기 때문이다.
   */
  const institutionShortLabel = sector?.shortLabel ?? null
  /** 이메일 초안의 수신처 자리에 쓸 이름. 없으면 비워 두고 사용자가 채운다. */
  const customInstitutionLabel = (diagnosis.customInstitution ?? '').trim()

  // 라우팅이 unknown 이면 서식 1이 선행 단계이므로 서식 1 탭에서 시작한다.
  // ?form=<서식 id> 로 특정 서식을 바로 열 수 있다.
  const [params] = useSearchParams()
  const [tab, setTab] = useState(() => {
    // 두 번째 건에는 서식 2가 없다 (CaseSwitcher 주석 참조). 건이 바뀌면 다시 마운트된다.
    if (isSecond) return FORM_EXPLANATION_REQUEST.id
    if (params.get('form') === FORM_CORRECTION_REQUEST.id) return FORM_CORRECTION_REQUEST.id
    if (params.get('form') === FORM_EXPLANATION_REQUEST.id) return FORM_EXPLANATION_REQUEST.id
    // 회신 해석에서 "이 항목을 다시 요구하라"고 넘어왔으면 서식 1이다
    if ((diagnosis.missingRequestItems ?? []).length > 0) return FORM_EXPLANATION_REQUEST.id
    // 정정할 항목이나 유리한 정보가 넘어왔으면 서식 2다
    if ((diagnosis.correctionRows ?? []).length > 0 || (diagnosis.selectedCandidates ?? []).length > 0)
      return FORM_CORRECTION_REQUEST.id
    if (savedForm.tab === FORM_CORRECTION_REQUEST.id) return FORM_CORRECTION_REQUEST.id
    return FORM_EXPLANATION_REQUEST.id
  })
  // 두 번째 건에는 서식 2가 없다. 저장된 탭이 서식 2였어도 서식 1로 연다.

  // 서식 1 — unknown 분기는 선행 단계가 지정한 요청 항목(기초정보의 개요)을 미리 선택한다.
  /**
   * 서식 1 요청 항목.
   * /response 에서 "설명되지 않음"으로 판정된 유형이 있으면 그것만 선택된 상태로 시작한다.
   * 없으면 라우팅 선행 단계가 지정한 항목을 쓴다.
   */
  /**
   * 다른 화면에서 막 넘어온 값(hand-off).
   *
   * 우선순위: **방금 넘어온 값 > 저장된 작성 내용 > 기본값**
   *   회신 해석에서 "이 항목이 누락됐다"고 판정해 넘어온 것은 사용자의 방금 행동이므로
   *   며칠 전 저장된 선택보다 우선한다.
   * 소비한 뒤에는 비운다. 안 그러면 이후 방문마다 사용자의 수정을 계속 덮어쓴다.
   */
  const [handoff] = useState(() => ({
    requestItems: diagnosis.missingRequestItems ?? [],
    correctionRows: diagnosis.correctionRows ?? [],
    candidates: diagnosis.selectedCandidates ?? [],
  }))
  useEffect(() => {
    if (
      handoff.requestItems.length ||
      handoff.correctionRows.length ||
      handoff.candidates.length
    ) {
      setSection(
        'diagnosis',
        { missingRequestItems: [], correctionRows: [], selectedCandidates: [] },
        { immediate: true },
      )
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const [selectedItems, setSelectedItems] = useState(
    handoff.requestItems.length > 0
      ? handoff.requestItems
      : (savedF1.selectedItems ?? branch?.steps?.[0]?.requestItemIds ?? []),
  )
  const [hopeResult, setHopeResult] = useState(savedF1.hopeResult ?? '')
  const [consent, setConsent] = useState(savedF1.consent ?? null)

  /**
   * 인적사항.
   * 서버로 보내지 않는다. 이 브라우저에만 저장된다.
   * ★ 주민등록번호는 여기에 없다. 애초에 입력받지 않으므로 저장할 것도 없다.
   */
  const [personal, setPersonalState] = useState(
    savedForm.personal ?? { name: '', phone: '', email: '' },
  )
  const setPersonal = (k, v) => setPersonalState((p) => ({ ...p, [k]: v }))

  // 서식 2
  const [enabled, setEnabled] = useState(savedF2.enabled ?? { s2: true, s3: true, s4: true })
  /**
   * 섹션 2 정정·삭제 표.
   * /response 에서 "사실과 다르다"고 표시한 항목이 "현행 정보" 칸으로 들어온다.
   * "정정 또는 삭제 내용" 칸은 사용자가 직접 채운다.
   * 같은 분류에 여러 건이면 줄바꿈으로 합친다.
   */
  const [rows, setRows] = useState(() => {
    const saved = savedF2.rows ?? {}
    if (handoff.correctionRows.length === 0) return saved
    // 방금 넘어온 항목은 "현행 정보"만 덮어쓰고, 저장돼 있던 "정정 내용"은 살린다
    const incoming = {}
    for (const r of handoff.correctionRows) {
      const prev = incoming[r.categoryId]
      incoming[r.categoryId] = prev ? `${prev}\n${r.current}` : r.current
    }
    const merged = { ...saved }
    for (const [cat, current] of Object.entries(incoming)) {
      merged[cat] = { current, correction: merged[cat]?.correction ?? '' }
    }
    return merged
  })
  /**
   * 섹션 3은 /strategy 에서 고른 후보로 채워진다.
   * 아직 안 거쳤으면 빈 표 3행으로 시작한다.
   */
  const [favorable, setFavorable] = useState(() => {
    if (handoff.candidates.length === 0 && savedF2.favorable) return savedF2.favorable
    const picked = handoff.candidates.map((c) => ({
      infoName: c['정보명'] ?? '',
      detail: c['세부내용'] ?? '',
    }))
    const blanks = Math.max(0, 3 - picked.length)
    return [...picked, ...Array.from({ length: blanks }, () => ({ infoName: '', detail: '' }))]
  })
  const [recipient, setRecipient] = useState(savedF2.recipient ?? '')

  /**
   * 서식 내용 자동 저장.
   * 타이핑 중마다 쓰지 않는다 — setSection 이 입력이 멈춘 뒤(1.5초) 한 번 저장한다.
   */
  useEffect(() => {
    const f1 = { selectedItems, hopeResult, consent }
    const f2 = { enabled, rows, favorable, recipient }
    setSection('form', (prev) => {
      // 두 번째 건은 자기 칸에만 쓴다. 기본 건의 작성 내용을 건드리지 않는다.
      if (isSecond) return { ...prev, tab, personal, second: { ...prev.second, form1: f1 } }
      if (form2Index > 0) {
        const extras = [...(prev.form2Extras ?? [])]
        extras[form2Index - 1] = f2
        return { ...prev, tab, personal, form1: f1, form2Extras: extras }
      }
      return { ...prev, tab, personal, form1: f1, form2: f2 }
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, personal, selectedItems, hopeResult, consent, enabled, rows, favorable, recipient])

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
  const currentForm = isForm1 ? FORM_EXPLANATION_REQUEST : FORM_CORRECTION_REQUEST
  /** 여정 기록 키 — 두 번째 건은 별도로 센다 */
  const milestoneKey = `${tab}${caseKey}${!isForm1 && form2Index > 0 ? `:r${form2Index}` : ''}`
  const milestone = journey.milestones?.[milestoneKey] ?? { printedAt: null, submittedAt: null }

  const setMilestone = (formId, patch) =>
    setSection(
      'milestones',
      (m) => ({
        ...m,
        [formId]: { printedAt: null, submittedAt: null, ...(m?.[formId] ?? {}), ...patch },
      }),
      { immediate: true },
    )

  /**
   * 인쇄 후 화면.
   *
   * 지금까지는 인쇄 버튼을 누르면 서비스가 거기서 끊겼다. 사용자는 종이를 들고
   * "이제 뭐 하지" 상태가 된다. afterprint 로 다음 단계를 이어 붙인다.
   */
  const [stage, setStage] = useState('form') // form | afterPrint
  const [confirming, setConfirming] = useState(false)
  const printAck = usePrintAck()
  const printScale = usePrintScale()
  const [emailOpen, setEmailOpen] = useState(false)
  const [checked, setChecked] = useState({})
  const printing = useRef(false)
  const afterPrintRef = useRef(null)

  const finishPrint = () => {
    if (!printing.current) return
    printing.current = false
    setMilestone(milestoneKey, { printedAt: new Date().toISOString() })
    setStage('afterPrint')
  }

  const doPrint = () => {
    setConfirming(false)
    printing.current = true
    setStage('form')
    window.print()
    // afterprint 가 오지 않는 브라우저를 위한 보조 경로. 둘 다 와도 한 번만 처리된다.
    setTimeout(finishPrint, 300)
  }

  /**
   * 인쇄 직전 검토.
   *
   * 두 가지를 한 번에 확인한다.
   *   1) 빠뜨린 칸 (경고만 한다 — 진행은 막지 않는다)
   *   2) 머리글·바닥글 (브라우저가 제어하므로 우리가 끌 수 없다 — docs/cases/print-headers.md)
   * 확인할 것이 하나도 없으면 곧바로 인쇄한다.
   */
  const issues = preflightIssues({
    isForm1,
    personal,
    selectedItems,
    rows,
    favorable,
    enabled,
    needsRecipient: Boolean(branch?.requiresRecipientInput),
    recipient,
    categoryLabel: (id) => BASE_INFO_CATEGORIES_BY_ID[id]?.label ?? id,
  })

  const handlePrint = () => {
    if (!printAck.acked || issues.length > 0) {
      setConfirming(true)
      return
    }
    doPrint()
  }

  useEffect(() => {
    const onAfter = () => finishPrint()
    window.addEventListener('afterprint', onAfter)
    // 옛 Safari 등은 afterprint 대신 print 미디어 질의 변화로만 알린다
    const mq = window.matchMedia?.('print')
    const onMq = (e) => {
      if (!e.matches) finishPrint()
    }
    mq?.addEventListener?.('change', onMq)
    return () => {
      window.removeEventListener('afterprint', onAfter)
      mq?.removeEventListener?.('change', onMq)
    }
  })

  useEffect(() => {
    if (stage === 'afterPrint') afterPrintRef.current?.scrollIntoView({ block: 'start' })
  }, [stage])

  /** 제출까지 남은 실물 작업. 서식에 따라 항목이 달라진다. */
  const checklist = [
    { id: 'sign', label: '출력물에 서명 또는 날인했습니다' },
    isForm1 && {
      id: 'rrn',
      label: '주민등록번호를 직접 기재했습니다',
      note: '이 서비스는 주민등록번호를 입력받지 않습니다. 서식에 공란으로 출력되니 손으로 적으세요.',
    },
    !isForm1 &&
      s2HasContent && {
        id: 'evidence',
        label: '증빙자료를 첨부했습니다',
        note: FORM_CORRECTION_REQUEST.attachment.label,
      },
    { id: 'where', label: '제출할 곳을 확인했습니다' },
  ].filter(Boolean)
  const doneCount = checklist.filter((c) => checked[c.id]).length

  /** 예상 인쇄 페이지 수. 서식 2는 PagedSheet 가, 서식 1은 SheetHeightProbe 가 잰다. */
  const [pageCount, setPageCount] = useState(1)
  const [form1PageCount, setForm1PageCount] = useState(1)

  // 서식 2는 내용에 따라 여러 장이 된다. 블록으로 만들어 PagedSheet 가 나눈다.
  const form2 = form2Blocks({
    enabled,
    personal,
    rows,
    setRow,
    favorable,
    setFavorable: setFavorableCell,
    recipient,
    setRecipient,
    needsRecipient: Boolean(branch?.requiresRecipientInput),
    institutionShortLabel,
    s2HasContent,
  })

  return (
    <div className="print-root space-y-5 py-6">
      <PageHeader
        kicker="서식 생성"
        title="고시 서식을 채워 인쇄하세요"
        description={
          /* ★ "새로고침하면 사라집니다"는 여정 저장을 넣으면서 사실이 아니게 됐다(감사 지적).
                저장이 되는 환경과 막힌 환경은 실제 동작이 다르므로 문구도 나눈다. */
          <Plain id={storageAvailable ? 'document.intro' : 'document.introBlocked'}>
            화면에서 채운 내용이 그대로 인쇄됩니다. 서버로 보내지 않습니다.{' '}
            {storageAvailable ? STORAGE_FACTS.normal : STORAGE_FACTS.blocked}
          </Plain>
        }
      />

      {/* ── 인쇄 후 — 제출까지 이어 붙인다 ─────────────────── */}
      {stage === 'afterPrint' && (
        <section
          ref={afterPrintRef}
          className="no-print rounded-lg border-2 border-ink-700 bg-white p-5"
          aria-labelledby="afterprint-heading"
        >
          <p className="text-sm font-semibold tracking-wide text-ink-600">인쇄했습니다</p>
          <h2 id="afterprint-heading" className="mt-1 text-xl font-bold text-gray-900">
            제출 전에 확인하세요
          </h2>
          <p className="mt-1 text-gray-600">
            {currentForm.title}
            {milestone.printedAt && ` · ${formatWhen(milestone.printedAt)} 인쇄`}
          </p>

          <ul className="mt-4 space-y-2">
            {checklist.map((c) => (
              <li key={c.id} className="rounded-md border border-gray-200 p-3">
                <label className="flex cursor-pointer items-start gap-3">
                  <input
                    type="checkbox"
                    checked={Boolean(checked[c.id])}
                    onChange={() => setChecked((p) => ({ ...p, [c.id]: !p[c.id] }))}
                    className="mt-1 h-5 w-5 shrink-0 accent-ink-700"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="font-bold text-gray-900">{c.label}</span>
                    {c.note && <span className="mt-1 block text-sm text-gray-600">{c.note}</span>}
                  </span>
                </label>
              </li>
            ))}
          </ul>
          <p role="status" aria-live="polite" className="mt-2 text-sm text-gray-600">
            {doneCount}/{checklist.length} 확인
          </p>

          <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              type="button"
              className="btn btn-primary"
              onClick={() => {
                setEmailOpen(true)
                setTimeout(
                  () => document.getElementById('email-draft')?.scrollIntoView({ block: 'start' }),
                  0,
                )
              }}
            >
              이메일 초안 열기
            </button>
            <Link to="/next" className="btn btn-secondary">
              제출 절차 자세히
            </Link>
            <button type="button" className="btn btn-secondary" onClick={handlePrint}>
              다시 인쇄
            </button>
            <button type="button" className="btn btn-quiet" onClick={() => setStage('form')}>
              서식 계속 고치기
            </button>
          </div>

          {/* 제출은 우리가 대행하지 않으므로 날짜를 자동으로 알 수 없다 */}
          <div className="mt-6 border-t border-gray-200 pt-4">
            <label htmlFor="submitted-at" className="block font-bold text-gray-900">
              제출한 날짜를 기록해 두세요
            </label>
            <p id="submitted-at-help" className="mt-1 text-sm text-gray-600">
              이 서비스는 제출을 대행하지 않아 언제 내셨는지 알 수 없습니다. 직접 적어 두시면
              나중에 &ldquo;언제 냈더라&rdquo;를 찾지 않으셔도 됩니다.
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <input
                id="submitted-at"
                type="date"
                max={todayInputValue()}
                value={milestone.submittedAt ?? ''}
                aria-describedby="submitted-at-help"
                onChange={(e) => setMilestone(milestoneKey, { submittedAt: e.target.value || null })}
                className="rounded-md border border-gray-300 px-3 py-2"
              />
              {milestone.submittedAt && (
                <span className="text-gray-700">
                  {formatDate(milestone.submittedAt)}에 제출한 것으로 기록했습니다.
                </span>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 저장이 막힌 환경이면 타이핑을 시작하기 전에 알린다 */}
      {!storageAvailable && (
        <div className="no-print">
          <Notice title="이 브라우저에서는 자동 저장이 안 됩니다">
            <p>
              시크릿 모드이거나 브라우저가 저장을 막고 있습니다. 화면을 닫으면 입력이 사라지니,
              아래 [작성 중인 내용 불러오기 · 파일로 보관하기]에서 파일로 내보내 두세요. 서식
              작성과 인쇄는 그대로 됩니다.
            </p>
          </Notice>
        </div>
      )}

      {/* 모바일 안내 — 서식은 A4 고정이므로 작은 화면에서는 축소돼 보이는 것이 정상이다 */}
      <div className="no-print md:hidden">
        <Notice title="인쇄는 PC를 권장합니다">
          <p>
            서식은 A4 크기에 맞춰 조판돼 있어 이 화면에서는 작게 보입니다. 내용은 여기서 채우고,
            인쇄는 PC에서 하시거나 아래 [이메일로 제출하기]를 쓰세요. 표는 좌우로 밀어 볼 수
            있습니다.
          </p>
        </Notice>
      </div>

      {branch?.requiresPrecedingStep && (
        <div className="no-print">
          <Notice title="순서가 있습니다" mark="1">
            <ol className="space-y-1">
              {branch.steps.map((st) => (
                <li key={st.order}>
                  {st.order}. {st.description}
                </li>
              ))}
            </ol>
          </Notice>
        </div>
      )}

      {/* 복수 기관 동시 행사 — 기본은 한 건, 필요할 때 추가한다 */}
      <CaseSwitcher activeCase={activeCase} isForm1={isForm1} />

      {/* 두 서식은 제출처를 정하는 방식이 다르다. 그 차이를 늘 밝힌다. */}
      <TwoFormsNote />

      {/* 정정 요청서는 제출처가 라우팅으로 정해진다. 회사가 여럿이면 회사마다 한 벌. */}
      {!isForm1 && <Form2CaseSwitcher />}

      <div className="no-print flex flex-col gap-2 sm:flex-row sm:flex-wrap" role="group" aria-label="서식 선택">
        {/* 두 번째 건은 설명요구서만 갖는다 (CaseSwitcher 주석 참조) */}
        {(isSecond ? [FORM_EXPLANATION_REQUEST] : [FORM_EXPLANATION_REQUEST, FORM_CORRECTION_REQUEST]).map((f, i) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setTab(f.id)}
            aria-pressed={tab === f.id}
            className={`flex-1 rounded-md border px-4 py-3 text-left ${
              tab === f.id
                ? 'border-ink-700 bg-ink-700 text-white'
                : 'border-gray-300 bg-white hover:border-ink-400'
            }`}
          >
            <span className="block font-bold">
              {tab === f.id && <span aria-hidden="true">✓ </span>}
              서식 {i + 1} · {f.title}
            </span>
            <span className={`mt-1 block text-sm ${tab === f.id ? 'text-ink-100' : 'text-gray-600'}`}>
              {f.coveredRights.join(', ')}
            </span>
          </button>
        ))}
      </div>

      <p className="no-print text-gray-600">
        <Plain id="document.formRequired">
          두 서식 모두 <Term id="noticedForm">고시 서식</Term>입니다. 직접 만든 편지로는 요건을
          채우지 못합니다.
        </Plain>
      </p>

      {/*
       * ★ 인쇄만 하고 닫았다가 며칠 뒤 돌아오는 것이 정상 사용 패턴이다.
       *   그래서 불러오기는 항상 보이는 자리에 둔다.
       */}
      <details className="no-print rounded-lg border border-gray-200 bg-white">
        <summary className="cursor-pointer rounded-lg px-4 py-3 font-bold text-gray-900">
          작성 중인 내용 불러오기 · 파일로 보관하기
        </summary>
        <div className="space-y-3 border-t border-gray-200 p-4">
          <p className="text-gray-700">
            {journey.updatedAt
              ? `이 브라우저에 저장된 내용을 자동으로 불러왔습니다 (마지막 저장 ${formatWhen(
                  journey.updatedAt,
                )}). 이어서 고치시면 됩니다.`
              : '아직 저장된 내용이 없습니다. 입력을 시작하면 자동으로 저장됩니다.'}
          </p>
          <p className="text-sm text-gray-600">{STORAGE_SCOPE_TEXT}</p>
          <BackupPanel />
        </div>
      </details>

      {/* 서식 밖 안내. 인쇄되는 서식 본문에는 넣지 않는다 (renderOutsideFormOnly). */}
      {isForm1 && (
        <div className="no-print panel">
          <p className="font-bold text-gray-900">고시 서식 안내문에 대한 보충</p>
          <p className="mt-2 text-gray-700">{FORM_SECTION1_DISCREPANCY.correction}</p>
          <p className="mt-3">
            <Basis chain prefix="근거 체인">
              {FORM_SECTION1_DISCREPANCY.basisChain}
            </Basis>
          </p>
        </div>
      )}

      {!isForm1 && (
        <div className="no-print panel space-y-3">
          <p className="font-bold text-gray-900">넣을 섹션을 고르세요</p>
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
                    <Basis>{sec.basis}</Basis>
                  </Checkbox>
                  {blocked && (
                    <p className="pl-6 text-sm text-amber-900">
                      <span aria-hidden="true">※ </span>
                      {sec.dependsOn.message}
                    </p>
                  )}
                </div>
              )
            })}
          {handoff.correctionRows.length > 0 && (
            <p className="text-sm text-gray-700" data-tour="handoff">
              회신 해석에서 표시하신 {handoff.correctionRows.length}건이 섹션 2의 &ldquo;현행
              정보&rdquo; 칸에 채워졌습니다. &ldquo;정정 또는 삭제 내용&rdquo;은 직접 적어
              주세요.
            </p>
          )}
          {handoff.candidates.length > 0 && (
            <p className="text-sm text-gray-700">
              대응 전략에서 고른 {handoff.candidates.length}개 항목이 섹션 3에 채워졌습니다.
              세부 수치는 직접 확인해 수정하세요.
            </p>
          )}
          <p className="text-sm text-gray-600">{FORM_CORRECTION_REQUEST.attachment.rationale}</p>
        </div>
      )}

      {/* .sheet-scroll 은 @media screen 에서만 동작한다. 인쇄에는 영향이 없다. */}
      <div className="sheet-scroll">
      {isForm1 ? (
        <>
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
          {/* 서식 1의 쪽 수도 가정이 아니라 측정으로 표시한다 */}
          <SheetHeightProbe onPageCount={setForm1PageCount}>
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
          </SheetHeightProbe>
        </>
      ) : (
        <PagedSheet
          title={FORM_CORRECTION_REQUEST.title}
          subtitle={FORM_CORRECTION_REQUEST.subtitle}
          applicantName={personal.name}
          blocks={form2.blocks}
          groups={form2.groups}
          onPageCount={setPageCount}
        />
      )}
      </div>

      <div className="no-print space-y-3">
        {/* 서식 출처 — 어느 실물을 보고 재현했는지 밝힌다 */}
        <p className="rounded-md border border-gray-300 bg-white p-3 text-sm text-gray-700">
          <b>서식 출처</b> — 이 서식은 {currentForm.source}을 기준으로 재현했습니다.{' '}
          {currentForm.sourceNote ?? currentForm.sourceCaveat}{' '}
          <Basis>{currentForm.basis}</Basis>
        </p>
        {/* ★ 안내가 버튼보다 먼저 눈에 들어와야 한다. 누른 뒤에 읽으면 늦다. */}
        <PrintSetupNotice />
        {confirming ? (
          <PrePrintPanel
            issues={issues}
            needAck={!printAck.acked}
            onPrint={doPrint}
            onCancel={() => setConfirming(false)}
            onRemember={printAck.remember}
          />
        ) : null}
        {/* 인쇄 글자 크기 — 고령층이 자기가 낸 서류를 읽을 수 있어야 한다 */}
        <div className="rounded-md border border-gray-300 bg-white p-3">
          <p className="font-bold text-gray-900" id="print-scale-label">
            인쇄 글자 크기
          </p>
          <div
            className="mt-2 flex flex-col gap-2 sm:flex-row"
            role="group"
            aria-labelledby="print-scale-label"
          >
            {PRINT_SCALES.map((sc) => (
              <button
                key={sc.id}
                type="button"
                onClick={() => printScale.setScale(sc.id)}
                aria-pressed={printScale.scale === sc.id}
                className={`flex-1 rounded-md border px-3 py-2 text-left ${
                  printScale.scale === sc.id
                    ? 'border-ink-700 bg-ink-700 text-white'
                    : 'border-gray-300 bg-white hover:border-ink-400'
                }`}
              >
                <span className="block font-bold">
                  {printScale.scale === sc.id && <span aria-hidden="true">✓ </span>}
                  {sc.label}
                </span>
                <span
                  className={`mt-0.5 block text-sm ${
                    printScale.scale === sc.id ? 'text-ink-100' : 'text-gray-600'
                  }`}
                >
                  {sc.hint}
                </span>
              </button>
            ))}
          </div>
          <p className="mt-2 text-sm text-gray-600">
            서식의 항목과 순서는 그대로이고 크기만 바뀝니다. 화면 글자 크기와는 별개입니다.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center">
          <button type="button" onClick={handlePrint} className="btn btn-primary">
            인쇄 / PDF로 저장
          </button>
          <Link to="/next" className="btn btn-secondary">
            출력했다면, 이후 절차 보기
          </Link>
        </div>
        <p role="status" aria-live="polite" className="text-gray-800" data-tour="pagecount">
          {isForm1 ? (
            <>
              현재 내용은 <b>{form1PageCount}페이지</b>로 출력됩니다.
              {form1PageCount > 1 &&
                ' 서식 1은 짧아서 보통 한 장에 들어갑니다. 두 장이 되면 인쇄 미리보기에서 한 번 확인해 주세요.'}
            </>
          ) : (
            <>
              현재 내용은 <b>{pageCount}페이지</b>로 출력됩니다.
              {pageCount > 1 && ' 법정 서식은 여러 장으로 제출해도 됩니다. 각 장 하단에 쪽 번호가, 둘째 장부터는 상단에 문서명과 신청인 성명이 인쇄됩니다.'}
            </>
          )}
          {/* 예고를 숨기지 않는다. 참고값으로 두되 불확실성을 밝힌다. */}
          {pageCountUncertain() && (
            <span className="block text-sm text-gray-700">
              이 브라우저에서는 이 값이 실제와 다를 수 있습니다. 인쇄 미리보기에서 확인해
              주세요.
            </span>
          )}
        </p>
        {/* 다시 들어왔을 때 "이거 냈던가" 를 여기서 바로 알 수 있게 한다 */}
        {(milestone.printedAt || milestone.submittedAt) && (
          <p className="rounded-md bg-ink-50 p-3 text-ink-800">
            {milestone.printedAt && <>이 서식을 {formatWhen(milestone.printedAt)}에 인쇄하셨습니다. </>}
            {milestone.submittedAt && <>제출일은 {formatDate(milestone.submittedAt)}로 기록돼 있습니다.</>}
          </p>
        )}
        <p className="text-sm text-gray-600">
          인쇄 대화상자에서 용지를 A4, 배율 100%로 두세요. 지금 보고 있는 서식만 인쇄됩니다.
        </p>

      </div>

      {/* 전자우편 제출 — 시행령 제31조의2 제6항이 허용한 행사 방법 */}
      <EmailDraft
        open={emailOpen}
        onOpenChange={setEmailOpen}
        formId={tab}
        personal={personal}
        selectedItems={selectedItems}
        rows={rows}
        favorable={favorable}
        enabled={enabled}
        recipientOrg={
          recipient.trim() || customInstitutionLabel
        }
      />

      {/* s4 의존 규칙 근거를 화면에도 남긴다 */}
      {!isForm1 && s4.dependsOn && (
        <p className="no-print text-sm text-gray-500">{s4.dependsOn.message}</p>
      )}
    </div>
  )
}
