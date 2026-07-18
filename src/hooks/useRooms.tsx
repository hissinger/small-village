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

import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import {
  DATABASE_TABLES,
  INACTIVE_TIMEOUT_MS,
  LOBBY_ROOMS_POLL_INTERVAL_MS,
} from "../constants";
import { countActiveUsersByRoom } from "../lib/roomCounts";
import { Room } from "../types";

export const useRooms = () => {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  // 언마운트 후 setState 방지용 플래그.
  const mountedRef = useRef(true);
  // 동시에 여러 fetch(폴링·수동·최초)가 겹칠 수 있으므로, "마지막으로 시작한 요청"만
  // 데이터를 반영하게 하는 시퀀스 토큰. 늦게 시작했지만 먼저 끝난 오래된 스냅샷이
  // 최신 결과를 덮어쓰는 out-of-order 반영을 막는다.
  const requestSeqRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // silent=true 는 자동 폴링용: 로딩 스피너를 띄우지 않고(목록을 비우지 않고) 조용히 갱신한다.
  // 최초 로드와 수동 새로고침(refetch)은 silent=false 로 스피너를 보여 준다.
  const fetchRooms = useCallback(async (silent = false) => {
    const seq = (requestSeqRef.current += 1);

    if (!silent) {
      setLoading(true);
    }

    // rooms 조회와 방별 인원수 집계용 users 조회는 서로 독립적이므로 병렬로 실행한다.
    // 방별 인원수 스냅샷: fetch 시점에 한 번 집계.
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

    // 최초 로드/수동 새로고침에서만 스피너가 깜빡 사라지지 않게 잠깐 보여 준다.
    // 자동 폴링(silent)은 지연 없이 즉시 반영한다.
    if (!silent) {
      await new Promise((resolve) => setTimeout(resolve, 1000));
    }

    if (!mountedRef.current) {
      return;
    }

    // 최신 요청일 때만 데이터를 반영해 오래된 스냅샷의 덮어쓰기를 막는다.
    if (seq === requestSeqRef.current) {
      setRooms(data || []);
      setCounts(nextCounts);
    }

    // 스피너는 이 요청이 켠 것이므로, 최신 여부와 무관하게 자신이 끈다(로딩 고착 방지).
    if (!silent) {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRooms();
  }, [fetchRooms]);

  // 주기적 자동 갱신: 수동 새로고침 버튼과 별개로 일정 주기마다 조용히 다시 조회한다.
  // 탭이 백그라운드일 때는 폴링을 멈추고, 다시 보일 때 즉시 한 번 갱신한다.
  useEffect(() => {
    let intervalId: ReturnType<typeof setInterval> | undefined;

    const startPolling = () => {
      if (intervalId !== undefined) return;
      intervalId = setInterval(() => {
        fetchRooms(true);
      }, LOBBY_ROOMS_POLL_INTERVAL_MS);
    };

    const stopPolling = () => {
      if (intervalId !== undefined) {
        clearInterval(intervalId);
        intervalId = undefined;
      }
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        stopPolling();
      } else {
        fetchRooms(true);
        startPolling();
      }
    };

    if (!document.hidden) {
      startPolling();
    }
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      stopPolling();
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [fetchRooms]);

  // onClick={refetch} 등에서 이벤트 객체가 silent 인자로 새지 않도록 인자 없이 감싼다.
  // useCallback 으로 참조를 고정해 불필요한 리렌더/재구독을 막는다.
  const refetch = useCallback(() => fetchRooms(false), [fetchRooms]);

  return {
    rooms,
    counts,
    refetch,
    loading,
  };
};
