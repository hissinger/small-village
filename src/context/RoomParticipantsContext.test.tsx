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
  RoomParticipantsProvider,
  useRemoteParticipants,
} from "./RoomParticipantsContext";
import { PARTICIPANT_FETCH_MAX_ATTEMPTS } from "../constants";

// jest.mock 팩토리는 hoist 되므로 참조 변수는 `mock` 접두사가 필수.
// 두 채널(데이터 postgres_changes / presence)의 핸들러와 fetch 를 캡처해 결정적으로 발동한다.
let mockChannelNames: string[];
let mockPresenceKey: string | undefined;
let mockInsertCb: ((p: { new: Record<string, unknown> }) => void) | null;
let mockUpdateCb: ((p: { new: Record<string, unknown> }) => void) | null;
let mockDeleteCb: ((p: { old: Record<string, unknown> }) => void) | null;
let mockSyncCb: (() => void) | null;
let mockPresenceState: Record<string, { user_id: string; online_at: string }[]>;
let mockRows: Record<string, Record<string, unknown>>;
let mockTrackCalls: { user_id: string }[];
let mockFetchCounts: Record<string, number>;

jest.mock("../lib/supabaseClient", () => ({
  supabase: {
    channel: (name: string, opts?: { config?: { presence?: { key?: string } } }) => {
      mockChannelNames.push(name);
      const isPresence = name.startsWith("online-users");
      if (isPresence) mockPresenceKey = opts?.config?.presence?.key;
      const chan: Record<string, unknown> = {
        on: (type: string, filter: { event?: string }, cb: (p: never) => void) => {
          if (type === "postgres_changes") {
            if (filter.event === "INSERT") mockInsertCb = cb as never;
            if (filter.event === "UPDATE") mockUpdateCb = cb as never;
            if (filter.event === "DELETE") mockDeleteCb = cb as never;
          } else if (type === "presence" && filter.event === "sync") {
            mockSyncCb = cb as never;
          }
          return chan;
        },
        subscribe: (cb?: (status: string) => void) => {
          if (isPresence && cb) cb("SUBSCRIBED");
          return chan;
        },
        unsubscribe: jest.fn(),
        track: (meta: { user_id: string }) => {
          mockTrackCalls.push(meta);
          return Promise.resolve();
        },
        presenceState: () => mockPresenceState,
      };
      return chan;
    },
    // fetch 체인: select().eq("id", id).maybeSingle() → mockRows[id] 반환.
    from: () => ({
      select: () => ({
        eq: (_col: string, id: string) => ({
          maybeSingle: () => {
            mockFetchCounts[id] = (mockFetchCounts[id] ?? 0) + 1;
            return Promise.resolve({ data: mockRows[id] ?? null, error: null });
          },
        }),
      }),
    }),
  },
}));

jest.mock("./RoomContext", () => ({
  useRoomContext: () => ({ roomId: "room-1", userId: "me" }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => (
  <RoomParticipantsProvider>{children}</RoomParticipantsProvider>
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

const presence = (...ids: string[]) => {
  const state: Record<string, { user_id: string; online_at: string }[]> = {};
  ids.forEach((id) => {
    state[id] = [{ user_id: id, online_at: "2026-01-01T00:00:00.000Z" }];
  });
  return state;
};

// presence sync 를 발동하고 그로 인한 fetch 마이크로태스크까지 흘려보낸다.
const syncTo = async (state: typeof mockPresenceState) => {
  mockPresenceState = state;
  await act(async () => {
    mockSyncCb!();
    await Promise.resolve();
    await Promise.resolve();
  });
};

beforeEach(() => {
  mockChannelNames = [];
  mockPresenceKey = undefined;
  mockInsertCb = null;
  mockUpdateCb = null;
  mockDeleteCb = null;
  mockSyncCb = null;
  mockPresenceState = {};
  mockRows = {};
  mockTrackCalls = [];
  mockFetchCounts = {};
});

describe("RoomParticipantsProvider", () => {
  it("데이터 채널 1개 + presence 채널 1개를 만들고, presence 는 key=userId 로 track 한다", () => {
    renderHook(() => useRemoteParticipants(), { wrapper });
    expect(mockChannelNames).toHaveLength(2);
    expect(mockChannelNames.some((n) => n.startsWith("online-users"))).toBe(true);
    expect(mockPresenceKey).toBe("me");
    expect(mockTrackCalls).toHaveLength(1);
    expect(mockTrackCalls[0].user_id).toBe("me");
  });

  it("presence sync 로 잡힌 멤버의 데이터를 fetch 로 채운다", async () => {
    mockRows = { u1: userRow("u1", "철수") };
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    await syncTo(presence("u1", "me"));
    expect(result.current.get("u1")?.name).toBe("철수");
  });

  // S1 회귀: INSERT 이벤트가 유실돼도(=수신 못 함) presence sync 기준으로 fetch 해 수렴해야 한다.
  it("INSERT 이벤트 유실 후에도 sync 로 기존 멤버가 채워진다", async () => {
    mockRows = { u1: userRow("u1", "철수") };
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    // INSERT 콜백은 부르지 않는다(이벤트 유실 시뮬레이션).
    await syncTo(presence("u1", "me"));
    expect(result.current.get("u1")?.name).toBe("철수");
  });

  it("멤버십은 sync 전체집합으로만 바뀐다 — 데이터만 있고 presence 멤버가 아니면 노출 안 됨", async () => {
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    // presence 에 없는 u2 의 데이터가 INSERT 로 먼저 도착.
    act(() => mockInsertCb!({ new: userRow("u2", "영희") }));
    expect(result.current.has("u2")).toBe(false); // 멤버 아님 → 감춤
    // 이후 sync 가 u2 를 멤버로 인정하면 그제야 노출.
    await syncTo(presence("u2", "me"));
    expect(result.current.get("u2")?.name).toBe("영희");
  });

  // S1 회귀 + leave 즉시제거 금지: DELETE 이벤트가 없어도 sync 에서 빠지면 제거된다.
  it("sync 집합에서 빠진 멤버는 DELETE 없이도 제거된다", async () => {
    mockRows = { u1: userRow("u1", "철수") };
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    await syncTo(presence("u1", "me"));
    expect(result.current.has("u1")).toBe(true);
    // u1 이 다음 sync 집합에서 빠짐 → 제거.
    await syncTo(presence("me"));
    expect(result.current.has("u1")).toBe(false);
  });

  it("멤버가 유지되는 sync 는 기존 멤버를 지우지 않는다", async () => {
    mockRows = { u1: userRow("u1", "철수") };
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    await syncTo(presence("u1", "me"));
    // u1 이 계속 들어있는 sync 재발 → 유지.
    await syncTo(presence("u1", "me"));
    expect(result.current.get("u1")?.name).toBe("철수");
  });

  it("UPDATE(이동) 는 기존 멤버 데이터에 반영된다", async () => {
    mockRows = { u1: userRow("u1", "철수") };
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    await syncTo(presence("u1", "me"));
    act(() =>
      mockUpdateCb!({ new: { ...userRow("u1", "철수"), x: 42, y: 7 } })
    );
    expect(result.current.get("u1")?.x).toBe(42);
  });

  it("DELETE 는 데이터를 지워 멤버여도 노출에서 빠진다", async () => {
    mockRows = { u1: userRow("u1", "철수") };
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    await syncTo(presence("u1", "me"));
    act(() => mockDeleteCb!({ old: { id: "u1" } }));
    expect(result.current.has("u1")).toBe(false);
  });

  it("useRemoteParticipants 는 self 를 제외하고 원격만 노출한다", async () => {
    mockRows = { u1: userRow("u1", "철수"), me: userRow("me", "나") };
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    await syncTo(presence("u1", "me"));
    expect(result.current.has("me")).toBe(false);
    expect(result.current.has("u1")).toBe(true);
  });

  // B1/R1 회귀: 데이터 없는 멤버(예: same-user 다중 탭에서 공유 row 삭제)를 무한 폴링하지 않고
  // 상한에서 멈춘다. presence sync 는 주기적이지 않으므로 유한 백오프로만 재시도한다.
  it("데이터 없는 멤버는 상한까지만 재시도하고 무한 폴링하지 않는다", async () => {
    jest.useFakeTimers();
    // mockRows 에 ghost 없음 → maybeSingle 은 항상 null.
    const { result, unmount } = renderHook(() => useRemoteParticipants(), {
      wrapper,
    });
    mockPresenceState = presence("ghost", "me");
    await act(async () => {
      mockSyncCb!();
      await Promise.resolve();
    });
    // 백오프 타이머를 넉넉히 흘려도 재시도는 상한에서 멈춘다.
    for (let i = 0; i < PARTICIPANT_FETCH_MAX_ATTEMPTS + 3; i++) {
      await act(async () => {
        jest.advanceTimersByTime(10_000);
        await Promise.resolve();
      });
    }
    expect(mockFetchCounts.ghost).toBe(PARTICIPANT_FETCH_MAX_ATTEMPTS);
    expect(result.current.has("ghost")).toBe(false);
    unmount();
    jest.useRealTimers();
  });
});
