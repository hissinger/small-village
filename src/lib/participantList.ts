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

import { User } from "../types";

// 참가자 패널 한 행에 필요한 최소 정보.
export interface ParticipantEntry {
  id: string;
  name: string;
  isMe: boolean;
  micOn: boolean;
  speaking: boolean;
}

// 나(self) 정보. 이름은 RoomContext, 마이크 상태는 RTK self.audioEnabled 에서 온다.
export interface ParticipantSelf {
  id: string;
  name: string;
  audioEnabled: boolean;
}

// buildParticipantList 가 필요로 하는 RTK 참가자의 최소 형태.
// (RealtimeKit RTKParticipant 를 구조적으로 수용 — 테스트에선 이 형태만 흉내내면 된다.)
export interface RtkParticipantLike {
  customParticipantId?: string | null;
  audioEnabled?: boolean;
}

/**
 * self + 원격 유저 + RTK 마이크 상태 + 발화 집합을 하나의 참가자 목록으로 병합한다.
 * 순수 함수 — React/RealtimeKit 에 의존하지 않아 Jest 로 단위테스트한다.
 *
 *  - self 는 항상 목록 맨 앞에 1번 포함되고 isMe=true.
 *  - 원격 유저의 마이크 상태는 customParticipantId === user.id 로 매칭한다.
 *    매칭되는 RTK 참가자가 없으면 micOn=false (아직 오디오 연결 전이거나 트랙 없음).
 *  - speaking 은 공용 훅(useSpeakingPeers)이 넘겨준 집합으로만 판정한다.
 *  - 원격 맵에 self 와 같은 id 가 섞여 있어도 중복 없이 self 만 남긴다.
 */
export function buildParticipantList(
  self: ParticipantSelf,
  remoteMap: Map<string, User>,
  rtkParticipants: RtkParticipantLike[],
  speakingIds: Set<string>
): ParticipantEntry[] {
  // customParticipantId → audioEnabled 조회 테이블.
  const micById = new Map<string, boolean>();
  rtkParticipants.forEach((p) => {
    if (p.customParticipantId) {
      micById.set(p.customParticipantId, p.audioEnabled === true);
    }
  });

  const seen = new Set<string>([self.id]);
  const list: ParticipantEntry[] = [
    {
      id: self.id,
      name: self.name,
      isMe: true,
      micOn: self.audioEnabled,
      speaking: speakingIds.has(self.id),
    },
  ];

  remoteMap.forEach((u) => {
    if (seen.has(u.id)) return; // self 또는 이미 추가한 id 는 건너뛴다.
    seen.add(u.id);
    list.push({
      id: u.id,
      name: u.name,
      isMe: false,
      micOn: micById.get(u.id) ?? false,
      speaking: speakingIds.has(u.id),
    });
  });

  return list;
}
