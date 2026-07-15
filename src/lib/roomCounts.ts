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

// 방별 "지금 접속 중"인 유저 수를 집계하는 순수 함수.
// users 는 휘발성 접속 상태라 stale/유령 row 가 남을 수 있으므로,
// last_active 가 (nowMs - timeoutMs) 이후인 row 만 유효한 접속으로 센다.
export function countActiveUsersByRoom(
  users: { room_id: string | null; last_active: string }[],
  nowMs: number,
  timeoutMs: number
): Record<string, number> {
  const cutoff = nowMs - timeoutMs;
  const counts: Record<string, number> = {};

  for (const user of users) {
    // room_id 가 없는 row 는 어느 방에도 속하지 않으므로 counts["null"] 유령 키를 막는다.
    if (user.room_id == null) {
      continue;
    }
    const activeMs = new Date(user.last_active).getTime();
    // 경계 시각(cutoff 와 정확히 같음)은 아직 살아있는 것으로 간주한다.
    if (Number.isNaN(activeMs) || activeMs < cutoff) {
      continue;
    }
    counts[user.room_id] = (counts[user.room_id] ?? 0) + 1;
  }

  return counts;
}
