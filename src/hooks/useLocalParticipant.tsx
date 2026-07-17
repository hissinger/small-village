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

import { User } from "../types";
import { supabase } from "../lib/supabaseClient";
import { DATABASE_TABLES } from "../constants";
import { useEffect, useState } from "react";
import { useRoomContext } from "../context/RoomContext";

/**
 * 내 users row(초기 위치 seed + 존재 여부)를 준다. 공간오디오의 myPosition **초기값**과
 * 렌더 게이팅에 쓴다.
 *
 * 위치의 live 갱신은 broadcast(useRemotePositions)로 옮겼으므로(#51), 여기서는 이동마다의
 * postgres UPDATE 를 구독하지 않는다 — 초기 1회 fetch(seed) + INSERT(늦은 등록) + DELETE(퇴장)만.
 */
export const useLocalParticipant = (): User | undefined => {
  const { roomId, userId } = useRoomContext();
  const [participant, setParticipant] = useState<User>();

  // Fetch initial user data on mount
  useEffect(() => {
    const fetchInitialUser = async () => {
      if (!userId) return;
      const { data, error } = await supabase
        .from(DATABASE_TABLES.USERS)
        .select("*")
        .eq("id", userId)
        .single();
      if (error) {
        console.error("Error fetching initial user data:", error);
        return;
      }
      setParticipant(data as User);
    };
    fetchInitialUser();
  }, [userId]);

  useEffect(() => {
    const usersChannelName = `realtime:public:${DATABASE_TABLES.USERS}:useLocalParticipant`;
    const usersChannel = supabase
      .channel(usersChannelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          if (payload.new.id !== userId) return;
          const newUser = payload.new as User;
          setParticipant(newUser);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          if (userId !== payload.old.id) {
            return;
          }
          setParticipant(undefined);
        }
      )
      .subscribe();

    return () => {
      usersChannel.unsubscribe();
    };
  }, [roomId, userId]);

  return participant;
};
