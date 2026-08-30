import { paginate, buildChunks } from '../src/lib/paginate.js'
let fail=0
const eq=(n,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);if(!ok)fail++;console.log(`${ok?'PASS':'FAIL'}  ${n}${ok?'':`\n   got  ${JSON.stringify(g)}\n   want ${JSON.stringify(w)}`}`)}
const ids=(pages)=>pages.map(p=>p.blocks.map(b=>b.id))

// [1] 다 들어가면 한 페이지
eq('[1] 한 페이지', ids(paginate({
  blocks:[{id:'a'},{id:'b'},{id:'c'}], heights:{a:100,b:100,c:100}, pageHeight:1000,
})), [['a','b','c']])

// [2] 넘치면 나뉜다
eq('[2] 두 페이지로 분할', ids(paginate({
  blocks:[{id:'a'},{id:'b'},{id:'c'}], heights:{a:400,b:400,c:400}, pageHeight:1000,
})), [['a','b'],['c']])

// [3] keepWithNext — 제목이 하단에 홀로 남지 않는다
// 제목+첫행이 함께 들어가면 그대로 둔다 (제목만 남는 상황이 아니다)
eq('[3a] 제목+첫행이 들어가면 그대로', ids(paginate({
  blocks:[{id:'x'},{id:'head',keepWithNext:true},{id:'row1'},{id:'row2'}],
  heights:{x:600,head:200,row1:200,row2:200}, pageHeight:1000,
})), [['x','head','row1'],['row2']])
// 제목만 들어가고 첫행이 안 들어가면 제목도 함께 넘긴다 (핵심 요건)
eq('[3b] 제목만 남게 되면 함께 넘어간다', ids(paginate({
  blocks:[{id:'x'},{id:'head',keepWithNext:true},{id:'row1'},{id:'row2'}],
  heights:{x:700,head:200,row1:200,row2:200}, pageHeight:1000,
})), [['x'],['head','row1','row2']])

// [4] keepWithPrev — 서명란이 홀로 넘어가지 않는다
eq('[4] 첨부+서명이 함께 넘어간다', ids(paginate({
  blocks:[{id:'body'},{id:'attach',keepWithNext:true},{id:'sign',keepWithPrev:true}],
  heights:{body:700,attach:150,sign:200}, pageHeight:1000,
})), [['body'],['attach','sign']])

// [5] 표 thead — 그 페이지에서 처음 나올 때만 높이를 먹는다
eq('[5] thead 는 페이지마다 한 번', ids(paginate({
  blocks:[{id:'r1',group:'T'},{id:'r2',group:'T'},{id:'r3',group:'T'}],
  heights:{r1:300,r2:300,r3:300}, groupHeadHeights:{T:200}, pageHeight:1000,
})), [['r1','r2'],['r3']])   // 200+300+300=800, +300=1100 초과 → 2페이지(200+300)

// [6] 2페이지부터는 반복 머리가 자리를 먹는다
eq('[6] 반복 머리 반영', ids(paginate({
  blocks:[{id:'a'},{id:'b'},{id:'c'}], heights:{a:500,b:400,c:400},
  pageHeight:1000, firstHeadHeight:0, runHeadHeight:300, footHeight:0,
})), [['a','b'],['c']])   // 2페이지 용량 700 → c(400)만

// [7] 블록 간격이 반영된다
eq('[7] gap 반영', ids(paginate({
  blocks:[{id:'a'},{id:'b'}], heights:{a:500,b:480}, pageHeight:1000, gap:30,
})), [['a'],['b']])

// [8] 한 블록이 한 페이지보다 커도 잘라내지 않는다
eq('[8] 초과 블록도 버리지 않는다', ids(paginate({
  blocks:[{id:'a'},{id:'huge'}], heights:{a:100,huge:5000}, pageHeight:1000,
})), [['a'],['huge']])

// [9] 덩어리 묶기
eq('[9] buildChunks', buildChunks([{id:'a'},{id:'h',keepWithNext:true},{id:'r'},{id:'s',keepWithPrev:true}]).map(c=>c.map(b=>b.id)),
  [['a'],['h','r','s']])

// [10] 첫 페이지 머리 높이 반영
eq('[10] 문서명 높이 반영', ids(paginate({
  blocks:[{id:'a'},{id:'b'}], heights:{a:500,b:400}, pageHeight:1000, firstHeadHeight:200,
})), [['a'],['b']])

console.log(fail?`\n${fail} FAILED`:'\n모두 통과')
process.exit(fail?1:0)
