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

import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { User } from "../types";
import { supabase } from "../lib/supabaseClient";
import {
  DATABASE_TABLES,
  RECONCILE_INTERVAL_MS,
  ROSTER_STALE_TIMEOUT_MS,
} from "../constants";
import { activeAgeMs } from "../lib/sessionActivity";
import { useRoomContext } from "./RoomContext";

/**
 * 방 로스터("누가 있나")의 단일 진실원.
 *
 * 설계(docs/presence-source-refactor-plan.md, Option B):
 * - 소스는 **`users` 테이블**이다(호스티드 Supabase presence 미동작 — supabase/realtime#1807).
 *   방의 row 존재 = 접속 중. 초기 1회 fetch 로 전체 로스터를 잡고, `postgres_changes`
 *   (INSERT/UPDATE/DELETE) 로 저latency 반영, 그리고 **주기 reconcile(방 전체 재조회)** 로
 *   놓친 이벤트·재연결을 자가복구한다(S1/S3).
 * - **비파괴**: 클라이언트는 남의 row 를 삭제하지 않는다(S2). 크래시로 정리 안 된 고아 row 는
 *   `ROSTER_STALE_TIMEOUT_MS` 이상 침묵하면 뷰에서 제외만 하고 삭제는 beforeunload/webhook 에 맡긴다.
 *
 * 노출 API `useRemoteParticipants()` 는 self 를 제외한 뷰를 준다(패널·배지·공간오디오·게임 씬 사용).
 * 내부 맵은 self 포함 전체 로스터이며, self 는 각 소비자가 따로 다룬다.
 */
const RoomParticipantsContext = createContext<Map<string, User> | null>(null);

export const RoomParticipantsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { roomId } = useRoomContext();
  const [participants, setParticipants] = useState<Map<string, User>>(
    () => new Map()
  );

  // 알려진 방 유저 전체(self 포함). 노출 맵은 여기서 stale 을 걸러 파생한다.
  const dataRef = useRef<Map<string, User>>(new Map());

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;

    // 노출 맵 = 최근 활동(last_active) row 만. 고아 row 는 감추되 삭제하진 않는다.
    const recompute = () => {
      if (cancelled) return;
      const now = Date.now();
      const next = new Map<string, User>();
      dataRef.current.forEach((u, id) => {
        // 파싱 불가(null)는 방금 도착한 것으로 보고 포함(초기 write 레이스 방지).
        const age = activeAgeMs(u.last_active, now);
        if (age === null || age <= ROSTER_STALE_TIMEOUT_MS) {
          next.set(id, u);
        }
      });
      setParticipants(next);
    };

    const upsertRow = (payload: { new: Record<string, unknown> }) => {
      if (payload.new.room_id !== roomId) return;
      const u = payload.new as unknown as User;
      dataRef.current.set(u.id, u);
      recompute();
    };

    // 방 전체를 다시 읽어 dataRef 를 권위 스냅샷으로 교체(수렴). 초기 1회 + 주기 실행.
    const reconcile = async () => {
      const { data, error } = await supabase
        .from(DATABASE_TABLES.USERS)
        .select("*")
        .eq("room_id", roomId);
      if (cancelled || error || !data) return;
      const next = new Map<string, User>();
      data.forEach((u) => next.set((u as User).id, u as User));
      dataRef.current = next;
      recompute();
    };

    const channelName = `realtime:public:${DATABASE_TABLES.USERS}_roomParticipants`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: DATABASE_TABLES.USERS },
        upsertRow
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: DATABASE_TABLES.USERS },
        upsertRow
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (!id) return;
          dataRef.current.delete(id);
          recompute();
        }
      )
      .subscribe();

    // 초기 스냅샷 + 주기 reconcile. reconcile 이 매번 recompute 로 stale 필터를 재적용하므로
    // (RECONCILE_INTERVAL_MS < ROSTER_STALE_TIMEOUT_MS) 별도 stale sweep 은 불필요하다.
    reconcile();
    const interval = setInterval(reconcile, RECONCILE_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      channel.unsubscribe();
    };
  }, [roomId]);

  return (
    <RoomParticipantsContext.Provider value={participants}>
      {children}
    </RoomParticipantsContext.Provider>
  );
};

// 내부 헬퍼: context 의 전체 로스터(self 포함) 맵. 노출 API 는 self 제외 뷰만 제공한다.
const useRoomParticipantsMap = (): Map<string, User> => {
  const ctx = useContext(RoomParticipantsContext);
  if (!ctx) {
    throw new Error(
      "useRemoteParticipants must be used within a RoomParticipantsProvider"
    );
  }
  return ctx;
};

/** 방 안의 원격 유저(self 제외) 스냅샷. RoomParticipantsProvider 하위에서만 쓴다. */
export const useRemoteParticipants = (): Map<string, User> => {
  const all = useRoomParticipantsMap();
  const { userId } = useRoomContext();
  return useMemo(() => {
    if (!all.has(userId)) return all;
    const next = new Map(all);
    next.delete(userId);
    return next;
  }, [all, userId]);
};
