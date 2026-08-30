/**
 * 여정 저장소.
 *
 * ── 설계 제약 (CLAUDE.md 민감정보 처리 원칙) ──────────────────────
 * 1. **서버에 저장하지 않는다.** 계정도 로그인도 없다.
 * 2. 기록은 사용 중인 브라우저의 localStorage 에만 있다.
 * 3. 기기 간 연속성은 **파일 내보내기/불러오기**로만 만든다.
 * 4. 주민등록번호는 애초에 수집하지 않으므로 저장 대상에도 없다.
 * 5. 붙여넣은 **회신 원문은 저장하지 않는다.** 해석 결과(항목 목록)만 남긴다.
 *    원문에는 우리가 굳이 붙들고 있을 이유가 없는 개인 신용정보가 그대로 들어 있다.
 * ────────────────────────────────────────────────────────────────
 *
 * 저장이 불가능한 환경(시크릿 모드, 저장소 차단, 용량 초과)에서도
 * **기능이 죽지 않아야 한다.** 모든 접근을 try/catch 로 감싸고 실패는 값으로 돌려준다.
 */

/** 저장 형식 버전. 형식이 바뀌면 올리고 migrate() 에 경로를 추가한다. */
export const SCHEMA_VERSION = 1

/** 키 네임스페이스 */
const NS = 'wae:journey'
const KEY_STATE = `${NS}:state`

/** 내보내기 파일임을 알아보는 표지 */
const FILE_MARKER = 'wae.journey'

/* ── 빈 상태 ──────────────────────────────────────────────────── */

export const EMPTY_DIAGNOSIS = {
  eventId: null,
  counterpartyId: null,
  institutionSectorId: '',
  customInstitution: '',
  reason: '',
  routingBranchId: null,
  sampleId: null,
  /** 한도 축소 × 은행 조합에서만 쓰인다 ('loan' | 'card') */
  limitKind: null,
  /** /strategy 에서 사용자가 고른 R3 후보. 서식 2 섹션 3으로 넘어간다. */
  selectedCandidates: [],
  /** /response 에서 "사실과 다르다"고 표시한 항목. 서식 2 섹션 2로 넘어간다. */
  correctionRows: [],
  /** /response 에서 설명되지 않은 것으로 판정된 유형. 서식 1 재요구에 쓴다. */
  missingRequestItems: [],
}

export const EMPTY_JOURNEY = {
  schemaVersion: SCHEMA_VERSION,
  updatedAt: null,
  diagnosis: EMPTY_DIAGNOSIS,
  /** /strategy 결과. 다시 들어와도 후보를 새로 만들지 않아도 되게 한다. */
  strategy: { notice: null, candidates: [], picked: [], source: null },
  /** 서식 작성 내용. 주민등록번호는 여기에도 없다. */
  form: {
    tab: null,
    personal: { name: '', phone: '', email: '' },
    form1: { selectedItems: null, hopeResult: '', consent: null },
    form2: { enabled: null, rows: null, favorable: null, recipient: '' },
    /**
     * 복수 기관 동시 행사.
     *
     * 기본은 **한 건**이다 (위 form1/form2 — 진단이 정한 상대방에게 낼 것).
     * 두 곳에 각각 내야 할 때만 두 번째 건이 생긴다.
     *   second.counterpartyId — 'CB' | 'FI'
     *   second.form1          — 두 번째 건의 설명요구서 작성 내용
     * 지금 어느 건을 보고 있는지는 activeCase 가 가리킨다 ('base' | 'second').
     */
    activeCase: null,
    second: null,
    /**
     * 서식 2를 여러 벌 만들어야 하는 경우.
     *
     * ★ 상대방을 고르는 것이 아니다. 라우팅이 other(타 금융회사)로 판정됐을 때,
     *   **정정할 정보가 발생한 회사가 여럿일 수 있어서** 생기는 목록이다.
     *   제출처는 여전히 라우팅이 정한다. 사용자가 바꾸는 것이 아니다.
     *
     *   form2Index 0 = 기본(위 form2), 1..n = form2Extras[n-1]
     */
    form2Index: 0,
    form2Extras: [],
  },
  /** /response 해석 결과. 붙여넣은 원문은 담지 않는다. */
  response: { interpretation: null, errors: [], catOverrides: {} },
  /** 인쇄·제출 기록. 서식 id 별로 둔다. */
  milestones: {},
}

/* ── 정규화 ──────────────────────────────────────────────────── */

/** /strategy 후보의 출처. 'ai' 만 사용자 서술을 읽고 고른 것이다. */
const STRATEGY_SOURCES = ['ai', 'cached', 'fallback']

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v)
const str = (v, d = '') => (typeof v === 'string' ? v : d)
const arr = (v, d = []) => (Array.isArray(v) ? v : d)

/**
 * 불러온 값을 우리 모양으로 강제한다.
 * 파일도 저장소도 믿지 않는다. 모르는 키는 버리고 빠진 키는 기본값으로 채운다.
 */
export function normalizeJourney(raw) {
  const j = isObj(raw) ? raw : {}
  const d = isObj(j.diagnosis) ? j.diagnosis : {}
  const s = isObj(j.strategy) ? j.strategy : {}
  const f = isObj(j.form) ? j.form : {}
  const f1 = isObj(f.form1) ? f.form1 : {}
  const f2 = isObj(f.form2) ? f.form2 : {}
  const p = isObj(f.personal) ? f.personal : {}
  const r = isObj(j.response) ? j.response : {}

  return {
    schemaVersion: SCHEMA_VERSION,
    updatedAt: typeof j.updatedAt === 'string' ? j.updatedAt : null,
    diagnosis: {
      eventId: typeof d.eventId === 'string' ? d.eventId : null,
      counterpartyId: typeof d.counterpartyId === 'string' ? d.counterpartyId : null,
      institutionSectorId: str(d.institutionSectorId),
      customInstitution: str(d.customInstitution),
      reason: str(d.reason),
      routingBranchId: typeof d.routingBranchId === 'string' ? d.routingBranchId : null,
      sampleId: typeof d.sampleId === 'string' ? d.sampleId : null,
      limitKind: typeof d.limitKind === 'string' ? d.limitKind : null,
      selectedCandidates: arr(d.selectedCandidates).filter(isObj),
      correctionRows: arr(d.correctionRows).filter(isObj),
      missingRequestItems: arr(d.missingRequestItems).filter((x) => typeof x === 'string'),
    },
    strategy: {
      notice: typeof s.notice === 'string' ? s.notice : null,
      candidates: arr(s.candidates).filter(isObj),
      picked: arr(s.picked).filter((x) => Number.isInteger(x)),
      /** 후보가 어디서 왔는지. 화면이 'AI가 고른 것'과 '일반 목록'을 구분해 말한다. */
      source: STRATEGY_SOURCES.includes(s.source) ? s.source : null,
    },
    form: {
      tab: typeof f.tab === 'string' ? f.tab : null,
      // 주민등록번호는 수집하지 않으므로 여기에도 자리가 없다
      personal: { name: str(p.name), phone: str(p.phone), email: str(p.email) },
      form1: {
        selectedItems: Array.isArray(f1.selectedItems)
          ? f1.selectedItems.filter((x) => typeof x === 'string')
          : null,
        hopeResult: str(f1.hopeResult),
        consent: f1.consent === 'agree' || f1.consent === 'disagree' ? f1.consent : null,
      },
      form2: {
        enabled: isObj(f2.enabled) ? f2.enabled : null,
        rows: isObj(f2.rows) ? f2.rows : null,
        favorable: Array.isArray(f2.favorable) ? f2.favorable.filter(isObj) : null,
        recipient: str(f2.recipient),
      },
      activeCase: f.activeCase === 'second' ? 'second' : f.activeCase === 'base' ? 'base' : null,
      second: normalizeSecondCase(f.second),
      form2Extras: normalizeForm2Extras(f.form2Extras),
      form2Index: normalizeForm2Index(f.form2Index, normalizeForm2Extras(f.form2Extras).length),
    },
    response: {
      interpretation: isObj(r.interpretation) ? r.interpretation : null,
      errors: arr(r.errors).filter((x) => Number.isInteger(x)),
      catOverrides: isObj(r.catOverrides) ? r.catOverrides : {},
    },
    milestones: isObj(j.milestones)
      ? Object.fromEntries(
          Object.entries(j.milestones)
            .filter(([, v]) => isObj(v))
            .map(([k, v]) => [
              k,
              {
                printedAt: typeof v.printedAt === 'string' ? v.printedAt : null,
                submittedAt: typeof v.submittedAt === 'string' ? v.submittedAt : null,
              },
            ]),
        )
      : {},
  }
}

/** 두 번째 건 — 설명요구서(서식 1)만 갖는다. 없으면 null. */
function normalizeSecondCase(raw) {
  if (!isObj(raw)) return null
  const cp = raw.counterpartyId
  if (cp !== 'CB' && cp !== 'FI') return null
  const f1 = isObj(raw.form1) ? raw.form1 : {}
  return {
    counterpartyId: cp,
    form1: {
      selectedItems: Array.isArray(f1.selectedItems)
        ? f1.selectedItems.filter((x) => typeof x === 'string')
        : null,
      hopeResult: str(f1.hopeResult),
      consent: f1.consent === 'agree' || f1.consent === 'disagree' ? f1.consent : null,
    },
  }
}

/** 추가 서식 2 건. 넘치는 값은 버린다. */
export const MAX_FORM2_EXTRAS = 4

/**
 * 저장된 내용이 실제로 있는가 (빈 여정과 구분).
 *
 * ★ 화면을 옮기기만 해도 빈 여정이 한 번 저장되면서 시각이 찍힌다.
 *   그것만 보고 "저장됨"을 띄우면, 아무것도 입력하지 않은 사람에게 거짓을 말하는 것이 된다.
 *
 * ★ JSON.stringify 비교로는 안 된다. 저장 경로에 따라 **키 순서가 달라져서**
 *   내용이 같아도 문자열이 달라진다(form2Index / form2Extras 순서가 실제로 갈렸다).
 *   그래서 순서를 보지 않는 깊은 비교를 쓴다.
 */
function sameValue(a, b) {
  if (a === b) return true
  if (Array.isArray(a) || Array.isArray(b)) {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false
    return a.every((v, i) => sameValue(v, b[i]))
  }
  if (a && b && typeof a === 'object' && typeof b === 'object') {
    const ka = Object.keys(a)
    const kb = Object.keys(b)
    if (ka.length !== kb.length) return false
    return ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && sameValue(a[k], b[k]))
  }
  return false
}

/** 여정에 담긴 내용이 있는지. 버전·저장시각은 내용이 아니므로 보지 않는다. */
export function hasSavedContent(journey) {
  if (!journey) return false
  return ['diagnosis', 'strategy', 'form', 'response', 'milestones'].some(
    (k) => !sameValue(journey[k], EMPTY_JOURNEY[k]),
  )
}

function normalizeForm2Extras(raw) {
  if (!Array.isArray(raw)) return []
  return raw
    .filter(isObj)
    .slice(0, MAX_FORM2_EXTRAS)
    .map((e) => ({
      recipient: str(e.recipient),
      enabled: isObj(e.enabled) ? e.enabled : null,
      rows: isObj(e.rows) ? e.rows : null,
      favorable: Array.isArray(e.favorable) ? e.favorable.filter(isObj) : null,
    }))
}

function normalizeForm2Index(raw, extraCount) {
  const n = Number(raw)
  if (!Number.isInteger(n) || n < 0 || n > extraCount) return 0
  return n
}

/** 옛 형식을 현재 형식으로 올린다. 지금은 v1 뿐이다. */
function migrate(raw, version) {
  if (version === SCHEMA_VERSION) return raw
  // 아직 올릴 경로가 없다. 정규화가 빠진 키를 기본값으로 채운다.
  return raw
}

/* ── localStorage ────────────────────────────────────────────── */

/** 저장소를 쓸 수 있는지. 시크릿 모드·저장소 차단에서 false. */
export function isStorageAvailable() {
  try {
    const k = `${NS}:probe`
    localStorage.setItem(k, '1')
    localStorage.removeItem(k)
    return true
  } catch {
    return false
  }
}

/** @returns {{journey: object, found: boolean, error: string|null}} */
export function loadJourney() {
  try {
    const raw = localStorage.getItem(KEY_STATE)
    if (!raw) return { journey: EMPTY_JOURNEY, found: false, error: null }
    const parsed = JSON.parse(raw)
    const version = Number(parsed?.schemaVersion) || 0
    if (version > SCHEMA_VERSION) {
      return { journey: EMPTY_JOURNEY, found: false, error: 'newer_version' }
    }
    return { journey: normalizeJourney(migrate(parsed, version)), found: true, error: null }
  } catch {
    // 저장된 값이 깨졌으면 없는 것으로 본다. 화면이 멈추게 두지 않는다.
    return { journey: EMPTY_JOURNEY, found: false, error: 'unreadable' }
  }
}

/** @returns {boolean} 저장 성공 여부 */
export function saveJourney(journey) {
  try {
    localStorage.setItem(KEY_STATE, JSON.stringify(journey))
    return true
  } catch {
    return false
  }
}

export function clearJourney() {
  try {
    localStorage.removeItem(KEY_STATE)
    return true
  } catch {
    return false
  }
}

/* ── 파일 내보내기 / 불러오기 ─────────────────────────────────── */

export function buildExport(journey) {
  return {
    /** 우리 파일인지 알아보는 표지 */
    app: FILE_MARKER,
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    journey: normalizeJourney(journey),
  }
}

/**
 * 파일명에 날짜를 넣는다 (같은 날 여러 번 내보내도 알아볼 수 있게 시각까지).
 *
 * ★ 파일명은 사람이 알아보라고 붙이는 것뿐이다. 불러오기는 **파일명을 보지 않는다.**
 *   parseImport 는 파일 안의 표지(FILE_MARKER)만 확인하므로,
 *   서비스명이 바뀌기 전 이름으로 내보낸 파일도 그대로 열린다.
 *   그래서 FILE_MARKER 는 바꾸지 않는다. 바꾸면 기존 파일이 안 열린다.
 */
export function exportFileName(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `삼육이-기록-${now.getFullYear()}${p(now.getMonth() + 1)}${p(now.getDate())}-${p(
    now.getHours(),
  )}${p(now.getMinutes())}.json`
}

/**
 * 불러온 텍스트를 검증한다. 우리 형식이 아니면 왜 아닌지 알려준다.
 * @returns {{ok: true, journey: object} | {ok: false, error: string}}
 */
export function parseImport(text) {
  let data
  try {
    data = JSON.parse(text)
  } catch {
    return { ok: false, error: 'JSON 파일이 아닙니다. 내보내기로 만든 .json 파일을 넣어 주세요.' }
  }
  if (!isObj(data)) {
    return { ok: false, error: 'JSON 파일이 아닙니다. 내보내기로 만든 .json 파일을 넣어 주세요.' }
  }
  if (data.app !== FILE_MARKER) {
    return {
      ok: false,
      error: '이 서비스에서 내보낸 파일이 아닙니다. 다른 서비스의 파일은 불러올 수 없습니다.',
    }
  }
  const version = Number(data.schemaVersion)
  if (!Number.isFinite(version) || version < 1) {
    return { ok: false, error: '파일의 형식 버전을 읽을 수 없습니다. 파일이 손상된 것 같습니다.' }
  }
  if (version > SCHEMA_VERSION) {
    return {
      ok: false,
      error: `더 새로운 버전(${version})에서 내보낸 파일입니다. 이 화면을 새로고침해 최신 버전으로 다시 시도해 주세요.`,
    }
  }
  if (!isObj(data.journey)) {
    return { ok: false, error: '파일에 기록이 들어 있지 않습니다.' }
  }
  return { ok: true, journey: normalizeJourney(migrate(data.journey, version)) }
}

/* ── 표시용 ──────────────────────────────────────────────────── */

/** "오늘 22:14" / "8월 26일 22:14" — 상대 시각 대신 사실만 적는다 */
export function formatWhen(iso, now = new Date()) {
  if (!iso) return null
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  const sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate()
  return sameDay ? `오늘 ${time}` : `${d.getMonth() + 1}월 ${d.getDate()}일 ${time}`
}

/**
 * 날짜 문자열을 **그 지역의 그 날**로 읽는다.
 *
 * new Date('2026-08-24') 는 표준상 UTC 자정으로 해석된다. 한국(UTC+9)에서는
 * 같은 날이지만 서쪽 시간대에서는 하루 전으로 표시된다.
 * 제출일은 사용자가 달력에서 고른 그 날짜여야 하므로 직접 쪼갠다.
 */
function parseDay(value) {
  if (typeof value === 'string') {
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim())
    if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  }
  return new Date(value)
}

/** "8월 26일" */
export function formatDate(value) {
  if (!value) return null
  const d = parseDay(value)
  if (Number.isNaN(d.getTime())) return null
  return `${d.getMonth() + 1}월 ${d.getDate()}일`
}

/**
 * 제출일로부터 며칠 지났는지.
 *
 * ★ "며칠 남았다"는 만들지 않는다. 법령에 처리 기한 규정이 없으므로
 *   근거 없는 카운트다운이 된다. 경과일은 사실이므로 표시해도 된다.
 */
export function daysSince(value, now = new Date()) {
  if (!value) return null
  const d = parseDay(value)
  if (Number.isNaN(d.getTime())) return null
  const a = new Date(d.getFullYear(), d.getMonth(), d.getDate())
  const b = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((b - a) / 86_400_000)
  return diff >= 0 ? diff : null
}

/** 오늘 날짜를 <input type="date"> 값으로 */
export function todayInputValue(now = new Date()) {
  const p = (n) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${p(now.getMonth() + 1)}-${p(now.getDate())}`
}
