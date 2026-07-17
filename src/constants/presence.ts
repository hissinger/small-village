/**
 * Copyright 2024 SmallVillageProject
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

// presence(접속 상태) 관련 공유 상수.
// users row 는 휘발성이라 heartbeat 로 갱신하고, 일정 시간 조용하면 죽은 것으로 본다.
export const INACTIVE_TIMEOUT_MS = 15_000;
export const HEARTBEAT_INTERVAL_MS = 10_000;

// 방 로스터(RoomParticipantsProvider)의 주기적 재조회(reconcile) 간격.
// postgres_changes 이벤트를 놓치거나 재연결로 어긋나도 이 주기마다 방 전체를 다시 읽어 수렴한다.
export const RECONCILE_INTERVAL_MS = 10_000;

// 인룸 로스터에서 "고아 row"(크래시로 beforeunload/webhook 정리가 안 된 row)를 뷰에서 제외하는
// 완만한 타임아웃. 하트비트(10s)보다 넉넉히 커서 정상 유저가 깜빡이지 않는다. row 를 삭제하진 않는다.
export const ROSTER_STALE_TIMEOUT_MS = 30_000;

// 고아 row 은닉용 로컬 stale-sweep 주기. 위치가 broadcast 로 빠지고 last_active UPDATE 가
// diff 로 억제되면(위치/하트비트가 노출 Map 을 안 바꿈) stale 필터의 잦은 트리거가 사라지므로,
// DB fetch 없이 dataRef 에 필터만 재적용하는 값싼 sweep 을 이 주기로 돌린다(< ROSTER_STALE_TIMEOUT_MS).
export const ROSTER_STALE_SWEEP_INTERVAL_MS = 5_000;

// 입장 직후엔 기존 접속자들이 로스터에 한꺼번에 채워지므로, 이 워밍업 창 동안은 "입장" 토스트를
// 띄우지 않는다. 창이 지난 뒤 새로 등장한 원격 유저만 진짜 입장으로 보고 토스트한다.
export const JOIN_TOAST_WARMUP_MS = 2_500;
