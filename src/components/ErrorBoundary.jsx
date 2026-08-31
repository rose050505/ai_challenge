import { Component } from 'react'
import { Link } from 'react-router-dom'
import { useJourney } from '../lib/diagnosis-context.jsx'
import { STORAGE_SCOPE_TEXT } from './Journey.jsx'

/**
 * 화면 하나가 죽어도 서비스 전체가 죽지 않게 한다.
 *
 * 심사 기간(2026-09-07 11:00 ~ 09-11 23:59)에 화면이 빈 흰 화면이 되면 그대로 결격이다.
 * 이 경계는 <main> 안에만 걸리므로 머리말·네비게이션·푸터는 살아 있고,
 * 다른 화면으로 이동하면 (경계가 경로별로 초기화되므로) 정상 동작한다.
 *
 * ★ 오류 내용을 화면에 그대로 내보내지 않는다.
 *   메시지에 사용자가 입력한 상황 서술이나 회신에서 읽은 신용정보가 섞여 있을 수 있다.
 *   같은 이유로 어디에도 로그를 남기지 않는다. 서버로 보내지 않는 것은 물론이다.
 */
class Boundary extends Component {
  constructor(props) {
    super(props)
    this.state = { failed: false }
  }

  static getDerivedStateFromError() {
    // 오류 객체를 상태에 담지 않는다. 담으면 언젠가 화면에 새어 나온다.
    return { failed: true }
  }

  componentDidCatch() {
    /* 의도적으로 아무것도 하지 않는다 — 기록하지 않는다 */
  }

  render() {
    if (!this.state.failed) return this.props.children
    return <Fallback onRetry={() => this.setState({ failed: false })} />
  }
}

function Fallback({ onRetry }) {
  const { exportToFile, storageAvailable, savedAt } = useJourney()
  return (
    <div className="py-10">
      <div className="rounded-lg border-2 border-amber-500 bg-white p-5">
        <h1 className="text-[1.75rem] font-bold text-gray-900 sm:text-[2.125rem]">이 화면에서 문제가 생겼습니다</h1>
        <p className="mt-3 text-lg text-gray-900">
          <b>진행 기록은 보존되어 있습니다.</b>{' '}
          {storageAvailable
            ? savedAt
              ? '지금까지 입력하신 내용은 이 브라우저에 저장돼 있습니다.'
              : '지금까지 입력하신 내용은 이 브라우저에 저장됩니다.'
            : '다만 이 브라우저에서는 자동 저장이 되지 않으니, 아래에서 파일로 내려받아 두세요.'}
        </p>
        <p className="mt-2 text-gray-700">
          아래 방법 중 하나로 이어서 진행하실 수 있습니다. 다른 화면은 정상 동작합니다.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
          <button type="button" className="btn btn-primary" onClick={onRetry}>
            이 화면 다시 시도
          </button>
          <Link to="/" className="btn btn-secondary">
            처음 화면으로
          </Link>
          <button type="button" className="btn btn-secondary" onClick={exportToFile}>
            기록을 파일로 내려받기
          </button>
        </div>
        <p className="mt-4 text-sm text-gray-600">
          {STORAGE_SCOPE_TEXT} 내려받은 파일은 처음 화면의 [기록 불러오기]로 되돌릴 수 있습니다.
        </p>
        <p className="mt-2 text-sm text-gray-600">
          오류의 자세한 내용은 표시하지 않습니다. 입력하신 내용이 섞여 있을 수 있기 때문입니다.
        </p>
      </div>
    </div>
  )
}

export default Boundary
