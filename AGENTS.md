# AGENTS.md

Small Village 는 Gather Town 류의 2D 가상 공간이다. 픽셀 아트 맵 위에서 캐릭터를 움직이고, 근처 사람과 음성으로 대화하며(공간 오디오), 말풍선 채팅을 주고받는다. **서버가 없다** — Supabase(DB · Realtime · Edge Functions) 와 Cloudflare RealtimeKit(음성 SFU) 만으로 동작하는 serverless 구조이며 Netlify 로 배포한다.

## 개발 명령어

```bash
npm install
npm start        # CRA dev server (localhost:3000)
npm run build    # 프로덕션 빌드 (Netlify 배포 대상)
npm test         # react-scripts test (Jest). 현재 작성된 테스트는 없음
```

- 린트/포맷 전용 스크립트는 없다. ESLint 는 CRA 기본(`react-app`)으로 빌드/개발 중에만 돈다.
- Edge Functions 는 Deno 기반이라 별도 빌드가 없다. `supabase functions deploy <name>` 로 배포한다.

## 기술 스택

- **CRA (react-scripts 5)** + **TypeScript 4.9** + **React 18** — CRA 를 벗어난 커스텀 웹팩/vite 설정 없음.
- **Phaser 3** — 2D 게임 월드 렌더링 (맵/타일맵, 캐릭터 스프라이트, 말풍선). `src/scenes/` 에 있다.
- **Supabase** — Postgres DB + Realtime(3종) + Edge Functions.
- **Cloudflare RealtimeKit** (`@cloudflare/realtimekit-react`) — 음성 SFU. WebAudio 로 공간 오디오를 입힌다.
- **Tailwind CSS** — UI 스타일링(로비/바텀바 등). 게임 화면 자체는 Phaser 가 그린다.
- lodash, uuid, linkify(채팅 링크화), react-toastify, react-ga4/gtm.

## 아키텍처 — 데이터 흐름이 핵심

이 앱을 이해하는 열쇠는 **"상태를 어디에 두고 어떻게 동기화하는가"** 다. 세 개의 실시간 레이어가 있다.

### 1. Supabase Postgres — 위치/존재(presence) 저장소
- 테이블은 `rooms`, `users` 둘뿐 ([schema.sql](schema.sql)). 테이블 이름은 [src/constants/database.ts](src/constants/database.ts) 의 `DATABASE_TABLES` 상수로만 참조한다.
- `users` 는 **영속 데이터가 아니라 휘발성 접속 상태**다. 캐릭터의 `x/y`, 이름, 캐릭터 인덱스, `last_active` 를 담는다.
- 이동 동기화: [SmallVillageScene.ts](src/scenes/SmallVillageScene.ts) `update()` 에서 내가 움직일 때만 `users` 를 upsert → 다른 클라이언트는 `postgres_changes` 의 UPDATE 이벤트로 받아 스프라이트를 tween 이동시킨다 ([SmallVillage.tsx](src/components/SmallVillage.tsx)).
- 정리(GC) 로직이 여러 겹으로 겹쳐 있다 (핵심 주의점):
  - `beforeunload` 에 `users` row 삭제.
  - 10초마다 heartbeat 로 `last_active` 갱신, 15초 넘게 조용하면 inactive 로 보고 삭제.
  - RealtimeKit webhook `participantLeft` 에서도 서버측(Edge Function)이 삭제.
  - Supabase presence `leave` 이벤트에서도 삭제.
  - → **users row 는 언제든 사라질 수 있다고 가정하고 다뤄라.**

### 2. Supabase Realtime — 세 가지 용도로 나뉜다
- **postgres_changes** (`SmallVillage.tsx`): `users` 테이블 INSERT/UPDATE/DELETE 를 구독해 다른 유저의 등장/이동/퇴장을 씬에 반영.
- **broadcast 채널 `"message"`** ([MessageContext.tsx](src/context/MessageContext.tsx)): 채팅 메시지 버스. `receiver_id` 가 `"all"` 또는 내 id 일 때만 처리. `MessageType.CHAT` → [useChatMessage.tsx](src/hooks/useChatMessage.tsx) → 씬의 말풍선.
- **presence 채널 `online-users-<roomId>`** ([useOnlineUsers.tsx](src/hooks/useOnlineUsers.tsx)): join/leave 감지용.

### 3. Cloudflare RealtimeKit — 음성 + 공간 오디오
- 방 입장 시 [SmallVillageScreen.tsx](src/pages/SmallVillageScreen.tsx) 가 `createRTKToken` 으로 토큰을 받아 미팅에 join (audio only).
- [Conference.tsx](src/components/Conference.tsx) → [SpatialAudioController.tsx](src/components/SpatialAudioController.tsx) → [SpatialAudioRenderer.tsx](src/components/SpatialAudioRenderer.tsx): 원격 참가자의 `customParticipantId` 로 `users` 위치를 찾아, 내 위치와의 거리에 따라 WebAudio 로 볼륨/패닝을 조절한다. **RealtimeKit 참가자 ↔ Supabase user 는 `customParticipantId == users.id` 로 연결된다.**

### Edge Functions ([supabase/functions/](supabase/functions/), Deno)
- `create-meeting`: Cloudflare 에 미팅 생성 (`RTC_API_URL`, `RTC_API_KEY` 사용).
- `create-rtk-token`: 참가자용 auth 토큰 발급.
- `rtk-webhook`: Cloudflare 미팅 이벤트 수신 → `meeting.started/ended` 로 `rooms` 관리, `participantLeft` 로 `users` 정리. `SUPABASE_SERVICE_ROLE_KEY` 로 동작.

## 화면 흐름
`App.tsx` 의 2-스텝 상태 머신: `CHARACTER_SELECT` → `SMALL_VILLAGE`.
- [CharacterSelectScreen.tsx](src/pages/CharacterSelectScreen.tsx): 로비. 캐릭터 미리보기(Phaser `CharacterPreviewScene`), 이름 입력, 방 목록/생성. 픽셀 배경 위 반투명 패널 디자인.
- [SmallVillageScreen.tsx](src/pages/SmallVillageScreen.tsx): 게임 화면. Phaser 게임 인스턴스 생성 + RealtimeKit join + Provider 들 마운트.
- 유저 식별자: 로그인 없음. `localStorage` 의 uuid (`smallvillage_user_id`) 가 곧 유저 id. localStorage 라 같은 브라우저의 여러 탭이 같은 유저 id 를 공유한다.

## 디렉터리
- `src/pages/` — 최상위 화면. `src/components/` — UI/기능 컴포넌트. `src/scenes/` — Phaser 씬. `src/hooks/` — 재사용 훅(주로 Supabase/RTK 구독). `src/context/` — 전역 Provider(Message, Room). `src/lib/` — Supabase 클라이언트 & Edge Function 호출. `src/constants/` — 상수(테이블명, 캐릭터 수 등).
- `public/assets/` — 캐릭터 스프라이트(`characters/000.png` … 40개), 타일맵/타일셋, 말풍선. `public/VolumeProcessor.js` — 오디오 워크렛.

## 컨벤션 · 주의사항
- **기능 구현·버그 수정 시에는 항상 테스트를 작성해 재발을 막는다.** 버그는 이를 재현하는(실패하는) 테스트를 먼저 만든 뒤 고친다. 테스트는 `npm test`(Jest + @testing-library). 아직 작성된 테스트 파일은 없으므로 첫 테스트를 추가할 때 관례를 세운다.
- **코드 변경 후에는 항상 린트·테스트·빌드를 확인한다.** 별도 `lint` 스크립트는 없다 — `npm run build` 가 ESLint(`react-app`)를 겸하고, 테스트는 `CI=true npm test`(watch 모드로 멈추지 않게 1회 실행)로 돌린다.
- 모든 소스 파일 상단에 Apache-2.0 라이선스 헤더가 붙어 있다. **새 `.ts/.tsx` 파일에도 동일 헤더를 넣어라** (기존 파일 복사).
- 주석/로그가 한국어·영어 혼용이다. 기존 파일 톤에 맞춰라.
- Supabase 테이블명은 문자열 리터럴 말고 `DATABASE_TABLES` 상수를 써라.
- `index.tsx` 에서 `window.global/process/Buffer` 를 polyfill 한다 (Node 전역을 기대하는 webrtc 계열 라이브러리용). `process` 는 실제 import 되는 의존성이므로 함부로 지우지 말 것 — 제거하려면 RealtimeKit/오디오가 런타임에 필요로 하지 않는지 먼저 확인.
- Phaser 씬은 React 밖 명령형 코드다. React state 를 씬에 넘길 때는 씬 인스턴스 메서드(`updateUsers`, `showChatMessage` 등)를 호출하는 방식(`SmallVillage.tsx`)을 따른다.
- `useEffect` 다수가 `// eslint-disable-line react-hooks/exhaustive-deps` 로 의존성을 의도적으로 비웠다(1회성 구독). 건드릴 때 주의.

## 환경 변수
로컬은 `.env.local`(git 제외). Netlify 는 대시보드 env.
- 프론트: `REACT_APP_SUPABASE_URL`, `REACT_APP_SUPABASE_KEY`, `REACT_APP_GA_ID`(선택), `REACT_APP_GTM_ID`(선택).
- Edge Functions (`supabase/functions/.env`, git 제외): `RTC_API_URL`, `RTC_API_KEY`, 그리고 런타임 제공 `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`.
- **비밀키를 커밋하거나 로그에 출력하지 말 것.** `.env*` 는 gitignore 되어 있다.
