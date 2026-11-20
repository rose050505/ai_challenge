/** 확장 범위(개인정보 보호법 제37조의2) 단위 시험 — 판정 · 가드 · 링크 · 문구 (2026-11-20) */
const L = await import('../src/data/law.js')
const { judgePipa, checkReply } = await import('../src/lib/pipa-judge.js')
const D = await import('../api/decision.js')
const { DECISION_SAMPLES, DECISION_GENERIC } = await import('../src/data/decision-samples.js')
let pass = 0, fail = 0
const t = (n, c) => { if (c) pass++; else { fail++; console.log('  FAIL', n) } }

// ── 판정: 거부 · 설명 · 검토 ──
const j = (auto, big, basis) => judgePipa({ auto, big, basis })
t('사람이 판단 → 권리 없음', !j('yes').applies && j('yes').complete && j('yes').notes[0].id === 'humanInvolved')
t('미완성 답 → complete false', !judgePipa({ auto: 'no' }).complete)
t('자동 + 중대 + 근거 모름 → 셋 다', (() => { const r = j('no', 'yes', 'unk'); return r.refuse && r.explain && r.review })())
for (const b of ['consent', 'contract', 'law'])
  t(`근거 ${b} → 거부 불가, 설명·검토 가능`, (() => { const r = j('no', 'yes', b); return !r.refuse && r.explain && r.review })())
t('영향 작음 → 거부 불가 + 갈음 안내', (() => { const r = j('no', 'no', 'unk'); return !r.refuse && r.explain && r.notes.some((n) => n.id === 'minorImpact') })())
t('영향 모름 → 거부 함께 적음', j('no', 'unk', 'unk').refuse)
t('자동 여부 모름 → 요구서에서 묻는다', j('unk', 'yes', 'unk').askAutomated)
t('거부 가능하면 절차 안내(시행령 제44조의2 제1항)', j('no', 'yes', 'unk').notes.some((n) => n.basis.includes('제44조의2 제1항')))
t('판정 안내는 전부 law.js 문구', j('unk', 'no', 'consent').notes.every((n) => L.PIPA_JUDGE_NOTES[n.id]?.text === n.text))

// ── 샘플 두 개가 의도한 갈래를 보여 준다 ──
const [hire, plat] = DECISION_SAMPLES
t('샘플 채용: 셋 다 가능', (() => { const r = judgePipa(hire.answers); return r.refuse && r.explain && r.review })())
t('샘플 플랫폼: 계약이라 거부 불가', (() => { const r = judgePipa(plat.answers); return !r.refuse && r.explain && r.askAutomated })())
t('샘플 분야는 이 화면이 다루는 갈래', DECISION_SAMPLES.every((s) => L.PIPA_DECISION_KINDS_BY_ID[s.kindId].route === 'pipa'))
t('일반 목록에는 선정이유가 없다', Object.values(DECISION_GENERIC).flat().every((c) => !c['선정이유']))

// ── 회신 점검 ──
const ids = L.PIPA_EXPLANATION_ITEMS.map((i) => i.id)
t('법정 설명 항목은 네 개', ids.length === 4)
t('빠진 항목 계산', checkReply({ result: true, types: true }, 'in', ids).missing.join() === 'criteria,process')
t('기한 넘김', checkReply({}, 'none', ids).overdue)

// ── 조문 링크: 신용정보법으로 잘못 가지 않는다 ──
t('개인정보 보호법 → 개인정보보호법', L.basisLink('개인정보 보호법 제37조의2 제1항').href.endsWith('/개인정보보호법/제37조의2'))
t('개인정보 보호법 시행령 → 시행령', L.basisLink('개인정보 보호법 시행령 제44조의3 제5항').href.endsWith('/개인정보보호법시행령/제44조의3'))
t('기존 신용정보법 링크 불변', L.basisLink('법 제36조의2 제2항 제2호 나목').href.endsWith('/신용정보의이용및보호에관한법률/제36조의2'))
t('기존 신용정보법 시행령 링크 불변', L.basisLink('시행령 제31조의2 제5항').href.endsWith('/신용정보의이용및보호에관한법률시행령/제31조의2'))
const allBasis = [...L.PIPA_RIGHTS.flatMap((r) => [r.basis, r.actionBasis]), ...L.PIPA_EXPLANATION_ITEMS.map((i) => i.basis),
  ...Object.values(L.PIPA_JUDGE_NOTES).map((n) => n.basis), L.PIPA_DEADLINE.basis, L.PIPA_REFUSAL_DUTY.basis]
t('확장 범위 배지는 전부 개인정보 보호법 원문으로', allBasis.every((b) => L.basisLink(b)?.href.includes('개인정보보호법')))

// ── 요구서 문구 ──
t('설명 문장은 법 이름을 스스로 밝힌다(「같은 조」로 시작하지 않음)', L.PIPA_FORM_TEXTS.explain.startsWith('개인정보 보호법 제37조의2 제2항'))
t('요구서는 법정 서식이라 칭하지 않는다', !L.PIPA_FORM_TEXTS.title.includes('서식'))

// ── 제안 가드 ──
const story = '웹 개발 경력이 3년 있는데 지원서 양식에 경력을 넣을 칸이 없어서 빠졌어요.'
t('근거 있는 인용은 통과', D.groundedSuggestReason("'경력을 넣을 칸이 없어서'라고 하셨으니 경력이 빠졌을 수 있습니다", story) !== '')
t('지어낸 인용은 이유만 버림', D.groundedSuggestReason("'석사 학위가 있는데'라고 하셨으니", story) === '')
t('인용 없으면 이유 버림', D.groundedSuggestReason('일반적으로 도움이 됩니다', story) === '')
t('사람 평가 → 항목째(null)', D.groundedSuggestReason("'경력이 3년'이라 성실해 보입니다", story) === null)
t('법적 결론 → 이유만 버림', D.groundedSuggestReason("'경력을 넣을 칸이 없어서' 이 결정은 위법합니다", story) === '')
const g = D.guardSuggestions([
  { 정보: '경력 3년', 자료: '경력증명서', 선정이유: "'경력이 3년'이라 하셨으니" },
  { 정보: '외모 평가', 자료: '사진' },
  { 정보: '', 자료: 'x' },
  ...Array.from({ length: 8 }, (_, i) => ({ 정보: `항목${i}`, 자료: 'y' })),
], story)
t('범주 밖 · 빈 항목 제거', !g.some((c) => c.정보 === '외모 평가' || !c.정보))
t('최대 개수', g.length === L.PIPA_SUGGEST_SCOPE.maxCandidates)
t('정상 항목의 이유 유지', g[0].선정이유.length > 0)

// ── 회신 가드: 원문에 없는 문장은 「찾았다」로 인정하지 않는다 ──
const replyText = hire.reply
const gr = D.guardReply({
  items: {
    result: { found: true, quote: '서류 전형에서 불합격 처리되었습니다.' },
    types: { found: true, quote: '학력,  경력, 자격 사항과 AI 역량검사 결과가 활용되었습니다' },
    criteria: { found: true, quote: '경력 점수가 기준 미달이었습니다' },
    process: { found: false, quote: '' },
    invented: { found: true, quote: '서류 전형' },
  },
  refused: { found: true, quote: '공개가 어려운 점 양해 부탁드립니다' },
  human: { found: true, quote: '담당자가 다시' },
}, replyText)
t('원문에 있는 문장은 인정', gr.items.result.found && gr.items.types.found)
t('★ 지어낸 문장은 버린다', !gr.items.criteria.found && gr.items.criteria.quote === '')
t('AI 가 만든 키는 버린다', !('invented' in gr.items))
t('거절 표지 인정', gr.refused.found)
t('원문에 없는 표지는 버린다', !gr.human.found)
t('너무 짧은 인용은 인정 안 함', !D.guardReply({ items: { result: { found: true, quote: '서류' } } }, replyText).items.result.found)
t('JSON 파싱: 코드펜스', D.parseJsonObject('```json\n{"a":1}\n```')?.a === 1)
t('JSON 파싱: 앞뒤 잡소리', D.parseJsonObject('네 {"a":2} 끝')?.a === 2)
t('JSON 파싱 실패 → null', D.parseJsonObject('없음') === null)

// ── 프롬프트에 조문 원문이 들어간다 (AI 기억에 기대지 않는다) ──
t('제안 프롬프트에 시행령 원문', D.SUGGEST_PROMPT.includes(L.PIPA_SUGGEST_SCOPE.lawText))
t('회신 프롬프트에 4항목 원문', L.PIPA_EXPLANATION_ITEMS.every((i) => D.REPLY_PROMPT.includes(i.law)))

console.log(fail ? `통과 ${pass} / 실패 ${fail}` : `모두 통과 (${pass})`)
process.exit(fail ? 1 : 0)
