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

export const useRemoteParticipants = (): Map<string, User> => {
  const { roomId, userId } = useRoomContext();
  const [participants, setParticipants] = useState<Map<string, User>>(
    new Map()
  );

  // Fetch initial participants on mount
  useEffect(() => {
    const fetchInitialParticipants = async () => {
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
      const participantsMap = new Map<string, User>();
      data?.forEach((user) => {
        participantsMap.set(user.id, user as User);
      });
      setParticipants(participantsMap);
    };
    fetchInitialParticipants();
  }, [roomId, userId]);

  useEffect(() => {
    const usersChannelName = `realtime:public:${DATABASE_TABLES.USERS}_useRemoteParticipants`;
    const usersChannel = supabase
      .channel(usersChannelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          if (payload.new.room_id !== roomId) return;
          if (payload.new.id === userId) return;
          const newUser = payload.new as User;

          setParticipants((prev) => {
            const newParticipants = new Map(prev);
            newParticipants.set(newUser.id, newUser);
            return newParticipants;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          if (payload.new.room_id !== roomId) return;
          if (payload.new.id === userId) return;

          setParticipants((prev) => {
            const newParticipants = new Map(prev);
            newParticipants.set(payload.new.id, payload.new as User);
            return newParticipants;
          });
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          if (userId === payload.old.id) return;

          setParticipants((prev) => {
            const newParticipants = new Map(prev);
            newParticipants.delete(payload.old.id);
            return newParticipants;
          });
        }
      )
      .subscribe();

    return () => {
      usersChannel.unsubscribe();
    };
  }, [roomId, userId]);

  return participants;
};
