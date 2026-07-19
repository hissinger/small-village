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

import { useState } from "react";
import { Room } from "../types";
import { createMeeting } from "../lib/supabaseFunctions";
import { pushEvent } from "../lib/analytics";
import { ANALYTICS_EVENTS } from "../constants";
import { DEFAULT_MAP, MAP_LABELS, MAPS, MapKind } from "../lib/mapKind";

interface CreateNewRoomProps {
  disabled: boolean;
  onEnterRoom: (room: Room) => void;
  roomCount: number;
}

const CreateNewRoom: React.FC<CreateNewRoomProps> = ({
  disabled,
  onEnterRoom,
  roomCount,
}) => {
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [mapKind, setMapKind] = useState<MapKind>(DEFAULT_MAP);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreateRoom = async (e: React.FormEvent) => {
    e.preventDefault();
    const title = newRoomTitle.trim();
    if (!title || isCreating) return;

    setIsCreating(true);
    try {
      const newRoom = await createMeeting(title, mapKind);
      // 비공개 방 개념이 아직 스키마에 없다(모든 방 public). 도입 시 이 값을 확장한다.
      pushEvent(ANALYTICS_EVENTS.ROOM_CREATED, { is_public: true, map: mapKind });
      onEnterRoom({
        id: newRoom,
        title,
        created_at: new Date().toISOString(),
        map: mapKind,
      });
    } finally {
      setIsCreating(false);
    }
  };

  // When there are no rooms yet, nudge the user with a solid primary button;
  // otherwise keep it as a quieter outline action next to the list.
  const isPrimary = roomCount === 0;
  const buttonTone = isPrimary
    ? "bg-orange-700 text-white hover:bg-orange-800 active:bg-orange-900"
    : "border border-orange-400/70 text-orange-200 hover:bg-white/10";

  return (
    <form onSubmit={handleCreateRoom}>
      <label
        htmlFor="room-title"
        className="mb-2 block text-sm font-bold uppercase tracking-wider text-stone-100"
      >
        Create a New Room
      </label>

      {/* 맵 선택(방별 고정): 같은 방 참가자는 모두 이 맵을 쓴다. */}
      <div className="mb-2 flex items-center gap-2">
        <span className="text-xs font-medium text-stone-300">Map</span>
        <div
          role="group"
          aria-label="Map"
          className="inline-flex overflow-hidden rounded-lg border border-white/15"
        >
          {(Object.values(MAPS) as MapKind[]).map((m) => (
            <button
              key={m}
              type="button"
              aria-pressed={mapKind === m}
              onClick={() => setMapKind(m)}
              className={`px-3 py-1 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 ${
                mapKind === m
                  ? "bg-orange-700 text-white"
                  : "bg-stone-800/60 text-stone-300 hover:bg-white/10"
              }`}
            >
              {MAP_LABELS[m]}
            </button>
          ))}
        </div>
      </div>

      <div className="flex gap-2">
        <input
          id="room-title"
          type="text"
          placeholder="Room title"
          value={newRoomTitle}
          maxLength={30}
          onChange={(e) => setNewRoomTitle(e.target.value)}
          className="w-full rounded-xl border border-stone-900/10 bg-[#fffdf7] px-3 py-2 text-stone-800 placeholder:text-stone-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
        />
        <button
          type="submit"
          className={`shrink-0 rounded-lg px-4 py-2 text-sm font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:border-transparent disabled:bg-stone-700/50 disabled:text-white/70 disabled:hover:bg-stone-700/50 ${buttonTone}`}
          disabled={disabled || !newRoomTitle.trim() || isCreating}
        >
          {isCreating ? "Creating..." : "Create"}
        </button>
      </div>
    </form>
  );
};

export default CreateNewRoom;
