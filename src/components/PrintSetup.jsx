import { useCallback, useEffect, useState } from 'react'
import { Notice } from './ui.jsx'

/**
 * 인쇄 설정 안내 + 첫 인쇄 확인 단계.
 *
 * ── 왜 안내밖에 할 수 없는가 (2026-08-26 실측) ───────────────────────
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

/** 이 브라우저에서 안내를 이미 확인했는지 (개인정보가 아니므로 여정과 분리해 둔다) */
const ACK_KEY = 'wy-print-ack'

export function usePrintAck() {
  const [acked, setAcked] = useState(false)
  useEffect(() => {
    try {
      setAcked(localStorage.getItem(ACK_KEY) === '1')
    } catch {
      /* 저장소를 못 쓰면 매번 확인 단계를 보여준다 — 안내를 놓치는 쪽보다 낫다 */
    }
  }, [])
  const remember = useCallback(() => {
    setAcked(true)
    try {
      localStorage.setItem(ACK_KEY, '1')
    } catch {
      /* 무시 */
    }
  }, [])
  const forget = useCallback(() => {
    setAcked(false)
    try {
      localStorage.removeItem(ACK_KEY)
    } catch {
      /* 무시 */
    }
  }, [])
  return { acked, remember, forget }
}

/** 브라우저별 끄는 경로. 두 곳(안내·확인 단계)에서 같은 문구를 쓴다. */
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

/** 인쇄 버튼 위에 놓는 안내. 버튼보다 먼저 눈에 들어와야 한다. */
export function PrintSetupNotice() {
  return (
    <Notice title="인쇄하기 전에 — 머리글·바닥글을 꺼 주세요">
      <p>
        브라우저는 인쇄물 맨 위와 맨 아래에 페이지 제목·주소·날짜·쪽수를 자동으로 넣습니다. 끄지
        않으면 금융회사에 내는 서식에 이 서비스의 인터넷 주소가 함께 인쇄됩니다.
      </p>
      <HeaderFooterSteps />
      <p className="mt-2 text-sm">
        <b>이 설정은 브라우저가 제어하므로 서비스에서 자동으로 끌 수 없습니다.</b> 글자가 놓이는
        위치도 브라우저가 정해서, 서식 여백을 넓혀도 종이 끝에 붙어 인쇄됩니다.
      </p>
      <p className="mt-2 text-sm">
        쪽 번호는 이 서비스가 서식 안에 직접 넣습니다. 브라우저 것을 꺼도 쪽 번호는 남습니다.
      </p>
    </Notice>
  )
}

/**
 * 첫 인쇄 확인 단계.
 * 매번 뜨면 성가시므로 한 번 확인하면 이 브라우저에서는 다시 묻지 않는다.
 */
export function PrintConfirm({ onPrint, onCancel, onRemember }) {
  const [dontAsk, setDontAsk] = useState(true)
  return (
    <div
      role="group"
      aria-labelledby="print-confirm-heading"
      className="rounded-lg border-2 border-ink-700 bg-white p-4"
    >
      <h3 id="print-confirm-heading" className="text-lg font-bold text-gray-900">
        인쇄 설정에서 머리글·바닥글을 끄셨나요?
      </h3>
      <p className="mt-1 text-gray-700">
        인쇄 대화상자가 열리면 아래를 먼저 확인하세요. 이 서비스가 대신 꺼 드릴 수 없는
        설정입니다.
      </p>
      <div className="text-gray-800">
        <HeaderFooterSteps />
      </div>
      <label className="mt-3 flex items-center gap-2 text-gray-800">
        <input
          type="checkbox"
          checked={dontAsk}
          onChange={(e) => setDontAsk(e.target.checked)}
          className="h-5 w-5 accent-ink-700"
        />
        이 브라우저에서 다시 묻지 않기
      </label>
      <div className="mt-4 flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          autoFocus
          className="btn btn-primary"
          onClick={() => {
            if (dontAsk) onRemember()
            onPrint()
          }}
        >
          확인했습니다 · 인쇄하기
        </button>
        <button type="button" className="btn btn-quiet" onClick={onCancel}>
          취소
        </button>
      </div>
    </div>
  )
}
