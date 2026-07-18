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

import { supabase } from "./supabaseClient";
import { DATABASE_TABLES, INACTIVE_TIMEOUT_MS } from "../constants";
import { countActiveUsersByRoom } from "./roomCounts";

/**
 * 방 입장 시점의 인원 수(나 포함)를 users 테이블에서 직접 센다.
 * 로스터 구독은 비동기라 READY 직후 0 일 수 있어, 신뢰값을 위해 DB 를 조회한다.
 * 계측 보조용이므로 실패해도 흐름을 깨지 않고 0 을 돌려준다.
 */
export async function fetchRoomSize(roomId: string): Promise<number> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.USERS)
    .select("room_id, last_active")
    .eq("room_id", roomId);
  if (error || !data) return 0;
  const counts = countActiveUsersByRoom(data, Date.now(), INACTIVE_TIMEOUT_MS);
  return counts[roomId] ?? 0;
}
