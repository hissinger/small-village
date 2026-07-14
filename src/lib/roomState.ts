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
import { DATABASE_TABLES } from "../constants";

/**
 * 해당 방(rooms row)이 존재하는지 확인한다.
 *
 * rooms 는 진실의 원천이다: create-meeting 이 방 생성 시 insert 하고,
 * meeting.ended webhook 이 삭제한다. users.room_id 가 rooms 를 FK 로 참조하므로,
 * rooms row 가 없는 방에 들어가면 위치 write 마다 FK 위반(409)이 난다. 따라서
 * 존재하지 않는 방(이미 종료됐거나 목록이 오래된 경우)에는 입장을 막는다.
 */
export async function roomExists(roomId: string): Promise<boolean> {
  // 일시적 오류로 멀쩡한 방을 잘못 막지 않도록 1회 재시도한다. 그래도 확인이
  // 안 되면 rooms 가 진실의 원천이므로 "확인 불가 = 입장 불가"로 막는다 — 방이
  // 없는데 그냥 들여보내면 위치 write 마다 FK 위반(409)이 쏟아지기 때문이다.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { count, error } = await supabase
      .from(DATABASE_TABLES.ROOMS)
      .select("id", { count: "exact", head: true })
      .eq("id", roomId);
    if (!error) return (count ?? 0) > 0;
    console.error("Error checking room existence:", error);
  }
  return false;
}
