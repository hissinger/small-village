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

// users row 에 쓰는 휘발성 접속 상태.
// room_id 는 반드시 포함해야 한다: GC/heartbeat/webhook 정리로 row 가 사라진 상태에서
// 움직이면 이 upsert 가 INSERT 로 동작하는데, room_id 를 빠뜨리면 스키마 기본값
// gen_random_uuid() 가 채워져 rooms FK(users_room_id_fkey)를 위반하고 409(23503)가
// 난다. (실측: room_id 생략 시 409 foreign_key_violation, 포함 시 201.)
export interface UserStateWrite {
  id: string;
  name: string;
  character_index: number;
  room_id: string;
  x: number;
  y: number;
}

/**
 * 내 캐릭터 상태를 users 테이블에 멱등하게 upsert 한다.
 *
 * 같은 id(localStorage uuid) row 가 이미 있을 수 있으므로(재접속·이전 세션·
 * dev StrictMode 이중 마운트 등) insert 를 쓰면 PK 충돌(409)이 난다. upsert 는
 * 충돌을 merge 로 흡수하므로 최초 등록과 이동 동기화 모두 이 함수 하나로 처리한다.
 */
export async function upsertUserState(state: UserStateWrite) {
  return supabase.from(DATABASE_TABLES.USERS).upsert(state);
}
