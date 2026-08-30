const src = (await import('node:fs')).readFileSync(new URL('../src/', import.meta.url).pathname+'components/PrintSetup.jsx','utf8')
const body = src.slice(src.indexOf('export function isOldSafariPrint'))
const fnSrc = body.slice(0, body.indexOf('\n}\n')+2).replace('export function','function')
const isOld = eval(`(${fnSrc.replace('function isOldSafariPrint','function')})`)
const cases = [
 ['Safari 17', {vendor:'Apple Computer, Inc.', userAgent:'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 Version/17.4 Safari/605.1.15'}, true],
 ['Safari 18.1', {vendor:'Apple Computer, Inc.', userAgent:'Version/18.1 Safari/605.1.15'}, true],
 ['Safari 18.2', {vendor:'Apple Computer, Inc.', userAgent:'Version/18.2 Safari/605.1.15'}, false],
 ['Safari 26.0', {vendor:'Apple Computer, Inc.', userAgent:'Version/26.0 Safari/605.1.15'}, false],
 ['Chrome on Mac', {vendor:'Google Inc.', userAgent:'Mozilla/5.0 (Macintosh) Chrome/151.0 Safari/537.36'}, false],
 ['Chrome on iOS', {vendor:'Apple Computer, Inc.', userAgent:'CriOS/151.0 Version/17.0 Safari/604.1'}, false],
 ['UA 없음', {vendor:'Apple Computer, Inc.', userAgent:''}, false],
]
let ok=0,bad=0
for (const [n,nav,exp] of cases){ const got=isOld(nav); (got===exp?ok++:bad++); console.log((got===exp?'  ok  ':'  FAIL')+` ${n} → ${got} (기대 ${exp})`) }
console.log(`통과 ${ok} / 실패 ${bad}`); process.exit(bad?1:0)
