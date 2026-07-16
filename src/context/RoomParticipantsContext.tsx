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
  PARTICIPANT_FETCH_MAX_ATTEMPTS,
  PARTICIPANT_FETCH_BACKOFF_MS,
} from "../constants";
import { useRoomContext } from "./RoomContext";

/**
 * 방 로스터("누가 있나")의 단일 진실원.
 *
 * 설계(docs/presence-source-refactor-plan.md):
 * - **누가(membership)** → Supabase Presence 를 권위로 삼는다. presence `sync` 는 매번 전체
 *   접속자 집합을 주고 재연결에도 자가복구되므로, 이벤트가 유실돼도 다음 sync 로 수렴한다.
 *   제거는 오직 sync 전체집합 reconcile 로만 한다(leave 즉시제거 금지 — localStorage 공유 id 라
 *   같은 유저의 다른 탭이 살아있는데 한 탭 leave 로 오제거될 수 있다).
 * - **어디/무엇(state)** → `users` 테이블 + `postgres_changes`(INSERT/UPDATE) 를 데이터 채움의
 *   1차 경로로 쓴다. presence 멤버인데 아직 row 데이터가 없으면 개별 fetch 로 보강하되, 유한
 *   횟수(PARTICIPANT_FETCH_MAX_ATTEMPTS)로 재시도한다(무한 폴링 방지).
 *
 * 이 Provider 가 presence 채널(`online-users-<roomId>`)의 track/sync 를 단독 소유한다. 같은
 * 소켓에 동일 이름 채널을 중복 구독하면 토픽이 겹쳐 한쪽이 이벤트를 못 받으므로, presence 구독은
 * 여기 한 곳에만 둔다.
 *
 * 노출 맵은 self 를 포함한 전체 로스터다. 소비자는 필요에 맞게 고른다:
 *  - useRoomParticipants(): self 포함 전체 로스터.
 *  - useRemoteParticipants(): self 제외 뷰(패널·배지·공간오디오가 사용).
 */
const RoomParticipantsContext = createContext<Map<string, User> | null>(null);

const ONLINE_USERS_CHANNEL_PREFIX = "online-users";

interface PresenceMeta {
  user_id: string;
  online_at: string;
}

export const RoomParticipantsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { roomId, userId } = useRoomContext();
  const [participants, setParticipants] = useState<Map<string, User>>(
    new Map()
  );

  // 멤버십(presence 권위)과 데이터(users row)를 분리해 ref 로 들고, 둘을 교집합해 노출 맵을 만든다.
  const membersRef = useRef<Set<string>>(new Set());
  const dataRef = useRef<Map<string, User>>(new Map());
  const fetchAttemptsRef = useRef<Map<string, number>>(new Map());
  const fetchTimersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map()
  );

  useEffect(() => {
    if (!roomId) return;
    let cancelled = false;
    const fetchTimers = fetchTimersRef.current;
    const fetchAttempts = fetchAttemptsRef.current;

    // 노출 맵 = (presence 멤버) ∩ (데이터 있음). 멤버여도 데이터가 없으면 아직 감춘다.
    const recompute = () => {
      if (cancelled) return;
      const next = new Map<string, User>();
      membersRef.current.forEach((id) => {
        const u = dataRef.current.get(id);
        if (u) next.set(id, u);
      });
      setParticipants(next);
    };

    const clearFetch = (id: string) => {
      const timer = fetchTimers.get(id);
      if (timer) {
        clearTimeout(timer);
        fetchTimers.delete(id);
      }
      fetchAttempts.delete(id);
    };

    // presence 멤버지만 데이터가 없는 id 를 개별 fetch. 유한 횟수 백오프로만 재시도한다.
    const fetchMemberData = async (id: string) => {
      if (cancelled) return;
      if (dataRef.current.has(id) || !membersRef.current.has(id)) return;
      const attempts = fetchAttempts.get(id) ?? 0;
      if (attempts >= PARTICIPANT_FETCH_MAX_ATTEMPTS) return; // 상한 — 무한 폴링 방지
      fetchAttempts.set(id, attempts + 1);

      const { data, error } = await supabase
        .from(DATABASE_TABLES.USERS)
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (cancelled) return;
      // fetch 대기 중 postgres INSERT 가 먼저 채웠거나 멤버가 빠졌으면 중단.
      if (dataRef.current.has(id) || !membersRef.current.has(id)) return;

      if (!error && data) {
        dataRef.current.set(id, data as User);
        clearFetch(id);
        recompute();
        return;
      }
      // 상한 도달: 이 멤버는 끝내 users row 를 못 채웠다(예: same-user 다중 탭에서 공유 row 삭제).
      // 회귀 조기 감지를 위해 dev 에서만 남긴다(정상 warmup 노이즈가 아닌 진짜 실패 지점).
      if (attempts + 1 >= PARTICIPANT_FETCH_MAX_ATTEMPTS) {
        if (process.env.NODE_ENV !== "production") {
          console.debug(
            `[presence] member ${id} still has no users row after ${
              attempts + 1
            } attempts`
          );
        }
        return;
      }
      // 실패/빈 결과 → 유한 백오프 후 재시도(그 사이 postgres INSERT 가 오면 위 guard 로 중단).
      const timer = setTimeout(
        () => fetchMemberData(id),
        PARTICIPANT_FETCH_BACKOFF_MS * (attempts + 1)
      );
      fetchTimers.set(id, timer);
    };

    // 데이터 채널: users INSERT/UPDATE 가 데이터 채움의 1차 경로. DELETE 는 보조.
    const dataChannelName = `realtime:public:${DATABASE_TABLES.USERS}_roomParticipants`;
    const upsertData = (payload: { new: Record<string, unknown> }) => {
      if (payload.new.room_id !== roomId) return;
      const u = payload.new as unknown as User;
      dataRef.current.set(u.id, u);
      clearFetch(u.id);
      recompute();
    };
    const dataChannel = supabase
      .channel(dataChannelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: DATABASE_TABLES.USERS },
        upsertData
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: DATABASE_TABLES.USERS },
        upsertData
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          const id = (payload.old as { id?: string }).id;
          if (!id) return;
          dataRef.current.delete(id);
          clearFetch(id);
          recompute();
        }
      )
      .subscribe();

    // presence 채널: 멤버십의 권위. key=userId 로 track 해 sync 집합이 곧 user_id 집합이 되게 한다.
    const presenceChannelName = `${ONLINE_USERS_CHANNEL_PREFIX}-${roomId}`;
    const presenceChannel = supabase.channel(presenceChannelName, {
      config: { presence: { key: userId } },
    });

    const handleSync = () => {
      const state = presenceChannel.presenceState<PresenceMeta>();
      // key 설정 여부와 무관하게 안전하도록 meta 의 user_id 로 집합을 만든다.
      const ids = new Set<string>();
      Object.values(state).forEach((metas) =>
        metas.forEach((m) => {
          if (m.user_id) ids.add(m.user_id);
        })
      );
      membersRef.current = ids;

      // 떠난 멤버 정리(데이터·진행 중 fetch 폐기).
      Array.from(dataRef.current.keys()).forEach((id) => {
        if (!ids.has(id)) {
          dataRef.current.delete(id);
          clearFetch(id);
        }
      });
      // 데이터 없는 멤버 보강.
      ids.forEach((id) => {
        if (!dataRef.current.has(id)) void fetchMemberData(id);
      });
      recompute();
    };

    presenceChannel
      .on("presence", { event: "sync" }, handleSync)
      .subscribe(async (status) => {
        if (status === "SUBSCRIBED") {
          const meta: PresenceMeta = {
            user_id: userId,
            online_at: new Date().toISOString(),
          };
          await presenceChannel.track(meta);
        }
      });

    return () => {
      cancelled = true;
      fetchTimers.forEach((timer) => clearTimeout(timer));
      fetchTimers.clear();
      fetchAttempts.clear();
      dataChannel.unsubscribe();
      presenceChannel.unsubscribe();
    };
  }, [roomId, userId]);

  return (
    <RoomParticipantsContext.Provider value={participants}>
      {children}
    </RoomParticipantsContext.Provider>
  );
};

const useRoomParticipantsMap = (): Map<string, User> => {
  const ctx = useContext(RoomParticipantsContext);
  if (!ctx) {
    throw new Error(
      "useRoomParticipants must be used within a RoomParticipantsProvider"
    );
  }
  return ctx;
};

/** 방 안의 전체 로스터(self 포함). RoomParticipantsProvider 하위에서만 쓴다. */
export const useRoomParticipants = (): Map<string, User> =>
  useRoomParticipantsMap();

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
