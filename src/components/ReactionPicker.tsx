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
import { Smile } from "lucide-react";
import {
  useMessage,
  MessageType,
  CHANNEL_MESSAGE,
  RECEIVER_ALL,
} from "../context/MessageContext";
import { useRoomContext } from "../context/RoomContext";
import { REACTION_EMOJIS } from "../constants";
import IconButton from "./IconButton";

export default function ReactionPicker() {
  const [open, setOpen] = useState(false);
  const { sendMessage } = useMessage();
  const { userId } = useRoomContext();

  const sendReaction = (emoji: string) => {
    sendMessage(CHANNEL_MESSAGE, {
      type: MessageType.REACTION,
      sender_id: userId,
      receiver_id: RECEIVER_ALL,
      body: emoji,
      timestamp: new Date().toISOString(),
    });
    setOpen(false);
  };

  return (
    <div className="relative">
      <IconButton
        onClick={() => setOpen(!open)}
        ariaLabel="Toggle Reactions"
        ActiveIcon={Smile}
        activeColor="#FFB400"
        size={25}
        strokeWidth={2}
      />
      {open && (
        <div className="absolute bottom-12 right-0 flex flex-wrap gap-1 bg-white p-2 rounded-lg shadow-lg w-[180px]">
          {REACTION_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              aria-label={`reaction-${emoji}`}
              onClick={() => sendReaction(emoji)}
              className="text-2xl hover:scale-110 transition-transform"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
