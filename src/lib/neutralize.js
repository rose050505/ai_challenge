/**
 * 서식 원문의 기관명만 기관 중립적으로 치환한다.
 * 규칙은 src/data/law.js 의 section.substitution 에 있다. 여기서 정의하지 않는다.
 *
 * - targets 에 든 문자열만 바꾼다 (현재: "저축은행" — 섹션 1에 2회, 섹션 2 리드에 2회)
 * - doNotSubstitute 에 든 표현은 건드리지 않는다 (현재: "당사")
 * - adjustParticles 가 켜져 있으면, 치환된 이름 **바로 뒤의 조사만** 받침에 맞게 고친다
 * - 그 밖의 문구는 절대 수정하지 않는다
 *
 * ⚠️ 치환값은 업권의 shortLabel 이다.
 *    수신 기관(회사명) 입력값을 여기에 넘기지 말 것.
 *    서식 원문의 그 자리는 회사명이 아니라 업권명 자리다.
 */

/** 한글 음절의 받침 유무. 한글이 아니면 받침 없음으로 본다. */
function hasFinalConsonant(ch) {
  if (!ch) return false
  const code = ch.charCodeAt(0)
  if (code < 0xac00 || code > 0xd7a3) return false
  return (code - 0xac00) % 28 !== 0
}

/** 받침 있을 때 / 없을 때 짝 */
const PARTICLE_PAIRS = {
  은: ['은', '는'],
  는: ['은', '는'],
  이: ['이', '가'],
  가: ['이', '가'],
  을: ['을', '를'],
  를: ['을', '를'],
  과: ['과', '와'],
  와: ['과', '와'],
}

/**
 * @param {string} text            서식 원문
 * @param {object} substitution    law.js 의 section.substitution
 * @param {string|null} shortLabel INSTITUTION_SECTORS[].shortLabel
 */
export function neutralizeInstitution(text, substitution, shortLabel) {
  if (!text || !substitution) return text
  const name = shortLabel || substitution.fallbackLabel
  const withFinal = hasFinalConsonant(name[name.length - 1])

  return substitution.targets.reduce((acc, target) => {
    const parts = acc.split(target)
    return parts
      .map((part, i) => {
        // 마지막 조각 앞에는 치환된 이름이 없다
        if (i === 0) return part
        if (!substitution.adjustParticles) return part
        const pair = PARTICLE_PAIRS[part[0]]
        if (!pair) return part
        return (withFinal ? pair[0] : pair[1]) + part.slice(1)
      })
      .join(name)
  }, text)
}
