# Presence & Visibility 개선 plan

> 한 화면에서 "여기 사람이 있나 / 누가 말하나 / 무슨 말을 했나"를 즉시 알 수 있게 만든다.
> 실사용(라이브 QA)에서 확인된 4가지 첫인상 약점을 저비용으로 해결한다.

## 배경 — 왜 이걸 먼저 하나

라이브(https://smallvillage.netlify.app)에서 직접 방을 만들어 들어가 본 결과, 코어 루프(입장→이동→공간음성→채팅)는 동작하지만 **"혼자 들어가면 할 게 없고, 공간 오디오인데 누가 말하는지 모르고, 말풍선이 깨진다"** 는 세 가지가 첫인상을 크게 깎는다. 네 항목 모두 **새 서버·새 인프라 없이 기존 데이터(`users` 테이블 + RealtimeKit 참가자 상태)와 기존 연결만으로** 구현 가능하다 — "서버 없음" 아키텍처에 완전히 부합.

## 목표 / 성공지표

- 로비에서 **사람이 있는 방을 한눈에** 고를 수 있다 (빈 방 문제 완화).
- 방 안에서 **말하는 사람이 시각적으로** 드러난다 (공간 오디오 완성도).
- 방 안에서 **현재 접속자 목록**(이름·마이크 상태)을 볼 수 있다.
- 말풍선이 **긴 URL/장문에서도 깨지지 않고**, 여러 명이 동시에 말해도 각자 정상 사라진다.

## 비목표 (YAGNI — 이번 범위 아님)

- DM·1:1 대화 UI, 유저 클릭 상호작용(프로필) — 별도 plan.
- 비디오/화면공유, 볼륨 슬라이더, 사적 대화 구역, 모바일 터치 이동.
- 빈 방 자동 삭제 정책, 로드 시 404 리소스 — 관찰만 기록, 별도 이슈.

## 공통 제약 · 원칙

- 새 테이블/컬럼 추가 없이 기존 `users`(id, name, character_index, room_id, x, y, last_active)만으로 해결한다. DB 마이그레이션은 선택적 최적화로만 둔다.
- **RealtimeKit 참가자 ↔ Supabase user 매핑 키는 `participant.customParticipantId === users.id`** (기존 `SpatialAudioController.tsx:38` 규약 그대로 재사용).
- Phaser 씬은 명령형이다. React → 씬 반영은 기존 방식(씬 인스턴스 메서드 호출: `updateUsers`/`showChatMessage`)을 따라 새 메서드를 추가한다.
- `INACTIVE_TIMEOUT_MS`(15s)는 현재 [SmallVillage.tsx:36](../src/components/SmallVillage.tsx#L36)에 지역 상수로만 있다 → 공유 상수로 승격해 PR-2(인원수 집계의 freshness 필터)가 재사용한다.
- 새 `.ts/.tsx` 파일엔 기존 Apache-2.0 헤더를 복사해 넣는다. 테이블명은 `DATABASE_TABLES` 상수 사용.
- 각 PR은 `npm run build`(ESLint 겸) + `CI=true npm test` 통과가 완료 조건. 순수 로직은 Jest 유닛테스트를 **먼저** 작성한다(회귀 방지 관례 수립).

## 구현 순서 (PR 단위)

의존도·리스크 순으로: **PR-1(④ 말풍선, 고립·저위험) → PR-2(① 인원수) → PR-3(② 스피커 링) → PR-4(③ 참가자 패널)**.
PR-3·4는 **같은 발화 상태를 공유**하므로, PR-3에서 공용 훅 `useSpeakingPeers()`를 만들고 PR-4가 재사용한다(순서 고정). "말하는 중" 표시는 이 훅을, 마이크 on/off는 RTK `audioEnabled` selector를 함께 쓴다.

---

## PR-1 — ④ 말풍선 오버플로우 · 긴 URL · 동시발화 타이머 버그

**문제(라이브 확인).** 스크린샷에서 `https://example.co`\n`m` 처럼 URL이 버블 밖으로 어색하게 잘리고, 장문이면 버블이 과도하게 커진다. 추가로 코드 리뷰에서 **명백한 버그**를 발견:

- [SmallVillageScene.ts:270](../src/scenes/SmallVillageScene.ts#L270) `speechBubbleHideTimer`가 **씬 전역 단일 필드**다. A가 말한 뒤 B가 말하면 [setMessage():465-474](../src/scenes/SmallVillageScene.ts#L460-L475)가 A의 타이머를 `remove()`하고 B용 타이머만 건다 → **A의 말풍선이 영원히 안 사라짐.**

**범위.** 인-월드 말풍선(`SpeechBubble`)만. 채팅 패널(`ChatPanel`)은 이미 `break-all`+스크롤이라 손대지 않는다.

**구현.**
1. **타이머를 버블별로.** `SpeechBubble`에 `private hideTimer` 필드 추가. 텍스트 표시/숨김을 버블 자신이 관리하는 `display(text: string, durationMs = 10000)` 메서드로 옮긴다: 이전 `hideTimer` 취소 → `setText` → `setAlpha(1)` → `this.scene.time.delayedCall(durationMs, () => this.setAlpha(0))`로 재설정. 씬의 `speechBubbleHideTimer` 필드와 `setMessage()`의 타이머 로직 제거, `showChatMessage()`가 각 버블의 `display()`를 호출하도록 변경.
2. **장문 잘라내기.** 순수 함수 `truncateBubbleText(text, maxLen = 200)`을 `src/scenes/bubbleText.ts`(신규)로 분리 → `maxLen` 초과 시 `…` 붙여 자름. `display()`에서 setText 전에 적용.
3. **오버플로우/워드랩 정합.** 주 방어선은 **char-cap(`truncateBubbleText`) + 생성자 `wordWrap.width`([:94-97](../src/scenes/SmallVillageScene.ts#L94-L97))와 렌더 폭 정합** 두 가지다 — 이 둘만으로 대부분 해결된다. `maxLines`(예: 6)는 **선택적 세로폭 안전장치**로만 둔다: Phaser `maxLines`는 초과분을 **말없이 잘라낼 뿐 `…`을 붙이지 않는다**(말줄임은 오직 char-cap이 담당). 긴 무공백 토큰(URL)은 `useAdvancedWrap: true`가 문자 단위로 끊으므로 유지하되, 자른 뒤에도 버블 경계 안에 들어오는지 2-클라이언트 수동확인. [검증: phaser.d.ts:74739 `maxLines` 실재]

**엣지케이스.** 빈 문자열/공백만 입력, 이모지·CJK 혼합 폭 계산, `maxLines` 초과분은 **말줄임 없이 잘림**(말줄임은 char-cap이 담당).

**테스트.** `bubbleText.test.ts` — 짧은 문자열 그대로 / 201자 → 200자+`…` / 정확히 경계값 / 멀티바이트. (Phaser 렌더는 유닛테스트 불가 → 수동 스크린샷.)

**변경 파일.** `src/scenes/SmallVillageScene.ts`(SpeechBubble·setMessage·showChatMessage), `src/scenes/bubbleText.ts`(신규), `src/scenes/bubbleText.test.ts`(신규).

**수용조건.** 두 클라이언트가 연달아 말해도 각자 10초 뒤 개별적으로 사라진다 / 긴 URL·장문이 버블 밖으로 안 넘친다.

---

## PR-2 — ① 방 목록 실시간 인원수 배지

**문제.** 로비 [RoomList.tsx:74-77](../src/components/RoomList.tsx#L74-L77)의 "Open" 배지는 **하드코딩 라벨**이라 방에 사람이 있는지 알 수 없다 → 빈 방 문제.

**구현(서버 없이 클라이언트 집계).**
1. 공유 상수 승격: `src/constants/presence.ts`(신규)에 `INACTIVE_TIMEOUT_MS = 15_000`, `HEARTBEAT_INTERVAL_MS = 10_000` 정의 → `SmallVillage.tsx`가 이걸 import(기존 지역 상수 제거).
2. 순수 함수 `countActiveUsersByRoom(users, nowMs, timeoutMs)` → `src/lib/roomCounts.ts`(신규). `last_active`가 `now - timeout` 이후인 row만 세어 `Record<roomId, number>` 반환. **stale/유령 row는 자동 제외**(GC는 방에 사람이 있을 때만 돌아 로비 시점엔 낡은 row가 남을 수 있으므로 freshness 필터가 필수).
3. [useRooms.tsx](../src/hooks/useRooms.tsx) 확장: rooms 조회 후 `supabase.from(USERS).select("room_id, last_active")` 한 번 더 → `countActiveUsersByRoom`으로 집계. **공유 `Room` 타입([types.ts:27](../src/types.ts#L27))은 DB row 스키마이자 App→SmallVillageScreen까지 흐르는 영속 엔티티이므로 계산값을 박지 않는다** — `useRooms`가 `{ rooms: Room[]; counts: Record<string, number>; refetch; loading }`로 **counts를 별도 맵으로 분리 반환**한다(또는 로비 지역 파생타입 `RoomWithCount`). [App.tsx:85](../src/App.tsx#L85)·[SmallVillageScreen.tsx:38](../src/pages/SmallVillageScreen.tsx#L38)는 그대로 `Room`을 받으므로 파급 없음. (기존 인위적 `setTimeout(1000)` 딜레이는 유지/무관.)
4. [RoomList.tsx](../src/components/RoomList.tsx): "Open" 라벨을 카운트 배지로 교체(count는 `counts[room.id] ?? 0`). `count > 0` → 초록 `👥 N` / `=== 0` → 회색 "비어 있음". 상단 정렬을 인원수 desc로 바꿔 사람 있는 방을 위로 올린다(선택).

**리얼타임(선택, 저비용).** 새로고침 버튼(`refetch`)이 이미 있으므로 MVP는 수동 갱신으로 충분. 스트레치: 로비에서 `users` INSERT/DELETE 구독해 배지 자동 증감. **처음엔 넣지 않는다(YAGNI)** — 필요성 확인 후 별도.

**엣지케이스.** `users` 조회 실패 시 카운트 0으로 폴백(방 목록은 계속 보여야 함) / 방은 있는데 user row 0 / 동일 user가 여러 room_id(불가하지만 방어).

**테스트.** `roomCounts.test.ts` — fresh/stale 혼합, 빈 배열, 여러 방 분포, 경계 시각.

**변경 파일.** `src/constants/presence.ts`(신규), `src/lib/roomCounts.ts`(+`.test.ts`, 신규), `src/hooks/useRooms.tsx`, `src/components/RoomList.tsx`, `src/components/SmallVillage.tsx`(상수 import 교체).

**수용조건.** 다른 탭에서 방에 입장하면 로비 새로고침 시 해당 방 배지가 1 이상으로 뜬다 / 아무도 없는(또는 유령 row만 있는) 방은 "비어 있음".

---

## PR-3 — ② 말하는 사람 표시(스피커 링)

**문제.** 공간 오디오인데 누가 발화 중인지 시각 단서가 0.

**RTK 2.0 발화 신호(코드로 검증한 실제 API).** `participants.active` 같은 리스트는 **없다.** 신호는 두 가지뿐:
- **`meeting.participants.on("activeSpeaker", ({ peerId, volume }) => …)`** 이벤트 — 발화 *시작/전환*만 오고 "**멈춤 이벤트는 없다**". `peerId`는 RTK 피어 id로 **`customParticipantId`가 아니다.** [검증: `@cloudflare/realtimekit` 2.0.0, index.d.ts:2492 payload=`{peerId, volume}`]
- `meeting.participants.lastActiveSpeaker: string`(단일 peerId). 마이크 상태는 참가자별 `audioEnabled` getter. [검증: index.d.ts:2545, AudioMuteButton은 `useRealtimeKitSelector((m) => m.self.audioEnabled)` 사용]

**매핑.** `activeSpeaker.peerId` → **`customParticipantId`(=`users.id`)** → 씬 스프라이트 키(`userSprites[id]` 또는 로컬 `this.sprite`). ⚠️ 원격은 `participants.joined`에서 조회하지만 **self는 `joined`에 없고 `meeting.self`에 있다**(기존 `SpatialAudioController.tsx:35`도 joined로 원격만 순회) → resolver가 `peerId === meeting.self.id`면 `meeting.self.customParticipantId`로 풀어야 내 캐릭터 링이 뜬다.

**구현.**
1. **공용 훅 `useSpeakingPeers()`** — `src/hooks/useSpeakingPeers.tsx`(신규). PR-3·PR-4가 공유하는 유일한 발화-상태 소스.
   - `meeting.participants.on("activeSpeaker", …)` 구독. 이벤트 수신 시 `peerId`를 `customParticipantId`로 해석해 **speaking Set에 추가**하고, **"멈춤 이벤트가 없으므로" peer별 debounce 타이머(예: 800ms 무이벤트 시 자동 제거)** 로 해제한다. 반환: `Set<userId>`.
   - **정리(누수 방지):** 언마운트 시 `meeting.participants.off("activeSpeaker", handler)` + 진행 중 debounce 타이머 전부 clear. (기존 훅들의 `unsubscribe()` 정리 관례와 정합.)
   - 순수 로직은 `src/lib/speakingPeers.ts`(신규)로 분리: `resolveSpeakingUserId(peerId, participants, self)`(peerId를 원격 `joined` **또는 self** 에서 찾아 customParticipantId 반환, 미해결/음소거 시 null), 그리고 debounce 상태 리듀서. 유닛테스트 대상.
2. **씬 API 추가.** `SmallVillageScene.setSpeaking(userId: string, speaking: boolean)`:
   - 대상 스프라이트가 로컬(`userId === this.userId`)이면 `this.sprite`, 아니면 `this.userSprites[userId].sprite`.
   - 발 밑에 반투명 초록 링(`this.add.ellipse` 또는 `graphics` arc, depth = 스프라이트보다 1 낮게) 을 lazy 생성/토글. 살짝 pulsing tween(scale 1↔1.15, yoyo). `speaking=false`면 링 숨김/정지.
   - 링 위치는 이름표처럼 `update()`/tween `onUpdate`에서 스프라이트에 동기화([:630-643](../src/scenes/SmallVillageScene.ts#L630-L643) 패턴 재사용). `removeUserSprite`에서 링도 destroy.
   - (선택) `activeSpeaker` payload의 `volume`을 링 알파/스케일에 매핑하면 on/off보다 자연스럽다.
3. **React 브리지.** 신규 `src/components/SpeakerIndicators.tsx`(SmallVillage 내부, scene prop 주입). `useSpeakingPeers()` Set 변화 diff → 새로 켜진 id `scene.setSpeaking(id, true)`, 꺼진 id `false`.
4. **로컬(내) 발화.** self도 참가자이므로 **`activeSpeaker` 이벤트에 self가 포함될 가능성이 높다** — 구현 착수 시 **먼저 실측**한다. 포함되면 위 매핑의 **self 분기(`peerId === meeting.self.id`)만으로** 내 링이 뜬다(추가 오디오 코드 불필요). 포함 안 될 때만, 이미 있는 워크렛(`public/volumeProcessor.js` — 소문자로 로드됨; `AudioVisualizer.tsx`가 이 볼륨-읽기 로직을 가짐)에서 **볼륨 계산 부분만 추출**해 임계값↑이면 self를 speaking으로. (컴포넌트 통째 재사용이 아님. `public/`에 `VolumeProcessor.js`/`volumeProcessor.js` 중복 존재 — 정리는 별도.) 마이크 음소거면 항상 false.

**엣지케이스.** 음소거 참가자 제외(`audioEnabled=false`면 speaking Set에 안 넣음) / 스프라이트가 아직 없을 때(참가자 먼저, user row 늦게) `setSpeaking` no-op / debounce로 멈춤 처리(멈춤 이벤트 부재) / 방 나갈 때 링·타이머 정리.

**테스트.** `speakingPeers.test.ts` — peerId→customParticipantId 해석(원격 joined 성공 / **self 분기** / 미해결 null), 음소거 제외, debounce 리듀서(이벤트 후 타임아웃 전/후 상태). (링 렌더는 2-클라이언트 수동확인: A가 말할 때 B 화면에서 A에 링.)

**변경 파일.** `src/scenes/SmallVillageScene.ts`(setSpeaking·링 생성/정리), `src/lib/speakingPeers.ts`(+`.test.ts`, 신규), `src/hooks/useSpeakingPeers.tsx`(신규), `src/components/SpeakerIndicators.tsx`(신규), `src/components/SmallVillage.tsx`(마운트), (self가 이벤트에 없을 때만) 워크렛 볼륨 로직 추출.

**수용조건.** 한 클라이언트가 말하면 다른 클라이언트 화면에서 그 캐릭터 발밑에 링이 나타났다(발화 종료 후 ~800ms 내) 사라진다 / 내가 말하면 내 캐릭터에도 링 / 음소거 중엔 링 없음.

---

## PR-4 — ③ 참가자 목록 패널

**문제.** 방 안에 누가 있는지, 마이크는 켜졌는지 볼 방법이 없다.

**구현.**
1. **데이터 병합.** 순수 함수 `buildParticipantList(self, remoteMap, rtkParticipants, speakingIds)` → `src/lib/participantList.ts`(신규). 반환: `{ id, name, isMe, micOn, speaking }[]`.
   - 원격: 기존 [useRemoteParticipants()](../src/hooks/useRemoteParticipants.tsx)(id·name·character_index 제공)를 그대로 사용.
   - 로컬(self): `RoomContext`에서 이름. (v1 목록엔 characterIndex/아바타를 쓰지 않으므로 RoomContext 변경 불필요 — 아래 O2 참고.)
   - 마이크 상태: PR-3의 RTK 참가자 상태를 `customParticipantId===id`로 매칭 → `micOn=audioEnabled`. self는 기존 패턴 `useRealtimeKitSelector((m) => m.self.audioEnabled)` 재사용([AudioMuteButton.tsx](../src/components/AudioMuteButton.tsx)).
   - 발화(`speaking`): **PR-3의 공용 훅 `useSpeakingPeers()`를 그대로 구독**(별도 구독 만들지 않음).
2. **UI.** 신규 `src/components/ParticipantPanel.tsx` — [ChatPanel.tsx:193-208](../src/components/ChatPanel.tsx#L193-L208)의 우측 슬라이드-인 패턴을 그대로 복제(좌측 배치로 채팅과 겹치지 않게). 각 행: 이름(+ "나") + 마이크 on/off 아이콘(`Mic`/`MicOff`) + 발화 중 하이라이트. **아바타는 v1 비포함**(O2) — 후속 스트레치로, 넣을 땐 캐릭터 시트 첫 프레임을 CSS 크롭(`background-position:0 0`, `image-rendering: pixelated`)하고 그때 RoomContext에 `characterIndex`를 추가한다.
3. **바텀바 토글.** [BottomBar.tsx](../src/components/BottomBar.tsx)에 `Users` 아이콘 `IconButton` 추가(채팅 토글과 동일 패턴). 버튼에 인원수 배지(목록 length) 표시. 채팅/참가자 패널 상호 배타 오픈(하나 열면 다른 것 닫힘)은 선택.

**엣지케이스.** 나 혼자면 self만 표시 / user row는 있는데 아직 RTK 참가자 안 붙음 → `micOn=false`로 표시 / 이름 미입력 방어(닉네임은 필수라 사실상 없음) / 긴 닉네임 truncate.

**테스트.** `participantList.test.ts` — self 항상 포함·isMe, 원격 병합, RTK 매칭 실패 시 micOn=false, speaking 반영, 중복 id 제거.

**변경 파일.** `src/lib/participantList.ts`(+`.test.ts`, 신규), `src/components/ParticipantPanel.tsx`(신규), `src/components/BottomBar.tsx`. (아바타를 v1에 넣지 않으므로 `RoomContext.tsx`·`SmallVillageScreen.tsx` 변경 없음.)

**수용조건.** 두 클라이언트 접속 시 양쪽 패널에 서로가 보이고, 한쪽이 음소거하면 상대 패널의 마이크 아이콘이 off로 바뀐다 / 바텀바 배지 숫자 = 실제 접속자 수.

---

## 리스크 · 확인 필요

- **RTK 2.0 발화 신호는 확인됨, 단 self 포함 여부만 미결**(PR-3/4) — 소스는 `activeSpeaker` 이벤트(`{peerId, volume}`) + `lastActiveSpeaker`(단일 peerId), 매핑은 peerId→`customParticipantId`, 멈춤 신호가 없어 debounce로 해제(위 PR-3 반영 완료). **유일한 미결은 self가 이 이벤트를 emit하는지** — 착수 시 실측하고, 안 하면 그때만 워크렛 볼륨 로직 추출(불필요할 가능성 높음).
- **인원수 정확도**(PR-2) — 유령 row는 `last_active` 필터로 걸러지나, 로비에선 GC 주체가 없어 오래된 row가 DB에 잔존한다. freshness 필터가 유일한 방어선이므로 timeout 값(15s) 일관성 유지.
- **Phaser 링 성능**(PR-3) — 참가자 수만큼 tween. 소규모라 무해하나 링은 발화 중일 때만 활성 tween.

## 검증 방법

- 각 PR: `npm run build`(ESLint) + `CI=true npm test`.
- 통합 수동검증: 헤드리스 Chrome **2개 클라이언트**를 같은 방에 입장시켜(같은 QA 스크립트 재사용) — 인원수 배지 증가 / 한쪽 발화 시 반대쪽에 링 / 참가자 패널 상호 표시 / 연속 발화 후 말풍선 개별 소멸 을 스크린샷으로 확인.
