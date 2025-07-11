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

import React, { memo, useEffect, useRef, useState } from "react";
import SmallVillage from "../components/SmallVillage";
import { RoomProvider } from "../context/RoomContext";
import SmallVillageScene from "../scenes/SmallVillageScene";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  RealtimeKitProvider,
  useRealtimeKitClient,
} from "@cloudflare/realtimekit-react";
import { createRTKToken } from "../lib/supabaseFunctions";

import { Room } from "../types";
import BottomBar from "../components/BottomBar";

interface SmallVillageScreenProps {
  userId: string;
  characterIndex: number;
  characterName: string;
  room: Room;
  onExit: () => void;
}

const SmallVillageScreen: React.FC<SmallVillageScreenProps> = ({
  userId,
  characterIndex,
  characterName,
  room,
  onExit,
}: SmallVillageScreenProps) => {
  const [readyScene, setReadyScene] = useState(false);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [scene, setScene] = useState<SmallVillageScene>();
  const [isJoined, setIsJoined] = useState(false);
  const [meeting, initMeeting] = useRealtimeKitClient();

  useEffect(() => {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
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
      backgroundColor: "#000000",
      width: 640 * 2,
      height: 480 * 2,
      scale: {
        mode: Phaser.Scale.NONE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
    };

    const game = new Phaser.Game(config);
    game.scene.start("SmallVillageScene", {
      characterIndex,
      characterName,
      roomId: room.id,
      userId,
    });

    game.events.once(Phaser.Core.Events.READY, () => {
      setTimeout(() => {
        setReadyScene(true);
        setScene(game.scene.getScene("SmallVillageScene") as SmallVillageScene);
      }, 3_000);
    });

    return () => {
      game.destroy(true);
    };
  }, [characterIndex, characterName, userId, room.id]);

  useEffect(() => {
    const joinRoom = async () => {
      try {
        const token = await createRTKToken(room.id, userId, characterName);
        await initMeeting({
          authToken: token,
          defaults: {
            video: false,
            audio: true,
          },
        });

        setIsJoined(true);
      } catch (error) {
        console.error("Error joining room:", error);
      }
    };

    joinRoom();
  }, [initMeeting, userId, characterName, room.id]);

  const handleExit = async () => {
    console.log("Exiting game");

    try {
      await meeting?.leave();
    } catch (error) {
      console.error("Error leaving meeting:", error);
    }

    // call onExit function
    onExit();
  };

  const isReady = readyScene && scene && isJoined;

  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-800 relative">
      <div ref={gameContainerRef} className="overflow-hidden" />
      <div className="absolute inset-0">
        {!isReady ? (
          <LoadingSpinner message="Strolling into the Small Village..." />
        ) : (
          <RealtimeKitProvider value={meeting}>
            <RoomProvider userId={userId} userName={characterName}>
              <SmallVillage
                room={room}
                userId={userId!}
                characterIndex={characterIndex}
                characterName={characterName}
                scene={scene}
                onExit={onExit}
              />
              <BottomBar onExit={handleExit} userId={userId} />
            </RoomProvider>
          </RealtimeKitProvider>
        )}
      </div>
    </div>
  );
};

export default memo(SmallVillageScreen);
