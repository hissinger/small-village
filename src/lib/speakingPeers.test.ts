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

import {
  ParticipantLike,
  ParticipantsLike,
  addSpeaking,
  pruneStale,
  resolveSpeakingUserId,
} from "./speakingPeers";

describe("resolveSpeakingUserId", () => {
  const self: ParticipantLike = {
    id: "self-peer",
    customParticipantId: "self-user",
  };
  const participants: ParticipantsLike = {
    joined: new Map<string, ParticipantLike>([
      ["remote-peer", { id: "remote-peer", customParticipantId: "remote-user" }],
    ]),
  };

  it("원격 joined 피어를 customParticipantId 로 해석한다", () => {
    expect(resolveSpeakingUserId("remote-peer", participants, self)).toBe(
      "remote-user"
    );
  });

  it("self 분기: peerId === self.id 이면 self.customParticipantId 를 돌려준다", () => {
    expect(resolveSpeakingUserId("self-peer", participants, self)).toBe(
      "self-user"
    );
  });

  it("모르는 피어는 null(미해결)", () => {
    expect(resolveSpeakingUserId("unknown-peer", participants, self)).toBeNull();
  });

  it("customParticipantId 가 없으면 null", () => {
    const selfNoCpid: ParticipantLike = { id: "self-peer" };
    const noCpid: ParticipantsLike = {
      joined: new Map<string, ParticipantLike>([
        ["remote-peer", { id: "remote-peer" }],
      ]),
    };
    expect(resolveSpeakingUserId("self-peer", noCpid, selfNoCpid)).toBeNull();
    expect(resolveSpeakingUserId("remote-peer", noCpid, selfNoCpid)).toBeNull();
  });
});

describe("debounce 리듀서 (addSpeaking / pruneStale)", () => {
  it("addSpeaking 은 id 를 추가하고 마지막 시각을 기록한다", () => {
    const { state, lastSeen } = addSpeaking(new Set(), {}, "u1", 1000);
    expect(state.has("u1")).toBe(true);
    expect(lastSeen["u1"]).toBe(1000);
  });

  it("타임아웃 전에는 유지된다", () => {
    const { state, lastSeen } = addSpeaking(new Set(), {}, "u1", 1000);
    // 500ms 경과 (< 800ms)
    const pruned = pruneStale(state, lastSeen, 1500, 800);
    expect(pruned.state.has("u1")).toBe(true);
    expect(pruned.lastSeen["u1"]).toBe(1000);
  });

  it("타임아웃 경과 후에는 제거된다", () => {
    const { state, lastSeen } = addSpeaking(new Set(), {}, "u1", 1000);
    // 1000ms 경과 (>= 800ms)
    const pruned = pruneStale(state, lastSeen, 2000, 800);
    expect(pruned.state.has("u1")).toBe(false);
    expect(pruned.lastSeen["u1"]).toBeUndefined();
  });

  it("재발화(addSpeaking 재호출) 하면 타이머가 리셋된다", () => {
    let acc = addSpeaking(new Set(), {}, "u1", 1000);
    // 700ms 시점에 다시 발화 → lastSeen 갱신
    acc = addSpeaking(acc.state, acc.lastSeen, "u1", 1700);
    // 원래 시작(1000)으로부터 1000ms 지난 2000ms 지만, 갱신(1700) 기준 300ms 뿐
    const pruned = pruneStale(acc.state, acc.lastSeen, 2000, 800);
    expect(pruned.state.has("u1")).toBe(true);
  });

  it("여러 id 중 오래된 것만 제거한다", () => {
    let acc = addSpeaking(new Set(), {}, "old", 1000);
    acc = addSpeaking(acc.state, acc.lastSeen, "fresh", 1900);
    const pruned = pruneStale(acc.state, acc.lastSeen, 2000, 800);
    expect(pruned.state.has("old")).toBe(false); // 1000ms 경과
    expect(pruned.state.has("fresh")).toBe(true); // 100ms 경과
  });
});
