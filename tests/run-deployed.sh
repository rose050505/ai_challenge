#!/usr/bin/env bash
# 배포본 점검 — 심사 기간(2026-09-07 11:00 ~ 09-11 23:59)에 한 줄로 돌린다.
#
#   ./run-deployed.sh                       # 대표 URL
#   ./run-deployed.sh https://... --quick   # 실제 API 호출 없이 (비용 0)
#
# ★ --quick 이 아니면 /api/analyze 를 **한 번 실제로 호출한다.** 비용이 든다(적다).
#   심사 기간에는 그게 핵심이다 — 키가 살아 있는지 여기서 확인한다.
set -u
cd "$(dirname "$0")"
. ./lock.sh   # ★ 실행기는 한 번에 하나만 — 크롬 탭을 함께 쓴다 (README 「주의」)

URL="${1:-https://362.parkmiyeong.com}"
case "${1:-}" in --quick) URL="https://362.parkmiyeong.com" ;; esac
QUICK=0
for a in "$@"; do [ "$a" = "--quick" ] && QUICK=1; done

CDP="${CDP:-http://127.0.0.1:9444}"
export CDP

echo "대상: $URL"
echo

# ── 0. 살아 있는가 (브라우저 없이) ──────────────────────────────
code=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -H 'Cache-Control: no-cache' "$URL/?cb=$(date +%s)")
printf '  %s 접속 %s\n' "$([ "$code" = 200 ] && echo ✔ || echo ✘)" "$code"
[ "$code" = 200 ] || { echo; echo "✘ 열리지 않는다. 여기서 멈춘다."; exit 1; }

# 보안 헤더 — 배포 설정이 살아 있는지
hdr=$(curl -sI --max-time 20 -H 'Cache-Control: no-cache' "$URL/" | tr 'A-Z' 'a-z')
for h in content-security-policy x-content-type-options x-frame-options referrer-policy permissions-policy strict-transport-security; do
  printf '  %s %s\n' "$(printf '%s' "$hdr" | grep -q "^$h:" && echo ✔ || echo '·')" "$h"
done

# /api 가 낯선 Origin 을 거부하는가 (2026-09-02 심사 대비 [1])
# ★ 403 이 Claude 호출보다 먼저 나므로 이 검사에 API 비용이 들지 않는다.
oc=$(curl -s -o /dev/null -w '%{http_code}' --max-time 20 -X POST \
  -H 'Origin: https://example.com' -H 'Content-Type: application/json' \
  --data '{}' "$URL/api/analyze")
if [ "$oc" = 403 ]; then
  echo "  ✔ /api Origin 가드 403"
else
  echo "  ✘ /api Origin 가드: 낯선 Origin 에 $oc (기대 403)"; fail_origin=1
fi

# ── 어느 판을 검사하는가 ────────────────────────────────────────
# ★ 캐시 오탐 방지 (2026-09-01). 배포 직후 첫 실행이 옛 번들을 잡아 13건 실패했고,
#   두 번째에 새 번들로 통과했다. 배포는 정상이었고 검사가 캐시를 봤다.
#   여기서 캐시를 우회해 **지금 서버가 주는 판**을 확정하고, 브라우저 검사들이
#   그 판을 물었는지 대조하게 한다(tests/deputil.mjs).
CB=$(date +%s)
NOCACHE=(-H 'Cache-Control: no-cache, no-store, max-age=0' -H 'Pragma: no-cache')
index=$(curl -s --max-time 30 "${NOCACHE[@]}" "$URL/?cb=$CB")
js=$(printf '%s' "$index" | grep -o '/assets/[^"]*\.js' | head -1)
css=$(printf '%s' "$index" | grep -o '/assets/[^"]*\.css' | head -1)
DEPLOY_JS="${js##*/}"
export DEPLOY_JS
printf '  · 지금 서버가 주는 판: %s / %s\n' "${js##*/}" "${css##*/}"

# 배포본 CSS 가 로컬 빌드의 규칙을 빠뜨리지 않았는가 (depcss.mjs 주석 참조)
node depcss.mjs "$URL" || fail_css=1

# 번들에 키가 새지 않았는가 — 배포본에서 직접 확인한다
if [ -n "$js" ]; then
  body=$(curl -s --max-time 60 "${NOCACHE[@]}" "$URL$js?cb=$CB")
  if printf '%s' "$body" | grep -qE 'sk-ant|ANTHROPIC_API_KEY'; then
    echo "  ✘ ★ 번들에 API 키 흔적이 있다 — 즉시 중단하고 확인할 것"; exit 1
  else
    echo "  ✔ 번들에 API 키 흔적 없음 ($js)"
  fi
fi

# ── 1. 브라우저가 필요한 점검 ───────────────────────────────────
curl -sf "$CDP/json/version" -o /dev/null || {
  echo
  echo "헤드리스 크롬이 없어 여기까지만 확인했다: $CDP"
  echo "  chrome-headless-shell --remote-debugging-port=9444 --user-data-dir=/tmp/cdp-profile about:blank"
  exit 0; }

node reset-browser.mjs || exit 2   # 눌어붙은 탭 상태를 걷어낸다 (reset-browser.mjs 주석)

fail=$(( ${fail_css:-0} + ${fail_origin:-0} ))
run() {  # run <이름> <파일> [인자...]
  echo
  echo "── $1 ──"
  if timeout 400 node "$2" "${@:3}"; then :; else fail=$((fail+1)); echo "  ✘ $1 실패"; fi
}

if [ "$QUICK" = 1 ]; then
  echo
  echo "(--quick: 실제 API 를 호출하는 dep1 은 건너뛴다)"
else
  run "화면 사실 확인 + 라이브 AI 한 번" dep1.mjs "$URL"
fi
run "저장이 막힌 브라우저(시크릿)" private-dep.mjs "$URL"
run "저장 차단 시 서식 안내문" blocked-lead.mjs "$URL"
run "375 / 768 / 1280 스크린샷" depshots.mjs "$URL"

echo
echo "────────────────────────"
echo "검사한 판: $DEPLOY_JS"
if [ "$fail" -eq 0 ]; then echo "배포본 점검 통과"; else echo "실패 $fail 건"; fi
[ "$fail" -eq 0 ]
