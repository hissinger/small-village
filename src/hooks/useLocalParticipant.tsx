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
import { produce } from "immer";

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
        { event: "UPDATE", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          if (payload.new.id !== userId) return;
          setParticipant((prev) => {
            return produce(prev, (draft) => {
              if (draft) {
                draft.x = payload.new.x;
                draft.y = payload.new.y;
              } else {
                draft = payload.new as User;
              }
              return draft;
            });
          });
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
