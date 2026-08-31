import { createContext, useContext, useId } from 'react'
import { CORRECTION_ROUTING, FORMS_BY_ID } from '../data/law.js'

/**
 * 그림 세 장.
 *
 * ── 규칙 ────────────────────────────────────────────────────────
 * ★ 외부 의존성 없음. 인라인 SVG 뿐이다. 아이콘 패키지도 차트 라이브러리도 쓰지 않는다.
 * ★ 색은 currentColor 와 우리 팔레트(ink/seal/gray)만 쓴다.
 * ★ 각 그림에 role="img" + <title> + <desc>. 그림을 못 보는 사람도 같은 내용을 듣는다.
 * ★ 375px 에서 글자가 읽혀야 한다. 가로 그림을 그대로 줄이면 8pt 가 되므로
 *   **세로 배치 변형을 따로 그린다.** (sm 미만 = 세로, sm 이상 = 가로)
 * ★ 법령 문구는 여기에 새로 쓰지 않는다. 필요한 라벨은 law.js 에서 읽는다.
 * ────────────────────────────────────────────────────────────────
 *
 * 인쇄에는 넣지 않는다(no-print). 서식은 고시 서식 그대로여야 한다.
 */

/* ── 공통 조각 ──────────────────────────────────────────────── */

const FILL = { ink: '#e4ebf3', seal: '#f9ead3', white: '#ffffff', gray: '#f3f2ef' }
const STROKE = { ink: '#294061', seal: '#a97220', gray: '#9d998f' }

function Box({ x, y, w, h, tone = 'ink', children, sub, dashed = false, r = 8 }) {
  const lines = Array.isArray(children) ? children : [children]
  const cx = x + w / 2
  const startY = y + h / 2 - ((lines.length - 1) * 19) / 2 + (sub ? -8 : 0)
  return (
    <g>
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={r}
        fill={FILL[tone] ?? FILL.white}
        stroke={STROKE[tone] ?? STROKE.ink}
        strokeWidth="2"
        strokeDasharray={dashed ? '6 4' : undefined}
      />
      {lines.map((t, i) => (
        <text
          key={i}
          x={cx}
          y={startY + i * 19}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="16"
          fontWeight="700"
          fill="#23211d"
        >
          {t}
        </text>
      ))}
      {sub && (
        <text
          x={cx}
          y={y + h - 14}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize="13"
          fill="#55524b"
        >
          {sub}
        </text>
      )}
    </g>
  )
}

/**
 * ★ marker id 는 SVG 마다 달라야 한다.
 *
 *   가로판과 세로판을 CSS 로 번갈아 보이게 두는데, 둘 다 같은 id 로 marker 를 정의하면
 *   문서에 같은 id 가 둘이 되고 url(#arrow) 는 **문서 순서상 첫 번째**로 풀린다.
 *   375px 에서는 그 첫 번째가 display:none 인 가로판 안이라 **화살촉이 하나도 안 그려졌다.**
 *   (실제로 모바일 그림에서 방향이 사라졌다. 닫힌 고리가 선 다발로 보였다.)
 *   그래서 SVG 마다 useId() 로 접두사를 만들어 문맥으로 내려준다.
 */
const MarkerPrefix = createContext('')

/** 화살표. path 를 그대로 받는다. */
function Arrow({ d, tone = 'ink', dashed = false, marker = 'arrow' }) {
  const prefix = useContext(MarkerPrefix)
  return (
    <path
      d={d}
      fill="none"
      stroke={STROKE[tone] ?? STROKE.ink}
      strokeWidth="2.5"
      strokeDasharray={dashed ? '6 5' : undefined}
      markerEnd={`url(#${prefix}${marker})`}
    />
  )
}

function Defs() {
  const prefix = useContext(MarkerPrefix)
  return (
    <defs>
      <marker id={`${prefix}arrow`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={STROKE.ink} />
      </marker>
      <marker id={`${prefix}arrowSeal`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
        <path d="M 0 0 L 10 5 L 0 10 z" fill={STROKE.seal} />
      </marker>
    </defs>
  )
}

function Caption({ x, y, children, anchor = 'middle', size = 14, tone = '#55524b', weight = 400 }) {
  return (
    <text x={x} y={y} textAnchor={anchor} fontSize={size} fill={tone} fontWeight={weight}>
      {children}
    </text>
  )
}

/**
 * 그림 한 장을 감싼다.
 * @param {string} id  aria 연결용 (title/desc)
 */
function Figure({ id, title, desc, caption, wide, tall, className = '' }) {
  const label = `${id}-t`
  const described = `${id}-d`
  const uid = useId().replace(/:/g, '')
  return (
    <figure className={`no-print ${className}`}>
      <div className="overflow-x-auto">
        {/* 가로 배치 — sm 이상 */}
        <svg
          role="img"
          aria-labelledby={`${label} ${described}`}
          viewBox={wide.viewBox}
          data-diagram={id}
          data-layout="wide"
          className="hidden h-auto w-full sm:block"
        >
          <title id={label}>{title}</title>
          <desc id={described}>{desc}</desc>
          <MarkerPrefix.Provider value={`${uid}w-`}>
            <Defs />
            {wide.children}
          </MarkerPrefix.Provider>
        </svg>
        {/* 세로 배치 — 375px 에서 글자가 읽히게 */}
        <svg
          role="img"
          aria-labelledby={`${label}-m ${described}-m`}
          viewBox={tall.viewBox}
          data-diagram={id}
          data-layout="tall"
          className="h-auto w-full sm:hidden"
        >
          <title id={`${label}-m`}>{title}</title>
          <desc id={`${described}-m`}>{desc}</desc>
          <MarkerPrefix.Provider value={`${uid}t-`}>
            <Defs />
            {tall.children}
          </MarkerPrefix.Provider>
        </svg>
      </div>
      {caption && (
        <figcaption className="mt-2 text-sm text-gray-600">{caption}</figcaption>
      )}
    </figure>
  )
}

/* ══ A. 권리 행사 전 주기 루프 ═══════════════════════════════ */

const LOOP_DESC =
  '진단과 전략을 거쳐 서식에 이르고, 서식에서 제출, 회신 해석, 정정·재산출로 이어진 다음 ' +
  '다시 서식으로 돌아오는 닫힌 고리입니다. 서식·제출·회신 해석·정정 재산출 네 단계가 고리를 이룹니다.'

export function LoopDiagram({ className = '' }) {
  const wide = {
    viewBox: '0 0 880 330',
    children: (
      <>
        <Box x={8} y={118} w={112} h={60} tone="gray" sub="무슨 일이 있었나">
          진단
        </Box>
        <Arrow d="M 124 148 H 158" />
        <Box x={162} y={118} w={112} h={60} tone="gray" sub="무엇을 낼까">
          전략
        </Box>
        {/* 전략 → 고리의 첫 칸(서식). 허공에서 끊기지 않게 서식의 왼쪽 변으로 넣는다. */}
        <Arrow d="M 278 148 H 300 V 71 H 322" />

        {/* 닫힌 고리 네 칸 */}
        <Box x={326} y={40} w={168} h={62} sub="고시 서식 작성">
          서식
        </Box>
        <Box x={628} y={40} w={168} h={62} sub="법정 채널 4가지">
          제출
        </Box>
        <Box x={628} y={196} w={168} h={62} sub="무엇이 빠졌나">
          회신 해석
        </Box>
        <Box x={326} y={196} w={168} h={62} tone="seal" sub="법 §36-2 ②">
          정정 · 재산출
        </Box>

        <Arrow d="M 498 71 H 622" />
        <Arrow d="M 712 106 V 192" />
        <Arrow d="M 622 227 H 502" />
        <Arrow d="M 410 192 V 108" tone="seal" marker="arrowSeal" />

        {/* 고리 안쪽은 좁다(134). 짧게 두 줄로 넣고 긴 설명은 아래로 내린다. */}
        <Caption x={561} y={140} weight={700} tone="#294061" size={15}>
          한 바퀴가
        </Caption>
        <Caption x={561} y={161} weight={700} tone="#294061" size={15}>
          닫힙니다
        </Caption>
        <Caption x={64} y={200} size={13}>
          여기서 시작
        </Caption>
        <Caption x={440} y={306} size={15}>
          회신 해석에서 찾은 오류가 다음 서식으로 그대로 넘어갑니다
        </Caption>
      </>
    ),
  }
  const tall = {
    viewBox: '0 0 360 620',
    children: (
      <>
        <Box x={96} y={8} w={200} h={56} tone="gray" sub="무슨 일이 있었나">
          진단
        </Box>
        <Arrow d="M 196 68 V 92" />
        <Box x={96} y={96} w={200} h={56} tone="gray" sub="무엇을 낼까">
          전략
        </Box>
        <Arrow d="M 196 156 V 180" />
        <Box x={96} y={184} w={200} h={60} sub="고시 서식 작성">
          서식
        </Box>
        <Arrow d="M 196 248 V 272" />
        <Box x={96} y={276} w={200} h={60} sub="법정 채널 4가지">
          제출
        </Box>
        <Arrow d="M 196 340 V 364" />
        <Box x={96} y={368} w={200} h={60} sub="무엇이 빠졌나">
          회신 해석
        </Box>
        <Arrow d="M 196 432 V 456" />
        <Box x={96} y={460} w={200} h={60} tone="seal" sub="법 §36-2 ②">
          정정 · 재산출
        </Box>
        {/* 왼쪽으로 돌아 서식으로 */}
        <Arrow d="M 96 490 H 40 V 214 H 92" tone="seal" marker="arrowSeal" />
        <Caption x={196} y={556} weight={700} tone="#294061" size={15}>
          한 바퀴가 닫힙니다
        </Caption>
        <Caption x={196} y={578} size={13}>
          회신에서 찾은 오류가
        </Caption>
        <Caption x={196} y={596} size={13}>
          다음 서식으로 그대로 넘어갑니다
        </Caption>
      </>
    ),
  }
  return (
    <Figure
      id="dg-loop"
      title="권리 행사의 한 주기"
      desc={LOOP_DESC}
      caption="이 서비스가 “전 주기”라고 말할 때의 그림입니다. 서식에서 끝나지 않습니다."
      wide={wide}
      tall={tall}
      className={className}
    />
  )
}

/* ══ B. 판정 구조 — 무엇을 AI가, 무엇을 코드가 ═══════════════
 *
 * ★ 이 그림은 사용자의 질문("법조문도 AI가 지어낸 것 아닌가")에 답하는 자리다.
 *   우리가 무엇을 잘했는지 자랑하는 자리가 아니다. (2026-08-31 사용자 지적)
 *   슬로건("AI를 쓰되, 믿지 않는다")과 구현 예시 두 줄을 걷어냈다.
 *   남은 것은 흐름과 캡션 한 줄이다.
 */

const ARCH_DESC =
  '사용자가 쓴 상황 서술은 LLM 이 받아 맥락만 번역합니다. 법조문, 거절 사유, 서식 문구, 절차는 ' +
  '코드 안의 법령 상수가 결정합니다. 두 사이에 서버 검산이 있어, LLM 출력이 법의 구조에 맞는지 ' +
  '확인하고 맞지 않으면 버립니다. 화면에는 검산을 통과한 것만 나옵니다.'

export function ArchitectureDiagram({ className = '' }) {
  const wide = {
    viewBox: '0 0 880 400',
    children: (
      <>
        <Box x={330} y={8} w={220} h={54} tone="gray" sub="자유 서술 · 회신문">
          사용자가 쓴 것
        </Box>
        {/* 사용자가 쓴 것 → LLM. 한 번에 이어 그린다(허공에서 끊기지 않게). */}
        <Arrow d="M 440 66 V 120 H 590" />

        <Box x={596} y={100} w={252} h={80} sub="맥락만 옮긴다 · 판정하지 않는다">
          LLM
        </Box>
        <Box x={32} y={100} w={252} h={80} sub="법조문 · 거절 사유 · 서식 · 절차">
          법령 상수 · 코드
        </Box>

        <Caption x={520} y={112} size={12}>
          서술
        </Caption>

        <Box x={330} y={224} w={220} h={72} tone="seal" sub="법의 구조에 비추어 검사">
          서버 검산
        </Box>
        <Arrow d="M 722 184 V 246 H 554" tone="seal" marker="arrowSeal" />
        <Arrow d="M 158 184 V 260 H 326" />
        <Caption x={196} y={252} size={12} anchor="start">
          이 기준으로
        </Caption>

        <Box x={330} y={330} w={220} h={54}>
          화면에 나가는 것
        </Box>
        <Arrow d="M 440 300 V 326" />

        <Box x={640} y={330} w={180} h={54} tone="gray" dashed sub="근거가 안 맞으면" >
          버린다
        </Box>
        <Arrow d="M 554 268 H 730 V 326" tone="gray" dashed />

      </>
    ),
  }
  /*
   * ★ 세로판을 다시 그린 이유 (2026-08-31, 375px 실기)
   *   앞선 세로판은 네 상자를 한 줄로 세워 "사용자 → LLM → 법령 상수 → 서버 검산"으로
   *   읽혔다. 그러면 **법령 상수가 LLM 의 산물**처럼 보인다. 이 그림이 답하려는 질문
   *   ("법조문도 AI가 지어낸 것 아닌가")에 정반대로 답하는 셈이다.
   *   가로판은 처음부터 둘을 나란히 두고 서버 검산에서 만나게 그렸다.
   *   세로판도 같은 구조로 고친다 — LLM 은 오른쪽으로, 법령 상수는 왼쪽으로 돌아
   *   서버 검산의 양옆으로 들어온다. 둘 사이에는 화살표가 없다.
   */
  const tall = {
    viewBox: '0 0 360 474',
    children: (
      <>
        <Box x={60} y={8} w={240} h={56} tone="gray" sub="자유 서술 · 회신문">
          사용자가 쓴 것
        </Box>
        <Arrow d="M 180 68 V 92" />
        <Box x={60} y={96} w={240} h={68} sub="맥락만 옮긴다 · 판정하지 않는다">
          LLM
        </Box>
        {/* ★ 여기에 화살표를 두지 않는다. 법령 상수는 LLM 이 만든 것이 아니다. */}
        <Box x={60} y={192} w={240} h={68} tone="gray" sub="법조문 · 거절 사유 · 서식 · 절차">
          법령 상수 · 코드
        </Box>
        <Box x={60} y={300} w={240} h={68} tone="seal" sub="법의 구조에 비추어 검사">
          서버 검산
        </Box>
        {/* LLM 이 옮긴 것은 오른쪽으로 돌아 검산으로 */}
        <Arrow d="M 300 130 H 328 V 334 H 304" tone="seal" marker="arrowSeal" />
        {/* 법령 상수는 왼쪽으로 돌아 검산으로 — 이 기준으로 맞춰 본다 */}
        <Arrow d="M 60 226 H 32 V 334 H 56" />
        <Box x={12} y={400} w={164} h={60}>
          화면에 나가는 것
        </Box>
        <Box x={192} y={400} w={156} h={60} tone="gray" dashed sub="근거가 안 맞으면">
          버린다
        </Box>
        <Arrow d="M 110 368 V 396" />
        <Arrow d="M 250 368 V 396" tone="gray" dashed />
      </>
    ),
  }
  return (
    <Figure
      id="dg-arch"
      title="판정은 코드가, 번역은 AI가"
      desc={ARCH_DESC}
      caption="법정 사실은 결정론적으로, 사용자 맥락 해석만 LLM으로 처리합니다."
      wide={wide}
      tall={tall}
      className={className}
    />
  )
}

/* ══ C. 정정 라우팅 3분기 ═══════════════════════════════════ */

const R = Object.fromEntries(CORRECTION_ROUTING.branches.map((b) => [b.id, b]))
/** 그림 상자 안에서는 두 줄로 쓴다. "서식 1/2" 는 화면 전체에서 쓰는 우리 번호다. */
const FORM1 = [FORMS_BY_ID.explanationRequest.shortTitle, '(서식 1)']
const FORM2 = [FORMS_BY_ID.correctionRequest.shortTitle, '(서식 2)']

const ROUTING_DESC =
  `${CORRECTION_ROUTING.question} 이 회사와의 거래에서 생긴 기록이면 이 회사에, ` +
  '다른 회사와의 거래에서 생긴 기록이면 그 회사에 정정·재산출 요청서를 냅니다. ' +
  '모르겠으면 먼저 설명요구서로 기초정보의 개요를 물어 어느 회사에서 온 기록인지 확인한 뒤 요청서를 냅니다.'

/** 질문은 한 줄에 안 들어간다. 그림 상자 안에서만 두 줄로 끊는다. */
const ROUTING_Q_LINES = ['고치려는 내용이', '이 회사와의 거래에서 생긴 것인가요?']

/** 세로판의 갈래 하나. 질문에서 내려온 세로선에 팔을 뻗어 붙는다. */
function TallBranch({ y, spineX, label, tone, children }) {
  return (
    <g>
      {/* 줄기에서 갈라지는 지점 */}
      <circle cx={spineX} cy={y + 28} r="4.5" fill={STROKE.ink} />
      <Arrow d={`M ${spineX} ${y + 28} H ${spineX + 22}`} />
      <Box x={spineX + 26} y={y} w={300} h={56} tone={tone}>
        {label}
      </Box>
      {children}
    </g>
  )
}

export function RoutingDiagram({ className = '' }) {
  /*
   * ★ 상자 높이 주의: 두 줄 제목 + 부제가 들어가는 칸은 76 이상이어야 글자가 겹치지 않는다.
   *   (Box 는 제목을 가운데, 부제를 아래에서 14 위에 그린다)
   */
  const wide = {
    viewBox: '0 0 880 428',
    children: (
      <>
        <Box x={230} y={8} w={420} h={64} tone="gray">
          {ROUTING_Q_LINES}
        </Box>
        <path d="M 440 72 V 84" fill="none" stroke={STROKE.ink} strokeWidth="2.5" />
        <path d="M 150 84 H 730" fill="none" stroke={STROKE.ink} strokeWidth="2.5" />
        <Arrow d="M 150 84 V 104" />
        <Arrow d="M 440 84 V 104" />
        <Arrow d="M 730 84 V 104" />

        <Box x={20} y={108} w={260} h={64}>
          {R.own.chartLabel}
        </Box>
        <Box x={310} y={108} w={260} h={64}>
          {R.other.chartLabel}
        </Box>
        <Box x={600} y={108} w={260} h={64} tone="seal">
          {R.unknown.chartLabel}
        </Box>

        <Arrow d="M 150 176 V 284" />
        <Arrow d="M 440 176 V 284" />
        <Arrow d="M 730 176 V 200" tone="seal" marker="arrowSeal" />

        <Box x={20} y={288} w={260} h={76} sub={R.own.submitToLabel}>
          {FORM2}
        </Box>
        <Box x={310} y={288} w={260} h={76} sub={R.other.submitToLabel}>
          {FORM2}
        </Box>

        {/* 이 갈래만 두 단계 */}
        <Box x={600} y={204} w={260} h={76} tone="seal" sub="기초정보의 개요를 물어 출처 확인">
          {[`${FORM1[0]} 먼저`, FORM1[1]]}
        </Box>
        <Arrow d="M 730 284 V 308" tone="seal" marker="arrowSeal" />
        <Box x={600} y={312} w={260} h={76} sub="확인된 그 회사에 제출">
          {FORM2}
        </Box>
        <Caption x={730} y={410} size={14} tone="#8a5a18" weight={700}>
          이 경로만 두 단계입니다
        </Caption>
      </>
    ),
  }
  /*
   * ★ 세로판을 다시 그린 이유 (2026-08-31 사용자 지적, 375px 실기)
   *   앞선 세로판은 질문·갈래·결과를 **한 줄로 세워** 놓았다. 그래서
   *   "하나의 질문에서 셋으로 갈라진다"가 사라지고 여덟 칸짜리 순서도로 읽혔다.
   *   (갈래 A → 서식 → 갈래 B → 서식 … 순서대로 하는 일처럼 보인다)
   *   그림이 구조를 못 보여주면 없느니만 못하다.
   *
   *   고친 방법: 질문에서 **왼쪽 세로 줄기**를 내리고, 세 갈래가 각각 그 줄기에서
   *   갈라져 나오게 했다. 갈라지는 지점에 점을 찍고, 갈래와 그 결과는 줄기보다
   *   안쪽으로 들여썼다. 줄기를 눈으로 따라가면 갈라지는 곳이 셋이라는 것이 보인다.
   */
  const SPINE = 26
  const tall = {
    viewBox: '0 0 360 774',
    children: (
      <>
        <Box x={8} y={8} w={344} h={64} tone="gray">
          {ROUTING_Q_LINES}
        </Box>
        {/* 질문에서 내려오는 줄기. 마지막 갈래가 갈라지는 높이까지만 긋는다. */}
        <path
          d={`M ${SPINE} 72 V 496`}
          fill="none"
          stroke={STROKE.ink}
          strokeWidth="2.5"
          strokeLinecap="round"
        />
        <Caption x={SPINE + 14} y={92} anchor="start" size={13} tone="#294061" weight={700}>
          답에 따라 셋으로 갈립니다
        </Caption>

        <TallBranch y={100} spineX={SPINE} label={R.own.chartLabel}>
          <Arrow d="M 92 156 V 180" />
          <Box x={72} y={184} w={280} h={76} sub={R.own.submitToLabel}>
            {FORM2}
          </Box>
        </TallBranch>

        <TallBranch y={284} spineX={SPINE} label={R.other.chartLabel}>
          <Arrow d="M 92 340 V 364" />
          <Box x={72} y={368} w={280} h={76} sub={R.other.submitToLabel}>
            {FORM2}
          </Box>
        </TallBranch>

        <TallBranch y={468} spineX={SPINE} label={R.unknown.chartLabel} tone="seal">
          <Arrow d="M 92 524 V 548" tone="seal" marker="arrowSeal" />
          <Box x={72} y={552} w={280} h={76} tone="seal" sub="기초정보의 개요를 물어 출처 확인">
            {[`${FORM1[0]} 먼저`, FORM1[1]]}
          </Box>
          <Arrow d="M 92 628 V 652" tone="seal" marker="arrowSeal" />
          <Box x={72} y={656} w={280} h={76} sub="확인된 그 회사에 제출">
            {FORM2}
          </Box>
        </TallBranch>
        <Caption x={212} y={760} size={14} tone="#8a5a18" weight={700}>
          이 경로만 두 단계입니다
        </Caption>
      </>
    ),
  }
  return (
    <Figure
      id="dg-routing"
      title="정정·재산출 요청서를 어디로 내는가"
      desc={ROUTING_DESC}
      caption={`제출처는 고르는 것이 아니라 정보의 출처가 정합니다. 근거: ${CORRECTION_ROUTING.basis}`}
      wide={wide}
      tall={tall}
      className={className}
    />
  )
}
