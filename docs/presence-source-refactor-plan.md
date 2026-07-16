# Presence 단일 소스 리팩토링 plan

## 배경 / 문제

"방에 누가 있나(presence)" 를 만드는 로직이 **두 곳에 중복**되어 있고, 둘 다 같은 방식·같은 약점을 가진다. 그 결과 **먼저 입장해 있던 참가자가 나중 입장자의 화면(패널 + 게임 씬 모두)에서 영구히 누락**될 수 있다.

- 씬용 로스터: [src/components/SmallVillage.tsx](../src/components/SmallVillage.tsx) — 마운트 시 `users` 1회 fetch + GC + `postgres_changes` 구독 → `scene.updateUsers()`.
- 패널/오디오용 로스터: [src/context/RemoteParticipantsContext.tsx](../src/context/RemoteParticipantsContext.tsx) — 마운트 시 1회 fetch(merge) + `postgres_changes` 구독 → `Map`.

### 재현/증거

2-클라이언트 e2e 에서, Carol(마지막 입장)의 패널과 게임 씬에서 Alice(최초 입장)가 통째로 사라지는 현상을 관측(간헐, 약 1/5). 게임 월드 이름표가 "CBob1" 로 겹쳐 뜨며 Alice 스프라이트가 없었다 — 패널만이 아니라 **씬 로스터에서도** 빠진 것.

### 근본 원인 (구조적)

- **S1. 1회성 fetch + 이벤트 스트림 / 재동기화 없음.** 이미 방에 있던 유저는 오직 초기 fetch 로만 인지한다. fetch 가 한 명 놓치거나 realtime 이벤트가 하나 유실(재연결 등)되면 영구히 어긋난다. 주기적 reconcile 이 없다.
- **S2. 파괴적 GC.** [SmallVillage.tsx:79-109](../src/components/SmallVillage.tsx#L79-L109) — 입장자가 방의 모든 유저 중 `last_active` 가 `INACTIVE_TIMEOUT_MS`(15s) 보다 오래된 사람의 row 를 **삭제**한다. 하트비트(`HEARTBEAT_INTERVAL_MS` 10s)가 단 한 번(>5s) 밀리면 멀쩡한 참가자가 삭제된다. (헤드리스에서 백그라운드 탭 타이머 스로틀링으로 재현.)
- **S3. 하트비트가 update-only.** [SmallVillage.tsx:64-70](../src/components/SmallVillage.tsx#L64-L70) — `update().match()` 는 이미 지워진 row 엔 no-op. 잘못 지워진 유저는 움직여서 씬이 upsert 하기 전까지 복구 불가.
- **S4. 로스터 이원화.** 씬과 패널이 각자 계산 → 서로 다를 수 있음(현재 실제로 다름).

## 목표 구조 — "단일 presence 소스 + 자가복구 reconcile"

"누가 있나" 의 **단일 진실원**을 하나 두고, 씬·패널·spatial audio 가 모두 그것을 구독한다. 소스는 놓쳐도 스스로 수렴한다.

원칙: **"누가"(membership) 와 "어디/무엇"(state: x/y/name/character/mic) 을 분리**한다.

- **누가** → Supabase **Presence** 를 권위로 삼는다. presence `sync` 이벤트는 매번 전체 접속자 집합을 주고 재연결에도 자가복구된다. (이미 [useOnlineUsers.tsx](../src/hooks/useOnlineUsers.tsx) 가 presence 채널에 `track` 중 — join/leave 만 쓰고 sync 는 비어 있음.)
  - **제거는 오직 `sync` 전체집합 reconcile 로만** 한다. presence `leave` 는 같은 user_id 의 여러 탭 중 하나만 닫혀도 발동하므로(presence key 미설정 → ref 키가 탭별 다중), leave 를 곧바로 "맵에서 제거"로 쓰면 **아직 접속 중인 유저가 사라진다**. join/leave 는 저latency 힌트로만, 최종 진실은 sync 집합.
- **어디/무엇** → `users` 테이블 + `postgres_changes` 로 저latency 반영(이동 등). presence 멤버인데 아직 row 데이터가 없으면 그때 개별 fetch.
  - **주의(레이스):** 입장 직후엔 presence `track` 이 `users` row upsert(씬 init 의 비동기 write)보다 먼저 도착할 수 있다. 이때 개별 fetch 는 **빈 결과**를 돌려주므로, "멤버는 잡혔는데 데이터가 안 채워지는" 상태가 생긴다 → 방치하면 S1 재현. 따라서 **`postgres_changes` INSERT/UPDATE 를 데이터 채움의 주 경로로 유지**하고(멤버의 x/y/name/character 가 도착하면 맵에 반영), sync 시점의 개별 fetch 는 누락분 backstop 으로만 쓴다. (INSERT/UPDATE 는 "보조"가 아니라 데이터 소스의 1차 경로다.)

이렇게 하면:
- 초기 fetch 가 놓쳐도 다음 presence `sync` 에서 채워짐 (S1 해결).
- realtime 이벤트가 유실돼도 sync 기준 reconcile 로 수렴 (S1 해결).
- 입장자가 남을 지우지 않으므로 오삭제 없음 (S2 해결).
- 파괴적 GC 가 사라져 오삭제 자체가 없어지므로 "잘못 지워진 유저가 복구 안 됨" 상황이 소멸 (S3 해결). 정상 퇴장/크래시는 beforeunload·webhook 이 자기/떠난 row 를 정리하고, 로스터의 퇴장 반영은 presence `sync` 가 관장.
- 씬·패널·오디오가 동일 로스터를 봄 (S4 해결).

### 단일 소스 컴포넌트

`RoomParticipantsProvider` (기존 `RemoteParticipantsContext` 확장/대체):
- 상태: `Map<userId, User>` — **원격 + self 포함** 전체 로스터(소비 측에서 self 필터).
- 멤버십: presence `sync` → 접속 user_id 집합 = 권위. 집합에 없는 id 는 맵에서 제거. 집합에 있으나 데이터 없는 id 는 fetch. **이 fetch 는 일시 실패에 대비해 백오프로 재시도하되 명시적 유한 횟수(상한)로 못박는다** — presence `sync` 는 멤버십 변화·재연결에만 발동하고 주기적이지 않으므로(주기 reconcile 은 PR-3 에서 YAGNI 로 제외), 한 번 실패하고 방치하면 그 유저가 데이터 없이 남아 "기존 유저 누락"이 재현된다. 최대 N회 백오프 후 중단하고(무한 폴링 방지, 아래 same-user 다중 탭 한계 참조), 그 사이 postgres INSERT/UPDATE 가 오면 즉시 성공 처리한다.
- 상태 갱신: `postgres_changes` INSERT/UPDATE(등장·이동) 를 맵에 반영 — 멤버의 x/y/name/character 를 채우는 **1차 데이터 경로**. DELETE 는 멤버십을 presence sync 가 관장하므로 보조.
- 소비자:
  - 패널/배지: 지금처럼 `useRemoteParticipants()` (self 제외 뷰) + 카운트.
  - spatial audio: 동일 소스.
  - **게임 씬**: SmallVillage 가 이 소스를 구독해 `scene.updateUsers()` 를 호출 (씬 자체 fetch/GC 제거).

## PR 단위 계획

작업은 아래 PR 로 쪼갠다. 각 PR 끝에 `/audit --fix` + lint/test/build.

### PR-1 — presence 를 로스터 소스로 승격 (self 포함 단일 Provider)
- `RemoteParticipantsContext` → `RoomParticipantsProvider` 로 확장: presence `sync` 구독 추가, 멤버십을 presence 집합으로 reconcile, `users` 는 데이터(x/y/...) 소스로만 사용.
- **[SmallVillage.tsx](../src/components/SmallVillage.tsx) 의 `useOnlineUsers` 사용부 제거** — 이 훅의 유일 소비자다(import L19, 호출 L208, `handleJoinUser`/`handleLeaveUser`). presence 소유가 provider 로 옮겨가므로 PR-1 에서 함께 걷어낸다. `handleLeaveUser` 의 `scene.removeUser` 는 **PR-2 전까지 SmallVillage 의 postgres DELETE 핸들러가 대체**하므로(row 가 실제 삭제되면 DELETE 이벤트로 스프라이트 제거) PR-1 단독 상태에서도 씬 스프라이트 제거는 유지된다 — 회귀 아님.
- **presence 채널 단일화 (필수 선결).** 코드베이스가 이미 경고한다 — 같은 소켓에 **동일 이름 채널을 중복 구독하면 중복 토픽이 돼 한쪽이 이벤트를 못 받는다** ([RemoteParticipantsContext.tsx:28-31](../src/context/RemoteParticipantsContext.tsx#L28-L31)). 따라서 provider 가 presence `sync` 를 새로 구독하면서 `useOnlineUsers` 가 여전히 같은 `online-users-<roomId>` 채널을 `track` 하면 정확히 이 함정에 빠진다. → **presence 소유를 provider 한 곳으로 이관**한다: provider 가 `track` + `sync`/`join`/`leave` 를 모두 소유하고, `useOnlineUsers` 는 폐기하거나 provider 내부 유틸로 흡수.
- **채널 생성 시 `presence: { key: userId }` 설정.** 현재 useOnlineUsers 는 key 미설정([useOnlineUsers.tsx:51](../src/hooks/useOnlineUsers.tsx#L51))이라 `presenceState()` 가 ref 키로 잡혀 값들을 flatten 해 `user_id` 를 뽑아야 하고, multi-tab 이 서로 다른 키로 흩어진다. key=userId 로 track 하면 sync 집합이 곧 user_id 집합이 되고 multi-tab 이 한 키 아래로 모여 dedup·멤버십 판정이 단순해진다.
- 멤버 제거는 **`sync` 전체집합 기준으로만** — `leave` 즉시제거 금지(multi-tab 오제거 방지, 위 "누가" 원칙 참조).
- **cross-client row 삭제(`handleLeaveUser`) 제거.** 기존 [SmallVillage.tsx:187-206](../src/components/SmallVillage.tsx#L187-L206) 은 *다른* 클라이언트가 떠난 유저의 `users` row 를 지우는데(presence leave 반응), 이는 위 "leave 즉시제거 금지"와 모순이고 multi-tab 에서 아직 접속 중인 유저의 데이터 row 를 지워 "멤버-데이터 없음"을 유발한다. 크래시 정리는 **webhook 이 이미 서버측에서 처리**하므로(`participantLeft` → `id = customParticipantId` 삭제, [rtk-webhook/index.ts:57-62](../supabase/functions/rtk-webhook/index.ts#L57-L62)) 이 client-side 삭제는 **provider 로 이관하지 말고 제거**한다. 자기 row 는 beforeunload 가 정리.
- 소비 API 유지: `useRemoteParticipants()`(self 제외). 필요 시 `useRoomParticipants()`(self 포함) 추가. self 포함 맵이라도 씬은 `updateUsers` 에서 이미 `user.id === this.userId` 를 필터([SmallVillageScene.ts:697](../src/scenes/SmallVillageScene.ts#L697))하므로 소비자 영향은 없다.
- 테스트: presence sync 로 신규/기존/퇴장 반영, **이벤트(INSERT/DELETE) 유실 후 sync 로 수렴**, leave 로는 제거 안 됨(sync 로만), self 필터. 기존 [RemoteParticipantsContext.test.tsx](../src/context/RemoteParticipantsContext.test.tsx) 의 채널 팩토리 mock(핸들러 캡처 방식)을 확장해 `presence`/`sync` 핸들러를 캡처·구동하면 결정적으로 짤 수 있다.

### PR-2 — 씬 로스터를 단일 소스로 이관 + 파괴적 GC/정리 경로 정비
PR-3 을 흡수한다: 파괴적 GC 는 아래에서 제거하는 바로 그 `useEffect`([SmallVillage.tsx:79-119](../src/components/SmallVillage.tsx#L79-L119)) 안에 있으므로, 씬 이관과 GC 제거는 같은 코드를 건드리는 한 덩어리다.
- SmallVillage.tsx 의 자체 `users` fetch + `postgres_changes` 구독 + **파괴적 GC 제거**.
- 대신 `RoomParticipantsProvider` 를 구독해 `scene.updateUsers()` 호출 (기존 명령형 브리지 패턴 유지).
- **입장 토스트 재배선.** 현재 "X has joined" 토스트는 제거 대상인 INSERT 핸들러 안에서 뜬다([SmallVillage.tsx:144-146](../src/components/SmallVillage.tsx#L144-L146)). 구독을 지우면 함께 사라지므로, **provider 의 멤버십 추가(신규 user_id 등장) 시점에서 재발생**시킨다(초기 sync 로 한꺼번에 들어오는 기존 멤버엔 토스트를 띄우지 않도록, 최초 스냅샷 이후의 신규 추가만).
- 이동 동기화(내 위치 upsert)는 그대로.
- 파괴적 GC 제거 후 남는 정리 책임 재확인: beforeunload row 삭제, RTK webhook `participantLeft`(서버측 크래시 정리). 크래시 클라이언트는 presence sync 집합에서 빠지므로 로스터에선 즉시 사라지고, DB `users` row 는 webhook 이 지운다. **고아 `users` row** 정리는 서버(webhook)에만 맡긴다(오삭제 방지 우선).
- **하트비트·`INACTIVE_TIMEOUT_MS` 는 유지.** 제거 대상은 SmallVillage.tsx 의 client-side row 삭제(파괴적 GC)뿐이다. 하트비트(`last_active` 갱신, [SmallVillage.tsx:65-71](../src/components/SmallVillage.tsx#L65-L71))와 `INACTIVE_TIMEOUT_MS` 상수는 **로비 방 목록의 접속 인원수 계산**에 계속 쓰인다([useRooms.tsx:59](../src/hooks/useRooms.tsx#L59), [roomSize.ts:32](../src/lib/roomSize.ts#L32) → [roomCounts.ts](../src/lib/roomCounts.ts)). 지우면 로비 카운트가 깨지므로 건드리지 않는다.
- 테스트: 프로바이더 맵 변화 → `scene.updateUsers` 호출 인자 검증(씬은 목). 퇴장 시 로스터 감소, 크래시(비정상 종료) 시 presence sync 로 감소.

### PR-3 (선택) — 정합성 하드닝 (대부분 YAGNI)
- presence `sync` 가 재연결 시 전체집합으로 자가복구하므로 **주기적 N초 reconcile 타이머는 불필요** — 기본 생략(YAGNI).
- 계측만 최소로: 로스터 크기와 presence 집합이 어긋나면 **dev 전용 로깅** 한 줄(회귀 조기 감지). 이것도 필요할 때만.

## 결정된 사항 (검토 반영)

1. **위치를 presence 페이로드에 담을지** — presence 에 x/y 까지 실으면 postgres `users` 를 로스터/위치 양쪽에서 뺄 수 있어 더 단순해지나, 이동이 잦아 presence track 빈도가 높아진다(이동은 broadcast 가 적합). → **presence=멤버십 / postgres=위치** 분리 유지(중간 규모, 변경 최소). (유지)
2. **useOnlineUsers 통합 범위** → **presence 소유를 provider 한 곳으로 이관**(PR-1 필수). 동일 이름 채널 중복 구독 함정을 피하기 위함. `useOnlineUsers` 는 폐기/흡수.
3. **`INACTIVE_TIMEOUT_MS` 정책** → **상수·하트비트는 유지.** 제거하는 것은 SmallVillage.tsx 의 client-side 파괴적 row 삭제(GC)뿐이다. 상수와 하트비트는 로비 방 목록 접속 인원수 계산에 계속 필요하다([useRooms.tsx:59](../src/hooks/useRooms.tsx#L59), [roomSize.ts:32](../src/lib/roomSize.ts#L32)). 고아 row 정리는 서버측(webhook)에 맡긴다(PR-2).

## 비범위

- 패널 UI(슬라이드 애니메이션 · 캐릭터 상체 아바타 · 구독 토픽 통합)는 이번 리팩토링과 무관하며 별도로 유지/커밋.
- 음성 SFU(RealtimeKit) 연결 로직 변경 없음.
- **same-user 다중 탭은 알려진 한계(비목표).** 유저 id 는 localStorage 저장이라 같은 브라우저의 두 탭이 동일 `smallvillage_user_id`(= `users` row 하나)를 공유한다([storage.ts:32-37](../src/lib/storage.ts#L32-L37)). 한 탭을 닫으면 그 탭의 beforeunload 가 공유 row 를 지우는데 presence 는 남은 탭 때문에 그 user_id 를 여전히 멤버로 본다 → 다른 탭이 움직여 재upsert 하기 전까지 "멤버는 있으나 데이터 없음"이 될 수 있다. 위 fetch 재시도 상한이 이 경우 무한 폴링만 막고, 완전 해소(마지막 탭 판별 후에만 삭제 등)는 이번 범위 밖이다.

## 검증

- 단위: 각 PR 의 프로바이더/씬 브리지 테스트(Jest). presence `sync` 핸들러 캡처는 [RemoteParticipantsContext.test.tsx](../src/context/RemoteParticipantsContext.test.tsx) 의 채널 팩토리 mock 패턴을 확장해 구동한다.
- e2e(Playwright, 2~3 클라이언트): 다양한 순서(열고 입장 / 이미 있는 상태에서 열기 / 닫았다 열기 / 연 채 퇴장) + **가만히 있는 기존 유저가 나중 입장자에게 계속 보이는지**(S1/S2/S3 회귀) 를 반복 실행해 누락 0 확인.
