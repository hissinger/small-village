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

import { RefreshCw } from "lucide-react";
import { Room } from "../types";
import IconButton from "./IconButton";
import LoadingSpinner from "./LoadingSpinner";

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
  <div className="p-4 flex flex-col w-7/12 h-full">
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
    <div className="h-[200px] overflow-y-auto pr-2 relative">
      {loading ? (
        <div className="flex items-center justify-center h-full min-h-[100px]">
          <LoadingSpinner />
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
                  {`Created at: ${new Date(room.created_at).toLocaleString()}`}
                </small>
              </div>
              <button
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-1 px-3 rounded text-sm disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-400"
                disabled={disabled}
                onClick={() => onEnterRoom(room)}
              >
                Enter
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <div className="flex flex-1 items-center justify-center min-h-[200px]">
          <p className="text-center text-gray-500">No available rooms.</p>
        </div>
      )}
    </div>
  </div>
);

export default RoomList;
