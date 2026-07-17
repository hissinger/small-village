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

import { supabaseUrl, supabaseKey } from "./supabaseClient";
import { DATABASE_TABLES } from "../constants";

/**
 * 퇴장 시 내 `users` row 를 **즉시·확실하게** 삭제한다.
 *
 * 왜 supabase-js(`supabase.from().delete()`)가 아니라 raw `fetch({ keepalive })` 인가:
 * - `beforeunload`/`pagehide` 처럼 페이지가 종료되는 순간엔 일반 fetch 가 in-flight 상태로
 *   취소돼 DELETE 가 서버에 도달하지 못한다. `keepalive: true` 는 문서 언로드 후에도 요청을
 *   끝까지 보내게 한다(POST 만 되는 sendBeacon 과 달리 DELETE 도 가능).
 * - 이 row 삭제가 곧 다른 클라이언트의 `postgres_changes` DELETE 이벤트가 되어 로스터에서
 *   즉시 사라지게 한다. 삭제가 유실되면 폴백(웹훅/stale 필터)만 남아 "늦게 사라짐"이 생긴다.
 *
 * 언로드 중에도 부를 수 있으므로 절대 throw 하지 않는다(실패는 무시하고 폴백에 맡긴다).
 */
export function deleteUserRow(userId: string): void {
  if (!userId) return;
  const url = `${supabaseUrl}/rest/v1/${DATABASE_TABLES.USERS}?id=eq.${encodeURIComponent(
    userId
  )}`;
  try {
    fetch(url, {
      method: "DELETE",
      keepalive: true,
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
      },
    }).catch(() => {
      /* 언로드 중 실패는 무시 — 서버측 웹훅/stale 필터가 폴백 */
    });
  } catch {
    /* fetch 자체가 던져도(구형 환경) 언로드를 막지 않는다 */
  }
}
