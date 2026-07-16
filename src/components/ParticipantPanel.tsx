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

import React, { useEffect, useRef, useState } from "react";
import { Mic, MicOff, X } from "lucide-react";
import { useRealtimeKitSelector } from "@cloudflare/realtimekit-react";
import { useRoomContext } from "../context/RoomContext";
import { useSpeakingPeers } from "../hooks/useSpeakingPeers";
import { useRemoteMicStates } from "../hooks/useRemoteMicStates";
import { buildParticipantList } from "../lib/participantList";
import CharacterAvatar from "./CharacterAvatar";
import { User } from "../types";

interface ParticipantPanelProps {
  isOpen: boolean;
  onClose: () => void;
  // R1: 원격 참가자 스냅샷은 BottomBar 가 useRemoteParticipants 로 1회만 구독해 넘겨준다.
  //     패널이 자체적으로 구독하지 않으므로 배지 count 와 패널 목록이 같은 스냅샷을 공유한다.
  remoteMap: Map<string, User>;
}

/**
 * 참가자 목록 패널. ChatPanel 패턴을 좌측 배치로 복제한다 — 좌측 슬라이드 인/아웃 애니메이션.
 * 각 행: 캐릭터 상체 아바타 · 이름(+ "나") · 마이크 아이콘(Mic/MicOff) · 발화 중 하이라이트.
 *
 * 애니메이션 vs R1(닫힘 시 구독 해제)을 함께 만족시키는 구조:
 *   - 바깥 슬라이드 컨테이너는 항상 마운트한다 (transform 트랜지션만, 훅 없음 → 구독 0).
 *   - 하위 훅(useSpeakingPeers/RTK 셀렉터/폴링)을 가진 Body 는 "열려 있는 동안 + 슬라이드 아웃
 *     애니메이션이 끝날 때까지"만 마운트한다. 닫힘 트랜지션 종료(onTransitionEnd) 후 언마운트해
 *     구독을 해제한다. (슬라이드 아웃 ~300ms 동안 구독이 남아도 UX 무방.)
 */
const ParticipantPanel = ({ isOpen, onClose, remoteMap }: ParticipantPanelProps) => {
  const panelRef = useRef<HTMLDivElement>(null);
  // 슬라이드 아웃 애니메이션 동안 Body 를 유지하려는 마운트 상태. 열리면 즉시 true.
  const [bodyMounted, setBodyMounted] = useState(isOpen);

  useEffect(() => {
    if (isOpen) setBodyMounted(true);
  }, [isOpen]);

  // 닫힘 트랜지션이 끝나면 Body 를 언마운트해 하위 훅 구독을 해제한다 (R1).
  // 컨테이너 자신의 트랜지션만 본다(target === currentTarget) — 자식에서 버블링된
  // transitionend 로 슬라이드 아웃 중 Body 가 조기 언마운트되는 것을 막는다.
  // (컨테이너는 transition-transform 만 가지므로 property 종류 확인은 불필요.)
  const handleTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.target !== e.currentTarget) return;
    if (!isOpen) setBodyMounted(false);
  };

  // ChatPanel 과 동일한 바깥 클릭 닫기 — 열려 있을 때만 리스너를 건다.
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (event: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  return (
    <div
      ref={panelRef}
      onTransitionEnd={handleTransitionEnd}
      className={`fixed left-0 top-0 h-full w-[320px] bg-white shadow-lg transition-transform duration-300 ease-in-out z-50 flex flex-col ${
        isOpen ? "translate-x-0" : "-translate-x-full"
      }`}
    >
      {bodyMounted && <ParticipantPanelBody onClose={onClose} remoteMap={remoteMap} />}
    </div>
  );
};

interface ParticipantPanelBodyProps {
  onClose: () => void;
  remoteMap: Map<string, User>;
}

// 열려 있는 동안(+슬라이드 아웃 중)에만 마운트된다 → 발화/마이크 구독은 여기서만 산다.
const ParticipantPanelBody = ({ onClose, remoteMap }: ParticipantPanelBodyProps) => {
  const { userId, userName, characterIndex } = useRoomContext();
  // self 마이크 상태 (AudioMuteButton 과 동일 셀렉터, 원시값 → aggregator 경로로 확실히 리렌더).
  const selfAudioEnabled = useRealtimeKitSelector((m) => m.self.audioEnabled);
  // B2/R1: 원격 마이크 상태는 폴링 훅에서 읽는다 (m.participants 셀렉터 대체 — 원격 audioUpdate 리렌더 보장).
  //        훅이 buildParticipantList 가 그대로 받는 RtkParticipantLike[] 를 반환하므로 별도 변환이 없다.
  const rtkParticipants = useRemoteMicStates();
  // PR-3 공용 훅 그대로 구독 (별도 오디오 구독을 만들지 않는다).
  const speaking = useSpeakingPeers();

  const list = buildParticipantList(
    { id: userId, name: userName, audioEnabled: selfAudioEnabled, characterIndex },
    remoteMap,
    rtkParticipants,
    speaking
  );

  return (
    <>
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
            <span className="flex items-center gap-2 min-w-0">
              <CharacterAvatar characterIndex={p.characterIndex} scale={1.5} />
              <span className="truncate">
                {p.name}
                {p.isMe && (
                  <span className="ml-1 text-xs text-gray-500">(나)</span>
                )}
              </span>
            </span>
            {p.micOn ? (
              <Mic
                size={22}
                color="#007bff"
                aria-label="microphone on"
                className="flex-shrink-0"
              />
            ) : (
              <MicOff
                size={22}
                color="#dc3545"
                aria-label="microphone off"
                className="flex-shrink-0"
              />
            )}
          </li>
        ))}
      </ul>
    </>
  );
};

export default ParticipantPanel;
