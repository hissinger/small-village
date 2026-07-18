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
  ROSTER_STALE_SWEEP_INTERVAL_MS,
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

/**
 * 멤버십/식별 관점의 동등성: 같은 id 집합 + 각 id 의 name·character_index 가 동일한가.
 * 위치(x/y)·last_active 차이는 무시한다 — 로스터 소비자(패널·배지·씬 스프라이트 생성)는
 * 그 필드를 안 쓰므로, 이동/하트비트로 노출 Map 참조가 바뀌어 리렌더되는 것을 막는다.
 */
function sameRoster(a: Map<string, User>, b: Map<string, User>): boolean {
  if (a.size !== b.size) return false;
  let equal = true;
  a.forEach((ua, id) => {
    const ub = b.get(id);
    if (
      !ub ||
      ua.name !== ub.name ||
      ua.character_index !== ub.character_index
    ) {
      equal = false;
    }
  });
  return equal;
}

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
      // 멤버십/식별(id 집합·name·character_index)이 안 바뀌면 참조를 유지한다.
      // 위치(x/y)·last_active 만 바뀐 UPDATE(이동·하트비트)로는 소비자를 리렌더하지
      // 않는다 → 패널/배지 이동 리렌더 제거(P1) + 하트비트 무의미 리렌더 제거(P4).
      setParticipants((prev) => (sameRoster(prev, next) ? prev : next));
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

    // 초기 스냅샷 + 주기 reconcile(DB 재조회로 놓친 이벤트·재연결 수렴).
    reconcile();
    const interval = setInterval(reconcile, RECONCILE_INTERVAL_MS);

    // 고아 row 은닉용 로컬 stale-sweep. 위치가 broadcast 로 빠지고 last_active UPDATE 가
    // diff 로 억제되면서 recompute 의 잦은 트리거(이동·하트비트)가 사라졌으므로, DB fetch 없이
    // dataRef 에 stale 필터만 재적용하는 값싼 sweep 으로 고아를 제때 감춘다(reconcile 과 분리).
    const staleSweep = setInterval(recompute, ROSTER_STALE_SWEEP_INTERVAL_MS);

    return () => {
      cancelled = true;
      clearInterval(interval);
      clearInterval(staleSweep);
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
