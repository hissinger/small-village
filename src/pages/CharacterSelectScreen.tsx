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

import React, { useEffect, useRef, useState } from "react";
import Phaser from "phaser";

import LoadingSpinner from "../components/LoadingSpinner";
import CharacterPreviewScene from "../scenes/CharacterPreviewScene";
import { NUM_CHARACTERS } from "../constants";
import { useRooms } from "../hooks/useRooms";
import { Room } from "../types";
import RoomList from "../components/RoomList";
import NameInput from "../components/NameInput";
import CreateNewRoom from "../components/CreateNewRoom";
import ChooseYourCharacter from "../components/ChooseYourCharacter";

interface CharacterSelectScreenProps {
  onEnterRoom: (characterIndex: number, name: string, room: Room) => void;
}

const CharacterSelectScreen: React.FC<CharacterSelectScreenProps> = ({
  onEnterRoom,
}) => {
  const [name, setName] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const gameInstance = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<CharacterPreviewScene | null>(null);
  const [readyScene, setReadyScene] = useState(false);
  const { rooms, refetch, loading } = useRooms();

  useEffect(() => {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 120,
      height: 100,
      parent: previewContainerRef.current as HTMLDivElement,
      scene: CharacterPreviewScene,
      pixelArt: true,
      audio: {
        noAudio: true,
      },
      backgroundColor: "#f0f0f0",
    };

    const game = new Phaser.Game(config);
    gameInstance.current = game;

    game.events.once(Phaser.Scenes.Events.READY, () => {
      const scene = game.scene.getScene(
        "CharacterPreviewScene"
      ) as CharacterPreviewScene;
      if (scene) {
        sceneRef.current = scene;
        setTimeout(() => setReadyScene(true), 1000);
      }
    });

    return () => {
      gameInstance.current?.destroy(true);
      gameInstance.current = null;
    };
  }, []);

  const handleNext = () => {
    if (!sceneRef.current) return;
    const nextIndex = (currentIndex + 1) % NUM_CHARACTERS;
    setCurrentIndex(nextIndex);
    sceneRef.current.updateCharacter(nextIndex);
  };

  const handlePrevious = () => {
    if (!sceneRef.current) return;
    const prevIndex = (currentIndex - 1 + NUM_CHARACTERS) % NUM_CHARACTERS;
    setCurrentIndex(prevIndex);
    sceneRef.current.updateCharacter(prevIndex);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative w-full max-w-4xl rounded-lg bg-white p-6 shadow-lg">
        {/* Body */}
        <div className="flex flex-col pt-4">
          <div className="flex flex-col flex-grow">
            <div className="flex flex-grow">
              {/* Choose your character */}
              <ChooseYourCharacter
                previewContainerRef={previewContainerRef}
                handlePrevious={handlePrevious}
                handleNext={handleNext}
              />

              {/* Room List */}
              <RoomList
                disabled={!name}
                rooms={rooms}
                onEnterRoom={(room: Room) =>
                  onEnterRoom(currentIndex, name, room)
                }
                loading={loading}
                refetch={refetch}
              />
            </div>
            <div className="flex items-center">
              {/* Character Name Input */}
              <div className="p-4 border-r w-5/12">
                <NameInput name={name} onChange={setName} />
              </div>

              {/* Create New Room */}
              <CreateNewRoom
                disabled={!name}
                onEnterRoom={(room: Room) =>
                  onEnterRoom(currentIndex, name, room)
                }
              />
            </div>
          </div>
        </div>
        {!readyScene && (
          <div className="absolute inset-0 flex items-center justify-center bg-white bg-opacity-80">
            <LoadingSpinner message="Loading assets..." />
          </div>
        )}
      </div>
    </div>
  );
};

export default CharacterSelectScreen;
