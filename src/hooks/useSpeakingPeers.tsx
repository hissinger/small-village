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

import { useEffect, useRef, useState } from "react";
import { useRealtimeKitMeeting } from "@cloudflare/realtimekit-react";
import {
  SPEAKING_TIMEOUT_MS,
  addSpeaking,
  pruneStale,
  resolveSpeakingUserId,
} from "../lib/speakingPeers";

// 무이벤트 id 를 정리하는 주기(ms). RTK 는 발화 "멈춤" 이벤트가 없어 폴링으로 끈다.
const PRUNE_INTERVAL_MS = 200;

/**
 * RTK `activeSpeaker` 이벤트를 구독해 "지금 말하는 userId 집합" 을 돌려준다.
 * - peerId → users.id(customParticipantId) 해석은 resolveSpeakingUserId 사용.
 * - self 는 meeting.self, 원격은 meeting.participants.joined 에서 해석한다.
 * - 음소거(audioEnabled === false) 참가자는 집합에 넣지 않는다.
 * - 마지막 이벤트 후 SPEAKING_TIMEOUT_MS 지나면 setInterval 로 자동 제거.
 */
export function useSpeakingPeers(): Set<string> {
  const { meeting } = useRealtimeKitMeeting();
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const stateRef = useRef<Set<string>>(new Set());
  const lastSeenRef = useRef<Record<string, number>>({});

  useEffect(() => {
    if (!meeting) return;

    // userId(customParticipantId) 로 음소거 여부 확인. self/원격 모두 검사.
    const isMuted = (userId: string): boolean => {
      if (meeting.self.customParticipantId === userId) {
        return meeting.self.audioEnabled === false;
      }
      const remote = Array.from(meeting.participants.joined.values()).find(
        (p) => p.customParticipantId === userId
      );
      return remote ? remote.audioEnabled === false : false;
    };

    const handleActiveSpeaker = ({ peerId }: { peerId: string; volume: number }) => {
      const userId = resolveSpeakingUserId(
        peerId,
        meeting.participants,
        meeting.self
      );
      if (!userId) return; // 미해결 peerId
      if (isMuted(userId)) return; // 음소거는 링 표시 안 함

      const prev = stateRef.current;
      const next = addSpeaking(
        prev,
        lastSeenRef.current,
        userId,
        Date.now()
      );
      stateRef.current = next.state;
      lastSeenRef.current = next.lastSeen;
      // membership(집합 내용)이 바뀔 때만 리렌더한다. activeSpeaker 는 발화 중
      // 초당 수회 오므로 매번 setState 하면 SpeakerIndicators effect 가 계속
      // 재실행되는 churn 이 생긴다. lastSeen 갱신(debounce)은 ref 로 충분하다.
      if (next.state.size !== prev.size) {
        setSpeaking(next.state);
      }
    };

    meeting.participants.on("activeSpeaker", handleActiveSpeaker);

    const interval = setInterval(() => {
      const next = pruneStale(
        stateRef.current,
        lastSeenRef.current,
        Date.now(),
        SPEAKING_TIMEOUT_MS
      );
      lastSeenRef.current = next.lastSeen;
      // 크기가 줄었을 때만(=누군가 멈춤) 리렌더한다.
      if (next.state.size !== stateRef.current.size) {
        stateRef.current = next.state;
        setSpeaking(next.state);
      }
    }, PRUNE_INTERVAL_MS);

    return () => {
      meeting.participants.off("activeSpeaker", handleActiveSpeaker);
      clearInterval(interval);
    };
  }, [meeting]);

  return speaking;
}
