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

interface CreateNewRoomProps {
  disabled: boolean;
  onEnterRoom: (room: Room) => void;
}

const CreateNewRoom: React.FC<CreateNewRoomProps> = ({
  disabled,
  onEnterRoom,
}) => {
  const [newRoomTitle, setNewRoomTitle] = useState("");

  const handleCreateRoom = async () => {
    if (!newRoomTitle) return;
    const newRoom = await createMeeting(newRoomTitle);

    onEnterRoom({
      id: newRoom,
      title: newRoomTitle,
      created_at: new Date().toISOString(),
    });
  };

  return (
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
              className="bg-green-500 hover:bg-green-700 text-white font-bold py-2 px-4 rounded ml-2 disabled:bg-gray-400 disabled:cursor-not-allowed disabled:hover:bg-gray-400"
              disabled={disabled || !newRoomTitle}
              onClick={handleCreateRoom}
            >
              CREATE
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CreateNewRoom;
