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

import { renderHook, act } from "@testing-library/react";
import { useRemoteMicStates } from "../useRemoteMicStates";
import { POLL_INTERVAL_MS } from "../../lib/speakingPeers";

// B1(기존): jest.mock 팩토리는 최상단으로 hoist 되므로 참조 변수는 `mock` 접두사가 필수.
// meeting.participants.joined 는 forEach 로 (참가자, id) 를 순회하는 Map 형태를 흉내낸다.
// 각 테스트가 원격 참가자의 audioEnabled 를 바꿔 다음 tick 반영을 검증할 수 있도록 가변으로 둔다.
let mockJoined: Map<
  string,
  { customParticipantId?: string | null; audioEnabled?: boolean }
>;

jest.mock("@cloudflare/realtimekit-react", () => ({
  // joined 를 getter 로 노출한다: 훅 effect 가 마운트 시점의 meeting 을 클로저로 캡처하므로,
  // 테스트에서 mockJoined 를 새 Map 으로 재할당해도 tick 이 항상 최신 값을 읽게 하려는 것.
  useRealtimeKitMeeting: () => ({
    meeting: {
      participants: {
        get joined() {
          return mockJoined;
        },
      },
    },
  }),
}));

beforeEach(() => {
  jest.useFakeTimers();
  // 기본: 원격 u1 마이크 on.
  mockJoined = new Map([
    ["u1", { customParticipantId: "u1", audioEnabled: true }],
  ]);
});

afterEach(() => {
  jest.useRealTimers();
});

// customParticipantId 로 audioEnabled 를 찾는 헬퍼(반환은 RtkParticipantLike[]).
const micOf = (
  list: { customParticipantId?: string | null; audioEnabled?: boolean }[],
  id: string
) => list.find((p) => p.customParticipantId === id)?.audioEnabled;

describe("useRemoteMicStates", () => {
  // (a) 초기 폴링 시점에 joined 의 audioEnabled 를 RtkParticipantLike[] 로 반환.
  it("초기 tick 에 joined 의 audioEnabled 를 RtkParticipantLike[] 로 반환한다", () => {
    const { result } = renderHook(() => useRemoteMicStates());
    expect(micOf(result.current, "u1")).toBe(true);
    expect(result.current).toHaveLength(1);
  });

  // (b) 원격 참가자 음소거 토글 시 다음 tick 에 반영.
  it("원격 참가자가 음소거하면 다음 tick 에 값이 false 로 바뀐다", () => {
    const { result } = renderHook(() => useRemoteMicStates());
    expect(micOf(result.current, "u1")).toBe(true);

    // u1 음소거 → 다음 폴링 tick 에서 갱신.
    mockJoined = new Map([
      ["u1", { customParticipantId: "u1", audioEnabled: false }],
    ]);
    act(() => {
      jest.advanceTimersByTime(POLL_INTERVAL_MS);
    });
    expect(micOf(result.current, "u1")).toBe(false);
  });

  // (c) 언마운트 시 setInterval clears.
  it("언마운트 시 setInterval 을 정리한다", () => {
    const clearSpy = jest.spyOn(global, "clearInterval");
    const { unmount } = renderHook(() => useRemoteMicStates());
    unmount();
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});
