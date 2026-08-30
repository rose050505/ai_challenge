/** 작업 1 — 선정이유 가드 단위 시험 */
const A = await import('../api/analyze.js')
const { R3_SCOPE } = await import('../src/data/law.js')
const S = await import('../src/data/strategy-fallback.js')
const { SAMPLE_SCENARIOS } = await import('../src/data/samples.js')
let pass=0, fail=0
const t=(n,c)=>{ if(c){pass++} else {fail++; console.log('  FAIL', n)} }
const sit = '프리랜서로 3년 일했는데 카드 발급이 거절됐습니다'

// groundedReason
t('근거 있는 인용은 통과', A.groundedReason("'프리랜서로 3년'이라 하셨으니 소득 자료가 필요합니다", sit) !== '')
t('공백이 달라도 통과', A.groundedReason("'프리랜서로   3년'이라 하셨으니", sit) !== '')
t('전각 따옴표도 인식', A.groundedReason('‘프리랜서로 3년’이라 하셨으니', sit) !== '')
t('지어낸 인용은 이유만 버림', A.groundedReason("'연봉 8천만원'이라 하셨으니", sit) === '')
t('인용 없으면 이유 버림', A.groundedReason('일반적으로 유용합니다', sit) === '')
t('빈 이유는 빈 값', A.groundedReason('', sit) === '')
t('사람됨 근거는 항목째(null)', A.groundedReason('성실해 보이셔서 골랐습니다', sit) === null)
t('안타까움 근거도 항목째', A.groundedReason('사정이 안타까워 골랐습니다', sit) === null)
t('학력 근거도 항목째', A.groundedReason('학력이 높으셔서', sit) === null)
t('서술이 비면 이유 없음', A.groundedReason("'무엇'이라 하셨으니", '') === '')

// applyGuards
const g1 = A.applyGuards([{정보명:'재직증명서',세부내용:'재직 기간',증빙서류:'회사',선정이유:"'프리랜서로 3년'이라 하셨으니"}], sit)
t('정상 항목 유지 + 이유 유지', g1.length===1 && g1[0]['선정이유'].length>0)
const g2 = A.applyGuards([{정보명:'재직증명서',세부내용:'재직 기간',선정이유:'성실해 보이셔서'}], sit)
t('범주 밖 이유 → 항목째 제거', g2.length===0)
const g3 = A.applyGuards([{정보명:'재직증명서',세부내용:'재직 기간',선정이유:"'연봉 1억'이라 하셨으니"}], sit)
t('지어낸 인용 → 항목은 남고 이유만 제거', g3.length===1 && g3[0]['선정이유']==='')
t('근거범주는 항상 법정 범주로 고정', g3[0]['근거범주']===R3_SCOPE.categoryLabel)
const g4 = A.applyGuards(Array.from({length:9},()=>({정보명:'x',세부내용:'y'})), sit)
t('최대 개수 유지', g4.length===R3_SCOPE.maxCandidates)
t('기존 deniedTerms 동작 불변', A.applyGuards([{정보명:'성격 평가서',세부내용:'a'}], sit).length===0)

// 캐시 샘플 — 우리가 쓴 이유도 같은 기준을 통과해야 한다
let ok=0, tot=0
for (const s of SAMPLE_SCENARIOS) for (const c of S.CACHED_CANDIDATES[s.id]) {
  tot++; if (A.groundedReason(c['선정이유'], s.reason)===c['선정이유']) ok++
}
t(`캐시 샘플 이유 ${ok}/${tot} 근거 확인`, ok===tot && tot===15)
t('폴백 목록에는 선정이유가 없다', S.GENERIC_CHECKLIST.every(c=>!c['선정이유']))

// 프롬프트에 법령 원문이 실제로 들어갔는지
t('프롬프트에 법정 정의 원문 포함', A.SYSTEM_PROMPT.includes(R3_SCOPE.definition))
t('프롬프트에 근거 조문 포함', A.SYSTEM_PROMPT.includes(R3_SCOPE.rightBasis))
t('프롬프트에 선정이유 지시 포함', A.SYSTEM_PROMPT.includes('선정이유'))


// ── parseCandidates — 모델이 JSON 만 주지 않는 경우들 ─────────────
// "테스트용으로 export" 라고 적어 두고 정작 시험이 없었다 (2026-08-31 Phase 6).
t('코드펜스를 벗긴다', A.parseCandidates('```json\n{"candidates":[{"정보명":"a"}]}\n```')?.length === 1)
t('언어 없는 코드펜스도', A.parseCandidates('```\n{"candidates":[{"정보명":"a"}]}\n```')?.length === 1)
t('앞뒤 잡소리를 걷어낸다', A.parseCandidates('네, 알겠습니다.\n{"candidates":[{"정보명":"a"}]}\n도움이 되셨길.')?.length === 1)
t('맨 JSON 도 받는다', A.parseCandidates('{"candidates":[]}')?.length === 0)
t('깨진 JSON 은 null', A.parseCandidates('{"candidates":[') === null)
t('candidates 가 배열이 아니면 null', A.parseCandidates('{"candidates":"x"}') === null)
t('빈 문자열은 null', A.parseCandidates('') === null)
t('JSON 이 아니면 null', A.parseCandidates('죄송합니다. 답할 수 없습니다.') === null)

console.log(`treason: ${pass}/${pass+fail} 통과`)
process.exit(fail?1:0)
