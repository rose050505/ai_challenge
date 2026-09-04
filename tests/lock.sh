# 실행기 잠금 — run.sh · run-print.sh · run-deployed.sh 가 함께 쓴다.
#
# 왜 있는가: 이 셋은 **크롬 탭 하나를 함께 쓴다.** 둘이 동시에 돌면 서로의 화면을
# 재고, 앞 시험이 남긴 404 화면을 읽고, 관계없는 시험이 무더기로 실패한다.
# 코드는 멀쩡한데 시험이 거짓말을 한다. 세 번 겪었다:
#   2026-09-01 탭 오염 · 2026-09-03 identifier 누수 · 2026-09-04 두 세션 경합
# 매번 원인은 달랐고 증상은 같았다. 원인을 하나씩 막는 것보다 애초에 둘이 못 돌게 하는 것이 낫다.
#
# 방식: flock(1). 파일 잠금은 **프로세스가 죽으면 커널이 푼다** — Ctrl-C 로 끊거나
# kill -9 를 맞아도 눌어붙은 잠금이 남지 않는다. PID 파일에는 그 성질이 없다.
# 잠금 자체는 out/.runner.lock 이 쥐고, 누가 쥐었는지는 out/.runner.who 에 적는다
# (잠금 파일에 함께 적으면 여는 순간 비워져서 읽을 수가 없다).
#
# 쓰는 법: 실행기 맨 위에서 `. "$(dirname "$0")/lock.sh"` — cd 보다 먼저 부르지 않는다.
# 빠져나갈 구멍: WAE_NO_LOCK=1 (일부러 둘을 겹쳐 볼 때만. 결과는 믿지 마라)

if [ "${WAE_NO_LOCK:-0}" != "1" ]; then
  mkdir -p out
  _lock_file=out/.runner.lock
  _lock_who=out/.runner.who

  if command -v flock >/dev/null 2>&1; then
    # >> 로 연다 — > 는 여는 즉시 비워서, 잠금을 잡기도 전에 앞사람 기록을 지운다
    exec 9>>"$_lock_file" || { echo "✘ 잠금 파일을 열 수 없다: $_lock_file"; exit 4; }
    if ! flock -n 9; then
      echo "✘ 다른 실행기가 이미 돌고 있다. 크롬 탭을 함께 쓰므로 겹쳐 돌리면 결과를 믿을 수 없다."
      if [ -s "$_lock_who" ]; then
        echo "   먼저 잡은 쪽: $(cat "$_lock_who")"
        # 잠금은 열린 fd 를 가진 **모든** 프로세스가 쥔다. 실행기를 kill -9 로 끊어도
        # 그때 돌던 node 자식이 fd 를 물려받아 계속 쥐고 있다 — 그리고 그 자식은
        # 아직 브라우저를 쓰고 있으므로 막는 것이 맞다. 다만 왜 막혔는지는 알려 준다.
        _hp=$(sed -n 's/^PID \([0-9]*\) .*/\1/p' "$_lock_who")
        if [ -n "$_hp" ] && ! kill -0 "$_hp" 2>/dev/null; then
          echo "   (그 실행기는 이미 끝났지만, 남은 시험 프로세스가 아직 브라우저를 쓰고 있다."
          echo "    곧 풀린다. 급하면: pkill -f 'node .*\.mjs')"
        fi
      fi
      echo "   끝나기를 기다렸다가 다시 실행해라."
      exit 4
    fi
  else
    # flock 이 없는 환경 — mkdir 은 원자적이다. 다만 죽은 뒤 잠금이 남을 수 있어
    # 그때는 무엇을 지우면 되는지 알려 준다.
    if ! mkdir out/.runner.lockdir 2>/dev/null; then
      echo "✘ 다른 실행기가 이미 돌고 있다 (flock 없음 — mkdir 잠금)."
      [ -s "$_lock_who" ] && echo "   먼저 잡은 쪽: $(cat "$_lock_who")"
      echo "   정말 아무도 안 돌고 있다면: rm -rf tests/out/.runner.lockdir"
      exit 4
    fi
    trap 'rmdir out/.runner.lockdir 2>/dev/null' EXIT
  fi

  printf 'PID %s · %s · %s\n' "$$" "$(basename "$0")" "$(date '+%m-%d %H:%M:%S')" > "$_lock_who"
fi
