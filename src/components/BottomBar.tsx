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

import ExitButton from "./ExitButton";
import AudioMuteButton from "./AudioMuteButton";
import AudioInputSelect from "./AudioInputSelect";
import { useState } from "react";
import ChatPanel from "./ChatPanel";
import ParticipantPanel from "./ParticipantPanel";
import { MessageCircle, Users } from "lucide-react";
import IconButton from "./IconButton";
import { BOTTOM_BAR_HEIGHT } from "../constants";
import { useRemoteParticipants } from "../context/RemoteParticipantsContext";

interface BottomBarProps {
  userId: string;
  onExit: () => void;
}

export default function BottomBar(props: BottomBarProps) {
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [isParticipantsOpen, setIsParticipantsOpen] = useState(false);
  // R1: 원격 참가자를 이 트리에서 1회만 구독하고, 배지 count 와 패널 목록이 같은 스냅샷을 쓰게 한다.
  //     (useRemoteParticipants 는 self 를 이미 제외하므로 배지 = size + 1.)
  const remoteParticipants = useRemoteParticipants();
  const participantCount = remoteParticipants.size + 1;

  return (
    <div>
      <ChatPanel isOpen={isChatOpen} onClose={() => setIsChatOpen(false)} />
      <ParticipantPanel
        isOpen={isParticipantsOpen}
        onClose={() => setIsParticipantsOpen(false)}
        remoteMap={remoteParticipants}
      />
      <div
        className="fixed bottom-0 left-0 w-full flex justify-end bg-white p-2.5"
        style={{ height: BOTTOM_BAR_HEIGHT }}
      >
        <AudioInputSelect />

        <div className="relative">
          <IconButton
            onClick={() => setIsParticipantsOpen(!isParticipantsOpen)}
            ariaLabel="Toggle Participants"
            ActiveIcon={Users}
            activeColor="#4CAF50"
            size={25}
            strokeWidth={2}
          />
          <span
            className="absolute top-0 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] leading-4 text-center pointer-events-none"
            data-testid="participant-count-badge"
            aria-label={`참가자 ${participantCount}명`}
          >
            {participantCount}
          </span>
        </div>

        <IconButton
          onClick={() => setIsChatOpen(!isChatOpen)}
          ariaLabel="Toggle Chat"
          ActiveIcon={MessageCircle}
          activeColor="#4CAF50"
          size={25}
          strokeWidth={2}
        />

        <AudioMuteButton />
        <ExitButton onClick={props.onExit} />
      </div>
    </div>
  );
}
