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
- **어디/무엇** → `users` 테이블 + `postgres_changes` 로 저latency 반영(이동 등). presence 멤버인데 아직 row 데이터가 없으면 그때 개별 fetch.

이렇게 하면:
- 초기 fetch 가 놓쳐도 다음 presence `sync` 에서 채워짐 (S1 해결).
- realtime 이벤트가 유실돼도 sync 기준 reconcile 로 수렴 (S1 해결).
- 입장자가 남을 지우지 않으므로 오삭제 없음 (S2 해결).
- presence 가 떠난 사람을 알려주고 자기 row 는 beforeunload/webhook 이 정리 → 미복구 문제 소멸 (S3 해결).
- 씬·패널·오디오가 동일 로스터를 봄 (S4 해결).

### 단일 소스 컴포넌트

`RoomParticipantsProvider` (기존 `RemoteParticipantsContext` 확장/대체):
- 상태: `Map<userId, User>` — **원격 + self 포함** 전체 로스터(소비 측에서 self 필터).
- 멤버십: presence `sync` → 접속 user_id 집합 = 권위. 집합에 없는 id 는 맵에서 제거. 집합에 있으나 데이터 없는 id 는 fetch.
- 상태 갱신: `postgres_changes` UPDATE(이동) 를 맵에 반영. INSERT/DELETE 는 presence 로 대체되므로 보조.
- 소비자:
  - 패널/배지: 지금처럼 `useRemoteParticipants()` (self 제외 뷰) + 카운트.
  - spatial audio: 동일 소스.
  - **게임 씬**: SmallVillage 가 이 소스를 구독해 `scene.updateUsers()` 를 호출 (씬 자체 fetch/GC 제거).

## PR 단위 계획

작업은 아래 PR 로 쪼갠다. 각 PR 끝에 `/audit --fix` + lint/test/build.

### PR-1 — presence 를 로스터 소스로 승격 (self 포함 단일 Provider)
- `RemoteParticipantsContext` → `RoomParticipantsProvider` 로 확장: presence `sync` 구독 추가, 멤버십을 presence 집합으로 reconcile, `users` 는 데이터(x/y/...) 소스로만 사용.
- presence 채널은 `useOnlineUsers` 와 중복되지 않도록 정리(하나로 합치거나 명확히 역할 분리).
- 소비 API 유지: `useRemoteParticipants()`(self 제외). 필요 시 `useRoomParticipants()`(self 포함) 추가.
- 테스트: presence sync 로 신규/기존/퇴장 반영, 이벤트 유실 후 sync 로 수렴, self 필터.

### PR-2 — 씬 로스터를 단일 소스로 이관
- SmallVillage.tsx 의 자체 `users` fetch + `postgres_changes` 구독 + **파괴적 GC 제거**.
- 대신 `RoomParticipantsProvider` 를 구독해 `scene.updateUsers()` 호출 (기존 명령형 브리지 패턴 유지).
- 이동 동기화(내 위치 upsert)는 그대로.
- 테스트: 프로바이더 맵 변화 → `scene.updateUsers` 호출 인자 검증(씬은 목).

### PR-3 — GC/정리 경로 정비
- 파괴적 client-side GC 제거 후 남는 정리 책임 재확인: beforeunload row 삭제, RTK webhook `participantLeft`, presence leave.
- 크래시 클라이언트(webhook 미도달) 대비 안전망: presence 기반이면 leave 로 처리되나, 고아 row 정리는 서버(webhook) 또는 매우 완만한 타임아웃으로. `INACTIVE_TIMEOUT_MS` 정책 재검토(오삭제 방지 우선).
- 테스트: 퇴장 시 로스터 감소, 크래시(비정상 종료) 시 presence leave 로 감소.

### PR-4 (선택) — 정합성 하드닝
- presence `sync` 외 주기적 안전망(예: N초 reconcile) 필요성 재평가 — presence 로 충분하면 생략(YAGNI).
- 계측: 로스터 크기와 presence 집합 불일치 발생 시 로깅(회귀 조기 감지).

## 열린 결정 포인트

1. **위치를 presence 페이로드에 담을지** — presence 에 x/y 까지 실으면 postgres `users` 를 로스터/위치 양쪽에서 뺄 수 있어 더 단순해지나, 이동이 잦아 presence track 빈도가 높아진다(이동은 broadcast 가 적합). → 초안은 **presence=멤버십 / postgres=위치** 분리 유지(중간 규모, 변경 최소).
2. **useOnlineUsers 통합 범위** — presence 채널을 하나로 합칠지, 역할만 나눌지.
3. `INACTIVE_TIMEOUT_MS` 정책 — 완만화 vs 제거.

## 비범위

- 패널 UI(슬라이드 애니메이션 · 캐릭터 상체 아바타 · 구독 토픽 통합)는 이번 리팩토링과 무관하며 별도로 유지/커밋.
- 음성 SFU(RealtimeKit) 연결 로직 변경 없음.

## 검증

- 단위: 각 PR 의 프로바이더/씬 브리지 테스트(Jest).
- e2e(Playwright, 2~3 클라이언트): 다양한 순서(열고 입장 / 이미 있는 상태에서 열기 / 닫았다 열기 / 연 채 퇴장) + **가만히 있는 기존 유저가 나중 입장자에게 계속 보이는지**(S1/S2/S3 회귀) 를 반복 실행해 누락 0 확인.
