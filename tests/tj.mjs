import {
  parseImport, buildExport, normalizeJourney, EMPTY_JOURNEY, SCHEMA_VERSION,
  daysSince, formatDate, formatWhen, exportFileName, todayInputValue, hasSavedContent,
} from '../src/lib/journey-storage.js'
let fail=0
const eq=(n,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);if(!ok)fail++;console.log(`${ok?'PASS':'FAIL'}  ${n}${ok?'':`\n   got  ${JSON.stringify(g)}\n   want ${JSON.stringify(w)}`}`)}
const ok=(n,c,d='')=>{if(!c)fail++;console.log(`${c?'PASS':'FAIL'}  ${n}${d?' — '+d:''}`)}

// [1] 잘못된 입력
ok('[1] JSON 아님', parseImport('이건 JSON이 아니다').error?.includes('JSON 파일이 아닙니다'))
ok('[1] 빈 문자열', !parseImport('').ok)
ok('[1] 배열', !parseImport('[1,2,3]').ok)
ok('[1] 다른 서비스 JSON', parseImport('{"app":"other-service","data":1}').error?.includes('이 서비스에서 내보낸 파일이 아닙니다'))
ok('[1] app 없음', parseImport('{"schemaVersion":1,"journey":{}}').error?.includes('이 서비스에서 내보낸 파일이 아닙니다'))
ok('[1] journey 없음', parseImport('{"app":"wae.journey","schemaVersion":1}').error?.includes('기록이 들어 있지 않습니다'))
ok('[1] 버전 미래', parseImport('{"app":"wae.journey","schemaVersion":99,"journey":{}}').error?.includes('더 새로운 버전'))
ok('[1] 버전 깨짐', parseImport('{"app":"wae.journey","schemaVersion":"x","journey":{}}').error?.includes('형식 버전'))

// [2] 왕복
const j = normalizeJourney({
  diagnosis: { eventId:'loanRejected', counterpartyId:'CB', reason:'프리랜서입니다', selectedCandidates:[{정보명:'소득금액증명'}] },
  strategy: { candidates:[{정보명:'a'}], picked:[0] },
  form: { tab:'correctionRequest', personal:{name:'홍길동',phone:'010',email:'a@b.c'},
          form1:{selectedItems:['result'],hopeResult:'1등급',consent:'agree'},
          form2:{enabled:{s2:true},rows:{identity:{current:'x',correction:'y'}},favorable:[{infoName:'i'}],recipient:'○○은행'} },
  response: { interpretation:{covered:['result'],baseInfoItems:[{항목:'연체'}]}, errors:[0], catOverrides:{0:'기타 정보'} },
  milestones: { explanationRequest:{printedAt:'2026-08-26T10:00:00.000Z',submittedAt:'2026-08-26'} },
})
const round = parseImport(JSON.stringify(buildExport(j)))
ok('[2] 왕복 성공', round.ok)
eq('[2] 왕복 후 동일', round.journey, j)
ok('[2] 이름 보존', round.journey.form.personal.name==='홍길동')
ok('[2] 제출 기록 보존', round.journey.milestones.explanationRequest.submittedAt==='2026-08-26')

// [3] 정규화 — 모르는 키 버리고 타입 강제
const dirty = normalizeJourney({
  악의적키: 'xxx',
  diagnosis: { eventId: 42, reason: null, selectedCandidates: 'not-array', 주민등록번호: '900101-1234567' },
  form: { personal: { name: 123, 주민등록번호: '900101-1234567' } },
  milestones: { bad: 'not-object', good: { printedAt: 5, submittedAt: '2026-01-01' } },
})
ok('[3] 모르는 최상위 키 제거', !('악의적키' in dirty))
ok('[3] 진단의 모르는 키 제거', !('주민등록번호' in dirty.diagnosis))
ok('[3] 인적사항의 주민번호 제거', !('주민등록번호' in dirty.form.personal))
eq('[3] 잘못된 타입 → 기본값', [dirty.diagnosis.eventId, dirty.diagnosis.reason, dirty.diagnosis.selectedCandidates, dirty.form.personal.name], [null,'',[],''])
ok('[3] 잘못된 milestone 제거', !('bad' in dirty.milestones))
eq('[3] milestone 타입 강제', dirty.milestones.good, {printedAt:null,submittedAt:'2026-01-01'})

// [4] 주민등록번호가 저장 구조 어디에도 없다
const flat = JSON.stringify(EMPTY_JOURNEY)
ok('[4] 빈 구조에 주민등록번호 자리 없음', !flat.includes('주민') && !/rrn|residentReg/i.test(flat))
ok('[4] 정규화가 주민번호를 통과시키지 않음', !JSON.stringify(dirty).includes('900101'))

// [5] 회신 원문은 저장 구조에 없다
ok('[5] response 에 원문 자리 없음', !('text' in EMPTY_JOURNEY.response) && !('responseText' in EMPTY_JOURNEY.response))
const withText = normalizeJourney({ response: { text: '회신 원문 전체...', interpretation: {covered:[]} } })
ok('[5] 원문이 들어와도 버린다', !('text' in withText.response))

// [6] 날짜 계산
const now = new Date('2026-08-26T12:00:00')
eq('[6] 경과일 0', daysSince('2026-08-26', now), 0)
eq('[6] 경과일 3', daysSince('2026-08-23', now), 3)
eq('[6] 미래 날짜는 null', daysSince('2026-09-01', now), null)
eq('[6] 없는 값은 null', daysSince(null, now), null)
eq('[6] 날짜 표기', formatDate('2026-08-26'), '8월 26일')
eq('[6] 오늘 표기', formatWhen('2026-08-26T22:14:00', now), '오늘 22:14')
eq('[6] 다른 날 표기', formatWhen('2026-08-23T09:05:00', now), '8월 23일 09:05')
ok('[6] 파일명에 날짜', /삼육이-기록-20260826-\d{4}\.json/.test(exportFileName(now)), exportFileName(now))
eq('[6] date input 값', todayInputValue(now), '2026-08-26')

// [6-2] 빈 여정과 내용 있는 여정 구분 (헤더의 "저장됨" 표시가 이걸 본다)
ok('[6-2] 빈 여정은 내용 없음', hasSavedContent(EMPTY_JOURNEY)===false)
ok('[6-2] 빈 여정을 정규화해도 없음', hasSavedContent(normalizeJourney({}))===false)
ok('[6-2] 키 순서가 달라도 없음', hasSavedContent(JSON.parse(JSON.stringify({
  ...EMPTY_JOURNEY,
  form: { ...EMPTY_JOURNEY.form, form2Extras: [], form2Index: 0 },
})))===false)
ok('[6-2] 서술 한 줄이면 내용 있음', hasSavedContent(normalizeJourney({diagnosis:{reason:'ㅁ'}}))===true)
ok('[6-2] 사건 선택도 내용 있음', hasSavedContent(normalizeJourney({diagnosis:{eventId:'loanRejected'}}))===true)
ok('[6-2] 서식 이름도 내용 있음', hasSavedContent(normalizeJourney({form:{personal:{name:'홍'}}}))===true)

// [6-3] 오염된 값이 화면에 그대로 흘러가지 않는가
//   ★ React 는 객체를 자식으로 받으면 렌더 도중 예외를 던진다.
//     저장소와 불러온 파일은 서버 가드를 거치지 않으므로 여기서 막아야 한다.
{
  const poisoned = normalizeJourney({
    strategy: { source: 'ai', candidates: [{ 정보명: { x: 1 }, 세부내용: [1], 증빙서류: {}, 선정이유: {}, 근거범주: {} }, { 정보명: '재직증명서', 세부내용: '재직 중' }] },
    response: {
      interpretation: { covered: 'notarray', missing: 3, baseInfoItems: 'oops', refused: 'yes', provisoText: {} },
      catOverrides: 7,
    },
    form: { form2: { enabled: { s2: 'yes' }, rows: { capacity: { current: {}, correction: 'x' } }, favorable: [{ infoName: {}, detail: 5 }] } },
    diagnosis: { selectedCandidates: [{ 정보명: {} }], correctionRows: [{ categoryId: {}, current: 'x' }] },
  })
  const leaves = []
  const walk = (v) => {
    if (Array.isArray(v)) return v.forEach(walk)
    if (v && typeof v === 'object') return Object.values(v).forEach(walk)
    leaves.push(v)
  }
  walk(poisoned)
  ok('[6-3] 정규화 뒤 남은 값은 전부 원시값', leaves.every((v) => v === null || ['string', 'number', 'boolean'].includes(typeof v)))
  ok('[6-3] 객체가 들어 있던 후보는 버린다', poisoned.strategy.candidates.length === 1)
  ok('[6-3] 멀쩡한 후보는 남는다', poisoned.strategy.candidates[0]['정보명'] === '재직증명서')
  ok('[6-3] covered/missing 은 배열', Array.isArray(poisoned.response.interpretation.covered) && Array.isArray(poisoned.response.interpretation.missing))
  ok('[6-3] baseInfoItems 는 배열', Array.isArray(poisoned.response.interpretation.baseInfoItems))
  ok('[6-3] refused 는 불리언', poisoned.response.interpretation.refused === false)
  ok('[6-3] catOverrides 는 객체', typeof poisoned.response.catOverrides === 'object')
  ok('[6-3] enabled 는 불리언만', poisoned.form.form2.enabled.s2 === false)
  ok('[6-3] 값이 객체인 정정 행은 버린다', poisoned.diagnosis.correctionRows.length === 0)
  ok('[6-3] 서식 2 표의 값은 문자열', typeof poisoned.form.form2.rows.capacity.current === 'string')
  ok('[6-3] 섹션 3 행의 값은 문자열', typeof poisoned.form.form2.favorable[0].infoName === 'string' && poisoned.form.form2.favorable[0].detail === '5')
}

// [7] 스키마 버전이 파일에 들어간다
ok('[7] 내보낸 파일에 버전', buildExport(EMPTY_JOURNEY).schemaVersion===SCHEMA_VERSION)
ok('[7] 내보낸 파일에 표지', buildExport(EMPTY_JOURNEY).app==='wae.journey')

console.log(fail?`\n${fail} FAILED`:'\n모두 통과')
process.exit(fail?1:0)
