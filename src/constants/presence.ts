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

// presence 멤버로는 잡혔지만 users row 데이터가 아직 없을 때, 개별 fetch 를 재시도하는 정책.
// presence sync 는 멤버십 변화·재연결에만 발동하고 주기적이지 않으므로, 일시 실패 시 유한 백오프로 채운다.
// 무한 폴링은 금지한다 — same-user 다중 탭에서 공유 row 가 지워진 경우 영영 채워지지 않으므로 상한에서 멈춘다.
export const PARTICIPANT_FETCH_MAX_ATTEMPTS = 4;
export const PARTICIPANT_FETCH_BACKOFF_MS = 500;
