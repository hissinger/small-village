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
import { subscribePositions } from "../lib/positionChannel";
import { useRoomContext } from "../context/RoomContext";
import { POSITION_STREAM_THROTTLE_MS } from "../constants";

export interface Position {
  x: number;
  y: number;
}

/**
 * 방의 위치 broadcast 스트림을 React state 로 노출한다(공간오디오 전용).
 *
 * 씬은 broadcast 를 매 메시지 직접 받지만(React 미경유), 공간오디오는 React 라
 * 여기서 소비한다. 이동은 고빈도라 매 메시지 setState 하면 오디오 서브트리가 폭주하므로,
 * ref 에 최신값을 모아 `POSITION_STREAM_THROTTLE_MS` 마다 한 번만 flush 한다.
 *
 * `broadcast.self=true` 라 내 위치도 이 맵에 포함된다(myPosition 소스). 로스터(useRemoteParticipants)와
 * 달리 self 를 제외하지 않는다.
 */
export const useRemotePositions = (): Map<string, Position> => {
  const { roomId } = useRoomContext();
  const [positions, setPositions] = useState<Map<string, Position>>(
    () => new Map()
  );
  const dataRef = useRef<Map<string, Position>>(new Map());
  const dirtyRef = useRef(false);

  useEffect(() => {
    if (!roomId) return;

    const unsubscribe = subscribePositions(roomId, (p) => {
      dataRef.current.set(p.id, { x: p.x, y: p.y });
      dirtyRef.current = true;
    });

    // 수신은 ref 에 모으고, 변경이 있을 때만 주기적으로 state 로 flush(리렌더 묶기).
    const interval = setInterval(() => {
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      setPositions(new Map(dataRef.current));
    }, POSITION_STREAM_THROTTLE_MS);

    return () => {
      unsubscribe();
      clearInterval(interval);
    };
  }, [roomId]);

  return positions;
};