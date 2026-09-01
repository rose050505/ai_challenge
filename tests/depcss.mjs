/**
 * 배포본 CSS 가 로컬 빌드의 규칙을 하나도 빠뜨리지 않았는가.
 *
 * ★ 왜 있나 (2026-09-01 심사 당일 감사)
 *   같은 커밋인데 배포본 CSS 가 로컬 빌드와 **바이트가 달랐다.** JS 는 바이트까지
 *   같았으므로 소스는 같다. 배포본 쪽이 1,786바이트 더 컸고, 늘어난 것은
 *   지금 아무도 쓰지 않는 유틸리티 넷(.visible .italic .blur .transition!)이었다.
 *   Tailwind 는 소스를 훑어 필요한 것만 뽑는데, Vercel 빌드에는 우리 쪽에 없는
 *   파일(빌드 캐시로 복원된 옛 산출물로 보인다)이 더 있었던 것이다.
 *
 *   지금은 쓰지 않는 규칙이 더 붙는 것뿐이라 화면에 아무 영향이 없다. 문제는 반대
 *   방향이다 — 어떤 이유로든 배포본에서 규칙이 **빠지면** 화면이 깨진다.
 *   로컬 시험은 로컬 CSS 로 도는 탓에 그걸 못 잡는다. 여기서 잡는다.
 *
 *   ★ JS 가 바이트까지 같을 때만 비교한다. 같으면 소스가 같다는 뜻이고,
 *     그때 CSS 규칙이 빠졌다면 그건 빌드 환경 차이지 우리 코드가 아니다.
 *     JS 가 다르면(= dist 가 낡았으면) 조용히 건너뛴다. 거짓 경보를 만들지 않는다.
 */
import fs from 'node:fs'
import path from 'node:path'

const BASE = process.argv[2] || 'https://362.parkmiyeong.com'
const DIST = path.join(new URL('..', import.meta.url).pathname, 'dist')
const NOCACHE = { 'Cache-Control': 'no-cache, no-store, max-age=0', Pragma: 'no-cache' }
const cb = '?cb=' + Date.now()

if (!fs.existsSync(path.join(DIST, 'index.html'))) {
  console.log('  · dist 가 없다 — 건너뜀 (npm run build 후에 다시)')
  process.exit(0)
}
const localIndex = fs.readFileSync(path.join(DIST, 'index.html'), 'utf8')
const localJs = localIndex.match(/\/assets\/[^"']+\.js/)?.[0]
const localCss = localIndex.match(/\/assets\/[^"']+\.css/)?.[0]

const depIndex = await (await fetch(BASE + '/' + cb, { headers: NOCACHE })).text()
const depJs = depIndex.match(/\/assets\/[^"']+\.js/)?.[0]
const depCss = depIndex.match(/\/assets\/[^"']+\.css/)?.[0]
if (!depJs || !depCss || !localJs || !localCss) { console.log('  · 번들 이름을 못 찾았다 — 건너뜀'); process.exit(0) }

const depJsBody = Buffer.from(await (await fetch(BASE + depJs + cb, { headers: NOCACHE })).arrayBuffer())
const localJsBody = fs.readFileSync(path.join(DIST, localJs.replace(/^\//, '')))
if (!depJsBody.equals(localJsBody)) {
  console.log(`  · 배포본 JS 와 로컬 dist 가 다르다 (${depJs} vs ${localJs}) — CSS 비교 건너뜀`)
  process.exit(0)
}

/**
 * 규칙 조각으로 쪼갠다.
 * ★ Tailwind 가 맨 앞에 두는 `@layer properties{@supports …{ --tw-*: … }}` 덩어리와
 *   `@property --tw-*` 선언은 뺀다. 이건 **쓰이는 유틸리티가 늘면 같이 늘어나는**
 *   초기값 목록이라, 배포본에 유틸리티가 더 붙으면 이 덩어리도 통째로 달라진다.
 *   화면을 그리는 규칙이 아니므로 비교에서 제외한다. 안 그러면 없는 문제를 신고한다.
 */
const SKIP = (r) => /^(\/\*[^]*?\*\/)?\s*@layer properties/.test(r) || /^@property\s+--tw-/.test(r)
const rules = (css) =>
  new Set(css.split('}').map((s) => s.trim()).filter((s) => s.length > 3 && !SKIP(s)))
const depCssBody = await (await fetch(BASE + depCss + cb, { headers: NOCACHE })).text()
const localCssBody = fs.readFileSync(path.join(DIST, localCss.replace(/^\//, '')), 'utf8')
const L = rules(localCssBody), D = rules(depCssBody)
const missing = [...L].filter(r => !D.has(r))
const extra = [...D].filter(r => !L.has(r))

console.log(`  · JS 는 바이트까지 같다 (${depJs})`)
console.log(`  · CSS 규칙 로컬 ${L.size} / 배포 ${D.size} — 더 붙은 것 ${extra.length}, 빠진 것 ${missing.length}`)
if (extra.length) console.log('    더 붙은 것 예: ' + extra.slice(0, 3).map(r => r.slice(0, 60)).join(' | '))
if (missing.length) {
  console.log('  ✘ ★ 배포본에서 빠진 규칙이 있다 — 화면이 로컬과 다르게 그려진다')
  for (const m of missing.slice(0, 5)) console.log('      ' + m.slice(0, 120))
  process.exit(1)
}
console.log('  ✔ 로컬 빌드의 CSS 규칙이 배포본에 전부 있다')
