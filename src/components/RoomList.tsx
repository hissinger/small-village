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
      <h2 className="text-sm font-bold uppercase tracking-wider text-stone-700">
        Available Rooms
      </h2>
      <span className="rounded-md bg-orange-100 px-1.5 py-0.5 text-xs font-semibold text-orange-700">
        {rooms.length}
      </span>
      <button
        type="button"
        aria-label="Refresh room list"
        onClick={refetch}
        className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg text-stone-500 transition-colors hover:bg-orange-50 hover:text-orange-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 focus-visible:ring-offset-1"
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
              className="flex items-center justify-between rounded-xl border border-stone-200 p-3 transition-colors hover:border-orange-300"
            >
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-stone-800">
                    {room.title}
                  </span>
                  <span className="inline-flex shrink-0 items-center gap-1 rounded-md bg-emerald-100 px-1.5 py-0.5 text-xs font-medium text-emerald-700">
                    <Users size={12} strokeWidth={2.5} />
                    Open
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-stone-500">
                  {`Created ${new Date(room.created_at).toLocaleString()}`}
                </p>
              </div>
              <button
                className="ml-3 shrink-0 rounded-lg bg-orange-700 px-3 py-1.5 text-sm font-semibold text-white transition-colors hover:bg-orange-800 active:bg-orange-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orange-400/60 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:bg-stone-300 disabled:hover:bg-stone-300"
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
          <p className="text-sm text-stone-500">The village is quiet</p>
        </div>
      )}
    </div>
  </div>
);

export default RoomList;
