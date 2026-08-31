import { preflightIssues } from '../src/lib/preflight.js'
let ok=0,bad=0
const t=(n,c,d='')=>{c?ok++:bad++;console.log((c?'PASS':'FAIL')+`  ${n}`+(d?` — ${d}`:''))}
const ids=(r)=>r.map(x=>x.id).join(',')

let r = preflightIssues({isForm1:true, personal:{name:''}, selectedItems:[]})
t('[1] 서식 1 — 성명·항목 둘 다 빔', ids(r)==='name,items', ids(r))
r = preflightIssues({isForm1:true, personal:{name:'홍길동'}, selectedItems:['result']})
t('[2] 서식 1 — 다 채우면 없음', r.length===0, ids(r))
r = preflightIssues({isForm1:true, personal:{name:'  '}, selectedItems:['result']})
t('[3] 공백만 있는 이름도 빈 것', ids(r)==='name')
r = preflightIssues({isForm1:false, personal:{name:'홍길동'}, rows:{creditworthiness:{current:'연체 기록',correction:''}}, categoryLabel:()=>'신용도판단정보'})
t('[4] 서식 2 — 현행만 있고 정정 없음', ids(r)==='row-creditworthiness-correction', ids(r))
r = preflightIssues({isForm1:false, personal:{name:'홍'}, rows:{capacity:{current:'',correction:'삭제 요구'}}, categoryLabel:()=>'신용거래능력'})
t('[5] 서식 2 — 정정만 있고 현행 없음', ids(r)==='row-capacity-current', ids(r))
r = preflightIssues({isForm1:false, personal:{name:'홍'}, rows:{a:{current:'x',correction:'y'}}})
t('[6] 양쪽 다 있으면 경고 없음', r.length===0, ids(r))
r = preflightIssues({isForm1:false, personal:{name:'홍'}, favorable:[{infoName:'소득금액증명',detail:''},{infoName:'',detail:''}]})
t('[7] 유리 정보 — 정보명만 있음', ids(r)==='fav-0', ids(r))
r = preflightIssues({isForm1:false, personal:{name:'홍'}, needsRecipient:true, recipient:''})
t('[8] 받는 기관 필요한데 빔', ids(r)==='recipient', ids(r))
r = preflightIssues({isForm1:false, personal:{name:'홍'}, enabled:{s2:false}, rows:{a:{current:'x',correction:''}}})
t('[9] 끈 섹션은 검사하지 않는다', r.length===0, ids(r))
r = preflightIssues({isForm1:false, personal:{name:'홍'}, enabled:{s3:false}, favorable:[{infoName:'x',detail:''}]})
t('[10] 끈 섹션 3도 마찬가지', r.length===0, ids(r))
t('[11] 모든 항목에 안내 문구', preflightIssues({isForm1:true,personal:{},selectedItems:[]}).every(i=>i.text&&i.hint))
r = preflightIssues({isForm1:true, personal:{name:'홍'}, selectedItems:[]})
t('[12] 근거 조문을 붙이지 않는다', !JSON.stringify(r).includes('제') || !/제\d+조/.test(JSON.stringify(r)))
// [13] ★ 사용자가 적은 값이 **종이에 나가는 경로**가 살아 있는가.
//      화면의 input/textarea 는 print:hidden 이고, 옆의 span 이 print:inline 으로 값을 그린다.
//      그 span 을 지우면 사용자가 적은 내용이 말없이 인쇄에서 빠진다.
//      2026-08-31 뮤테이션 시험에서 지워 봤더니 run.sh 안에서는 아무도 잡지 못했다
//      (run-print.sh 의 tprintlong 만 잡았다 — 그건 몇 분 걸리는 별도 스크립트다).
//      그래서 여기에 소스 수준의 빠른 대역을 둔다.
{
  const src = (await import('node:fs')).readFileSync('../src/pages/Document.jsx','utf8')
  t('[13] 값이 인쇄에 나가는 span 이 있다', /sheet-value[^"]*print:inline/.test(src))
  t('[13] 화면 입력칸은 인쇄에서 숨는다', /print:hidden/.test(src))
}
console.log(bad?`\n실패 ${bad}`:'\n모두 통과'); process.exit(bad?1:0)
