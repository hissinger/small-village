# 로스터 단일 소스 리팩토링 plan

> **개정 이력**: 초안은 Supabase **Presence** 를 멤버십 권위로 삼는 설계였다(아래 "폐기된 초안" 참조).
> 실기기/e2e 검증에서 **호스티드 Supabase 의 presence 가 동작하지 않음**([supabase/realtime#1807](https://github.com/supabase/realtime/issues/1807))을 확인해,
> **`users` 테이블을 단일 소스로 두는 Option B** 로 전환했다. 아래 본문은 Option B 기준이다.

## 배경 / 문제

"방에 누가 있나(로스터)" 를 만드는 로직이 **두 곳에 중복**되어 있고, 둘 다 같은 방식·같은 약점을 가진다. 그 결과 **먼저 입장해 있던 참가자가 나중 입장자의 화면(패널 + 게임 씬 모두)에서 영구히 누락**될 수 있다.

- 씬용 로스터: [src/components/SmallVillage.tsx](../src/components/SmallVillage.tsx) — 마운트 시 `users` 1회 fetch + GC + `postgres_changes` 구독 → `scene.updateUsers()`.
- 패널/오디오용 로스터: [src/context/RemoteParticipantsContext.tsx](../src/context/RemoteParticipantsContext.tsx) — 마운트 시 1회 fetch(merge) + `postgres_changes` 구독 → `Map`.

### 재현/증거

2-클라이언트 e2e 에서, Carol(마지막 입장)의 패널과 게임 씬에서 Alice(최초 입장)가 통째로 사라지는 현상을 관측(간헐, 약 1/5). 게임 월드 이름표가 "CBob1" 로 겹쳐 뜨며 Alice 스프라이트가 없었다 — 패널만이 아니라 **씬 로스터에서도** 빠진 것.

### 근본 원인 (구조적)

- **S1. 1회성 fetch + 이벤트 스트림 / 재동기화 없음.** 이미 방에 있던 유저는 오직 초기 fetch 로만 인지한다. fetch 가 한 명 놓치거나 realtime 이벤트가 하나 유실(재연결 등)되면 영구히 어긋난다. 주기적 reconcile 이 없다.
- **S2. 파괴적 GC.** [SmallVillage.tsx:79-109](../src/components/SmallVillage.tsx#L79-L109) — 입장자가 방의 모든 유저 중 `last_active` 가 `INACTIVE_TIMEOUT_MS`(15s) 보다 오래된 사람의 row 를 **삭제**한다. 하트비트(`HEARTBEAT_INTERVAL_MS` 10s)가 단 한 번(>5s) 밀리면 멀쩡한 참가자가 삭제된다. (헤드리스에서 백그라운드 탭 타이머 스로틀링으로 재현.)
- **S3. 하트비트가 update-only.** [SmallVillage.tsx:64-70](../src/components/SmallVillage.tsx#L64-L70) — `update().match()` 는 이미 지워진 row 엔 no-op. 잘못 지워진 유저는 움직여서 씬이 upsert 하기 전까지 복구 불가.
- **S4. 로스터 이원화.** 씬과 패널이 각자 계산 → 서로 다를 수 있음(현재 실제로 다름).

### 왜 presence 초안을 접었나 (#1807)

정석대로면 "누가 접속 중"은 Supabase **Presence** 가 정답이다 — 새 입장자가 채널에 persist 된 전체 상태를 즉시 받으므로 S1(기존 유저 누락)이 애초에 안 생긴다. 그러나 실제 백엔드에서 검증한 결과:

- 이 프로젝트(호스티드 Supabase)에서 **presence 가 전혀 전달되지 않는다.** 원시 `supabase-js` 로 확인: `SUBSCRIBED`·`track: ok` 인데 `sync`/`join`/`leave` 와 `presenceState()` 가 발화 0. broadcast·postgres_changes 는 정상.
- 원인은 서버측 회귀 [supabase/realtime#1807](https://github.com/supabase/realtime/issues/1807)(2026-03~, 미해결): 호스티드에서 **초기 `presence_state`(전체 스냅샷)를 안 보내고 `presence_diff` 만** 보낸다. SDK 가 초기 스냅샷을 못 받아 diff 를 버퍼에만 쌓고 sync 를 안 낸다.
- 저수준 `presence_diff` 를 직접 처리해도, **새 입장자가 "이미 있던 멤버"를 알 방법이 없다**(초기 스냅샷 부재). 3-클라이언트 e2e 로 확인: 각 클라이언트가 자기 구독 이후 입장자만 보고 기존 유저는 못 봤다 — 고치려던 버그가 그대로 재현.
- 프로젝트 설정은 정상(Realtime 켜짐, public 채널 허용, presence events/s=20). 즉 우리 코드·버전 문제가 아니라 Supabase 서버 버그다.

→ presence 는 #1807 이 고쳐질 때까지 신뢰할 수 없다. 대신 이 백엔드에서 **확실히 동작하고 이미 이 앱에 존재하는** `users` 테이블(휘발성 세션 + `last_active` 하트비트)을 단일 소스로 삼는다.

## 목표 구조 — "`users` 테이블 단일 소스 + 주기 reconcile + 비파괴"

"누가 있나" 의 **단일 진실원**을 하나 두고, 씬·패널·spatial audio 가 모두 그것을 구독한다. 소스는 이벤트를 놓쳐도 주기 reconcile 로 스스로 수렴한다. 신뢰성 필요 시 업계가 쓰는 "DB 세션 테이블 + 하트비트 + 실시간 + 주기 스냅샷" 패턴이며, 이 앱은 이미 재료(테이블·하트비트)를 갖고 있다.

- **소스 = `users` 테이블.** 방의 row 존재 = 접속 중. 초기 1회 fetch 로 전체 로스터를 잡고, `postgres_changes`(INSERT/UPDATE/DELETE)로 저latency 반영, **N초 주기 reconcile(방 전체 재조회)** 로 놓친 이벤트·재연결을 자가복구한다.
- **비파괴.** 클라이언트는 **남의 row 를 절대 삭제하지 않는다**. 실삭제는 beforeunload(자기 row) / RTK webhook `participantLeft`(크래시) 만. 크래시로 정리 안 된 고아 row 는 뷰에서 **완만한 타임아웃**(`ROSTER_STALE_TIMEOUT_MS`, 하트비트 여러 번 이상 침묵)으로 제외만 하고 지우지는 않는다.
- **로비 카운트와 동일 개념 재사용.** 로비 방 목록은 이미 `last_active + INACTIVE_TIMEOUT_MS` 로 "활성 세션"을 센다([roomCounts.ts](../src/lib/roomCounts.ts)). 인룸 로스터도 같은 "활성 row" 개념을 쓰되, 정상 유저가 깜빡이지 않도록 타임아웃 여유를 더 크게 둔다.

이렇게 하면:
- 초기 fetch 가 한 명 놓쳐도 다음 주기 reconcile 에서 채워짐 (S1 해결).
- realtime 이벤트가 유실돼도 reconcile 재조회로 수렴 (S1 해결).
- 클라이언트가 남을 지우지 않으므로 오삭제 없음 (S2 해결).
- 파괴적 GC 제거 → "잘못 지워진 유저 미복구" 상황 소멸 (S3 해결). 로스터 퇴장 반영은 postgres DELETE + reconcile.
- 씬·패널·오디오가 동일 로스터(단일 provider)를 봄 (S4 해결).

### 단일 소스 컴포넌트

`RoomParticipantsProvider` (기존 `RemoteParticipantsContext` 확장/대체):
- 상태: `Map<userId, User>` — **원격 + self 포함** 전체 로스터(소비 측에서 self 필터).
- 소스: 마운트 시 `users` 전체 fetch(방 기준) + `postgres_changes` INSERT/UPDATE/DELETE + `RECONCILE_INTERVAL_MS` 주기 재조회.
- 노출 뷰: `last_active` 가 `ROSTER_STALE_TIMEOUT_MS` 이내인 row 만(고아 row 완만한 제외). 삭제는 안 함.
- 소비자:
  - 패널/배지: `useRemoteParticipants()` (self 제외 뷰) + 카운트.
  - spatial audio: 동일 소스.
  - **게임 씬**: SmallVillage 가 이 소스를 구독해 `scene.updateUsers()` 호출 (씬 자체 fetch/GC 제거).
- presence 는 쓰지 않는다(#1807). `useOnlineUsers` 폐기.

## PR 단위 계획

### PR-1 — `users` 테이블을 로스터 단일 소스로 (Provider)
- `RemoteParticipantsContext` → `RoomParticipantsContext` 로 대체: 초기 fetch + `postgres_changes`(INSERT/UPDATE/DELETE) + 주기 reconcile 로 `Map<userId,User>` 유지. 노출은 `last_active` 완만한 타임아웃 필터.
- presence/`useOnlineUsers` 미사용·폐기. [SmallVillage.tsx](../src/components/SmallVillage.tsx) 의 `useOnlineUsers` 사용부 및 **cross-client row 삭제(`handleLeaveUser`) 제거**(비파괴). 크래시 정리는 webhook.
- 소비 API: `useRemoteParticipants()`(self 제외). 씬은 `updateUsers` 에서 이미 self 필터([SmallVillageScene.ts:697](../src/scenes/SmallVillageScene.ts#L697)).
- 상수: `RECONCILE_INTERVAL_MS`, `ROSTER_STALE_TIMEOUT_MS` 추가.
- 테스트: 초기 fetch 로 기존 멤버 반영, INSERT/UPDATE/DELETE 반영, **이벤트 유실 후 reconcile 로 수렴**, stale row 제외(비삭제), self 필터.

### PR-2 — 씬 로스터를 단일 소스로 이관 + 파괴적 GC 제거
- SmallVillage 의 자체 `users` fetch + `postgres_changes` 구독 + **파괴적 GC 제거** → provider(`useRemoteParticipants`) 구독해 `scene.updateUsers()`(기존 명령형 브리지 유지).
- **입장 토스트 재배선**: 워밍업 창 이후 새로 등장한 원격 유저만 토스트(초기 로스터엔 미표시).
- 이동 동기화(내 위치 upsert)·하트비트·`INACTIVE_TIMEOUT_MS` 는 유지(로비 카운트 의존).
- 테스트: 프로바이더 맵 변화 → `scene.updateUsers` 인자 검증(씬은 목), 퇴장 반영.

## 결정된 사항

1. **멤버십 소스** → **`users` 테이블**(#1807 로 presence 불가). 초기 fetch + postgres_changes + 주기 reconcile.
2. **위치/데이터** → 동일 `users` 테이블(x/y/name/character). presence/broadcast 분리 안 함(단일 소스가 더 단순).
3. **`INACTIVE_TIMEOUT_MS`·하트비트 유지** — 로비 카운트가 의존. 인룸 로스터는 별도 `ROSTER_STALE_TIMEOUT_MS`(더 여유롭게)로 고아 row 만 완만히 제외.
4. **정리(GC)** → 비파괴. 실삭제는 beforeunload/webhook 만. 클라이언트는 남의 row 삭제 금지.

## 비범위

- 패널 UI(슬라이드 애니메이션 · 캐릭터 상체 아바타 · 구독 토픽 통합)는 이번 리팩토링과 무관하며 별도로 유지/커밋.
- 음성 SFU(RealtimeKit) 연결 로직 변경 없음.
- **presence 로의 복귀**는 #1807 이 Supabase 에서 해결되면 별도 개선으로 검토(지금은 의존하지 않음). 소스 경계를 provider 한 곳에 모아 두어 전환이 쉽도록 한다.
- **same-user 다중 탭**: 유저 id 는 localStorage 저장이라 같은 브라우저의 두 탭이 동일 `smallvillage_user_id`(= `users` row 하나)를 공유한다([storage.ts:32-37](../src/lib/storage.ts#L32-L37)). 한 탭을 닫으면 공유 row 가 지워져 다른 탭이 재upsert(이동/하트비트)하기 전까지 로스터에서 빠질 수 있다. 완전 해소(마지막 탭 판별)는 범위 밖 — 주기 reconcile + 하트비트가 다음 주기에 복구한다.

## 폐기된 초안 (presence 기반)

초안은 presence `sync` 전체집합을 멤버십 권위로, `users` 를 데이터 소스로 분리했다. #1807(호스티드 presence 미동작)로 **폐기**. 관련 아이디어(멤버십/데이터 분리, 비파괴 정리, 주기 reconcile)는 Option B 에 흡수됐다.

## 검증

- 단위(Jest): provider(초기 fetch/postgres_changes/reconcile/stale 필터/self) + 씬 브리지 테스트.
- e2e(Playwright, 2~3 클라이언트, [e2e/presence-3clients.mjs](../e2e/presence-3clients.mjs)): 다양한 순서로 입장 후 **가만히 있는 기존 유저가 나중 입장자에게 계속 보이는지**(S1/S2/S3 회귀) 확인. worktree 에서 돌릴 땐 [e2e/README.md](../e2e/README.md) 의 env/서빙 절차 참고.
