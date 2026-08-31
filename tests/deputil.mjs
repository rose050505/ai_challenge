/**
 * 배포본 점검 공통 — **캐시 오탐 방지.**
 *
 * ── 왜 있나 (2026-09-01) ────────────────────────────────────────
 * 배포 직후 첫 실행이 **옛 번들**(index-Dsmn-7QJ.js)을 잡아 13건이 실패했고,
 * 두 번째 실행에서 새 번들로 27/27 통과했다. 배포는 정상이었고 검사가 캐시를 봤다.
 * 심사 기간(9/7~9/11)에 이 오탐이 나면 "배포가 깨졌다"고 오판하게 된다.
 *
 * 막는 방법 셋을 **다 쓴다.**
 *   1) 브라우저 캐시를 끈다        — Network.setCacheDisabled
 *   2) 요청에 no-cache 를 붙인다   — Network.setExtraHTTPHeaders
 *   3) 어느 판을 봤는지 찍는다     — 번들 해시를 출력하고, 기대값과 대조한다
 * 3) 이 핵심이다. 1·2 가 실패해도 **틀린 판을 검사했다는 사실이 드러난다.**
 * ────────────────────────────────────────────────────────────────
 */

/** 이 탭의 캐시를 끄고 no-cache 헤더를 붙인다. Page.enable 뒤에 부른다. */
export async function noCache(send) {
  await send('Network.enable')
  await send('Network.setCacheDisabled', { cacheDisabled: true })
  await send('Network.setExtraHTTPHeaders', {
    headers: { 'Cache-Control': 'no-cache', Pragma: 'no-cache' },
  })
}

/** 지금 화면이 물고 있는 번들 파일 이름 (index-XXXX.js) */
export async function loadedBundle(ev) {
  return ev(`(()=>{
    const s=[...document.querySelectorAll('script[src]')].map(s=>s.src)
      .find(u=>/\\/assets\\/[^/]+\\.js/.test(u));
    if(s) return s.split('/').pop();
    // 모듈 프리로드로만 걸린 경우까지 본다
    const l=[...document.querySelectorAll('link[href]')].map(l=>l.href)
      .find(u=>/\\/assets\\/[^/]+\\.js/.test(u));
    return l ? l.split('/').pop() : null
  })()`)
}

/**
 * 기대 번들과 대조한다.
 * @returns {{name:string|null, expect:string|null, ok:boolean}}
 *   expect 가 없으면(단독 실행) ok=true 로 두되 이름은 찍는다.
 */
export async function checkBundle(ev) {
  const name = await loadedBundle(ev)
  const expect = process.env.DEPLOY_JS || null
  const ok = !expect || (!!name && name === expect)
  return { name, expect, ok }
}
