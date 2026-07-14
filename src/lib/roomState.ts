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
  const { count, error } = await supabase
    .from(DATABASE_TABLES.ROOMS)
    .select("id", { count: "exact", head: true })
    .eq("id", roomId);

  if (error) {
    console.error("Error checking room existence:", error);
    // 확인 자체가 실패하면 입장을 막지 않는다(가용성 우선). write 단계에서 걸러진다.
    return true;
  }
  return (count ?? 0) > 0;
}
