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
import {
  RECONCILE_INTERVAL_MS,
  ROSTER_STALE_SWEEP_INTERVAL_MS,
  ROSTER_STALE_TIMEOUT_MS,
} from "../constants";

// jest.mock 팩토리는 hoist 되므로 참조 변수는 `mock` 접두사 필수.
let mockChannelCount: number;
let mockInsertCb: ((p: { new: Record<string, unknown> }) => void) | null;
let mockUpdateCb: ((p: { new: Record<string, unknown> }) => void) | null;
let mockDeleteCb: ((p: { old: Record<string, unknown> }) => void) | null;
// reconcile fetch(방 전체 재조회)가 돌려줄 row 들.
let mockRoomRows: Record<string, unknown>[];

jest.mock("../lib/supabaseClient", () => ({
  supabase: {
    channel: () => {
      mockChannelCount++;
      const chan: Record<string, unknown> = {
        on: (
          _type: string,
          filter: { event?: string },
          cb: (p: never) => void
        ) => {
          if (filter.event === "INSERT") mockInsertCb = cb as never;
          if (filter.event === "UPDATE") mockUpdateCb = cb as never;
          if (filter.event === "DELETE") mockDeleteCb = cb as never;
          return chan;
        },
        subscribe: () => chan,
        unsubscribe: jest.fn(),
      };
      return chan;
    },
    // fetch 체인: from().select().eq("room_id", id) → { data, error } (thenable).
    from: () => ({
      select: () => ({
        eq: () => Promise.resolve({ data: mockRoomRows, error: null }),
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

// 고정 기준 시각(fake timers 와 last_active 비교를 결정적으로).
const NOW = 1_800_000_000_000;
const fresh = () => new Date(NOW).toISOString();
const stale = () => new Date(NOW - 60_000).toISOString();

const userRow = (id: string, name: string, last_active: string = fresh()) => ({
  id,
  name,
  room_id: "room-1",
  character_index: 0,
  x: 0,
  y: 0,
  last_active,
});

// 마이크로태스크(초기/주기 fetch resolve)를 흘려보낸다.
const flush = () =>
  act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });

// reconcile 타이머를 한 번 발동시키고 fetch 를 흘려보낸다.
const tickReconcile = () =>
  act(async () => {
    jest.advanceTimersByTime(RECONCILE_INTERVAL_MS);
    await Promise.resolve();
    await Promise.resolve();
  });

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(NOW);
  mockChannelCount = 0;
  mockInsertCb = null;
  mockUpdateCb = null;
  mockDeleteCb = null;
  mockRoomRows = [];
});

afterEach(() => {
  jest.useRealTimers();
});

describe("RoomParticipantsProvider (users 테이블 단일 소스)", () => {
  it("postgres_changes 채널을 하나만 만든다", async () => {
    renderHook(() => useRemoteParticipants(), { wrapper });
    await flush();
    expect(mockChannelCount).toBe(1);
  });

  // S1 핵심: 이미 방에 있던 유저는 초기 fetch(방 전체 재조회)로 반영된다.
  it("초기 fetch 로 기존 멤버를 반영하고 self 는 제외한다", async () => {
    mockRoomRows = [userRow("u1", "철수"), userRow("me", "나")];
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    await flush();
    expect(result.current.get("u1")?.name).toBe("철수");
    expect(result.current.has("me")).toBe(false);
  });

  it("INSERT 로 등장이 반영된다", async () => {
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    await flush();
    act(() => mockInsertCb!({ new: userRow("u2", "영희") }));
    expect(result.current.get("u2")?.name).toBe("영희");
  });

  // PR-3: 위치(x/y)만 바뀐 UPDATE(=이동)는 노출 맵을 리렌더하지 않는다 — 참조 불변.
  // 위치는 broadcast 로 소비되고, 로스터 뷰는 멤버십/식별 필드만 본다(P1).
  it("위치만 바뀐 UPDATE 로는 노출 맵 참조가 바뀌지 않는다", async () => {
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    await flush();
    act(() => mockInsertCb!({ new: userRow("u2", "영희") }));
    const afterInsert = result.current;
    act(() => mockUpdateCb!({ new: { ...userRow("u2", "영희"), x: 42, y: 7 } }));
    expect(result.current).toBe(afterInsert);
  });

  // PR-3: 하트비트(last_active 만 변경)로도 참조가 바뀌지 않는다(무의미 리렌더 제거, P4).
  it("last_active 만 바뀐 UPDATE 로는 노출 맵 참조가 바뀌지 않는다", async () => {
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    await flush();
    act(() => mockInsertCb!({ new: userRow("u2", "영희") }));
    const afterInsert = result.current;
    act(() =>
      mockUpdateCb!({
        new: { ...userRow("u2", "영희", new Date(NOW + 1000).toISOString()) },
      })
    );
    expect(result.current).toBe(afterInsert);
  });

  // PR-3: 이름/캐릭터(멤버십·식별) 변경은 새 맵으로 반영된다.
  it("이름 변경 UPDATE 는 새 맵으로 반영된다", async () => {
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    await flush();
    act(() => mockInsertCb!({ new: userRow("u2", "영희") }));
    const afterInsert = result.current;
    act(() => mockUpdateCb!({ new: userRow("u2", "영희2") }));
    expect(result.current).not.toBe(afterInsert);
    expect(result.current.get("u2")?.name).toBe("영희2");
  });

  it("DELETE 로 제거된다", async () => {
    mockRoomRows = [userRow("u1", "철수")];
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    await flush();
    expect(result.current.has("u1")).toBe(true);
    act(() => mockDeleteCb!({ old: { id: "u1" } }));
    expect(result.current.has("u1")).toBe(false);
  });

  // S1/S3 회귀: INSERT 이벤트를 놓쳐도 다음 주기 reconcile 이 기존 멤버로 수렴한다.
  it("이벤트 유실 후 주기 reconcile 로 신규 멤버가 채워진다", async () => {
    mockRoomRows = [];
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    await flush();
    expect(result.current.size).toBe(0);
    // INSERT 콜백은 안 부른다(유실). 대신 다음 reconcile fetch 에 나타남.
    mockRoomRows = [userRow("u3", "민수")];
    await tickReconcile();
    expect(result.current.get("u3")?.name).toBe("민수");
  });

  // 반대 방향: reconcile 스냅샷에서 빠진 유저는 제거되어 수렴한다.
  it("reconcile 에서 사라진 유저는 제거된다", async () => {
    mockRoomRows = [userRow("u1", "철수")];
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    await flush();
    expect(result.current.has("u1")).toBe(true);
    mockRoomRows = [];
    await tickReconcile();
    expect(result.current.has("u1")).toBe(false);
  });

  // S2 비파괴: 고아(오래 침묵) row 는 뷰에서 제외되지만 삭제하지 않는다.
  it("last_active 가 오래된 고아 row 는 뷰에서 제외된다", async () => {
    mockRoomRows = [userRow("u1", "철수"), userRow("ghost", "고스트", stale())];
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    await flush();
    expect(result.current.has("u1")).toBe(true);
    expect(result.current.has("ghost")).toBe(false);
  });

  // PR-3(B2): 위치가 broadcast 로 빠지고 last_active UPDATE 가 diff 로 억제돼도,
  // stale-sweep(로컬 재필터)이 시간이 흐른 뒤 고아를 뷰에서 제외한다. 크래시로 row 가
  // DB 에 남아 reconcile 이 계속 돌려줘도(비파괴), stale 필터가 뷰에서 감춘다.
  it("stale 해진 고아는 reconcile 이 계속 돌려줘도 뷰에서 제외된다", async () => {
    mockRoomRows = [userRow("u1", "철수")];
    const { result } = renderHook(() => useRemoteParticipants(), { wrapper });
    await flush();
    expect(result.current.has("u1")).toBe(true);

    // u1 하트비트 끊김: 시간이 stale 임계 너머로 흐른다(row 는 DB 에 그대로 남아 있다).
    await act(async () => {
      jest.advanceTimersByTime(
        ROSTER_STALE_TIMEOUT_MS + ROSTER_STALE_SWEEP_INTERVAL_MS
      );
      await Promise.resolve();
      await Promise.resolve();
    });
    expect(result.current.has("u1")).toBe(false);
  });
});
