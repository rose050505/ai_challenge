/**
 * 서식 원문의 기관명만 기관 중립적으로 치환한다.
 * 규칙은 src/data/law.js 의 section.substitution 에 있다. 여기서 정의하지 않는다.
 *
 * - targets 에 든 문자열만 바꾼다 (현재: "저축은행")
 * - doNotSubstitute 에 든 표현은 건드리지 않는다 (현재: "당사")
 * - 나머지 문구는 절대 수정하지 않는다
 *
 * @param {string} text            서식 원문
 * @param {object} substitution    law.js 의 section.substitution
 * @param {string|null} label      사용자가 고른 업권 라벨
 */
export function neutralizeInstitution(text, substitution, label) {
  if (!text || !substitution) return text
  const name = label || substitution.fallbackLabel
  return substitution.targets.reduce(
    (acc, target) => acc.split(target).join(name),
    text,
  )
}
