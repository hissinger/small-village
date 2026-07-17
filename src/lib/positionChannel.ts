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

import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "./supabaseClient";

/**
 * 고빈도 위치(x/y) 전용 broadcast 채널.
 *
 * 설계(docs/roster-position-split-plan.md, PR-1):
 * - 위치는 fire-and-forget broadcast 로 흘린다 — DB 왕복 없음. 멤버십은 여전히 `users` 테이블.
 * - 방(roomId)별로 채널 하나. 씬(무 throttle)과 useRemotePositions 훅(throttle)이 **한 채널을 공유**하므로
 *   로컬 구독자를 ref-count 해 **마지막 구독자가 떠날 때만** 실제 unsubscribe 한다(먼저 정리되는 쪽이
 *   남은 소비자의 스트림을 끊지 않게).
 * - `broadcast.self=true`: 내 위치도 되받아 공간오디오(myPosition)가 같은 스트림으로 소비한다.
 *   자기 스프라이트를 그리는 씬은 자기 id 를 무시한다.
 */

export interface PositionUpdate {
  id: string;
  x: number;
  y: number;
}

const POSITION_EVENT = "position";

interface RoomChannel {
  channel: RealtimeChannel;
  listeners: Set<(p: PositionUpdate) => void>;
}

const rooms = new Map<string, RoomChannel>();

function getOrCreate(roomId: string): RoomChannel {
  const existing = rooms.get(roomId);
  if (existing) return existing;

  const listeners = new Set<(p: PositionUpdate) => void>();
  const channel = supabase
    .channel(`position-${roomId}`, { config: { broadcast: { self: true } } })
    .on("broadcast", { event: POSITION_EVENT }, ({ payload }) => {
      listeners.forEach((cb) => cb(payload as PositionUpdate));
    })
    .subscribe();

  const rc: RoomChannel = { channel, listeners };
  rooms.set(roomId, rc);
  return rc;
}

/**
 * 방의 위치 broadcast 를 구독한다. 반환된 함수로 해제하며, 마지막 구독자가 해제하면
 * 실제 채널을 unsubscribe 한다(ref-count).
 */
export function subscribePositions(
  roomId: string,
  cb: (p: PositionUpdate) => void
): () => void {
  const rc = getOrCreate(roomId);
  rc.listeners.add(cb);

  return () => {
    rc.listeners.delete(cb);
    if (rc.listeners.size === 0) {
      rc.channel.unsubscribe();
      rooms.delete(roomId);
    }
  };
}

/**
 * 내 위치를 방에 방송한다. fire-and-forget — 프레임을 막지 않도록 await 하지 않는다.
 * 채널이 아직 없으면(구독 전) 조용히 무시한다.
 */
export function sendPosition(roomId: string, update: PositionUpdate): void {
  const rc = rooms.get(roomId);
  if (!rc) return;
  rc.channel.send({
    type: "broadcast",
    event: POSITION_EVENT,
    payload: update,
  });
}
