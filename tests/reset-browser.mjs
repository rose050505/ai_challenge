/**
 * 시험 전에 브라우저 탭을 새것으로 바꾼다.
 *
 * ★ 왜 필요한가 (2026-09-01 심사 당일 감사에서 데였다)
 *   CDP 로 붙는 시험들은 **탭 하나를 함께 쓴다.** 그 탭에는 상태가 눌어붙는다 —
 *   Page.addScriptToEvaluateOnNewDocument 로 심었다가 못 지운 스크립트,
 *   Emulation.setEmulatedMedia 의 features(어두운 모드·고대비), 화면 크기 재정의,
 *   Network 의 캐시/헤더/회선 흉내.
 *   감사 중에 그런 상태가 남은 채로 run.sh 를 돌렸더니 thero 가 한 번은 9/34,
 *   다음엔 31/34, 다음엔 15/34 로 나왔다. **코드는 멀쩡했다.** 배포 직전에 이런
 *   거짓 실패를 보면 없는 문제를 쫓게 된다.
 *
 *   지울 수 있는 것은 지우고, 지울 수 없는 것(남의 주입 스크립트)은
 *   **탭을 새로 만들어 버린다.** 새 탭에는 아무것도 심겨 있지 않다.
 */
const CDP = process.env.CDP || 'http://127.0.0.1:9444'
const j = async (p, m = 'GET') => (await fetch(CDP + p, { method: m })).text()

let list = []
try { list = JSON.parse(await j('/json/list')) } catch { console.log('  · 브라우저 없음 — 건너뜀'); process.exit(0) }
const pages = list.filter(x => x.type === 'page')

// 새 탭을 하나 열고
await j('/json/new?about:blank', 'PUT').catch(() => j('/json/new?about:blank'))
// 옛 탭을 전부 닫는다
for (const p of pages) await j('/json/close/' + p.id)

/* 닫기는 비동기라 곧바로 세면 아직 남아 있을 수 있다. 잠깐 두고 다시 센다. */
let after = []
for (let i = 0; i < 10; i++) {
  await new Promise((r) => setTimeout(r, 200))
  after = JSON.parse(await j('/json/list')).filter((x) => x.type === 'page')
  if (after.length === 1) break
}
console.log(`  · 탭 정리: ${pages.length}개 닫고 ${after.length}개 남김`)
if (after.length !== 1) {
  console.log('  ✘ 탭이 하나가 아니다. 시험이 어느 탭을 물지 알 수 없다.')
  process.exit(1)
}
