# Small Village — 버그 트래킹 리포트 (Bug Reports)

본 문서는 `Small Village` 개발 및 자동화 리뷰 크론 과정에서 발견되고 조치된 버그 및 미결 이슈를 날짜별로 투명하게 트래킹하는 공식 문서입니다. 내용의 중복을 배제하고, 실질적인 코드 구조 및 빌드 정합성을 유지하기 위해 작성되었습니다.

---

## 📅 2026-07-16 (금일 리포트 및 조치 사항)

### 1. [해결 완료] 기획 점검 크론 스크립트의 캔버스 픽셀 분석 오탐 버그
* **발견 일자:** 2026-07-16
* **증상:** `daily-product-review.mjs` 실행 시, 게임 화면이 정상적으로 렌더링되고 있음에도 불구하고 캔버스 렌더링 비율이 `비검은 undefined%`로 출력되는 현상.
* **원인:** `analyzeBiggestCanvas(page)` 함수 내에서 캔버스가 존재할 때 반환하는 객체에 `hasCanvas` 플래그가 누락되어 있었습니다. 이로 인해 후속 코드인 `if (!res.hasCanvas) return res;` 분기를 타고 함수가 중간에 조기 리턴되어, 비검은 픽셀 연산(`stats` 계산)을 수행하는 `page.evaluate`가 실행되지 못했습니다.
* **조치 사항:** `analyzeBiggestCanvas` 반환 객체에 `hasCanvas: true` 프로퍼티를 명시하도록 패치를 적용했습니다. 조치 후 `비검은 99.9%`로 완벽하게 픽셀 분석 결과가 정상 집계됨을 확인했습니다.
* **영향을 받은 파일:** `scripts/daily-product-review.mjs` (Patched)

### 2. [미결 이슈] 인게임 진입 테스트 시 바텀바(BottomBar) 탐색 실패 및 오탐
* **발견 일자:** 2026-07-16 (Playwright E2E 점검)
* **증상:** Playwright 스뮬레이션 및 크론 실행 결과, 실제 스크린샷(`game-*.png`) 상에는 아래쪽에 마이크/채팅 등의 바텀바 UI가 온전히 렌더링되어 표시되나, 테스트 러너는 `bottombar: false` (바텀바 감지 실패)로 인지하여 오탐이 발생하는 현상.
* **원인:** `BottomBar.tsx` 컴포넌트 내부의 각 제어 요소들이 웹 표준 `button` 태그가 아니거나, Playwright가 텍스트(`name: /exit|mic|chat|message/i`)로 감지할 수 있는 시맨틱 마킹(`aria-label` 또는 `title` 속성)이 결여되어 접근성 트리(Accessibility Tree) 탐색에 실패하는 것으로 분석되었습니다.
* **조치 제안:** `BottomBar.tsx` 내 아이콘들을 `button` 태그로 선언하거나, 명시적으로 `aria-label="Exit"`, `aria-label="Mic Toggle"` 등 스크린 리더와 테스트 러너가 정확하게 타겟팅할 수 있는 웹 접근성 표준 속성을 보완해야 합니다.
* **영향을 받는 파일:** `src/components/BottomBar.tsx`

### 3. [미결 이슈] 로비 화면 초기 진입 시 검은 화면 캡처 문제
* **발견 일자:** 2026-07-16
* **증상:** `lobby-*.png` 및 픽셀 분석 시 `비검은 0%`로 잡히며 검은 화면이 캡처되는 현상.
* **원인:** 로비 씬(`CharacterPreviewScene`)의 Phaser 게임 엔진 에셋 로딩 시간 및 React 로딩 상태가 마무리되기 전에 Playwright가 너무 빠르게 스크린샷을 찍어 발생한 캡처 타이밍 이슈입니다.
* **조치 제안:** `scripts/daily-product-review.mjs`와 `interactive-review.mjs`에서 로비 진입 시 `page.waitForTimeout` 수치를 조금 더 넉넉히 제공하거나, 화면에 "Loading assets..." 텍스트가完全に 사라질 때까지 대기하는 안정성 가드 코드를 보강해야 합니다.
* **영향을 받는 파일:** `scripts/daily-product-review.mjs`, `scripts/interactive-review.mjs`

### 4. [진행 중] 말풍선 오버플로우 및 긴 URL 렌더링 깨짐 (PR-1)
* **발견 일자:** 2026-07-16 (비전 렌더링 확인)
* **증상:** 게임 씬 내에서 무공백 문자열(예: 구글 문서 긴 URL 등)을 채팅으로 발송할 경우, Phaser 말풍선 밖으로 텍스트가 깨져서 길게 삐져나가거나 잘려 보이는 현상.
* **원인:** Phaser 내의 말풍선 텍스트 객체(`wordWrap`)가 긴 단일 토큰(URL)을 공백이 없으면 개행 처리하지 못하는 엔진 한계 때문입니다.
* **조치 제안:** `TODO.md`에 정의된 PR-1 범위에 맞게, 긴 텍스트를 글자 단위로 강제 개행하는 `useAdvancedWrap: true` 속성을 도입하거나, `truncateBubbleText(text, 200)` 함수를 도입해 일정 길이를 넘는 텍스트를 말줄임(`…`)으로 변환하여 렌더링 부담을 제거해야 합니다.
* **영향을 받는 파일:** `src/scenes/SmallVillageScene.ts`

---

## 📅 2026-07-15 (이전 이슈 트래킹 및 조치 완료)

### 1. [조치 완료] RealtimeKit 2.0 업그레이드에 따른 팬텀 의존성 에러
* **증상:** `Conference.tsx` 등에서 `@cloudflare/realtimekit`를 임포트해 쓰고 있으나 `package.json` 의존성 목록에 누락되어 전이 의존성(hoisting)에 의존하고 있어 불안정했던 빌드 위험 요소.
* **조치 완료:** `package.json` `dependencies`에 명시적으로 `"@cloudflare/realtimekit": "2.0.0"`을 박아 넣고 `npm install`을 실행하여 락파일을 갱신하였습니다.
* **영향을 받은 파일:** `package.json`, `package-lock.json`

### 2. [조치 완료] 게임 나가기(Exit) 시 이중 `leave()` 호출 버그
* **증상:** 사용자가 방을 나갈 때 `handleExit`의 `meeting?.leave()`와 언마운트 라이프사이클의 `cleanup` 내 `leave()`가 중복으로 동작하여 불필요한 예외를 유발하는 위험.
* **조치 완료:** `useRef(false)` 가드를 두어 `leaveOnce()` 호출 헬퍼를 추가하고, 양쪽 흐름에서 단 한 번만 `leave()`가 동작하도록 가드를 보완하여 해결 완료했습니다.
* **영향을 받은 파일:** `src/pages/SmallVillageScreen.tsx`

### 3. [조치 완료] `initMeeting` 반환 누락으로 인한 `isJoined` 오판 버그
* **증상:** 내부 재진입 등으로 인해 `initMeeting`이 `undefined`를 리턴해도 조용히 `setIsJoined(true)`가 실행되어, 정작 음성 연결은 실패했는데 화면엔 "연결됨"으로 잘못 상태가 전이되던 오류.
* **조치 완료:** 반환값이 `undefined`인 경우 즉시 에러를 throw하여 자연스러운 `try-catch` 흐름을 타게 함으로써 유저에게 "음성 연결 실패" 경고를 띄우도록 구조를 변경했습니다.
* **영향을 받은 파일:** `src/pages/SmallVillageScreen.tsx`
