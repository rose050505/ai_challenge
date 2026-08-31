import { useState } from 'react'

/**
 * 인쇄 설정 안내.
 *
 * ── 2026-08-31: 안내를 대폭 줄였다 (사용자 지적) ─────────────────────
 * 브라우저 주소가 인쇄되는 것은 **거슬리는 것이지 실제 문제가 아니다.**
 * 서식의 법적 효력에 영향이 없고, 금융회사가 접수를 거부할 사유도 아니다.
 * 그런 것을 경고 상자로 띄우고 첫 인쇄 때 확인 단계까지 두는 것은
 * 사용자에게 절차를 하나 더 요구하는 것이고, 그만한 값어치가 없다.
 *   - 경고 상자 → 인쇄 버튼 옆 한 줄
 *   - 브라우저별 경로 → 접어 둔다
 *   - "브라우저가 제어하므로 자동으로 끌 수 없습니다" → 삭제.
 *     우리가 못 한 것을 변명하는 문단이었다.
 *   - 첫 인쇄 확인 단계(wy-print-ack) → 삭제. 마찰만 만든다.
 * 빈 칸 점검(PrePrintPanel)은 남긴다 — 그건 서식의 내용에 관한 것이다.
 * ────────────────────────────────────────────────────────────────────
 *
 * ── 왜 안내밖에 할 수 없는가 (2026-08-26 실측, 개발 참고) ─────────────
 * 브라우저가 그리는 머리글·바닥글은 **브라우저의 여백 영역**에 그려지고,
 * 종이 끝에서 그 글자까지의 거리는 브라우저가 고정한다. CSS 로 옮길 수 없다.
 *
 *   A4 세로, 머리글 켠 상태에서 종이 위 끝 ~ 머리글 글자 위쪽 거리
 *     Chrome  3.1mm  (@page margin 20mm / 25mm 모두 동일)
 *     Firefox 6.5mm  (@page margin 20mm / 25mm 모두 동일)
 *
 * 즉 @page 여백을 25mm 로 올려도 머리글은 그 자리에 그대로 있고,
 * 우리 본문만 5mm 더 내려가 페이지 수만 늘어난다. 그래서 여백은 20mm 로 둔다.
 *
 * 한편 Firefox 인쇄 대화상자의 '여백' 설정은 우리 @page 여백을 덮어쓰지 않는다.
 * (기본값 / 0 / 1.2in 세 값 모두에서 본문 시작 위치가 20.6mm 로 같았다.
 *  @page 여백을 선언하지 않은 대조군에서만 대화상자 값이 적용됐다.)
 * → 사용자에게 여백을 바꾸라고 안내할 필요는 없다. 끌 것은 머리글·바닥글뿐이다.
 * ────────────────────────────────────────────────────────────────────
 */

/** 브라우저별 끄는 경로. 접힌 안에서만 쓴다. */
export function HeaderFooterSteps() {
  return (
    <ul className="mt-2 list-disc space-y-1 pl-5">
      <li>
        <b>Chrome</b> — 인쇄 대화상자 오른쪽에서 [옵션 더보기] → <b>머리글/바닥글</b> 체크 해제
      </li>
      <li>
        <b>Firefox</b> — 인쇄 미리보기에서 [설정 자세히] → <b>머리글 및 바닥글</b> 체크 해제
      </li>
    </ul>
  )
}

/**
 * `@page` (paged media) 를 이 브라우저가 실제로 지원하는지 **직접 확인한다.**
 *
 * UA 문자열보다 기능 자체를 보는 편이 정확하다. 스타일 시트에 `@page` 규칙을 하나 넣고
 * 브라우저가 그것을 CSSPageRule 로 파싱했는지, size·margin 을 살려 뒀는지 본다.
 * 지원하지 않는 브라우저는 규칙을 통째로 버리거나 선언을 지운다.
 *
 * @returns {boolean|null} true 지원 / false 미지원 / null 판단 불가
 */
export function detectPagedMedia(doc = typeof document === 'undefined' ? null : document) {
  if (!doc) return null
  let style
  try {
    style = doc.createElement('style')
    style.textContent = '@page { size: A4; margin: 20mm 14mm; }'
    doc.head.appendChild(style)
    const rules = style.sheet?.cssRules
    if (!rules) return null
    for (const r of rules) {
      const isPageRule = r.constructor?.name === 'CSSPageRule' || r.type === 6
      if (!isPageRule) continue
      const text = r.cssText || ''
      return /size\s*:/i.test(text) && /margin\s*:/i.test(text)
    }
    // @page 규칙 자체가 목록에 없다 = 파싱 단계에서 버려졌다
    return false
  } catch {
    return null
  } finally {
    style?.remove()
  }
}

/**
 * 예상 페이지 수를 믿을 수 있는가.
 *
 * `@page` 를 지원하지 않으면 우리가 지정한 A4·여백이 무시되고 브라우저 기본 여백이 쓰인다.
 * 그러면 인쇄 영역 높이가 우리 계산과 달라져 **쪽 수 예고가 어긋날 수 있다.**
 * (내용이 잘리지는 않는다. `.paged-page` 는 height 가 아니라 min-height 다.)
 *
 * 기능 감지가 안 되면 UA 로 판별한다 — Safari 는 18.2 부터 지원한다.
 */
export function pageCountUncertain() {
  const detected = detectPagedMedia()
  if (detected !== null) return !detected
  return isOldSafariPrint()
}

/**
 * Safari 는 18.2 부터 `@page` (paged media) 를 지원한다. 그 이전 버전에서는
 * 우리가 지정한 A4·여백이 무시되고 브라우저 기본 여백이 쓰인다.
 * 내용이 잘리지는 않지만(.paged-page 는 height 가 아니라 min-height 다)
 * 화면이 예고한 쪽 수와 실제 인쇄가 다를 수 있다.
 *   근거: caniuse `css-paged-media` — safari 18.1 이하 n, 18.2 이상 y
 *
 * 감지 실패 시에는 아무 말도 하지 않는다. 없는 문제를 경고하지 않기 위해서다.
 */
export function isOldSafariPrint(nav = typeof navigator === 'undefined' ? null : navigator) {
  if (!nav) return false
  // Chrome·Edge 도 UA 에 Safari 를 넣는다. vendor 로 애플 계열만 먼저 거른다.
  if (nav.vendor !== 'Apple Computer, Inc.') return false
  const ua = nav.userAgent || ''
  if (/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)) return false
  const m = /Version\/(\d+)(?:\.(\d+))?/.exec(ua)
  if (!m) return false
  const major = Number(m[1])
  const minor = Number(m[2] ?? 0)
  return major < 18 || (major === 18 && minor < 2)
}

/**
 * 인쇄 버튼 옆에 놓는 한 줄.
 *
 * ★ 경고가 아니다. 끄지 않아도 서식은 유효하다. 그래서 상자도 색도 쓰지 않는다.
 *   브라우저별 경로는 접어 두고, 원하는 사람만 편다.
 */
export function PrintSetupNotice() {
  const [open, setOpen] = useState(false)
  const panelId = 'print-hf-steps'
  return (
    <div className="text-sm text-gray-700">
      <p>
        브라우저 설정에서 <b>머리글·바닥글</b>을 끄면 서식만 깔끔하게 나옵니다.{' '}
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls={open ? panelId : undefined}
          className="font-bold text-ink-700 underline"
        >
          끄는 방법
          <span aria-hidden="true">{open ? ' ▴' : ' ▾'}</span>
        </button>
      </p>
      {open && (
        <div id={panelId} className="text-gray-800">
          <HeaderFooterSteps />
        </div>
      )}
      {/* ★ 쪽 번호는 남긴다. 브라우저 것을 꺼도 서식 안의 쪽 번호는 그대로라는 사실은
             실제로 유용하다 — 이걸 모르면 끄기를 망설인다. */}
      <p className="mt-1">
        쪽 번호는 이 서비스가 서식 안에 직접 넣습니다. 브라우저 것을 꺼도 쪽 번호는 남습니다.
      </p>
      {pageCountUncertain() && (
        <p className="mt-1">
          <b>이 브라우저에서는 예상 페이지 수가 실제와 다를 수 있습니다.</b> 내용이 잘리지는
          않으니 인쇄 미리보기에서 쪽 수를 확인해 주세요.
        </p>
      )}
    </div>
  )
}

/**
 * 인쇄 직전 단계 — **빈 칸이 있을 때만** 뜬다.
 *
 * 머리글·바닥글 확인은 여기서 뺐다(2026-08-31). 이 패널이 말하는 것은
 * 서식의 내용이지 브라우저 설정이 아니다.
 *
 * ★ 진행을 막지 않는다. [이대로 인쇄하기] 는 언제나 활성 상태다.
 *   빠뜨린 것이 의도일 수도 있고, 그 판단은 사용자의 것이다.
 */
export function PrePrintPanel({ issues = [], onPrint, onCancel }) {
  return (
    <div
      role="group"
      aria-labelledby="preprint-heading"
      className="rounded-lg border-2 border-ink-700 bg-white p-4"
    >
      <h3 id="preprint-heading" className="text-lg font-bold text-gray-900">
        인쇄하기 전에 확인하세요
      </h3>

      {issues.length > 0 ? (
        <div className="mt-3">
          <p className="font-bold text-amber-900">
            <span aria-hidden="true">! </span>
            비어 있는 곳이 {issues.length}군데 있습니다
          </p>
          <ul className="mt-2 space-y-2">
            {issues.map((it) => (
              <li key={it.id} className="rounded-md border border-amber-300 bg-amber-50 p-3">
                <span className="block text-amber-900">{it.text}</span>
                {it.hint && <span className="mt-1 block text-sm text-amber-900">{it.hint}</span>}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-gray-700">
            일부러 비워 두신 것이라면 그대로 인쇄하셔도 됩니다. 막지 않습니다.
          </p>
        </div>
      ) : (
        <p className="mt-2 text-gray-800">
          <span aria-hidden="true">✓ </span>
          비어 있는 칸은 없습니다.
        </p>
      )}

      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          autoFocus
          className="btn btn-primary"
          onClick={onPrint}
        >
          이대로 인쇄하기
        </button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>
          돌아가서 고치기
        </button>
      </div>
    </div>
  )
}
