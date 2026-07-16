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

import { buildParticipantList, RtkParticipantLike } from "./participantList";
import { User } from "../types";

// User 는 위치/타임스탬프 등 필드가 많지만 목록 병합엔 id·name 만 쓰인다.
// 테스트 가독성을 위해 최소 필드만 채우는 헬퍼.
const user = (id: string, name: string): User => ({
  id,
  name,
  character_index: 0,
  room_id: "room-1",
  x: 0,
  y: 0,
  last_active: "2026-01-01T00:00:00.000Z",
});

const SELF = { id: "me", name: "나야", audioEnabled: true };

describe("buildParticipantList", () => {
  it("원격이 없어도 self 는 항상 isMe=true 로 맨 앞에 포함된다", () => {
    const list = buildParticipantList(SELF, new Map(), [], new Set());
    expect(list).toHaveLength(1);
    expect(list[0]).toMatchObject({ id: "me", isMe: true, micOn: true });
  });

  it("원격 유저를 self 뒤에 병합한다", () => {
    const remote = new Map<string, User>([["u1", user("u1", "철수")]]);
    const list = buildParticipantList(SELF, remote, [], new Set());
    expect(list.map((p) => p.id)).toEqual(["me", "u1"]);
    expect(list[1]).toMatchObject({ id: "u1", name: "철수", isMe: false });
  });

  it("RTK 참가자와 customParticipantId 로 매칭해 micOn 을 정한다", () => {
    const remote = new Map<string, User>([["u1", user("u1", "철수")]]);
    const rtk: RtkParticipantLike[] = [
      { customParticipantId: "u1", audioEnabled: true },
    ];
    const list = buildParticipantList(SELF, remote, rtk, new Set());
    expect(list[1].micOn).toBe(true);
  });

  it("RTK 매칭 실패 시 micOn=false", () => {
    const remote = new Map<string, User>([["u1", user("u1", "철수")]]);
    const rtk: RtkParticipantLike[] = [
      { customParticipantId: "other", audioEnabled: true },
    ];
    const list = buildParticipantList(SELF, remote, rtk, new Set());
    expect(list[1].micOn).toBe(false);
  });

  it("audioEnabled=false 인 RTK 참가자는 micOn=false", () => {
    const remote = new Map<string, User>([["u1", user("u1", "철수")]]);
    const rtk: RtkParticipantLike[] = [
      { customParticipantId: "u1", audioEnabled: false },
    ];
    const list = buildParticipantList(SELF, remote, rtk, new Set());
    expect(list[1].micOn).toBe(false);
  });

  it("speaking 집합을 self·원격 모두에 반영한다", () => {
    const remote = new Map<string, User>([["u1", user("u1", "철수")]]);
    const list = buildParticipantList(SELF, remote, [], new Set(["me", "u1"]));
    expect(list[0].speaking).toBe(true);
    expect(list[1].speaking).toBe(true);
  });

  it("원격 맵에 self 와 같은 id 가 있어도 중복 없이 self 만 남긴다", () => {
    const remote = new Map<string, User>([
      ["me", user("me", "중복나")],
      ["u1", user("u1", "철수")],
    ]);
    const list = buildParticipantList(SELF, remote, [], new Set());
    expect(list.map((p) => p.id)).toEqual(["me", "u1"]);
    // self 행은 RoomContext 이름(SELF.name)을 유지한다.
    expect(list[0].name).toBe("나야");
  });
});
