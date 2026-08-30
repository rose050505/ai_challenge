#!/usr/bin/env bash
# 회귀 시험 실행기. 자세한 설명은 README.md
set -u
cd "$(dirname "$0")"

APP_URL="${APP_URL:-http://localhost:4400}"
CDP="${CDP:-http://127.0.0.1:9444}"
export APP_URL CDP

UNIT="tp tj t1 tpre treason safari"
BROWSER="rename tlaw phase1 phase2 phase3 phase4 phase5 phase8 e2e4 journey private afterprint kbd tnext tstrategy tform2 tfacts tour tourkbd tdiag mail samplenote"

case "${1:-all}" in
  unit)    LIST="$UNIT"; NEED_BROWSER=0 ;;
  browser) LIST="$BROWSER"; NEED_BROWSER=1 ;;
  all)     LIST="$UNIT $BROWSER"; NEED_BROWSER=1 ;;
  *)       LIST="$1"; NEED_BROWSER=1 ;;
esac

if [ "$NEED_BROWSER" = 1 ]; then
  curl -sf "$APP_URL/" -o /dev/null || {
    echo "✘ 앱이 안 떠 있다: $APP_URL"
    echo "  npm run build && npx vite preview --port 4400"; exit 2; }
  curl -sf "$CDP/json/version" -o /dev/null || {
    echo "✘ 헤드리스 크롬이 안 떠 있다: $CDP"
    echo "  chrome-headless-shell --remote-debugging-port=9444 --user-data-dir=/tmp/cdp-profile about:blank"; exit 2; }
fi

pass=0; fail=0; failed=""
for t in $LIST; do
  [ -f "$t.mjs" ] || { echo "✘ $t.mjs 없음"; fail=$((fail+1)); failed="$failed $t"; continue; }
  out=$(timeout 400 node "$t.mjs" 2>&1)
  code=$?
  # 각 시험이 마지막 줄에 찍는 요약을 그대로 보여준다
  line=$(printf '%s\n' "$out" | grep -E "모두 통과|[0-9]+/[0-9]+ 통과|통과 [0-9]+ / 실패" | tail -1)
  bad=$(printf '%s\n' "$out" | grep -cE "^\s*(FAIL|✘)")
  if [ "$code" -ne 0 ] || [ "$bad" -gt 0 ] || [ -z "$line" ]; then
    fail=$((fail+1)); failed="$failed $t"
    printf '  ✘ %-12s %s\n' "$t" "${line:-요약 줄 없음 (exit $code)}"
    printf '%s\n' "$out" | grep -E "^\s*(FAIL|✘)" | head -5 | sed 's/^/       /'
  else
    pass=$((pass+1)); printf '  ✔ %-12s %s\n' "$t" "$line"
  fi
done

echo "────────────────────────"
echo "통과 $pass / 실패 $fail${failed:+  →$failed}"
[ "$fail" -eq 0 ]
