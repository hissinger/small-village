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
import SmallVillage from "../components/SmallVillage";
import { RoomProvider } from "../context/RoomContext";
import SmallVillageScene from "../scenes/SmallVillageScene";
import LoadingSpinner from "../components/LoadingSpinner";
import {
  RealtimeKitProvider,
  useRealtimeKitClient,
} from "@cloudflare/realtimekit-react";
import { createMeeting, createRTKToken } from "../lib/supabaseFunctions";

interface SmallVillageScreenProps {
  userId: string;
  characterIndex: number;
  characterName: string;
  onExit: () => void;
}

const SmallVillageScreen: React.FC<SmallVillageScreenProps> = ({
  userId,
  characterIndex,
  characterName,
  onExit,
}: SmallVillageScreenProps) => {
  const [readyScene, setReadyScene] = useState(false);
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const [gameInstance, setGameInstance] = useState<Phaser.Game>();
  const [scene, setScene] = useState<SmallVillageScene>();
  const [isJoined, setIsJoined] = useState(false);
  const [meeting, initMeeting] = useRealtimeKitClient();

  const handleResize = useCallback(() => {
    if (!gameInstance) {
      return;
    }

    const { innerWidth, innerHeight } = window;

    gameInstance.scale.resize(innerWidth, innerHeight);
    const scene = gameInstance.scene.getScene("SmallVillageScene");
    scene?.cameras.main.setBounds(0, 0, innerWidth, innerHeight);
  }, [gameInstance]);

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

    const game = new Phaser.Game(config);
    game.scene.start("SmallVillageScene", {
      characterIndex,
      characterName,
      userId,
    });

    game.events.once(Phaser.Core.Events.READY, () => {
      setTimeout(() => {
        setReadyScene(true);
        setScene(game.scene.getScene("SmallVillageScene") as SmallVillageScene);
      }, 3_000);
    });

    setGameInstance(game);

    return () => {
      game.destroy(true);
    };
  }, [characterIndex, characterName, userId]);

  useEffect(() => {
    window.addEventListener("resize", handleResize);
    return () => {
      window.removeEventListener("resize", handleResize);
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const joinRoom = async () => {
      try {
        const meetingId = await createMeeting("Small Village");
        const token = await createRTKToken(meetingId, userId, characterName);

        await initMeeting({
          authToken: token,
          defaults: {
            video: false,
            audio: true,
          },
        });

        console.log("Meeting initialized:", meetingId);
        setIsJoined(true);

        // await meeting?.joinRoom();
      } catch (error) {
        console.error("Error joining room:", error);
      }
    };

    joinRoom();
  }, [initMeeting, userId, characterName]);

  const isReady = readyScene && scene && isJoined;

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <div
        ref={gameContainerRef}
        style={{
          width: "100%",
          height: "100%",
          overflow: "hidden",
        }}
      />

      {!isReady ? (
        <LoadingSpinner message="Strolling into the Small Village..." />
      ) : (
        <RealtimeKitProvider value={meeting}>
          <RoomProvider userId={userId} userName={characterName}>
            <SmallVillage
              userId={userId!}
              characterIndex={characterIndex}
              characterName={characterName}
              scene={scene}
              onExit={onExit}
            />
          </RoomProvider>
        </RealtimeKitProvider>
      )}
    </div>
  );
};

export default memo(SmallVillageScreen);
