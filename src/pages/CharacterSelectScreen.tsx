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

import { RefreshCw } from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import CharacterPreviewScene from "../scenes/CharacterPreviewScene";
import { NUM_CHARACTERS } from "../constants";
import { useRooms } from "../hooks/useRooms";
import { createMeeting } from "../lib/supabaseFunctions";

import { Room } from "../types";
import IconButton from "../components/IconButton";

interface CharacterSelectScreenProps {
  onEnterRoom: (characterIndex: number, name: string, room: Room) => void;
}

interface CharacterPreviewProps {
  previewContainerRef: React.RefObject<HTMLDivElement>;
  onPrevious: () => void;
  onNext: () => void;
}

const CharacterPreview: React.FC<CharacterPreviewProps> = ({
  previewContainerRef,
  onPrevious,
  onNext,
}) => (
  <div className="flex flex-col items-center">
    <div className="flex items-center justify-center mb-3">
      <button
        type="button"
        className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 mr-3"
        onClick={onPrevious}
      >
        ◀
      </button>
      <div
        ref={previewContainerRef}
        style={{ width: "120px", height: "100px" }}
        className="border rounded"
      />
      <button
        type="button"
        className="px-3 py-1 rounded-md border border-gray-300 text-gray-700 hover:bg-gray-100 ml-3"
        onClick={onNext}
      >
        ▶
      </button>
    </div>
  </div>
);

interface NameInputProps {
  name: string;
  onChange: (value: string) => void;
}

const NameInput: React.FC<NameInputProps> = ({ name, onChange }) => (
  <div className="mb-4">
    <label className="block text-gray-700 text-sm font-bold mb-2">
      Enter Your Name
    </label>
    <input
      type="text"
      placeholder="Name"
      value={name}
      onChange={(e) => onChange(e.target.value)}
      className="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
    />
  </div>
);

const CharacterSelectScreen: React.FC<CharacterSelectScreenProps> = ({
  onEnterRoom,
}) => {
  const [name, setName] = useState("");
  const [newRoomTitle, setNewRoomTitle] = useState("");
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

  const handleCreateRoom = async () => {
    if (!newRoomTitle) return;
    const newRoom = await createMeeting(newRoomTitle);
    await refetch();
    onEnterRoom(currentIndex, name, {
      id: newRoom,
      title: newRoomTitle,
      created_at: new Date().toISOString(),
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="relative w-full max-w-4xl rounded-lg bg-white p-6 shadow-lg">
        {/* Modal Header */}
        <div className="flex items-center justify-between border-b pb-3">
          <h2 className="text-xl font-semibold">
            Create Your Character & Enter a Room
          </h2>
          <button
            type="button"
            className="text-gray-400 hover:text-gray-600"
            onClick={() => {
              /* Add close logic here if needed */
            }}
          >
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div
          style={{
            opacity: readyScene ? 1 : 0,
            transition: "opacity 0.5s ease-in-out",
          }}
          className="flex flex-col pt-4"
        >
          <div className="flex flex-col flex-grow">
            <div className="flex flex-grow">
              {/* Left Panel: Character and Name */}
              <div className="flex flex-col justify-center p-4 border-r w-5/12">
                <h5 className="text-center mb-4 text-lg font-medium">
                  Choose Your Character
                </h5>
                <CharacterPreview
                  previewContainerRef={previewContainerRef}
                  onPrevious={handlePrevious}
                  onNext={handleNext}
                />
              </div>

              {/* Right Panel: Room List */}
              <div className="p-4 flex flex-col w-7/12">
                <div className="flex justify-center items-center mb-4">
                  <h5 className="text-center mb-0 mr-2 text-lg font-medium">
                    Available Rooms
                  </h5>
                  <IconButton
                    onClick={refetch}
                    ActiveIcon={RefreshCw}
                    activeColor="#6c757d"
                    size={20}
                    strokeWidth={2}
                    className="w-auto px-2"
                  />
                </div>
                <div
                  style={{
                    minHeight: 0,
                    overflowY: "auto",
                    maxHeight: "300px",
                  }}
                  className="pr-2"
                >
                  {loading ? (
                    <div
                      className="flex justify-center items-center"
                      style={{ minHeight: "100px" }}
                    >
                      <LoadingSpinner message="Loading rooms..." />
                    </div>
                  ) : rooms.length > 0 ? (
                    <ul className="list-none p-0">
                      {rooms.map((room) => (
                        <li
                          key={room.id}
                          className="flex justify-between items-center border-b py-2 last:border-b-0"
                        >
                          <div>
                            <span className="font-bold">{room.title}</span>
                            <br />
                            <small className="text-gray-500">
                              {`Created at: ${new Date(
                                room.created_at
                              ).toLocaleString()}`}
                            </small>
                          </div>
                          <button
                            className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm"
                            disabled={!name}
                            onClick={() =>
                              onEnterRoom(currentIndex, name, room)
                            }
                          >
                            Enter
                          </button>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-center text-gray-500">
                      No available rooms.
                    </p>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center">
              <div className="p-4 border-r w-5/12">
                <NameInput name={name} onChange={setName} />
              </div>
              <div className="p-4 w-7/12">
                <div>
                  <div className="mb-2">
                    <label className="block text-gray-700 text-sm font-bold mb-2">
                      Create a New Room
                    </label>
                    <div className="flex">
                      <input
                        type="text"
                        placeholder="Room Title"
                        value={newRoomTitle}
                        onChange={(e) => setNewRoomTitle(e.target.value)}
                        className="appearance-none border rounded w-full py-2 px-3 text-gray-700 leading-tight focus:outline-none focus:shadow-outline"
                      />
                      <button
                        className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded ml-2"
                        disabled={!name || !newRoomTitle}
                        onClick={handleCreateRoom}
                      >
                        CREATE
                      </button>
                    </div>
                  </div>
                </div>
              </div>
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
