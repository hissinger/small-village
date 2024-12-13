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

import { useEffect, useRef } from "react";
import { DATABASE_TABLES } from "../constants";
import { supabase } from "../supabaseClient";
import { Session } from "../types";

interface useSessionsProps {
  userId: string;
  onJoin: (session: Session) => void;
  onLeave: (session: Session) => void;
}

export function useSessions({ userId, onJoin, onLeave }: useSessionsProps) {
  const propsRef = useRef({
    onJoin: onJoin,
    onLeave: onLeave,
  });

  useEffect(() => {
    propsRef.current = {
      onJoin: onJoin,
      onLeave: onLeave,
    };
  }, [userId, onJoin, onLeave]);

  useEffect(() => {
    if (!userId) {
      return;
    }

    const usersChannelName = `realtime:public:${DATABASE_TABLES.SESSIONS}`;
    const usersChannel = supabase
      .channel(usersChannelName)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: DATABASE_TABLES.SESSIONS,
          filter: `user_id=neq.${userId}`,
        },
        (payload) => {
          try {
            const session: Session = payload.new as Session;
            propsRef.current.onJoin(session);
          } catch (error) {
            console.error("Error pulling remote tracks:", error);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: DATABASE_TABLES.SESSIONS },
        (payload) => {
          try {
            const session: Session = payload.old as Session;
            propsRef.current.onLeave(session);
          } catch (error) {
            console.error("Error removing remote tracks:", error);
          }
        }
      )
      .subscribe();

    return () => {
      usersChannel?.unsubscribe();
    };
  }, [userId]);
}
