# 브라우저 테스트 가이드 (Headless WebGL)

Small Village 는 Phaser 가 WebGL 캔버스로 게임 월드를 그린다. 헤드리스
브라우저(Playwright)로 실제 렌더 결과를 캡처·검증하는 방법을 정리한다.
기획/QA 차원에서 "화면이 진짜로 그려지는지" 확인할 때 쓴다.

## 환경 사실 (이 저장소 테스트 머신 기준)

- OS: Ubuntu 24.04 (aarch64 / ARM64).
- GPU: `/dev/dri` 가 있긴 하나 전용 드라이버 없음 → **GPU 가속보다
  소프트웨어 WebGL(SwiftShader)로 안정적**.
- `agent-browser` 는 Linux ARM64 용 Chrome for Testing 빌드를 제공하지 않음
  (`Chrome for Testing does not provide Linux ARM64 builds` 오류).
  대신 **Playwright 가 자체 ARM64 chromium 을 `~/.cache/ms-playwright` 에
  이미 받아둠** (버전은 설치 시점의 chromium-XXXX). 이걸 쓴다.
- `apt` 로는 `chromium` 패키지가 없음(Ubuntu 24.04 noble 은 snap 전용).
  시스템 chromium 설치 경로는 가급적 피한다.

## 최초 1회 설치

```bash
# 프로젝트에 playwright 가 이미 있으므로 그대로 사용.
# 브라우저 바이너리만 없다면:
npx playwright install chromium
# (이미 받아둔 캐시가 있으면 no-op)
```

## 핵심: WebGL 을 보이게 하는 launch 플래그

헤드리스 Chromium 은 기본값이면 WebGL 컨텍스트를 못 만들어 캔버스가
**검은 화면**으로 잡힌다. 반드시 아래 플래그로 SwiftShader 소프트웨어
렌더링을 강제한다.

```js
const launchArgs = [
  '--no-sandbox',
  '--disable-dev-shm-usage',
  // WebGL 강제 (소프트웨어)
  '--use-gl=angle',
  '--use-angle=swiftshader',
  '--enable-unsafe-swiftshader',   // 최신 chromium 은 이게 없으면 WebGL 차단됨
  '--ignore-gpu-blocklist',
  '--enable-webgl',
  // 오디오/미디어 자동 허용 (공간오디오 getUserMedia 모킹)
  '--autoplay-policy=no-user-gesture-required',
  '--use-fake-ui-for-media-stream',
  '--use-fake-device-for-media-stream',
];

const browser = await chromium.launch({ headless: true, args: launchArgs });
```

검증 결과: 위 플래그로 `Phaser v3.87 (WebGL | Web Audio)` 모드로 기동하고,
로비 캐릭터 프리뷰 캔버스(120×100) 및 **게임 월드 캔버스(1280×696)가
평균 RGB(142,167,104)·비검은픽셀 99.9% 로 정상 렌더**됨을 확인했다.
(WebGL renderer 문자열: `ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device ...))`)

## 캔버스 픽셀 검증 패턴

Phaser 는 `render.preserveDrawingBuffer` 가 true 일 때만 `toDataURL()` 로
픽셀을 뽑을 수 있다. **개발 모드(`NODE_ENV !== 'production'`)에서는 이미
켜져 있다** (`src/pages/SmallVillageScreen.tsx` 참고) — dev 서버(`npm start`)
기준으로 검증한다.

```js
// 가장 큰(게임 월드) 캔버스를 골라 평균 RGB / 비검은픽셀 비율 계산
async function analyzeBiggestCanvas(page) {
  const res = await page.evaluate(() => {
    const cvs = Array.from(document.querySelectorAll('canvas'));
    if (!cvs.length) return { hasCanvas: false };
    let big = cvs[0];
    for (const c of cvs) if (c.width * c.height > big.width * big.height) big = c;
    return { w: big.width, h: big.height, url: big.toDataURL('image/png') };
  });
  const stats = await page.evaluate(async (url) => {
    const img = new Image();
    await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = url; });
    const off = document.createElement('canvas'); off.width = img.width; off.height = img.height;
    const ctx = off.getContext('2d'); ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, off.width, off.height);
    let r=0,g=0,b=0,nonBlack=0; const total=data.length/4;
    for (let i=0;i<data.length;i+=4){ r+=data[i];g+=data[i+1];b+=data[i+2];
      if(data[i]+data[i+1]+data[i+2]>24) nonBlack++; }
    return { avgR:Math.round(r/total), avgG:Math.round(g/total), avgB:Math.round(b/total),
             nonBlackPct:+(100*nonBlack/total).toFixed(1) };
  }, res.url);
  return { ...res, ...stats };
}

// 사용: const s = await analyzeBiggestCanvas(page);
//       console.log(s.nonBlackPct); // 99.9 → 렌더 정상, 0 → 검은 화면(플래그 누락 의심)
```

> 주의: `document.querySelector('canvas')` 는 **첫 번째** 캔버스(로비 프리뷰
> 120×100)를 잡으므로, 게임 월드를 보고 싶으면 면적이 가장 큰 캔버스를
> 골라야 한다(위 패턴 참고).

## ⚠️ 핵심 한계 — 인게임 진입은 RTK 오디오 join 이 필요

게임 화면은 `isReady = readyScene && scene && isJoined` 일 때만 언마스크된다.
`isJoined` 는 `createRTKToken` → `meeting.join()` 이 **성공**해야 true 다
(`SmallVillageScreen.tsx`). 즉:

- 헤드리스 테스트에서 **Cloudflare RealtimeKit 토큰 발급/미팅 join 이 실패**
  하면(네트워크 불가, 잘못된 키, rate limit 등) `isReady` 가 false 가 되어
  **"Strolling into the Small Village..." 로딩 오버레이가 게임 캔버스를 덮는다.**
- 이때 캔버스 픽셀 분석은 "정상 렌더(99.9%)"를 보고하지만, **사용자가 보는
  화면은 로딩 스피너** 다. 비전 모델로 봐도 "로딩 화면"으로 오인한다.
- 따라서 "인게임이 실제로 떴는지" 판별하려면 **캔버스 픽셀 + 바텀바(Exit/
  마이크/채팅 버튼) DOM 존재 여부를 함께 본다.** (로딩 오버레이일 땐 바텀바
  버튼이 안 뜬다.)

### 인게임까지 검증하려면

1. `.env.local` 의 `REACT_APP_SUPABASE_URL/KEY` 가 유효하고,
2. RealtimeKit 엣지 함수(`create-rtk-token`)가 동작하는 환경에서 실행.
3. 아니면 `isReady` 조건에서 `isJoined` 를 빼는 **테스트 전용 분기**를 두거나,
   `useRealtimeKitClient` mock 으로 join 을 강제 성공시킨다(별도 테스트
   하니스 필요 — 현재는 미구현).

## 기존 e2e 와의 정합

`e2e/room-flow.mjs` 는 현재 `chromium.launch()` 에 위 WebGL 플래그가 없다.
이 환경(ARM64 GPU 없음)에서는 게임 월드 캡처가 검은 화면으로 잡힐 수 있으니,
위 `launchArgs` 를 해당 파일에도 적용하는 걸 권장한다(단, e2e 는 users write
409 감시가 목적이라 캔버스 렌더까지는 필요 없음 — 필요 시에만).

## 실행 체크리스트

1. `npm start` 로 dev 서버 띄움 (포트 3000, `preserveDrawingBuffer` on).
2. 위 `launchArgs` 로 chromium launch.
3. 로비: `waitForTimeout(3500)` 후 로딩 오버레이 사라짐 확인 → 스크린샷.
4. 게임: 이름/방제 입력 → Create → 바텀바 버튼 대기(최대 20s) →
   `analyzeBiggestCanvas` + 스크린샷.
5. 비검은픽셀 ≈ 100% 이고 바텀바 버튼이 보이면 정상.
