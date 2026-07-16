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

import React, { memo, useCallback, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import Conference from "./Conference";
import SpeakerIndicators from "./SpeakerIndicators";
import {
  DATABASE_TABLES,
  INACTIVE_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
} from "../constants";
import SmallVillageScene from "../scenes/SmallVillageScene";
import { Room, User } from "../types";
import { useChatMessage } from "../hooks/useChatMessage";
import { useReactionMessage, ReactionMessage } from "../hooks/useReactionMessage";
import { useToast } from "../hooks/useToast";

interface SmallVillageProps {
  room: Room;
  userId: string;
  characterIndex: number;
  characterName: string;
  scene: SmallVillageScene;
  onExit: () => void;
}

const SmallVillage: React.FC<SmallVillageProps> = ({
  room,
  userId,
  scene,
  onExit,
}) => {
  const toast = useToast();

  const deleteUserDataFromDatebase = useCallback(async () => {
    await supabase.from(DATABASE_TABLES.USERS).delete().match({ id: userId });
  }, [userId]);

  const handleBeforeUnload = useCallback(async () => {
    await deleteUserDataFromDatebase();
  }, [deleteUserDataFromDatebase]);

  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const sendHeartbeat = async () => {
    // update last_active
    await supabase
      .from(DATABASE_TABLES.USERS)
      .update({ last_active: new Date().toISOString() })
      .match({ id: userId });
  };

  useEffect(() => {
    const interval = setInterval(sendHeartbeat, HEARTBEAT_INTERVAL_MS);
    return () => {
      clearInterval(interval);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    supabase
      .from(DATABASE_TABLES.USERS)
      .select("*")
      .eq("room_id", room.id)
      .then(({ data, error }) => {
        if (error) {
          console.error(error);
          return;
        }

        // gabage collection
        // remove users who are inactive
        const users = data || [];
        const now = new Date();
        const usersToDelete = users.filter(
          (user: User) =>
            new Date(user.last_active) <
            new Date(now.getTime() - INACTIVE_TIMEOUT_MS)
        );
        usersToDelete.forEach((user) => {
          supabase
            .from(DATABASE_TABLES.USERS)
            .delete()
            .match({ id: user.id })
            .then(({ error }) => {
              if (error) {
                console.error(`Failed to delete user ${user.id}:`, error);
              }
            });
        });

        // get online users and add them to the scene
        const onlineUsers = users.filter(
          (user: User) =>
            new Date(user.last_active) >
            new Date(now.getTime() - INACTIVE_TIMEOUT_MS)
        );
        scene.updateUsers(onlineUsers);
      });

    const usersChannelName = `realtime:public:${DATABASE_TABLES.USERS}`;
    const usersChannel = supabase
      .channel(usersChannelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          if (payload.new.room_id !== room.id) return;
          const newUser = payload.new as User;
          // if exists, update user data, otherwise add new user
          const existingUser = scene.users?.find(
            (user) => user.id === newUser.id
          );
          if (existingUser) {
            scene.updateUsers(
              scene.users?.map((user) =>
                user.id === newUser.id ? newUser : user
              )
            );
          } else {
            scene.updateUsers([...(scene.users || []), newUser]);
          }

          if (newUser) {
            toast.show(`${newUser.name} has joined`);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          if (payload.new.room_id !== room.id) return;
          if (payload.new.id === userId) return;

          const prevUsers = scene.users;
          const updatedUsers = prevUsers.map((user) =>
            user.id === payload.new.id ? (payload.new as User) : user
          );
          scene.updateUsers(updatedUsers);
        }
      )
      .on(
        "postgres_changes",
        { event: "DELETE", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          if (userId === payload.old.id) {
            return;
          }

          scene.removeUser((payload.old as User).id);
        }
      )
      .subscribe();

    return () => {
      usersChannel.unsubscribe();
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // presence(멤버십)/leave-정리는 RoomParticipantsProvider 가 단독으로 소유한다.
  // 씬 스프라이트 제거는 아래 postgres DELETE 핸들러가 계속 담당한다(PR-2 에서 provider 로 이관 예정).

  // chat handling
  const sendChatMessage = useCallback(
    (senderId: string, message: string) => {
      scene.showChatMessage(senderId, message);
    },
    [scene]
  );

  const chatMessage = useChatMessage();
  useEffect(() => {
    if (chatMessage) {
      const { sender_id: senderId, body: message } = chatMessage;
      sendChatMessage(senderId, message as string);
    }
  }, [chatMessage, sendChatMessage]);

  // reaction handling — 리액션은 동시다발이라 콜백으로 각 이벤트를 즉시 씬에 전달한다.
  const handleReaction = useCallback(
    (r: ReactionMessage) => {
      scene.showReaction(r.sender_id, r.emoji);
    },
    [scene]
  );
  useReactionMessage(handleReaction);

  return (
    <div className="relative w-full h-full">
      <div>
        <Conference userId={userId} />
      </div>
      <SpeakerIndicators scene={scene} />
    </div>
  );
};

export default memo(SmallVillage);
