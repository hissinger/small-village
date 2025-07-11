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

import { useCallback } from "react";
import { Mic, MicOff } from "lucide-react";
import IconButton from "./IconButton";
import {
  useRealtimeKitMeeting,
  useRealtimeKitSelector,
} from "@cloudflare/realtimekit-react";

export default function AudioMuteButton() {
  const audioEnabled = useRealtimeKitSelector((m) => m.self.audioEnabled);
  const { meeting } = useRealtimeKitMeeting();

  const handleMuteClick = useCallback(async () => {
    if (meeting.self.audioEnabled) {
      await meeting.self.disableAudio();
    } else {
      await meeting.self.enableAudio();
    }
  }, [meeting]);

  return (
    <IconButton
      onClick={handleMuteClick}
      isActive={!audioEnabled}
      ActiveIcon={MicOff}
      InactiveIcon={Mic}
      activeColor="#dc3545"
      inactiveColor="#007bff"
      size={25}
      strokeWidth={2}
      className="ml-2.5"
    />
  );
}
