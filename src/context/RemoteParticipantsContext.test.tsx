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

import React from "react";
import { renderHook, act } from "@testing-library/react";
import {
  RemoteParticipantsProvider,
  useRemoteParticipants,
} from "./RemoteParticipantsContext";

// jest.mock 팩토리는 hoist 되므로 참조 변수는 `mock` 접두사가 필수.
// 채널 핸들러와 초기 fetch resolver 를 캡처해 테스트에서 결정적으로 발동한다.
let mockChannelCount: number;
let mockInsertCb: ((p: { new: Record<string, unknown> }) => void) | null;
let mockDeleteCb: ((p: { old: Record<string, unknown> }) => void) | null;
let mockNeqResolve: ((v: { data: unknown[]; error: unknown }) => void) | null;

jest.mock("../lib/supabaseClient", () => ({
  supabase: {
    channel: () => {
      mockChannelCount++;
      const chan: {
        on: (t: string, f: { event?: string }, cb: (p: never) => void) => unknown;
        subscribe: () => unknown;
        unsubscribe: jest.Mock;
      } = {
        on: (_t, filter, cb) => {
          if (filter?.event === "INSERT")
            mockInsertCb = cb as unknown as typeof mockInsertCb;
          if (filter?.event === "DELETE")
            mockDeleteCb = cb as unknown as typeof mockDeleteCb;
          return chan;
        },
        subscribe: () => chan,
        unsubscribe: jest.fn(),
      };
      return chan;
    },
    // 초기 fetch 체인: 마지막 neq() 가 테스트가 수동으로 resolve 하는 Promise 를 준다.
    from: () => ({
      select: () => ({
        eq: () => ({
          neq: () =>
            new Promise((res) => {
              mockNeqResolve = res as typeof mockNeqResolve;
            }),
        }),
      }),
    }),
  },
}));

jest.mock("./RoomContext", () => ({
  useRoomContext: () => ({ roomId: "room-1", userId: "me" }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <RemoteParticipantsProvider>{children}</RemoteParticipantsProvider>
);

const userRow = (id: string, name: string) => ({
  id,
  name,
  room_id: "room-1",
  character_index: 0,
  x: 0,
  y: 0,
  last_active: "2026-01-01T00:00:00.000Z",
});

beforeEach(() => {
  mockChannelCount = 0;
  mockInsertCb = null;
  mockDeleteCb = null;
  mockNeqResolve = null;
});

describe("RemoteParticipantsProvider", () => {
  it("구독 채널을 한 번만 만든다 (단일 구독)", () => {
    renderHook(() => useRemoteParticipants(), { wrapper });
    expect(mockChannelCount).toBe(1);
  });

  it("INSERT/DELETE 이벤트로 목록이 갱신된다", () => {
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    act(() => mockInsertCb!({ new: userRow("u1", "철수") }));
    expect(result.current.get("u1")?.name).toBe("철수");
    act(() => mockDeleteCb!({ old: { id: "u1" } }));
    expect(result.current.has("u1")).toBe(false);
  });

  // B1 회귀: fetch await 중 도착한 live INSERT 가 나중에 resolve 된 초기 fetch 스냅샷으로
  //          덮여 유실되면 안 된다. fetch 는 없는 id 만 보강해야 한다.
  it("초기 fetch 가 이미 들어온 live INSERT 를 덮지 않는다", async () => {
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    // fetch 가 아직 resolve 되기 전에 live INSERT 도착.
    act(() => mockInsertCb!({ new: userRow("live", "실시간") }));
    expect(result.current.get("live")?.name).toBe("실시간");

    // 이제 초기 fetch resolve — "live" 는 포함하지 않고 "other" 만.
    await act(async () => {
      mockNeqResolve!({ data: [userRow("other", "기존")], error: null });
    });
    // live 는 유지되고 other 는 보강돼야 한다.
    expect(result.current.get("live")?.name).toBe("실시간");
    expect(result.current.get("other")?.name).toBe("기존");
    expect(result.current.size).toBe(2);
  });
});
