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

import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { DATABASE_TABLES, INACTIVE_TIMEOUT_MS } from "../constants";
import { countActiveUsersByRoom } from "../lib/roomCounts";
import { Room } from "../types";

export const useRooms = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  const fetchRooms = async () => {
    setLoading(true);

    // rooms 조회와 방별 인원수 집계용 users 조회는 서로 독립적이므로 병렬로 실행한다.
    // 방별 인원수 스냅샷: useRooms 진입/refetch 시점에 한 번 집계. 실시간 갱신은
    // 이 PR 범위 아님(로비 새로고침 버튼으로 갱신됨).
    // 인원수 집계가 실패해도 방 목록은 계속 보여야 하므로 counts 는 {} 로 폴백한다.
    const [
      { data, error },
      { data: userRows, error: usersError },
    ] = await Promise.all([
      supabase
        .from(DATABASE_TABLES.ROOMS)
        .select("*")
        .order("title", { ascending: false }),
      supabase.from(DATABASE_TABLES.USERS).select("room_id, last_active"),
    ]);

    if (error) {
      console.error("Error fetching rooms:", error);
    }

    if (usersError) {
      console.error("Error fetching user counts:", usersError);
    }

    const nextCounts = usersError
      ? {}
      : countActiveUsersByRoom(
          userRows || [],
          Date.now(),
          INACTIVE_TIMEOUT_MS
        );

    await new Promise((resolve) => setTimeout(resolve, 1000));

    setRooms(data || []);
    setCounts(nextCounts);
    setLoading(false);
  };

  useEffect(() => {
    fetchRooms();
  }, []);

  return {
    rooms,
    counts,
    refetch: fetchRooms,
    loading,
  };
};
