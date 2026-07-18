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

import { act, renderHook } from "@testing-library/react";
import { DATABASE_TABLES, LOBBY_ROOMS_POLL_INTERVAL_MS } from "../constants";
import { useRooms } from "./useRooms";

// 조회할 때마다 반환할 rooms 데이터를 테스트에서 바꿀 수 있게 mutable 로 둔다.
let mockRoomsData: Array<{ id: string; title: string; created_at: string }> = [];
let mockRoomsSelectCount = 0;

jest.mock("../lib/supabaseClient", () => ({
  supabase: {
    from: (table: string) => ({
      select: () => {
        if (table === "rooms") {
          mockRoomsSelectCount += 1;
          // rooms 쿼리는 .order() 로 이어지고 그 결과를 await 한다.
          return {
            order: () => Promise.resolve({ data: mockRoomsData, error: null }),
          };
        }
        // users 쿼리는 select 결과를 바로 await 한다.
        return Promise.resolve({ data: [], error: null });
      },
    }),
  },
}));

// 대기 중인 마이크로태스크(await 체인)를 여러 턴 flush 한다.
// 이 jest 버전엔 advanceTimersByTimeAsync 가 없어, 타이머를 진행시킨 뒤 수동으로 flush 한다.
const flushMicrotasks = async () => {
  for (let i = 0; i < 5; i += 1) {
    await Promise.resolve();
  }
};

// 타이머를 진행시키고 그 사이 발생한 await 들을 마저 처리한다.
const advanceAndFlush = async (ms: number) => {
  await flushMicrotasks();
  jest.advanceTimersByTime(ms);
  await flushMicrotasks();
};

describe("useRooms", () => {
  beforeEach(() => {
    mockRoomsData = [];
    mockRoomsSelectCount = 0;
    jest.useFakeTimers();
  });

  afterEach(() => {
    // renderHook 이 자동 언마운트하며 폴링 인터벌을 정리하므로 남은 타이머는 실행하지 않는다.
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it("주기적으로 방 목록을 다시 조회해 새 방을 반영한다", async () => {
    mockRoomsData = [{ id: "a", title: "Room A", created_at: "2024-01-01" }];

    const { result } = renderHook(() => useRooms());

    // 최초 로드에는 인위적 1s 지연이 있으므로 타이머를 진행시키고 await 를 flush 한다.
    await act(async () => {
      await advanceAndFlush(1000);
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.rooms).toHaveLength(1);

    const countAfterInitial = mockRoomsSelectCount;

    // 새 방이 생겼다고 가정하고 폴링 주기를 넘긴다.
    mockRoomsData = [
      { id: "a", title: "Room A", created_at: "2024-01-01" },
      { id: "b", title: "Room B", created_at: "2024-01-02" },
    ];
    await act(async () => {
      await advanceAndFlush(LOBBY_ROOMS_POLL_INTERVAL_MS);
    });

    // 폴링이 다시 조회했고, 스피너 없이(loading 유지) 목록이 갱신된다.
    expect(result.current.rooms).toHaveLength(2);
    expect(mockRoomsSelectCount).toBeGreaterThan(countAfterInitial);
    expect(result.current.loading).toBe(false);
  });

  it("탭이 백그라운드일 때는 폴링하지 않는다", async () => {
    const { result } = renderHook(() => useRooms());
    await act(async () => {
      await advanceAndFlush(1000);
    });
    expect(result.current.loading).toBe(false);

    const countBefore = mockRoomsSelectCount;

    // 탭 숨김 상태로 전환.
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => true,
    });
    act(() => {
      document.dispatchEvent(new Event("visibilitychange"));
    });

    await act(async () => {
      await advanceAndFlush(LOBBY_ROOMS_POLL_INTERVAL_MS * 2);
    });

    // 숨김 상태에서는 추가 조회가 없어야 한다.
    expect(mockRoomsSelectCount).toBe(countBefore);

    // 정리: 다시 보이게 되돌린다.
    Object.defineProperty(document, "hidden", {
      configurable: true,
      get: () => false,
    });
  });

  it("refetch 는 스피너를 띄우고(비-silent) 목록을 갱신한다", async () => {
    mockRoomsData = [{ id: "a", title: "Room A", created_at: "2024-01-01" }];
    const { result } = renderHook(() => useRooms());
    await act(async () => {
      await advanceAndFlush(1000);
    });
    expect(result.current.loading).toBe(false);

    mockRoomsData = [
      { id: "a", title: "Room A", created_at: "2024-01-01" },
      { id: "b", title: "Room B", created_at: "2024-01-02" },
    ];

    // refetch 는 인자 없이 fetchRooms(false) 를 부르므로 스피너가 켜져야 한다.
    let pending: Promise<void> | undefined;
    act(() => {
      pending = result.current.refetch();
    });
    expect(result.current.loading).toBe(true);

    await act(async () => {
      await advanceAndFlush(1000);
      await pending;
    });
    expect(result.current.loading).toBe(false);
    expect(result.current.rooms).toHaveLength(2);
  });

  it("늦게 시작했지만 먼저 끝난 요청이 최신 결과를 덮어쓰지 않는다(out-of-order)", async () => {
    mockRoomsData = [{ id: "a", title: "Room A", created_at: "2024-01-01" }];
    const { result } = renderHook(() => useRooms());
    await act(async () => {
      await advanceAndFlush(1000);
    });
    expect(result.current.rooms).toHaveLength(1);

    // 수동 새로고침 시작: 시작 시점 데이터([A])를 읽고 1s 지연에 들어간다.
    let stalePending: Promise<void> | undefined;
    await act(async () => {
      stalePending = result.current.refetch();
      await flushMicrotasks(); // Promise.all 까지 진행, setTimeout(1000) 대기 진입
    });

    // 그 사이 방이 늘고, 나중에 시작한 silent fetch(가시성 전환)가 먼저 반영된다.
    mockRoomsData = [
      { id: "a", title: "Room A", created_at: "2024-01-01" },
      { id: "b", title: "Room B", created_at: "2024-01-02" },
      { id: "c", title: "Room C", created_at: "2024-01-03" },
    ];
    await act(async () => {
      document.dispatchEvent(new Event("visibilitychange"));
      await flushMicrotasks();
    });
    expect(result.current.rooms).toHaveLength(3);

    // 이제 오래된 수동 새로고침의 지연이 끝난다 — 최신 결과를 덮어쓰면 안 된다.
    await act(async () => {
      await advanceAndFlush(1000);
      await stalePending;
    });
    expect(result.current.rooms).toHaveLength(3);
  });

  // mock 의 "rooms" 문자열이 실제 상수와 일치하는지(상수 오타 방지) 확인.
  it("DATABASE_TABLES.ROOMS 가 'rooms' 이다", () => {
    expect(DATABASE_TABLES.ROOMS).toBe("rooms");
  });
});
