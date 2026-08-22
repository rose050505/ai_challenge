/**
 * POST /api/analyze — Vercel Serverless Function (스텁)
 *
 * 이 단계에서는 뼈대만 둔다. 실제 Claude 호출은 다음 단계에서 구현한다.
 *
 * ── 절대 규칙 (CLAUDE.md) ────────────────────────────────────────
 * - ANTHROPIC_API_KEY 는 **서버 환경변수로만** 접근한다.
 *   VITE_ 접두사 환경변수는 클라이언트 번들에 노출되므로 API 키에 사용 금지.
 * - 법조문·거절 사유·서식 문구·절차·기한은 LLM이 생성하지 않는다.
 *   전부 src/data/law.js 의 상수를 쓴다.
 * - 개인 식별정보(성명·연락처·주민등록번호)는 이 엔드포인트로 보내지 않는다.
 *   상황 서술만 받는다.
 * - 서버 측 영속 저장소를 두지 않는다. 요청 본문을 로깅·저장하지 않는다.
 * ────────────────────────────────────────────────────────────────
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST')
    return res.status(405).json({ error: 'Method Not Allowed' })
  }

  // TODO: Anthropic Messages API 호출 구현
  // const apiKey = process.env.ANTHROPIC_API_KEY   // 서버 전용. 절대 클라이언트로 내보내지 않는다.

  return res.status(501).json({
    error: 'Not Implemented',
    message: '/api/analyze 는 아직 스텁입니다. 다음 단계에서 구현합니다.',
  })
}
