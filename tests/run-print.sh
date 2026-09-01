#!/usr/bin/env bash
# 인쇄 쪽수 예고 = 실제 확인. 10가지 조합의 PDF 를 만들어 쪽수를 센다. 몇 분 걸린다.
set -u
cd "$(dirname "$0")"
command -v pdfinfo >/dev/null || { echo "pdfinfo 가 필요하다 (poppler-utils)"; exit 2; }
node reset-browser.mjs || exit 2   # 눌어붙은 탭 상태를 걷어낸다 (run.sh 와 같은 이유)
ok=0; bad=0
for c in base worst huge split mega; do
  for sc in base lg; do
    out=$(timeout 400 node paged.mjs "$c" "$sc" 2>&1)
    pred=$(printf '%s\n' "$out" | grep -o '현재 내용은 [0-9]*페이지' | head -1 | grep -o '[0-9]*')
    pred=${pred:-1}
    real=$(pdfinfo "out/paged-$c-$sc-main.pdf" 2>/dev/null | awk '/^Pages/{print $2}')
    if [ "$pred" = "$real" ]; then ok=$((ok+1)); mark="✔"; else bad=$((bad+1)); mark="✘"; fi
    printf '  %s %-6s %-4s 예고 %s쪽 / 실제 %s쪽\n' "$mark" "$c" "$sc" "$pred" "${real:-?}"
  done
done
echo "────────────────────────"
echo "일치 $ok / 불일치 $bad"

# 긴 값이 잘리지 않고 전부 인쇄되는가 — PDF 에서 글자를 뽑아 센다
echo
echo "── 값 잘림 (tprintlong) ──"
if timeout 900 node tprintlong.mjs; then long=0; else long=1; fi

[ "$bad" -eq 0 ] && [ "$long" -eq 0 ]
