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
    <div className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-gradient-to-br from-orange-200 via-amber-100 to-stone-200 p-4">
      <div className="w-full max-w-4xl">
        {/* Hero title */}
        <h1 className="mb-6 text-center text-xl leading-relaxed text-orange-800 sv-font-pixel sv-pixel-shadow sm:text-2xl">
          Welcome to Small Village
        </h1>

        <div className="relative grid grid-cols-1 gap-4 md:grid-cols-5">
          {/* Left card: character + name */}
          <div className="rounded-xl bg-[#fffdf7]/95 p-5 shadow-lg shadow-amber-900/15 ring-1 ring-amber-900/10 md:col-span-2">
            <ChooseYourCharacter
              previewContainerRef={previewContainerRef}
              handlePrevious={handlePrevious}
              handleNext={handleNext}
              currentIndex={currentIndex}
              name={name}
              onNameChange={setName}
            />
          </div>

          {/* Right card: room list + create */}
          <div className="flex flex-col rounded-xl bg-[#fffdf7]/95 p-5 shadow-lg shadow-amber-900/15 ring-1 ring-amber-900/10 md:col-span-3">
            <RoomList
              disabled={!name}
              rooms={rooms}
              onEnterRoom={(room: Room) => onEnterRoom(currentIndex, name, room)}
              loading={loading}
              refetch={refetch}
            />
            <div className="mt-4 border-t border-stone-200 pt-4">
              <CreateNewRoom
                disabled={!name}
                roomCount={rooms.length}
                onEnterRoom={(room: Room) =>
                  onEnterRoom(currentIndex, name, room)
                }
              />
            </div>
          </div>

          {!readyScene && (
            <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-[#fffdf7]/80">
              <LoadingSpinner message="Loading assets..." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default CharacterSelectScreen;
