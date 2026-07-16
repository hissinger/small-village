# E2E 테스트

실제 브라우저(Playwright) + 실제 백엔드(Supabase/RealtimeKit)로 도는 통합 스모크·회귀 테스트 모음이다.
단위 테스트(`npm test`, Jest)와 달리 **앱이 실제로 떠 있어야** 하고 실제 DB/실시간에 붙는다.

> 이 스크립트들은 삭제하지 말 것 — 회귀 재현/재검증용이다. 새 회귀를 잡으면 여기에 스크립트를 추가한다.

## 공통 전제

1. **Playwright 브라우저 설치**(최초 1회):
   ```bash
   npx playwright install chromium
   ```
2. **`.env.local`** 에 `REACT_APP_SUPABASE_URL` / `REACT_APP_SUPABASE_KEY` 가 있어야 한다.
   각 스크립트가 테스트 흔적(rooms/users) 정리에 이 값을 쓴다.
3. **앱이 `http://localhost:3000` 에 떠 있어야** 한다. `E2E_BASE_URL` 로 override 가능.

### 앱 띄우는 두 가지 방법

- **개발 서버**(가장 간단, 현재 브랜치 코드 반영):
  ```bash
  npm start          # http://localhost:3000
  ```
- **정적 빌드 서빙**(HMR/websocket 노이즈 없이 헤드리스에 안정적):
  ```bash
  npm run build
  npx serve -s build -l 3000
  # 또는: (cd build && python3 -m http.server 3000)
  ```

> **git worktree 에서 테스트할 때 주의**: worktree 에는 `.env.local`(gitignore)과 `node_modules` 가
> 없다. 링크한 뒤 빌드해야 앱이 Supabase 에 붙는다:
> ```bash
> ln -sf /path/to/main/repo/.env.local .env.local
> ln -sf /path/to/main/repo/node_modules node_modules   # 또는 npm install
> npm run build && (cd build && python3 -m http.server 3000)
> ```

## 스크립트

| 스크립트 | 목적 | 클라이언트 | 실행 |
| --- | --- | --- | --- |
| `room-flow.mjs` | 방 생성→입장→이동 스모크. `POST /users` 409(FK 위반) 회귀 감시. | 1 | `npm run test:e2e` |
| `presence-3clients.mjs` | **presence 단일 소스 회귀**: 먼저 입장해 가만히 있는 유저가 나중 입장자의 참여자 패널/씬에서 누락되지 않는지(S1/S2/S3). | 3 | `node e2e/presence-3clients.mjs` |
| `issue37-reaction.mjs` | 이모지 리액션(issue #37): 피커 노출 + broadcast 송신 + 캔버스 변화. | 1 | `node e2e/issue37-reaction.mjs` |
| `issue37-reaction-timed.mjs` | 리액션 애니메이션 타이밍 캡처(육안 검사용 PNG). | 1 | `node e2e/issue37-reaction-timed.mjs` |
| `issue37-bottombar-final.mjs` | 바텀바 아이콘 정렬 육안 검사 크롭 캡처. | 1 | `node e2e/issue37-bottombar-final.mjs` |
| `issue37-verify-final.mjs` | 리액션 최종 재검증(정렬+broadcast+애니메이션+이동추적). | 1 | `node e2e/issue37-verify-final.mjs` |

`issue37-*` 캡처물은 `/tmp/sv-review/issue37/` 에 저장된다.

## presence-3clients.mjs — 무엇을·어떻게 검증하나

리팩토링 문서 [`docs/presence-source-refactor-plan.md`](../docs/presence-source-refactor-plan.md) 의
핵심 회귀(먼저 입장자가 나중 입장자 화면에서 사라지는 버그)를 재현·방지한다.

시나리오:
1. **Alice** 가 방을 만들고 입장한 뒤 가만히 있는다.
2. **Bob** 이 같은 방에 입장.
3. **Carol** 이 같은 방에 입장.
4. 세 클라이언트 각각에서 **참여자 배지 = 3**, 참여자 패널에 **Alice/Bob/Carol 이 모두** 보이는지 확인.
   (특히 Carol 이 "가만히 있던 Alice" 를 보는지가 핵심.)

판정 요령(스크립트에 반영됨):
- 게임 진입은 캔버스가 아니라 **참여자 배지 등장**(BottomBar 마운트 = `isReady`)으로 확인한다.
  로비에도 캐릭터 미리보기 캔버스가 있고, RTK join 완료까지 ~10초 로딩 스피너가 뜨기 때문.
- 배지 수·패널 목록은 presence sync + 데이터 fetch 수렴을 기다리며 **폴링**한다(고정 sleep 금지).
- 클라이언트별로 준비될 때까지 기다린 뒤 다음 클라이언트를 띄워 헤드리스 경합을 줄인다.

성공 시 종료코드 0, 실패 시 1. 종료 시 테스트가 만든 room/users 를 best-effort 로 정리한다.
