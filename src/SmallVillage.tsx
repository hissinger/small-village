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

import React, { memo, useCallback, useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { supabase } from "./supabaseClient";
import useOnlineUsers from "./hooks/useOnlineUsers";
import LoadingSpinner from "./LoadingSpinner";
import Conference from "./Conference";
import { DATABASE_TABLES } from "./constants";
import BottomBar from "./BottomBar";
import SmallVillageScene from "./scenes/SmallVillageScene";
import { User } from "./types";

interface SmallVillageScreenProps {
  userId: string;
  characterIndex: number;
  characterName: string;
  onExit: () => void;
}

const INACTIVE_TIMEOUT_MS = 15_000;
const HEARTBEAT_INTERVAL_MS = 10_000;

const SmallVillageScreen: React.FC<SmallVillageScreenProps> = ({
  userId,
  characterIndex,
  characterName,
  onExit,
}) => {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameInstanceRef = useRef<Phaser.Game | null>(null);
  const [readyScene, setReadyScene] = useState(false);

  const getScene = (): SmallVillageScene | null => {
    return gameInstanceRef.current?.scene.getScene(
      "SmallVillageScene"
    ) as SmallVillageScene | null;
  };

  const deleteUserDataFromDatebase = useCallback(async () => {
    await supabase.from(DATABASE_TABLES.USERS).delete().match({ id: userId });
  }, [userId]);

  const handleResize = useCallback(() => {
    const { innerWidth, innerHeight } = window;

    if (gameInstanceRef.current) {
      gameInstanceRef.current.scale.resize(innerWidth, innerHeight);
      const scene = gameInstanceRef.current.scene.getScene("SmallVillageScene");
      scene?.cameras.main.setBounds(0, 0, innerWidth, innerHeight);
    }
  }, []);

  const handleBeforeUnload = useCallback(async () => {
    await deleteUserDataFromDatebase();
  }, [deleteUserDataFromDatebase]);

  useEffect(() => {
    window.addEventListener("beforeunload", handleBeforeUnload);
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      window.removeEventListener("resize", handleResize);
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
        getScene()?.updateUsers(onlineUsers);
      });

    const usersChannelName = `realtime:public:${DATABASE_TABLES.USERS}`;
    const usersChannel = supabase
      .channel(usersChannelName)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          if (payload.new.id === userId) return;
          const scene = getScene();
          if (scene) {
            scene.updateUsers([...(scene.users || []), payload.new as User]);
          }
        }
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: DATABASE_TABLES.USERS },
        (payload) => {
          if (payload.new.id === userId) return;
          const scene = getScene();
          if (scene) {
            const prevUsers = scene.users;
            const updatedUsers = prevUsers.map((user) =>
              user.id === payload.new.id ? (payload.new as User) : user
            );
            scene.updateUsers(updatedUsers);
          }
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

          getScene()?.removeUser((payload.old as User).id);
        }
      )
      .subscribe();

    return () => {
      usersChannel.unsubscribe();
      gameInstanceRef.current?.destroy(true);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // 온라인 유저가 들어왔을 때
  const handleJoinUser = useCallback((userId: string) => {
    console.log(`User ${userId} joined.`);
  }, []);

  // 온라인 유저가 나갔을 때
  const handleLeaveUser = useCallback((userId: string) => {
    console.log(`User ${userId} left.`);

    // remove user sprite from scene
    getScene()?.removeUser(userId);

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
  }, []);

  useOnlineUsers({ userId, onJoin: handleJoinUser, onLeave: handleLeaveUser });

  useEffect(() => {
    const { innerWidth: width, innerHeight: height } = window;
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width,
      height,
      parent: gameContainerRef.current as HTMLDivElement,
      scene: SmallVillageScene,
      pixelArt: true,
      physics: {
        default: "arcade",
        arcade: {
          gravity: { x: 0, y: 0 },
          debug: false,
        },
      },
    };

    gameInstanceRef.current = new Phaser.Game(config);
    gameInstanceRef.current.scene.start("SmallVillageScene", {
      characterIndex,
      characterName,
      userId,
    });

    gameInstanceRef.current.events.once(Phaser.Core.Events.READY, () => {
      setTimeout(() => {
        setReadyScene(true);
      }, 3_000);
    });

    return () => {
      gameInstanceRef.current?.destroy(true);
    };
  }, [characterIndex, characterName, userId]);

  const handleExit = async () => {
    console.log("Exiting game");

    // delete user data from database
    await deleteUserDataFromDatebase();

    // call onExit function
    onExit();
  };

  // chat handling
  const sendChatMessage = (senderId: string, message: string) => {
    getScene()?.showChatMessage(senderId, message);
  };

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={gameContainerRef}
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
          visibility: readyScene ? "visible" : "hidden",
        }}
      />
      {!readyScene ? (
        <LoadingSpinner message="Strolling into the Small Village..." />
      ) : (
        <div>
          <BottomBar
            onExit={handleExit}
            userId={userId}
            onMessage={sendChatMessage}
          />
          <Conference userId={userId} />
        </div>
      )}
    </div>
  );
};

export default memo(SmallVillageScreen);
