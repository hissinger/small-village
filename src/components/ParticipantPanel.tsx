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

import { useEffect, useRef } from "react";
import { Mic, MicOff, X } from "lucide-react";
import { useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import { useRoomContext } from "../context/RoomContext";
import { useSpeakingPeers } from "../hooks/useSpeakingPeers";
import { useRemoteMicStates } from "../hooks/useRemoteMicStates";
import { buildParticipantList } from "../lib/participantList";
import { User } from "../types";

interface ParticipantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // R1: 원격 참가자 스냅샷은 BottomBar 가 useRemoteParticipants 로 1회만 구독해 넘겨준다.
  //     패널이 자체적으로 구독하지 않으므로 배지 count 와 패널 목록이 같은 스냅샷을 공유한다.
  remoteMap: Map<string, User>;
}

/**
 * 참가자 목록 패널. ChatPanel 패턴을 좌측 배치로 복제한다.
 * 각 행: 이름(+ "나") · 마이크 아이콘(Mic/MicOff) · 발화 중 하이라이트. 아바타는 v1 비포함.
 *
 * R1: 닫힌 상태에선 아예 언마운트(return null)해 하위 훅(useSpeakingPeers/RTK 셀렉터) 구독을
 *     만들지 않는다. 훅은 조건부 호출이 불가하므로, 목록·구독 계산은 열렸을 때만 마운트되는
 *     내부 ParticipantPanelBody 로 분리한다. (닫을 때 구독이 해제돼도 UX 무방.)
 */
const ParticipantPanel = ({ isOpen, onClose, remoteMap }: ParticipantPanelProps) => {
  // 닫혀 있으면 Body 를 마운트하지 않는다 → useSpeakingPeers/useRealtimeKitSelector 구독이 아예 없다.
  if (!isOpen) return null;
  return <ParticipantPanelBody onClose={onClose} remoteMap={remoteMap} />;
};

interface ParticipantPanelBodyProps {
  onClose: () => void;
  remoteMap: Map<string, User>;
}

// 열렸을 때만 마운트된다 → 발화/마이크 구독은 여기서만 산다.
const ParticipantPanelBody = ({ onClose, remoteMap }: ParticipantPanelBodyProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const { userId, userName } = useRoomContext();
  // self 마이크 상태 (AudioMuteButton 과 동일 셀렉터, 원시값 → aggregator 경로로 확실히 리렌더).
  const selfAudioEnabled = useRealtimeKitSelector((m) => m.self.audioEnabled);
  // B2/R1: 원격 마이크 상태는 폴링 훅에서 읽는다 (m.participants 셀렉터 대체 — 원격 audioUpdate 리렌더 보장).
  //        훅이 buildParticipantList 가 그대로 받는 RtkParticipantLike[] 를 반환하므로 별도 변환이 없다.
  const rtkParticipants = useRemoteMicStates();
  // PR-3 공용 훅 그대로 구독 (별도 오디오 구독을 만들지 않는다).
  const speaking = useSpeakingPeers();

  const list = buildParticipantList(
    { id: userId, name: userName, audioEnabled: selfAudioEnabled },
    remoteMap,
    rtkParticipants,
    speaking
  );

  // ChatPanel 과 동일한 바깥 클릭 닫기. (Body 는 열렸을 때만 존재하므로 isOpen 가드가 불필요.)
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [onClose]);

  return (
    <div
      ref={panelRef}
      className="fixed left-0 top-0 h-full w-[320px] bg-white shadow-lg z-50 flex flex-col"
    >
      <div className="flex justify-between items-center py-3 px-4 bg-gray-100 border-b border-gray-200">
        <h3 className="m-0 text-lg font-semibold">
          Participants ({list.length})
        </h3>
        <button
          onClick={onClose}
          className="bg-none border-none cursor-pointer p-1"
          aria-label="Close Participants"
        >
          <X size={20} />
        </button>
      </div>

      <ul className="flex-1 overflow-y-auto p-2 m-0 list-none">
        {list.map((p) => (
          <li
            key={p.id}
            className={`flex items-center justify-between px-3 py-2 rounded-lg mb-1 ${
              p.speaking ? "bg-green-100" : ""
            }`}
          >
            <span className="truncate">
              {p.name}
              {p.isMe && (
                <span className="ml-1 text-xs text-gray-500">(나)</span>
              )}
            </span>
            {p.micOn ? (
              <Mic size={18} color="#007bff" aria-label="microphone on" />
            ) : (
              <MicOff size={18} color="#dc3545" aria-label="microphone off" />
            )}
          </li>
        ))}
      </ul>
    </div>
  );
};

export default ParticipantPanel;
