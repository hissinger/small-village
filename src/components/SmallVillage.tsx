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
import useOnlineUsers from "../hooks/useOnlineUsers";
import Conference from "./Conference";
import { DATABASE_TABLES } from "../constants";
import BottomBar from "./BottomBar";
import SmallVillageScene from "../scenes/SmallVillageScene";
import { Room, User } from "../types";
import { useChatMessage } from "../hooks/useChatMessage";
import { useToast } from "../hooks/useToast";
import { useRealtimeKitMeeting } from "@cloudflare/realtimekit-react";

interface SmallVillageProps {
  room: Room;
  userId: string;
  characterIndex: number;
  characterName: string;
  scene: SmallVillageScene;
  onExit: () => void;
}

const INACTIVE_TIMEOUT_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 10_000;

const SmallVillage: React.FC<SmallVillageProps> = ({
  room,
  userId,
  scene,
  onExit,
}) => {
  const toast = useToast();
  const { meeting } = useRealtimeKitMeeting();

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
            // exit the game
            handleExit();
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

  // 온라인 유저가 들어왔을 때
  const handleJoinUser = useCallback((userId: string) => {
    console.log(`User ${userId} joined.`);
  }, []);

  // 온라인 유저가 나갔을 때
  const handleLeaveUser = useCallback(
    (userId: string) => {
      console.log(`User ${userId} left.`);

      // remove user sprite from scene
      scene.removeUser(userId);

      // gabage collection
      supabase
        .from(DATABASE_TABLES.USERS)
        .delete()
        .match({ id: userId })
        .then(({ error }) => {
          if (error) {
            console.error(`Failed to delete user ${userId}:`, error);
          }
        });
    },
    [scene]
  );

  useOnlineUsers({
    roomId: room.id,
    userId,
    onJoin: handleJoinUser,
    onLeave: handleLeaveUser,
  });

  const handleExit = async () => {
    console.log("Exiting game");

    // delete user data from database
    await deleteUserDataFromDatebase();

    meeting.leave();

    // call onExit function
    onExit();
  };

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

  return (
    <div className="relative w-full h-full">
      <div>
        <BottomBar onExit={handleExit} userId={userId} />
        <Conference userId={userId} />
      </div>
    </div>
  );
};

export default memo(SmallVillage);
