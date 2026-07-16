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
import LobbyBackground from "../components/LobbyBackground";
import { getStoredName, setStoredName } from "../lib/storage";
import { pushEvent } from "../lib/analytics";
import { ANALYTICS_EVENTS } from "../constants";

interface CharacterSelectScreenProps {
  onEnterRoom: (characterIndex: number, name: string, room: Room) => void;
}

const CharacterSelectScreen: React.FC<CharacterSelectScreenProps> = ({
  onEnterRoom,
}) => {
  // 지난 방문에서 저장해 둔 이름으로 초기화한다(없으면 빈 문자열).
  const [name, setName] = useState(() => getStoredName() ?? "");
  const [currentIndex, setCurrentIndex] = useState(0);

  // 이름이 바뀔 때마다 localStorage 에 반영해 다음 방문에 그대로 보이게 한다.
  const handleNameChange = (value: string) => {
    setName(value);
    setStoredName(value);
  };
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const gameInstance = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<CharacterPreviewScene | null>(null);
  const [readyScene, setReadyScene] = useState(false);
  const { rooms, counts, refetch, loading } = useRooms();

  // 캐릭터 확정 전용 버튼이 없으므로, 방 Join/Create 로 입장이 확정되는 시점에
  // 현재 선택 인덱스를 character_selected 로 함께 계측한다(RoomList/CreateNewRoom 공통).
  const handleEnterRoom = (room: Room) => {
    pushEvent(ANALYTICS_EVENTS.CHARACTER_SELECTED, {
      character_index: currentIndex,
    });
    onEnterRoom(currentIndex, name, room);
  };

  // 로비 방 목록이 처음 렌더될 때(loading true→false) 1회만 계측한다.
  const listViewSentRef = useRef(false);
  useEffect(() => {
    if (!loading && !listViewSentRef.current) {
      listViewSentRef.current = true;
      pushEvent(ANALYTICS_EVENTS.ROOM_LIST_VIEW, { room_count: rooms.length });
    }
  }, [loading, rooms.length]);

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
    <div className="fixed inset-0 z-50 overflow-y-auto">
      {/* Pixel-art village background (full screen, crisp, no blur) */}
      <LobbyBackground />
      {/* Feather-light scrim: let the pixel-art village read as vividly as
          possible and only lift a touch of warmth at the very bottom. */}
      <div className="pointer-events-none fixed inset-0 bg-gradient-to-b from-stone-900/10 via-stone-900/5 to-orange-950/20" />
      {/* Centered radial pool: adds just enough contrast behind the floating
          UI while the edges of the frame stay fully exposed. */}
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(ellipse_at_center,_rgba(12,10,9,0.32)_0%,_rgba(12,10,9,0.14)_45%,_rgba(12,10,9,0)_75%)]" />

      {/* Floating UI — no cards, content sits directly on the scrim */}
      <div className="relative flex min-h-full items-center justify-center p-4">
        <div className="w-full max-w-4xl">
          {/* Hero title */}
          <h1 className="mb-8 text-center text-xl leading-relaxed text-orange-100 sv-font-pixel sv-pixel-shadow sm:text-2xl">
            Welcome to Small Village
          </h1>

          {/* Two independent translucent panels floating over the pixel-art
              village: the background still reads through (bg-stone-900/70 +
              backdrop-blur), while the border + shadow give each block a clear
              "lobby window" edge that separates UI from scenery. */}
          <div className="relative grid grid-cols-1 items-stretch gap-8 md:grid-cols-5">
            {/* Left panel: character + name */}
            <div className="flex flex-col rounded-2xl border border-white/10 bg-stone-900/70 p-6 shadow-xl backdrop-blur-[2px] md:col-span-2">
              <ChooseYourCharacter
                previewContainerRef={previewContainerRef}
                handlePrevious={handlePrevious}
                handleNext={handleNext}
                currentIndex={currentIndex}
                name={name}
                onNameChange={handleNameChange}
              />
            </div>

            {/* Right panel: room list + create */}
            <div className="flex flex-col rounded-2xl border border-white/10 bg-stone-900/70 p-6 shadow-xl backdrop-blur-[2px] md:col-span-3">
              <RoomList
                disabled={!name}
                rooms={rooms}
                counts={counts}
                onEnterRoom={handleEnterRoom}
                loading={loading}
                refetch={refetch}
              />
              <div className="mt-auto border-t border-white/15 pt-4">
                <CreateNewRoom
                  disabled={!name}
                  roomCount={rooms.length}
                  onEnterRoom={handleEnterRoom}
                />
              </div>
            </div>

            {!readyScene && (
              <div className="absolute inset-0 flex items-center justify-center rounded-2xl bg-stone-950/60 backdrop-blur-sm">
                <LoadingSpinner message="Loading assets..." />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default CharacterSelectScreen;
