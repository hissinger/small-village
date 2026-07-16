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
import { POLL_INTERVAL_MS } from "../lib/speakingPeers";

// 마이크 상태 맵이 실제로 바뀌었는지 비교(내용 동등성). 바뀔 때만 리렌더한다.
function micStatesEqual(
  a: Map<string, boolean>,
  b: Map<string, boolean>
): boolean {
  if (a.size !== b.size) return false;
  for (const [id, on] of a) {
    if (b.get(id) !== on) return false;
  }
  return true;
}

/**
 * "원격 참가자별 마이크 on/off(audioEnabled)" 를 customParticipantId 별로 폴링해
 * Map<customParticipantId, audioEnabled> 로 돌려준다.
 *
 *  - 왜 폴링인가: `useRealtimeKitSelector((m) => m.participants)` 는 안정 참조 객체라
 *    원격 audioUpdate 로 리렌더되지 않을 수 있다(저장소에 원격 audioEnabled 를 selector 로
 *    소비하는 선례가 없음). useSpeakingPeers 와 같은 setInterval 폴링으로 audioEnabled 를
 *    직접 읽어 리렌더를 결정적으로 보장한다(AC2 결정적 검증).
 *  - 범위: audioEnabled(마이크 on/off)만 읽는다. 발화 볼륨 측정(AudioContext/analyser)은
 *    useSpeakingPeers 담당이며 여기선 하지 않는다.
 *  - self 는 제외한다(패널은 self 마이크를 m.self.audioEnabled 로 별도 구독). 원격만 담는다.
 *  - 맵 내용이 바뀔 때만 리렌더한다(폴링 tick 마다 setState 하지 않음).
 */
export function useRemoteMicStates(): Map<string, boolean> {
  const { meeting } = useRealtimeKitMeeting();
  const [micStates, setMicStates] = useState<Map<string, boolean>>(new Map());
  const micStatesRef = useRef<Map<string, boolean>>(new Map());

  useEffect(() => {
    if (!meeting) return;

    const tick = () => {
      // 원격 참가자(joined)의 customParticipantId → audioEnabled 스냅샷.
      const next = new Map<string, boolean>();
      meeting.participants.joined.forEach((p) => {
        if (p.customParticipantId) {
          next.set(p.customParticipantId, p.audioEnabled === true);
        }
      });

      // 내용이 바뀐 경우에만 리렌더.
      if (!micStatesEqual(next, micStatesRef.current)) {
        micStatesRef.current = next;
        setMicStates(next);
      }
    };

    tick(); // 초기 1회 즉시 반영.
    const interval = setInterval(tick, POLL_INTERVAL_MS);
    return () => clearInterval(interval);
  }, [meeting]);

  return micStates;
}
