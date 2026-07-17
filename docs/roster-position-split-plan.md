# 로스터/위치 분리 리팩토링 plan (issue #51)

> **선행**: 로스터 단일 소스 리팩토링([presence-source-refactor-plan.md](presence-source-refactor-plan.md), `users` 테이블 기반 Option B)이 머지(#53)되어
> "기존 유저가 나중 입장자에게 사라지는" 버그는 해결됐다. 이 문서는 그 과정에서 발견한 **구조적 후속 개선**([#51](https://github.com/hissinger/small-village/issues/51))을 다룬다.
>
> **결정**: 이슈가 제시한 두 방향 중 **A(broadcast 분리)** 채택. 범위 = **#1(위치/멤버십 분리) · #4(presence→roster 네이밍) · #2(reconcile 튜닝)**. #3(무의미 re-render)은 #1 해결 시 자연 소멸.

## 배경 / 문제

현재 로스터는 **고빈도 위치(x/y)** 와 **저빈도 멤버십(누가 있나 + 이름/캐릭터/마이크)** 을 한 소스(`users` 테이블 + `RoomParticipantsProvider`)에 섞어 두고 있다.

원격 유저가 한 칸 움직일 때마다:

```
이동 → users UPDATE(postgres) → RoomParticipantsProvider.recompute() → 새 Map
     → context 값 교체 → 모든 소비자 re-render
       (BottomBar · ParticipantPanel · SpatialAudioController · SmallVillage→scene.updateUsers)
```

세 가지 구조적 문제:

- **P1. 이동마다 패널/배지 re-render.** [ParticipantPanel](../src/components/ParticipantPanel.tsx)·[BottomBar](../src/components/BottomBar.tsx) 는 x/y 를 안 쓰는데 이동마다 리렌더된다.
- **P2. 씬 이동 hot-path 에 React 가 끼었다.** 리팩토링 이전엔 postgres 콜백 → **곧바로 씬**이었는데, 지금은 **React 상태 → re-render → `scene.updateUsers`** 를 경유한다([SmallVillage.tsx:95-106](../src/components/SmallVillage.tsx#L95-L106)).
- **P3. 이동마다 DB 왕복.** [SmallVillageScene.update():671](../src/scenes/SmallVillageScene.ts#L671) 이 **이동 중 매 프레임(~60Hz) `upsertUserState`** 한다(스로틀 없음). upsert → WAL → realtime 왕복 → 지연·쓰기 부하.

또한 부수적으로:

- **P4(#3). 무의미한 re-render.** 하트비트로 `last_active` 만 바뀐 UPDATE 에도 노출 Map 을 새로 만들어 소비자를 리렌더한다([recompute](../src/context/RoomParticipantsContext.tsx#L67-L79)).
- **P5(#4). 네이밍 혼동.** Supabase Presence 를 안 쓰는데([#1807](https://github.com/supabase/realtime/issues/1807)) 파일·상수·주석이 여전히 "presence" 다([constants/presence.ts](../src/constants/presence.ts)).
- **P6(#2). reconcile 가 10초마다 방 전체 fetch(O(N) 읽기).** [RoomParticipantsContext:89-99](../src/context/RoomParticipantsContext.tsx#L89-L99).

### 위치 데이터의 소비자는 씬만이 아니다 (설계 제약)

리팩토링 전 실측으로 확인한 핵심 제약: **원격 위치(x/y) 는 두 곳이 소비**한다.

1. **게임 씬** — 스프라이트 tween([updateOtherUsers](../src/scenes/SmallVillageScene.ts#L563)).
2. **공간 오디오** — [SpatialAudioController](../src/components/SpatialAudioController.tsx#L70-L82) 가 원격 `u.x/u.y` 로 볼륨/패닝 계산. 내 위치(`myPosition`)는 [Conference](../src/components/Conference.tsx#L41) 가 [useLocalParticipant](../src/hooks/useLocalParticipant.tsx)(내 UPDATE 를 postgres 로 되받음)로 공급.

→ 위치를 DB(postgres_changes)에서 broadcast 로 옮기면 **씬뿐 아니라 공간 오디오·`myPosition` 소스도 함께** 이관해야 한다. 안 그러면 DB per-move write 를 없앤 순간 공간 오디오 위치가 얼어붙는다. PR 순서는 이 제약을 지켜 **각 PR 이 항상 동작하는 앱**을 남기도록 짠다.

## 목표 구조 — "빈도로 채널을 가른다"

데이터 빈도에 맞춰 두 채널로 분리한다.

### A. 저빈도 멤버십/식별 — `users` 테이블 (기존 provider 유지, 뷰만 개선)

- 소스·자가복구(초기 fetch + `postgres_changes` + reconcile)는 그대로. 멤버십의 단일 진실원.
- **노출 Map 은 멤버십/식별 필드(`id`·`name`·`character_index`)로만 파생**한다. `x`/`y`/`last_active` 변화로는 **새 Map 을 만들지 않는다**(참조 안정) → P1·P4 소멸. 소비자(패널·배지·씬 스프라이트 생성)는 이동마다 리렌더되지 않는다.
- 초기 fetch/reconcile 의 `x/y` 는 **늦은 입장자 seed**(스프라이트 첫 배치 위치)로만 씬에 전달한다.
- **고아 row 은닉 = 전용 stale-sweep 타이머(신규).** 지금은 이동·하트비트 UPDATE 마다 `recompute` 가 stale 필터를 재적용해 crashed 고아를 감춘다. 위치를 broadcast 로 빼고 `last_active` UPDATE 를 diff 로 억제하면 **이 잦은 트리거가 사라진다** → 고아 은닉이 `postgres DELETE`·reconcile 에만 의존하게 된다. 그래서 `dataRef` 에 stale 필터만 재적용하는 **값싼 로컬 sweep(DB fetch 없음)** 을 `ROSTER_STALE_TIMEOUT_MS` 이하 주기로 돌린다. 이렇게 은닉을 reconcile 에서 떼어내면 reconcile(O(N) DB 읽기)은 멤버십 자가복구용으로만 남아 **간격을 자유롭게 올릴 수 있다(#2)**.

### B. 고빈도 위치 — broadcast 채널 `position-<roomId>` (신규)

- fire-and-forget, **DB 왕복 없음**. payload `{ id, x, y }`.
- **`lib/positionChannel.ts`(신규)**: 방별 Supabase broadcast 채널 싱글턴 + 로컬 pub/sub 팬아웃. `subscribePositions(roomId, cb) → unsub`, `sendPosition(roomId, {id,x,y})`. `broadcast.self=true`(내 위치를 공간오디오가 받게). 채널명에 `roomId` 포함(방 간 격리). 기존 broadcast 패턴([MessageContext](../src/context/MessageContext.tsx))을 따른다.
- **전송 예산(B5)**: [supabaseClient.ts](../src/lib/supabaseClient.ts) 는 realtime `params` 를 설정하지 않아 **서버 기본 rate limit(연결당 통상 10 events/s)** 이 적용되고, 이 예산은 **연결 단위로 공유**된다 — 위치 10Hz 가 같은 클라이언트의 [채팅/리액션 broadcast](../src/context/MessageContext.tsx#L111-L115) 전송을 잠식할 수 있다. → `createClient` 에 `{ realtime: { params: { eventsPerSecond: N } } }` 로 여유 상향(예: 24)하고 위치 스로틀을 그 안(~10Hz)에 둔다. *정확한 목표치는 Supabase 프로젝트 Realtime 설정의 현재 한도를 보고 정한다.*
- **공유 채널 수명(R7)**: 씬(무 throttle)과 `useRemotePositions` 훅(throttle)이 **한 채널을 공유**하므로, 정리 순서가 보장되지 않는다. `positionChannel` 은 **로컬 구독자 수를 세어 마지막 해제 시에만** 실제 `channel.unsubscribe()` 한다(ref-count) — 먼저 정리되는 쪽이 남은 소비자의 스트림을 끊지 않게.
- **씬**(React 미경유): 이동 중 **~10Hz 스로틀**로 `sendPosition`. 수신 시 `remotePositions: Map<id,{x,y}>` 갱신 → `updateOtherUsers` 가 그 값으로 tween(없으면 roster seed 로 폴백). 자기 id 는 무시(자기 스프라이트는 `this.sprite`).
- **공간 오디오**: 얇은 훅 **`useRemotePositions()`(신규)** — 같은 채널 구독, **throttled React state Map**(예: 100ms 병합). `SpatialAudioController` 가 roster 대신 이걸로 원격 x/y 를 얻고, `myPosition` 은 stream 의 내 id(=self broadcast)로 얻되 **첫 broadcast 이전 초기값은 [useLocalParticipant](../src/hooks/useLocalParticipant.tsx) 의 1회 fetch seed** 로 채운다(아래 PR-2 참조). 위치 리렌더는 오디오 서브트리에만 격리된다.
- **DB write**: 매 프레임 upsert 제거. 대신 seed 유지용 스냅샷만 — (a) 초기 등록(create), (b) **이동 멈출 때 1회**. 하트비트(`last_active`)는 유지(로비 카운트·roster stale 필터 의존). *(저빈도 주기 스냅샷은 두지 않는다 — 정지 유저는 멈춤 스냅샷이, 이동 유저는 지속 broadcast 가 늦은 입장자를 첫 스로틀 틱(~100ms) 안에 보정하므로 불필요.)*
- **송신 가드레일**: 씬의 `sendPosition` 은 **await 하지 않는다**(fire-and-forget — 현재 upsert 는 매 프레임 await 라 프레임을 막을 수 있다). payload x/y 는 현재 upsert 와 동일하게 `Math.floor`.

### 목표 데이터 흐름

```
[이동/저빈도 멤버십 분리]

내 이동  → position broadcast(position-<room>, 10Hz) ─┬─→ (원격) 씬 tween        (React 미경유)
                                                     └─→ (원격) 공간오디오 pan/gain (오디오 서브트리만)
         → users 스냅샷: 초기 1회 + 멈춤 시                        (늦은 입장자 seed 전용)
         → heartbeat: last_active 10s                              (로비 카운트/ stale)

입장/퇴장/이름·캐릭터 변경 → users INSERT/DELETE/UPDATE + reconcile
         → roster provider (멤버십/식별 필드 diff) → 멤버십 변화 때만 새 Map
         → 패널·배지 갱신 / 씬 스프라이트 생성·삭제(seed 위치)
```

## PR 단위 계획

각 PR 은 **머지해도 앱이 동작**하도록 순서를 잡았다(위치 소비자 전부가 broadcast 로 옮겨간 뒤에야 DB per-move write 를 제거).

### PR-1 — 위치 broadcast 채널 신설 + 씬이 broadcast 로 원격 위치 반영 (additive)
- `lib/positionChannel.ts` 신규(채널 싱글턴 + **ref-count pub/sub**, `sendPosition`/`subscribePositions`). 마지막 구독자 해제 시에만 `unsubscribe`(R7).
- [supabaseClient.ts](../src/lib/supabaseClient.ts) 에 `realtime.params.eventsPerSecond` 상향 설정(B5 — 위치 10Hz 가 채팅/리액션 전송 예산을 잠식하지 않게).
- 씬: 이동 시 `sendPosition`(~10Hz 스로틀) **추가**. 송신은 현재 upsert 와 동일하게 **`isMoving && this.ready`** 로 게이팅(등록 전 방송 방지, R5). 수신 → `remotePositions` → `updateOtherUsers` 가 broadcast 위치 **우선**, 없으면 roster seed. **기존 DB upsert 경로는 아직 유지**(공간오디오·seed 무손상).
- `updateOtherUsers` 는 **tween target 과 walk 애니메이션 방향을 모두 `remotePositions`(없으면 seed) 한 소스에서** 파생한다 — roster x/y 와 혼용 금지(R5).
- **정리**: 씬은 lifecycle 훅이 없으므로(현재 `events.on` 부재) `this.events.once(Phaser.Scenes.Events.SHUTDOWN, ...)` 로 `subscribePositions` 를 해제한다(B3 — `game.destroy(true)` 만으로는 채널이 안 닫혀 재입장·StrictMode·HMR 시 누수). 유저 퇴장 시 [removeUserSprite](../src/scenes/SmallVillageScene.ts#L494) 에서 `remotePositions` 엔트리도 삭제(R4).
- 결과: 원격 이동 반영이 broadcast(저지연)로. 나머지 경로 불변 → 회귀 없음.
- 테스트: send 스로틀(프레임 여러 번 → send 1회/창), 수신 payload → 해당 스프라이트 target 반영, 자기 id 무시, **SHUTDOWN 시 구독 해제**, 퇴장 시 remotePositions 정리, **ref-count(마지막 해제 전엔 채널 유지, 마지막에만 unsubscribe)**.

### PR-2 — 공간 오디오 위치를 broadcast 로 이관 (+ `myPosition` 소스 변경)
- `useRemotePositions()` 훅 신규(position 채널 구독, throttled React Map, self 포함).
- `SpatialAudioController`: 원격 x/y 를 `useRemoteParticipants` → `useRemotePositions` 로.
- `myPosition` seed 처리(**B1**): `useRemoteParticipants` 는 self 를 제외하므로 내 위치는 그 뷰에 없고, broadcast 는 보존되지 않아 첫 이동 전엔 stream 에도 없다. → **[useLocalParticipant](../src/hooks/useLocalParticipant.tsx) 의 초기 1회 fetch 를 seed 로 그대로 재사용**(R1)하고, live `myPosition` 은 stream 의 내 id 로 덮어쓴다. `useLocalParticipant` 에서 **위치 UPDATE 구독만 제거**(초기 fetch 는 유지) — Conference 가 유일 소비자.
- 결과: 위치의 **모든** 소비자(씬·공간오디오·myPosition)가 broadcast 를 쓴다. roster 는 아직 x/y 를 들고 있지만 소비되지 않는다.
- 테스트: throttle 병합, 원격/자기 위치 반영, **첫 broadcast 이전 myPosition 이 seed 로 채워짐**, 오디오 렌더러 pan/gain 재계산 트리거.

### PR-3 — 매 프레임 DB upsert 제거 + roster 노출을 멤버십/식별 전용으로 (P1·P3·P4)
- 씬 이동 write: **매 프레임 upsert 삭제** → **초기 등록 + 이동 멈춤 스냅샷만**(O1: 저빈도 주기 스냅샷 없음).
- `RoomParticipantsProvider`: 노출 Map 을 **멤버십/식별 필드 diff** 로 파생(`id` 집합·`name`·`character_index` 변화 때만 새 Map; `x`/`y`/`last_active` 무시).
- **고아 은닉용 전용 stale-sweep 타이머 추가**(B2): `last_active` UPDATE 가 diff 로 억제되면 stale 필터의 잦은 트리거가 사라지므로, `dataRef` 에 stale 필터만 재적용하는 값싼 로컬 sweep(DB fetch 없음)을 `ROSTER_STALE_TIMEOUT_MS` 이하 주기로 돌린다.
- `SmallVillage`: `scene.updateUsers` 를 **멤버십 변화 때만** 호출(위치는 이미 broadcast). seed x/y 는 스프라이트 생성 시에만 사용.
- 결과: DB write 급감(P3), 패널·배지 이동 리렌더 제거(P1), 무의미 리렌더 제거(P4). 위치는 broadcast 라 무손상.
- 테스트: 위치만 바뀐 UPDATE → 노출 Map **참조 불변**; 이름/캐릭터/입퇴장 → 갱신; 이동 중 upsert 호출이 초기+멈춤으로 제한됨; **stale-sweep 이 postgres 이벤트 없이도 고아를 뷰에서 제외**.

### PR-4 — 네이밍(#4) + reconcile 튜닝(#2)
- `constants/presence.ts` → `constants/roster.ts`(또는 `session.ts`)로 이름 변경, 파일·채널·주석의 "presence" 정리. `constants/index.ts` re-export·import 경로 업데이트.
- `RECONCILE_INTERVAL_MS`: 위치가 push(broadcast)로 빠지고 **고아 은닉이 PR-3 의 stale-sweep 으로 분리**됐으므로, reconcile(O(N) DB 읽기)은 멤버십 자가복구 안전망으로만 남아 **간격을 상향할 수 있다**(예: 10s→20~30s). 멤버십 push 는 여전히 INSERT/DELETE 로 즉시 반영. (stale-sweep 이 없으면 reconcile 을 stale 타임아웃 아래로 묶어야 하지만, PR-3 이후엔 그 제약이 풀린다.)
- e2e/README 및 브랜치 네이밍 노트(파일명은 유지, 문서로 의미 정리).

## 결정된 사항

1. **방향 = A(broadcast 분리).** 이동이 앱의 핵심 상호작용이고 P1·P2·P3 를 한 번에 잡는다. B(최소 변경)는 DB write 부하(P3)를 남기고, 어차피 공간오디오 위치 소스는 손봐야 하므로 A 와 작업량 차이가 작다.
2. **위치 소스 = broadcast(`position-<roomId>`).** DB 는 늦은 입장자 seed 용 스냅샷만. 멤버십 소스는 기존대로 `users` 테이블.
3. **씬은 React 미경유.** 씬은 `positionChannel` 을 직접 send/subscribe 한다(이미 `upsertUserState` 를 직접 쓰는 것과 동일 층위). 공간오디오만 React 훅(`useRemotePositions`)으로 소비.
4. **하트비트·`INACTIVE_TIMEOUT_MS`·`ROSTER_STALE_TIMEOUT_MS` 유지.** 로비 카운트·stale 필터가 의존. per-move write 제거와 무관.
5. **비파괴 정리 유지.** 클라이언트는 남의 row 삭제 금지(선행 리팩토링 계약 그대로).
6. **고아 은닉 = 전용 stale-sweep 타이머**(reconcile 간격 캡이 아니라). 값싼 로컬 재필터로 은닉을 reconcile 에서 분리 → #2(reconcile 간격 상향)와 상충하지 않는다. (B2 검토 결과 채택.)
7. **검증은 관측 가능성으로 층을 나눈다**(B4). e2e(headless)는 멤버십 + 이동 좌표 반영 + late-joiner seed 만; 리렌더 폭주(0) 와 오디오 패닝은 단위 테스트 + 수동(React DevTools/청취)으로. e2e 하네스는 이번에 좌표 assert 를 위해 확장한다.
8. **realtime 전송 예산 상향**(B5) + **공유 position 채널은 ref-count 로 정리**(R7). 위치 broadcast 가 채팅/리액션과 연결당 예산을 공유하므로 `eventsPerSecond` 를 명시 상향하고, 씬·훅이 공유하는 채널은 마지막 구독자 해제 시에만 닫는다.

## 비범위

- **presence 로의 복귀**는 [#1807](https://github.com/supabase/realtime/issues/1807) 해결 시 별도 검토. 멤버십 소스 seam 은 provider 한 곳.
- 음성 SFU(RealtimeKit) 연결 로직·마이크/발화 구독 변경 없음. 이번 변경은 **위치**만 broadcast 로 옮긴다.
- 패널 UI(디자인/애니메이션) 변경 없음.
- **same-user 다중 탭**: 선행 리팩토링과 동일 — 주기 reconcile + 하트비트가 다음 주기에 복구(범위 밖).
- broadcast 손실/순서 뒤바뀜: 위치는 fire-and-forget 이라 다음 패킷이 보정. 신뢰성 필요한 데이터(멤버십)는 여전히 DB.
- **공간오디오의 React 완전 제거(R3)**: `useRemotePositions`(throttled React state) 대신 씬 tick 에서 WebAudio 노드를 직접 갱신하는 방식은 작업량이 커 이번엔 안 한다. 이관 후에도 오디오 리렌더 churn 이 문제로 남으면 후속으로 검토.
- **tween churn 최적화(R6)**: [updateOtherUsers](../src/scenes/SmallVillageScene.ts#L602) 가 매 프레임 새 tween 을 만드는 것은 **기존(pre-existing) 동작**이다. broadcast(10Hz)로 옮긴 뒤 target 변경 시에만 tween 을 생성하도록 정리하면 churn 이 줄지만, 이번 리팩토링의 필수 범위는 아니라 선택적 후속으로 둔다.
- **배포 창(deploy window) 혼재 버전**: 단일 Netlify 배포라 방 안 클라이언트는 대개 같은 버전이지만, 배포 순간 구버전(DB 기반 위치)·신버전(broadcast)이 잠깐 공존하면 신버전이 구버전의 이동을 seed(생성 시점) 이후 갱신 못 받을 수 있다. 짧은 전환 구간 한정이라 별도 대응 안 함.

## 검증

검증은 **각 항목의 관측 가능성**에 맞춰 층을 나눈다(B4 — 현재 e2e 하네스는 참가자 카운트 배지만 확인하므로 위치/리렌더/오디오는 그대로 재사용할 수 없다).

- **단위(Jest)**: `positionChannel`(send 스로틀/구독 팬아웃/self), 씬 위치 반영(broadcast 우선·seed 폴백·SHUTDOWN 해제·퇴장 정리), roster provider 멤버십 diff(위치 UPDATE 는 참조 불변) + **stale-sweep 이 postgres 이벤트 없이 고아 제외**, 공간오디오 위치 소스 훅(+ **myPosition seed 폴백**), upsert 호출이 초기+멈춤으로 제한됨.
- **e2e(Playwright, 2~3 클라이언트)**: 현 [e2e/presence-3clients.mjs](../e2e/presence-3clients.mjs) 는 배지 기반 멤버십만 본다. 이번에 **하네스를 확장**해 headless 로 관측 가능한 것만 assert 한다 — (1) 한 클라이언트 이동 후 다른 클라이언트에서 해당 원격 스프라이트의 좌표가 따라옴(씬 상태를 test hook 으로 노출), (3) **가만히 있던 기존 유저가 나중 입장자에게 seed 위치로 즉시 보임**(late-joiner seed 회귀). worktree 실행 절차는 [e2e/README.md](../e2e/README.md).
- **단위 + 수동**: (2) 이동 중 패널/배지 리렌더 0 — 노출 Map 참조 불변 단위 테스트로 보장하고, 실측은 React DevTools Profiler 로 수동 확인(headless 계측 어려움). (4) 공간 오디오 패닝/볼륨 변화 — 위치 소스 훅 단위 테스트 + 수동 청취.
- **성능 관찰(수동)**: 이동 중 DB write 횟수(before ~60/s → after 초기+멈춤), 이동 시 패널/배지 리렌더 0(React DevTools).
