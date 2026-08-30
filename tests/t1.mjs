import { applyInterpretGuards, correctCategory } from '../api/interpret.js'
const j = (o) => JSON.stringify(o, null, 0)
let fail = 0
const eq = (name, got, want) => {
  const ok = j(got) === j(want)
  if (!ok) fail++
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok ? '' : `\n   got  ${j(got)}\n   want ${j(want)}`}`)
}

// [1] 실제 API 출력 재현 — 3유형 전부 covered 인데 refused:true
const real = applyInterpretGuards({
  covered: ['result', 'criteria', 'baseInfo'],
  missing: [],
  baseInfoItems: [
    { 항목: '직업', 내용: '회사원', 분류: '식별정보' },
    { 항목: '건강보험 납부', 내용: '24개월 완납', 분류: '기타 정보' },
  ],
  refused: true,
  refusalReasonText: '각 정보의 결합 방식은 당사가 자체 개발한 모델에 해당하여 제공 대상에서 제외됩니다.',
})
eq('[1] refused 강제 false', real.refused, false)
eq('[1] excludedByProviso true', real.excludedByProviso, true)
eq('[1] 원문 provisoText 이동', real.provisoText, '각 정보의 결합 방식은 당사가 자체 개발한 모델에 해당하여 제공 대상에서 제외됩니다.')
eq('[1] refusalReasonText 비움', real.refusalReasonText, '')
eq('[1] 직업 → 신용거래능력', real.baseInfoItems[0], { 항목: '직업', 내용: '회사원', 분류: '신용거래능력 판단정보', correctedFrom: '식별정보', correctionBasis: '법 제2조 제1호의5' })
eq('[1] 건강보험 → 신용거래능력', real.baseInfoItems[1].분류, '신용거래능력 판단정보')

// [2] 진짜 거절 — 3회 반복
const refusal = applyInterpretGuards({
  covered: [], missing: ['result', 'criteria', 'baseInfo'],
  baseInfoItems: [],
  refused: true,
  refusalReasonText: '동일 거래에 대해 3회 이상 반복 요구하셨으므로 응할 수 없습니다.',
})
eq('[2] 진짜 거절은 유지', refusal.refused, true)
eq('[2] 사유 원문 유지', refusal.refusalReasonText, '동일 거래에 대해 3회 이상 반복 요구하셨으므로 응할 수 없습니다.')
eq('[2] excludedByProviso false', refusal.excludedByProviso, false)

// [3] missing 이 있으면서 거절 — 유지
const mixed = applyInterpretGuards({
  covered: ['result'], missing: ['criteria', 'baseInfo'], baseInfoItems: [],
  refused: true, refusalReasonText: '나머지는 응할 수 없습니다.',
})
eq('[3] 일부 거절은 유지', [mixed.refused, mixed.missing.length], [true, 2])

// [4] 샘플(b) 모양 — 제외이되 거절 아님
const partial = applyInterpretGuards({
  covered: ['result'], missing: ['criteria', 'baseInfo'],
  baseInfoItems: [{ 항목: '타사 대출 건수', 내용: '2건', 분류: '거래내용 판단정보' }],
  refused: false, refusalReasonText: '',
  excludedByProviso: true, provisoText: '자체적으로 개발·가공하여 생성한 정보에 해당하므로 제공 대상에서 제외',
})
eq('[4] 샘플(b) refused false', partial.refused, false)
eq('[4] 샘플(b) excluded true', partial.excludedByProviso, true)
eq('[4] 거래내용 보정 없음', partial.baseInfoItems[0].correctedFrom, null)

// [5] 분류 보정 규칙 — 순서
eq('[5] 채무 불이행 → 신용도', correctCategory('채무 불이행 등록', '기타 정보').분류, '신용도 판단정보')
eq('[5] 총 채무액 → 신용거래능력', correctCategory('총 채무액', '기타 정보').분류, '신용거래능력 판단정보')
eq('[5] 연체 이력 → 신용도', correctCategory('최근 3년 내 연체 이력', '거래내용 판단정보').분류, '신용도 판단정보')
eq('[5] 성명 → 식별정보', correctCategory('성명', '기타 정보').분류, '식별정보')
eq('[5] 이미 맞으면 보정 안 함', correctCategory('연소득', '신용거래능력 판단정보'), { 분류: '신용거래능력 판단정보', correctedFrom: null, correctionBasis: null })
eq('[5] 규칙에 없으면 그대로', correctCategory('신용카드 개설 매수', '거래내용 판단정보').분류, '거래내용 판단정보')

// [6] 기존 가드 회귀
const g = applyInterpretGuards({ covered: ['result','해킹'], missing: ['baseInfo','아무거나'], baseInfoItems: Array.from({length:25},(_,i)=>({항목:`a${i}`,내용:'v',분류:'존재하지 않는 분류'})), refused: 'yes' })
eq('[6] covered 화이트리스트', g.covered, ['result'])
eq('[6] missing 3유형 보정', g.missing.sort(), ['baseInfo','criteria'].sort())
eq('[6] 20개 상한', g.baseInfoItems.length, 20)
eq('[6] 잘못된 분류 → 기타 정보', g.baseInfoItems[0].분류, '기타 정보')
eq('[6] refused 문자열 → false', g.refused, false)

console.log(fail ? `\n${fail} FAILED` : '\n모두 통과')
process.exit(fail ? 1 : 0)
