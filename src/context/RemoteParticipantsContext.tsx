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

import React, { createContext, useContext, useEffect, useState } from "react";
import { User } from "../types";
import { supabase } from "../lib/supabaseClient";
import { DATABASE_TABLES } from "../constants";
import { useRoomContext } from "./RoomContext";

const RemoteParticipantsContext = createContext<Map<string, User> | null>(null);

/**
 * 방 안의 "원격 유저(self 제외)" 스냅샷을 한 번만 구독해 공유하는 Provider.
 *
 * 왜 Context 인가: BottomBar(패널·배지)와 SpatialAudioController(공간 오디오)가 동시에
 * 이 데이터를 필요로 한다. 각자 훅으로 구독하면 같은 `users` 테이블에 대한 postgres_changes
 * 채널이 중복 생성돼(같은 소켓의 중복 토픽) 한쪽이 이벤트를 못 받는다. 구독을 여기 한 곳으로
 * 모아 단일 채널로 만들고, 소비자는 useRemoteParticipants 로 스냅샷만 읽는다.
 */
export const RemoteParticipantsProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const { roomId, userId } = useRoomContext();
  const [participants, setParticipants] = useState<Map<string, User>>(
    new Map()
  );

  // 실시간 구독 (INSERT/UPDATE/DELETE). 초기 fetch 보다 먼저 걸어 둔다.
  useEffect(() => {
    const channelName = `realtime:public:${DATABASE_TABLES.USERS}_remoteParticipants`;
    const channel = supabase
      .channel(channelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          if (payload.new.room_id !== roomId) return;
          if (payload.new.id === userId) return;
          const u = payload.new as User;
          setParticipants((prev) => new Map(prev).set(u.id, u));
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          if (payload.new.room_id !== roomId) return;
          if (payload.new.id === userId) return;
          const u = payload.new as User;
          setParticipants((prev) => new Map(prev).set(u.id, u));
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          if (payload.old.id === userId) return;
          setParticipants((prev) => {
            const next = new Map(prev);
            next.delete(payload.old.id);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, [roomId, userId]);

  // 초기 스냅샷 fetch. 구독과 fetch 는 병행하므로, fetch await 중 도착한 live 이벤트(더 최신)를
  // fetch 스냅샷으로 덮지 않도록 "아직 없는 id 만" 보강한다 (레이스 방지).
  useEffect(() => {
    let cancelled = false;
    const fetchInitial = async () => {
      if (!roomId) return;
      const { data, error } = await supabase
        .from(DATABASE_TABLES.USERS)
        .select("*")
        .eq("room_id", roomId)
        .neq("id", userId);
      if (error) {
        console.error("Error fetching initial participants:", error);
        return;
      }
      if (cancelled) return;
      setParticipants((prev) => {
        const next = new Map(prev);
        data?.forEach((u) => {
          if (!next.has(u.id)) next.set(u.id, u as User);
        });
        return next;
      });
    };
    fetchInitial();
    return () => {
      cancelled = true;
    };
  }, [roomId, userId]);

  return (
    <RemoteParticipantsContext.Provider value={participants}>
      {children}
    </RemoteParticipantsContext.Provider>
  );
};

/** 방 안의 원격 유저(self 제외) 스냅샷. RemoteParticipantsProvider 하위에서만 쓴다. */
export const useRemoteParticipants = (): Map<string, User> => {
  const ctx = useContext(RemoteParticipantsContext);
  if (!ctx) {
    throw new Error(
      "useRemoteParticipants must be used within a RemoteParticipantsProvider"
    );
  }
  return ctx;
};
