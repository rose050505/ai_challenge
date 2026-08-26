# Safari / WebKit 위험 항목

작성 2026-08-26. 실제 Safari 로 실행하지 못했다. **아래는 정적 분석 + caniuse 데이터**이며,
"확인함"이 아니라 "확인하지 못한 위험"으로 읽어야 한다.
근거 데이터: 저장소에 이미 설치돼 있는 `caniuse-lite`(browserslist 의존).

## 1. 위험 — 인쇄

| 항목 | Safari 지원 | 우리 영향 | 조치 |
|---|---|---|---|
| `@page { size; margin }` (caniuse `css-paged-media`) | **18.1 이하 미지원 / 18.2(2024-12) 이상 지원** | A4·여백 20mm 14mm 가 무시되고 Safari 기본 여백이 쓰인다. `.paged-page` 의 `min-height: 255mm` 가 실제 인쇄 영역과 어긋나 **쪽 수 예고가 틀릴 수 있다** | 내용은 잘리지 않는다(`height` 가 아니라 `min-height`). 구버전 Safari 를 감지해 인쇄 안내에 한 줄을 덧붙였다 (`isOldSafariPrint`) |
| `break-inside / break-before` (caniuse `css-page-break`) | 전 버전 **부분 지원** | 표의 행이 페이지 경계에서 갈라질 수 있다 | 1차 방어가 JS 분할(`paginate.js` + `.paged-page` 별 컨테이너 + `break-before: page`)이라 구조 자체는 유지된다. CSS `break-inside` 는 2차 방어일 뿐이다 |

## 2. 안전 — 확인된 것

| 사용 API | Safari 최초 지원 | 판단 |
|---|---|---|
| `localStorage` | 4 | 안전. 사생활 보호 모드는 `setItem` 프로브로 감지한다 (`isStorageAvailable`) |
| `AbortController` | 13 | 안전 |
| `beforeprint / afterprint` | 13 | 안전. 게다가 `window.print()` 직후 300ms 보조 경로와 `matchMedia('print')` 도 함께 둔다 |
| `display: flow-root` | 13 | 안전 (측정 영역의 여백 상쇄 차단) |
| `navigator.clipboard.writeText` | 14 | 안전. 클릭 핸들러의 첫 문장에서 호출한다(사용자 제스처 요건 충족). 실패 시 본문을 선택해 주는 폴백이 있다 |
| `<a download>` | 11 | 안전 (기록 내보내기) |
| `matchMedia` | 6 | 안전 |
| `word-break` | 9 | 안전 |

## 3. 위험 — 낮음

- **`<input type="date">`** (caniuse `input-datetime`): Safari 는 여전히 "부분 지원"으로 분류된다.
  제출일 입력에 쓴다. 값이 `YYYY-MM-DD` 가 아니어도 `formatDate`/`daysSince` 가
  `null` 을 돌려주고 화면은 그 줄을 그리지 않는다. **죽지 않는다.**
- **Tailwind CSS 4 의 요구 사양**: 빌드 산출물에 `@property` 37개, `color-mix()` 2개가 들어 있다.
  둘 다 Safari 16.4 (2023-03) 이상이 필요하다. 그 이하에서는 색이 일부 빠지지만
  글자와 구조는 남는다. `oklch()` 는 산출물에 하나도 없다(주조색을 직접 지정했기 때문).
- **`:has()`, `structuredClone`, `Array.at`, `Object.hasOwn`, `toSorted`, `findLast`,
  `requestIdleCallback`, `showOpenFilePicker`** — **한 곳도 쓰지 않는다** (전수 grep 확인).
- 빌드 타깃은 Vite 6 기본값 `baseline-widely-available` (Safari 16 이상).

## 4. 남은 불확실성

- Safari 의 **인쇄 시 글꼴 메트릭**이 화면과 다르면 `.print-metrics` 측정값이 어긋나
  쪽 수 예고가 틀릴 수 있다. Chrome 에서 겪었던 "20px 함정"과 같은 종류다.
  Chrome·Firefox 에서는 실측으로 예고 = 실제를 확인했지만 **Safari 는 확인하지 못했다.**
- iOS Safari 에서의 인쇄는 확인하지 못했다. 서식 화면에는 이미 "인쇄는 PC를 권장합니다" 안내가 있다.

## 5. 사용자 판단이 필요한 것

심사 전에 Mac 이 있는 분이 **Safari 로 `/document` 를 열고 인쇄 미리보기의 쪽 수가
화면 예고와 같은지** 한 번만 확인해 주시면 위 1번 위험이 사실상 해소된다.
