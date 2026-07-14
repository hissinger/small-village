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

import { RefreshCw, Users } from "lucide-react";
import { Room } from "../types";
import LoadingSpinner from "./LoadingSpinner";
import PixelHouse from "./PixelHouse";

interface RoomListProps {
  disabled: boolean;
  rooms: Room[];
  onEnterRoom: (room: Room) => void;
  loading: boolean;
  refetch: () => Promise<void>;
}

const RoomList: React.FC<RoomListProps> = ({
  disabled,
  rooms,
  onEnterRoom,
  loading,
  refetch,
}: RoomListProps) => (
  <div className="flex flex-col">
    <div className="mb-4 flex items-center gap-2">
      <span className="flex h-5 w-5 items-center justify-center rounded-md bg-orange-700 text-xs text-white sv-font-pixel">
        2
      </span>
      <h2 className="text-sm font-bold uppercase tracking-wider text-stone-100">
        Available Rooms
      </h2>
      <span className="rounded-md bg-orange-500/25 px-1.5 py-0.5 text-xs font-semibold text-orange-100">
        {rooms.length}
      </span>
      <button
        type="button"
        aria-label="Refresh room list"
        onClick={refetch}
        className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-white/70 transition-colors hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 focus-visible:ring-offset-1 focus-visible:ring-offset-transparent"
      >
        <RefreshCw size={18} className={loading ? "animate-spin" : ""} />
      </button>
    </div>
    <div className="relative h-[200px] overflow-y-auto pr-1">
      {loading ? (
        <div className="flex h-full min-h-[100px] items-center justify-center">
          <LoadingSpinner />
        </div>
      ) : rooms.length > 0 ? (
        <ul className="flex list-none flex-col gap-2 p-0">
          {rooms.map((room) => (
            <li
              key={room.id}
              className="flex items-center justify-between rounded-xl border border-stone-900/10 bg-white/80 p-3 shadow-sm backdrop-blur-[2px] transition-colors hover:border-orange-500 hover:bg-white/90"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-stone-800">
                    {room.title}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-500/15 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                    <Users size={12} strokeWidth={2.5} />
                    Open
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-stone-500">
                  {`Created ${new Date(room.created_at).toLocaleString()}`}
                </p>
              </div>
              <button
                className="ml-3 shrink-0 rounded-lg bg-orange-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-orange-800 active:bg-orange-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-stone-200 disabled:text-stone-400 disabled:hover:bg-stone-200"
                disabled={disabled}
                onClick={() => onEnterRoom(room)}
              >
                Join
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 text-center">
          <PixelHouse size={72} />
          <p className="rounded-full bg-black/30 px-3 py-1 text-sm font-medium text-white">
            The village is quiet
          </p>
        </div>
      )}
    </div>
  </div>
);

export default RoomList;
