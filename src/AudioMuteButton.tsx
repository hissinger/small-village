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

import { useCallback, useEffect, useState } from "react";
import { Mic, MicOff } from "lucide-react";
import { useRoomContext } from "./context/RoomContext";

export default function AudioMuteButton() {
  const [isMuted, setIsMuted] = useState(false);
  const { localAudioTrack } = useRoomContext();

  useEffect(() => {
    if (!localAudioTrack) {
      return;
    }

    setIsMuted(!localAudioTrack.enabled);
  }, [localAudioTrack]);

  const handleMuteClick = useCallback(() => {
    if (!localAudioTrack) {
      return;
    }
    setIsMuted(localAudioTrack.enabled);
    localAudioTrack.enabled = !localAudioTrack.enabled;
  }, [localAudioTrack]);

  return (
    <button
      style={{
        backgroundColor: isMuted ? "#dc3545" : "#007bff",
        color: "white",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
        margin: "0px 10px 0px 10px",
        padding: "0px 20px",
        height: "100%",
        width: "60px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
      }}
      onClick={handleMuteClick}
    >
      {isMuted ? <MicOff size={20} /> : <Mic size={20} />}
    </button>
  );
}
