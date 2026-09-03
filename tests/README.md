# 회귀 시험

이 폴더는 **저장소 밖(임시 디렉터리)에 있던 시험을 옮겨 온 것**이다.
기능 동결(2026-09-01) 이후에는 버그픽스만 하는데, 고칠 때마다 돌릴 것이 없으면
고쳤는지 확인할 방법이 없다. 그래서 저장소 안에 둔다.

시험 코드는 옮기면서 세 가지만 손봤다. 검사 내용은 한 줄도 바꾸지 않았다.

- 절대경로 import → 저장소 상대경로
- 앱 주소·크롬 주소를 환경변수로 (`APP_URL`, `CDP`) — 기본값은 그대로
- 산출물 저장 위치 — `paged` · `tprintlong` · `depshots` 는 `tests/out/` 에 쓴다.
  `phase8`(`chk-*.pdf`) · `tour`(`tour-*.png`) · `tstrategy`(`strategy-*.png`)는
  아직 `tests/` 바로 밑에 쓴다. 둘 다 `.gitignore` 에 걸려 있어 커밋되지는 않는다.

---

## 준비물

브라우저를 쓰는 시험은 **둘 다 떠 있어야** 한다.

### 1) 앱 (빌드 결과물을 4400 포트로)

```bash
npm run build
npx vite preview --port 4400
```

시험은 `dist/` 를 본다. **소스를 고쳤으면 다시 빌드해야 한다.**
(개발 서버 `npm run dev` 로도 돌아가지만, 인쇄 시험은 빌드본으로 재는 것이 맞다.)

### 2) 헤드리스 크롬 (원격 디버깅 9444 포트)

```bash
chrome-headless-shell \
  --remote-debugging-port=9444 \
  --user-data-dir=/tmp/cdp-profile \
  --no-first-run about:blank
```

`chrome-headless-shell` 이 없으면 `npx puppeteer browsers install chrome-headless-shell` 로 받는다.
일반 `google-chrome --headless=new` 도 동작한다.

떠 있는지 확인:

```bash
curl -s http://127.0.0.1:9444/json/version
```

### 환경변수 (선택)

| 변수 | 기본값 | 쓰임 |
|---|---|---|
| `APP_URL` | `http://localhost:4400` | 시험 대상 주소 |
| `CDP` | `http://127.0.0.1:9444` | 헤드리스 크롬의 디버깅 주소 |

---

## 실행

> ### ★ 한 번에 하나만 돌려라
>
> 브라우저 시험들은 **크롬 탭 하나를 함께 쓴다.** 실행기를 두 개 동시에 돌리면
> 서로 탭을 밀치고, 관계없는 시험이 무더기로 실패한다. 2026-09-01 감사 중에
> 실제로 그랬다 — `thero` 가 9/34, 31/34, 15/34 로 오락가락했고 **코드는 멀쩡했다.**
> (증거: `tour` 시험이 관측한 경로에 다른 시험이 붙인 `?cold=…` 가 찍혀 있었다.)
>
> 실행기 셋(`run.sh` · `run-print.sh` · `run-deployed.sh`)은 이제 맨 앞에서
> `reset-browser.mjs` 로 **탭을 새것으로 바꾼다.** 그래도 동시 실행은 막지 못한다.
> 낱개 시험을 손으로 돌릴 때도 실행기가 도는 중이면 기다려라.

```bash
cd tests
./run.sh            # 단위 + 브라우저 시험 전부
./run.sh unit       # 브라우저 없이 도는 것만
./run.sh browser    # 브라우저가 필요한 것만
./run.sh tfacts     # 하나만
```

인쇄 쪽수 시험은 따로 돈다 (10가지 조합 × PDF 생성이라 몇 분 걸린다).

```bash
./run-print.sh
```

`run-print.sh` 는 두 가지를 돈다.
- `paged.mjs` — 서식 2의 쪽 수 예고 = 실제 (10가지 조합)
- `tprintlong.mjs` — **긴 값이 잘리지 않고 전부 인쇄되는가**.
  인쇄된 PDF 에서 글자를 뽑아 넣은 글자 수와 대조한다.
  `pdftotext`·`pdfinfo`(poppler-utils)가 필요하다. **`run-print.sh` 는 `pdfinfo` 가 없으면
  맨 앞에서 통째로 멈춘다.** (`node tprintlong.mjs` 로 따로 돌리면 스스로 건너뛴다.)

배포본을 상대로 도는 시험 — **한 줄로 묶어 뒀다.**

```bash
./run-deployed.sh                                  # 대표 URL 전부
./run-deployed.sh https://362.parkmiyeong.com      # 주소를 직접
./run-deployed.sh --quick                          # 실제 API 호출 없이 (비용 0)
```

심사 기간(2026-09-07 11:00 ~ 09-11 23:59)에 이 한 줄로 확인한다. 순서는

1. 접속 200 — 안 열리면 여기서 멈춘다
2. 보안 헤더 5종
3. **배포본 CSS 가 로컬 빌드의 규칙을 빠뜨리지 않았는가** (`depcss.mjs`).
   JS 가 바이트까지 같을 때만 비교한다 — `dist` 가 낡았으면 조용히 건너뛴다
4. **배포된 번들에 API 키 흔적이 없는가** (있으면 즉시 중단)
5. `dep1.mjs` — 화면 사실 확인 + **실제 API 한 번** (`--quick` 이면 건너뛴다)
6. `private-dep.mjs` — 저장이 막힌 브라우저에서 전 경로
7. `blocked-lead.mjs` — 저장 차단 시 서식 안내문
8. `depshots.mjs` — 375/768/1280 스크린샷 (`tests/out/`)

1~4 는 브라우저가 없어도 돈다. 크롬이 없으면 거기까지만 하고 정상 종료한다.
낱개로 돌리려면 `node dep1.mjs <URL>` 처럼 그대로 부르면 된다.

---

## 무엇을 보는 시험인가

### 브라우저 없이 (단위)

| 파일 | 검사 |
|---|---|
| `tp.mjs` | 인쇄 페이지 분할 계산(paginate) |
| `tj.mjs` | 여정 저장·불러오기, 정규화, 주민등록번호가 저장 구조에 없음, 해를 넘긴 날짜 표기 |
| `tmatrix.mjs` | 사건 유형 × 업권 × 한도 **전수**(504조합) 판정이 근거 조문과 모순되지 않는가 |
| `t1.mjs` | 회신 해석 서버 가드(분류 교정, 거절 판정) |
| `tpre.mjs` | 인쇄 전 점검(preflight) 문구 |
| `treason.mjs` | `/strategy` 선정이유 가드 — 서술에 없는 인용을 버리는가 |
| `safari.mjs` | 옛 사파리 인쇄 분기 판정 |

### 브라우저 (앱 + 크롬 필요)

| 파일 | 검사 |
|---|---|
| `phase1~5`, `phase8` | 화면별 기능 회귀(진단·판정·서식·인쇄·이후 절차) |
| `e2e4.mjs` | 회신 해석 전 경로 |
| `journey.mjs` | 저장 → 새 세션 → 이어서 하기 → 내보내기/불러오기 |
| `private.mjs` | 저장이 막힌 브라우저에서 기능이 죽지 않는가 |
| `rename.mjs` | 서비스명 표기, 옛 파일명 호환, 저장소 네임스페이스 불변 |
| `thero.mjs` | 랜딩 제목이 사건 하나에 묶이지 않는가, 375 첫 화면, 쉬운 말, 서식 정본 미대조 고지, 진단 결과 바로가기 |
| `tlong.mjs` | 오래 쓰는 사용자 — 낡은 전략 목록 표시, 해를 넘긴 날짜, 71KB 기록으로 전 화면 |
| `tnarrow.mjs` | 좁은 화면에서 잘리는 곳이 없는가 (요소 단위). 320px 에서 밀 수 있다고 알리는가 |
| `tlaw.mjs` | 법령 원문 역방향 대조 — 화면의 조문 인용·근거 배지·판본이 원문과 맞는가 |
| `tform2.mjs` | 서식 2 원문 대조 교정 5건이 인쇄물에 그대로 나가는가 |
| `trform.mjs` | 회신 법정 서식(별지 제15호의4) 고지 — 원문·미확인 고지·단정 금지 |
| `tfacts.mjs` | 개인정보·전송 고지가 실제 동작과 일치하는가, 샘플 캐시 해제 |
| `tnext.mjs` | `/next` 접기·펼치기 기본 상태 |
| `tstrategy.mjs` | `/strategy` 선정이유·출처 표시 |
| `tour.mjs`, `tourkbd.mjs` | 둘러보기 완주(마우스·키보드), **375px 에서 정거장마다 패널이 맨 위부터 보이는가**. 정거장 수는 `src/data/tour.js` 에서 읽는다 |
| `tdiag.mjs` | 그림 3종(화살촉·모바일 변형 포함) |
| `kbd.mjs` | 키보드 접근성, 글자 크기 |
| `ta11y.mjs` | 스크린리더 관점 — 랜드마크·제목 계층·라벨·aria-controls·표 머리 (8화면) |
| `afterprint.mjs` | 인쇄 후 흐름, 카운트다운 없음 |
| `tcold.mjs` | **첫 방문에 화면이 튀지 않는가** — 투어 패널이 제자리에 그려지는가, 레이아웃 이동, 웹폰트 없음 (2026-09-01) |
| `mail.mjs` | 푸터 문의처 mailto·복사 가능 |
| `samplenote.mjs` | 샘플이 예시임을 화면이 밝히는가 |
| `paged.mjs` | 인쇄 쪽수 예고 = 실제 (`run-print.sh` 가 돌린다) |
| `tprintlong.mjs` | **PDF 에서 글자를 뽑아** 입력값이 전부 인쇄됐는지 센다 (`run-print.sh`) |

---

## 주의

- 시험끼리 **같은 브라우저·같은 localStorage 를 쓴다.** 앞 시험이 남긴 기록이
  뒤 시험을 흔들 수 있어, 대부분의 시험이 앱의 [처음부터]로 먼저 지우고 시작한다.
  새로 시험을 쓸 때도 그렇게 해라. `localStorage.clear()` 만으로는 부족하다 —
  앱이 화면을 떠날 때 메모리의 여정을 다시 저장한다.
- 인쇄 시험은 **빌드본**을 본다. 소스만 고치고 빌드를 안 하면 옛 결과가 나온다.

---

## 시험이 아닌 것 — `mkdiagrams.mjs`

기획서·발표 자료에 들어가는 그림 PNG(`docs/assets/diagram-*.png`)를 화면의 가로판 SVG에서
그대로 다시 뽑는다. **`src/components/Diagrams.jsx` 를 고쳤으면 반드시 돌린다.**
안 돌리면 화면은 새 문구, 기획서 그림만 옛 문구로 남는다.

```bash
node tests/mkdiagrams.mjs            # 셋 다
node tests/mkdiagrams.mjs routing    # 하나만
```

---

## 감사 스크립트 (`run.sh` 밖. 손으로 부른다)

심사 당일 조건을 재현하는 것들이다. 회귀 시험이 아니라 **한 번 재고 기록을 남기는** 용도라
`run.sh` 에 넣지 않았다. 결과는 `docs/audit-judgeday.md` 에 있다.

| 파일 | 무엇을 재는가 | 부르는 법 |
|---|---|---|
| `jd1-cold.mjs` | 캐시·기록 없는 첫 방문. 회선 3종 × 화면 2종의 FCP·CLS·투어 시점·글꼴 | `node jd1-cold.mjs [URL]` |
| `jd2-5min.mjs` | 5분 체험. 투어 본 사람 / 건너뛴 사람 × 375 / 1280 | `node jd2-5min.mjs [URL]` |
| `jd4-apidown.mjs` | `/api/*` 를 503·502·504·429·연결실패·무응답으로 강제하고 전 경로 완주. **실제 API 를 부르지 않는다(비용 0)** | `node jd4-apidown.mjs [URL]` |
| `jd5-requests.mjs` | 화면마다 나가는 요청 전수. 바깥 요청·함수 호출 시점 | `node jd5-requests.mjs [URL]` |
| `jd6-links.mjs` | 화면의 외부 링크를 **브라우저로** 열어 조문·판본까지 확인. 국가법령정보센터에 실제로 붙는다 | `node jd6-links.mjs [URL]` |
| `jd7-print.mjs` | A4 / Letter / 배율 / 머리글·바닥글 / 흑백. `pdfinfo`·`pdftotext` 필요 | `node jd7-print.mjs [경우] [글자크기]` |
| `jra1.mjs` | 새 입력 경로(진입 카드·샘플 선택·하단 시트)에 적대적 사용 · 되돌리기 | `node jra1.mjs [URL]` |
| `jra2.mjs` | 하단 시트·진입 카드 접근성 · 빈 상태 경계값 · 옛 기록 복원 | `node jra2.mjs [URL]` |
| `jdocs.mjs` | **제출 문서의 주장 ↔ 화면.** 열 가지 화면 상태의 글자를 모아(`out/screens.txt`) 문장 단위로 대조 | `node jdocs.mjs [URL]` |
| `jcontrast.mjs` | 글자·구획선 대비 실측 (문서의 수치가 아직 맞는지) | `node jcontrast.mjs [URL]` |
| `reset-browser.mjs` | 탭을 새것으로. 실행기 셋이 맨 앞에서 부른다 | `node reset-browser.mjs` |
| `depcss.mjs` | 배포본 CSS 가 로컬 빌드 규칙을 빠뜨렸는지. `run-deployed.sh` 가 부른다 | `node depcss.mjs [URL]` |

`jd6-links.mjs` 는 **바깥 서버(국가법령정보센터)에 의존한다.** 그쪽이 느리거나 죽으면
실패로 나온다 — 우리 문제가 아니다. 그래서 `run.sh` 에도 `run-deployed.sh` 에도 넣지 않았다.

> **한글 문자열을 찾을 때** — 음절이 미리 합쳐져 있어 `"아니"` 는 `"아닙니다"` 의 부분
> 문자열이 **아니다** (U+B2C8 vs U+B2D9). `jdocs.mjs` 를 처음 돌렸을 때 세 화면에 다 있는
> 문장을 한 화면에만 있다고 셌다. 어미 앞에서 끊어 찾지 마라.

### CSP · Origin (2026-09-02 심사 대비)

| 스크립트 | 무엇을 |
|---|---|
| `torigin.mjs` | `/api/*` 의 Origin 가드 — 우리 출처만 통과, **Origin 없는 요청은 막지 않는다** |
| `csp-server.mjs` | `vercel.json` 의 헤더를 그대로 실어 `dist/` 를 서빙 (기본 4500). `vite preview` 에는 CSP 가 실리지 않으므로 필요하다 |
| `tcsp.mjs` | CSP 아래에서 전 경로 완주 — 여섯 화면·투어·내보내기(blob)·mailto·인쇄·`/api` 폴백. 위반은 `securitypolicyviolation` 이벤트와 CDP `Log.entryAdded` **두 경로**로 듣는다 |

`run.sh` 가 목록을 다 돈 **뒤에** `csp-server.mjs` 를 직접 띄워 `tcsp` 를 돌리고 내린다
(브라우저 탭을 함께 쓰므로 동시에 돌리지 않는다). `dist/` 가 없으면 건너뛴다.

### 라이브 인용 검산 (비용 있음)

```bash
node tests/live-quote.mjs     # /api/interpret 을 실제로 한 번 호출한다
```

캐시에 없는 회신문을 넣어, 모델이 낸 인용 중 **몇 개가 회신 원문 대조에 걸려 버려지는지**
센다. 마지막에 지어낸 인용을 일부러 주입해 전부 버려지는지까지 본다(이건 API 를 다시 부르지 않는다).
`.env` 의 `ANTHROPIC_API_KEY` 를 직접 읽는다 — dotenv 를 의존성으로 더하지 않았다.
