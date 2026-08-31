import { useEffect, useState } from 'react'
import { Routes, Route, Link, NavLink, useLocation } from 'react-router-dom'
import { DiagnosisProvider, useJourney } from './lib/diagnosis-context.jsx'
import { SaveStatus, JourneyFlash, STORAGE_SCOPE_TEXT } from './components/Journey.jsx'
import { OPERATOR, operatorEmail } from './data/privacy.js'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import { PlainProvider, usePlain } from './lib/plain.jsx'
import { TourProvider } from './lib/tour.jsx'
import Tour from './components/Tour.jsx'
import { PLAIN_NOTICE } from './data/plain.js'
import LawVersions from './components/LawVersions.jsx'
import Landing from './pages/Landing.jsx'
import Diagnose from './pages/Diagnose.jsx'
import Document from './pages/Document.jsx'
import Strategy from './pages/Strategy.jsx'
import Next from './pages/Next.jsx'
import Response from './pages/Response.jsx'

/**
 * 네비게이션은 5개다.
 *
 * 모바일 처리 방식 결정: **햄버거 메뉴를 쓰지 않고 두 줄로 흘린다.**
 *   - 5개는 접어 숨길 만큼 많지 않다
 *   - 햄버거 아이콘은 고령층에게 해독 부담을 준다 (세부주제: 고령층 디지털 격차)
 *   - 접으면 열고 닫는 상태·포커스 가둠을 직접 관리해야 하고, 그만큼 깨질 곳이 늘어난다
 *   - 가로 스크롤로 처리하면 오른쪽 항목이 화면 밖에 숨는다
 *   → flex-wrap. 375px 에서 두 줄이 되지만 다섯 개가 모두 보이고 모두 탭으로 닿는다.
 */
const NAV = [
  { to: '/diagnose', label: '진단' },
  { to: '/document', label: '서식' },
  { to: '/strategy', label: '전략' },
  { to: '/next', label: '이후 절차' },
  { to: '/response', label: '회신 해석' },
]

const FONT_SCALES = [
  { id: 'base', label: '가', title: '기본 글자 크기' },
  { id: 'lg', label: '가', title: '큰 글자' },
  { id: 'xl', label: '가', title: '더 큰 글자' },
]

const FONT_SCALE_KEY = 'wy-font-scale'

/**
 * 글자 크기 조절.
 *
 * 값은 <html data-font-scale> 에 얹고, 실제 크기 변경은 index.css 의
 * @media screen 블록에서만 일어난다. → **인쇄 결과에는 영향이 없다.**
 *
 * 이 값만 localStorage 에 남긴다. 개인정보가 아니고, 매번 다시 맞추게 하면
 * 접근성 설정으로서 의미가 없기 때문이다. 입력 내용은 여전히 아무것도 저장하지 않는다.
 */
function FontScale() {
  const [scale, setScale] = useState('base')

  useEffect(() => {
    try {
      const saved = localStorage.getItem(FONT_SCALE_KEY)
      if (saved && FONT_SCALES.some((s) => s.id === saved)) setScale(saved)
    } catch {
      /* 저장소를 못 쓰는 환경이면 기본 크기로 둔다 */
    }
  }, [])

  useEffect(() => {
    document.documentElement.dataset.fontScale = scale
    try {
      localStorage.setItem(FONT_SCALE_KEY, scale)
    } catch {
      /* 무시 */
    }
  }, [scale])

  return (
    <div className="flex items-center gap-1">
      <span className="sr-only text-sm text-gray-500 sm:not-sr-only sm:mr-1" id="font-scale-label">
        글자 크기
      </span>
      <div className="flex overflow-hidden rounded-md border border-gray-400" role="group" aria-labelledby="font-scale-label">
        {FONT_SCALES.map((s, i) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setScale(s.id)}
            aria-pressed={scale === s.id}
            title={s.title}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center px-2 leading-none ${
              scale === s.id ? 'bg-ink-700 text-white' : 'bg-white text-gray-700 hover:bg-ink-50'
            }`}
            style={{ fontSize: `${0.875 + i * 0.25}rem` }}
          >
            <span aria-hidden="true">{s.label}</span>
            <span className="sr-only">{s.title}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/**
 * 쉬운 말 보기 토글.
 * 색만으로 상태를 알리지 않도록 aria-pressed 와 체크 글리프를 함께 준다.
 */
function PlainToggle() {
  const { plain, setPlain } = usePlain()
  return (
    <button
      type="button"
      onClick={() => setPlain(!plain)}
      aria-pressed={plain}
      className={`inline-flex min-h-11 items-center rounded-md border px-3 text-sm ${
        plain
          ? 'border-ink-700 bg-ink-700 text-white'
          : 'border-gray-400 bg-white text-gray-700 hover:bg-ink-50'
      }`}
    >
      {plain && <span aria-hidden="true">✓ </span>}
      쉬운 말
    </button>
  )
}

/** 무엇이 바뀌고 무엇이 안 바뀌는지를 화면에서 밝힌다 */
function PlainNotice() {
  const { plain } = usePlain()
  if (!plain) return null
  return (
    <div className="no-print border-b border-ink-400 bg-ink-50">
      <p className="mx-auto max-w-3xl px-4 py-2 text-sm text-ink-900">
        <b>{PLAIN_NOTICE.title}</b> — {PLAIN_NOTICE.body}
      </p>
    </div>
  )
}

/**
 * 파일을 불러오거나 기록을 지우면 세대 번호가 올라간다.
 * 각 화면이 useState 초기값으로 저장된 내용을 읽으므로, 그때 화면을 새로 마운트해야
 * 불러온 내용이 실제로 반영된다.
 */
/**
 * 바닥글의 법령 판본 블록.
 * 첫 화면에서는 권리 목록 바로 뒤(본문 안)에 두었으므로 여기서는 감춘다.
 * 다른 화면에서는 바닥글이 유일한 자리다.
 */
function FooterLawVersions() {
  const { pathname } = useLocation()
  if (pathname === '/') return null
  return <LawVersions collapsed className="mb-5 text-base" />
}

function AppRoutes() {
  const { generation } = useJourney()
  const { pathname } = useLocation()
  return (
    /* 경계는 경로마다 새로 만든다 — 한 화면이 죽어도 다른 화면으로 옮기면 정상으로 돌아온다.
       머리말·네비게이션·푸터는 이 경계 바깥이므로 함께 죽지 않는다. */
    <ErrorBoundary key={`${generation}:${pathname}`}>
    <Routes key={generation}>
      <Route path="/" element={<Landing />} />
      <Route path="/diagnose" element={<Diagnose />} />
      <Route path="/document" element={<Document />} />
      <Route path="/strategy" element={<Strategy />} />
      <Route path="/next" element={<Next />} />
      <Route path="/response" element={<Response />} />
      <Route
        path="*"
        element={
          <div className="py-10">
            <h1 className="text-[1.75rem] font-bold sm:text-[2.125rem]">찾는 화면이 없습니다</h1>
            <Link to="/" className="btn btn-secondary mt-4">
              처음으로
            </Link>
          </div>
        }
      />
    </Routes>
    </ErrorBoundary>
  )
}

export default function App() {
  return (
    <DiagnosisProvider>
      <PlainProvider>
      {/* 투어는 네 화면을 건너다닌다. 라우터 안, 화면 바깥에 둔다. */}
      <TourProvider>
      <div className="app-shell">
        {/* 키보드 사용자가 네비게이션 다섯 개를 매번 지나치지 않게 한다 */}
        <a
          href="#main"
          className="no-print sr-only focus:not-sr-only focus:absolute focus:left-3 focus:top-3 focus:z-50 focus:rounded-md focus:bg-ink-700 focus:px-4 focus:py-2 focus:text-white"
        >
          본문으로 건너뛰기
        </a>

        <header className="no-print border-b border-gray-400 bg-white">
          {/* ★ 375×667 에서 헤더가 첫 화면의 절반을 먹고 있었다(감사 지적).
                 데스크톱은 그대로 두고 작은 화면에서만 여백·부제·라벨을 줄인다.
                 기능은 하나도 빼지 않는다 — 자리만 줄인다. */}
          <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-x-3 gap-y-0 px-4 py-0.5 sm:gap-x-4 sm:gap-y-2 sm:py-1.5">
            <Link
              to="/"
              className="flex min-h-11 items-baseline gap-2 py-1.5 text-xl font-bold text-ink-800"
              aria-label="삼육이 — 처음으로"
            >
              삼육이
              <span className="hidden text-xs font-normal text-gray-500 sm:inline">
                자동화평가 설명·이의제기 지원 서비스
              </span>
            </Link>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-0 sm:gap-x-4">
              <SaveStatus />
              <PlainToggle />
              <FontScale />
            </div>
          </div>
          <nav aria-label="주요 화면" className="mx-auto max-w-3xl px-4 pb-0.5 sm:pb-1">
            <ul className="flex flex-wrap gap-x-1 gap-y-1">
              {NAV.map((n) => (
                <li key={n.to}>
                  <NavLink
                    to={n.to}
                    className={({ isActive }) =>
                      `flex min-h-11 items-center rounded-md px-2.5 text-base sm:px-3 ${
                        isActive
                          ? 'bg-ink-50 font-bold text-ink-800 underline decoration-2 underline-offset-4'
                          : 'text-gray-700 hover:bg-gray-100'
                      }`
                    }
                  >
                    {/* 현재 위치는 NavLink 가 aria-current="page" 로 알린다.
                        색·굵기만으로 알리지 않기 위해 밑줄도 함께 준다. */}
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
        </header>

        <PlainNotice />
        <JourneyFlash />

        <main id="main" className="app-main mx-auto w-full max-w-3xl px-4 print:max-w-none print:p-0">
          {/* 파일을 불러오거나 기록을 지우면 화면을 새로 마운트한다
              (각 화면이 useState 초기값으로 저장 내용을 읽기 때문) */}
          <AppRoutes />
        </main>

        <footer className="no-print mt-12 border-t border-gray-400 bg-white">
          <div className="mx-auto max-w-3xl px-4 py-6 text-sm text-gray-600">
            {/* 판본 표시는 각주가 아니라 근거다. 본문과 같은 크기로 둔다. */}
            <FooterLawVersions />
            {/* 공식 전체 표기는 여기에 한 번 둔다 */}
            <p className="mt-1 font-bold text-gray-800">
              삼육이 — 자동화평가 설명·이의제기 지원 서비스
            </p>
            <p className="mt-1">
              법률 자문이 아닙니다. 회원가입이 없고, 작성하신 내용을 서버에 저장하지 않습니다.
            </p>
            <p className="mt-1">{STORAGE_SCOPE_TEXT}</p>
            {/* ★ 운영 주체와 연락 경로. 없으면 "만든 사람을 알 수 없는 서비스"가 된다. */}
            <p className="mt-3 border-t border-gray-300 pt-3">
              만든 곳 <b className="text-gray-800">{OPERATOR.team}</b>
              {' · '}
              {OPERATOR.contactLabel}{' '}
              {/* 주소는 한 덩어리 텍스트로 그린다 — 드래그해 복사하면 그대로 붙는다 */}
              <a className="underline" href={`mailto:${operatorEmail()}`}>
                {operatorEmail()}
              </a>
            </p>
          </div>
        </footer>

        <Tour />
      </div>
      </TourProvider>
      </PlainProvider>
    </DiagnosisProvider>
  )
}
