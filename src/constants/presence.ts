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
