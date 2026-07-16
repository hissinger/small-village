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

import { RTKParticipants } from "@cloudflare/realtimekit-react";
import { useEffect, useMemo, useRef } from "react";
import { SpatialAudioRenderer } from "./SpatialAudioRenderer";
import { useRemoteParticipants } from "../context/RoomParticipantsContext";
import { useRoomContext } from "../context/RoomContext";
import { pushEvent } from "../lib/analytics";
import { ANALYTICS_EVENTS } from "../constants";

// 근접 발화 계측은 스로틀 창당 1회만 보낸다(컴포넌트가 매 렌더 실행되므로).
const PROXIMITY_THROTTLE_MS = 30_000;

interface SpatialAudioControllerProps {
  participants: RTKParticipants;
  myPosition: { x: number; y: number };
}

export function SpatialAudioController({
  participants,
  myPosition,
}: SpatialAudioControllerProps) {
  const audioContext = useMemo(() => new AudioContext(), []);
  const users = useRemoteParticipants();
  const { roomId } = useRoomContext();
  const lastSentRef = useRef(0);

  // audioTrack 이 있고 위치를 아는 원격 참가자 = "근접 발화 후보". D5 참조.
  const peerCount = useMemo(
    () =>
      [...participants.joined.values()].filter(
        (p) =>
          p.audioTrack &&
          p.customParticipantId &&
          users.get(p.customParticipantId)
      ).length,
    [participants, users]
  );

  useEffect(() => {
    if (peerCount <= 0) return;
    const now = Date.now();
    if (now - lastSentRef.current < PROXIMITY_THROTTLE_MS) return;
    lastSentRef.current = now;
    pushEvent(ANALYTICS_EVENTS.PROXIMITY_TALK, {
      room_id: roomId,
      peer_count: peerCount,
    });
  }, [peerCount, roomId]);

  return (
    <>
      {[...participants.joined.values()].map((p) => {
        if (!p.audioTrack || !p.customParticipantId) return null;

        const u = users.get(p.customParticipantId);
        if (!u) return null;

        return (
          <SpatialAudioRenderer
            key={p.audioTrack.id}
            participant={p}
            position={{ x: u.x, y: u.y }}
            myPosition={myPosition}
            audioContext={audioContext}
          />
        );
      })}
    </>
  );
}
