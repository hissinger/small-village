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
import { useRemotePositions } from "../useRemotePositions";
import { subscribePositions } from "../../lib/positionChannel";
import { POSITION_STREAM_THROTTLE_MS } from "../../constants";

type PositionUpdate = { id: string; x: number; y: number };

jest.mock("../../lib/positionChannel", () => ({
  subscribePositions: jest.fn(),
}));

jest.mock("../../context/RoomContext", () => ({
  useRoomContext: () => ({ roomId: "room-1", userId: "me" }),
}));

const mockedSubscribe = subscribePositions as jest.Mock;

// subscribePositions 의 콜백을 캡처해 테스트가 broadcast 수신을 흉내낸다.
let captured: ((p: PositionUpdate) => void) | undefined;
const mockUnsub = jest.fn();

beforeEach(() => {
  jest.useFakeTimers();
  captured = undefined;
  mockUnsub.mockClear();
  // CRA jest 가 테스트마다 mock 구현을 리셋하므로 매번 다시 세팅한다(userState.test 동일 패턴).
  mockedSubscribe.mockReset();
  mockedSubscribe.mockImplementation(
    (_roomId: string, cb: (p: PositionUpdate) => void) => {
      captured = cb;
      return mockUnsub;
    }
  );
});

afterEach(() => {
  jest.useRealTimers();
});

describe("useRemotePositions", () => {
  it("throttle 창 안의 여러 broadcast 를 한 번에 최신값으로 flush 한다", () => {
    const { result } = renderHook(() => useRemotePositions());
    expect(result.current.size).toBe(0);

    // 같은 창 안에서 두 번 수신 → 아직 state 반영 전.
    act(() => {
      captured?.({ id: "u1", x: 1, y: 1 });
      captured?.({ id: "u1", x: 5, y: 9 });
    });
    expect(result.current.size).toBe(0);

    // throttle 주기가 지나면 최신값으로 한 번 flush.
    act(() => {
      jest.advanceTimersByTime(POSITION_STREAM_THROTTLE_MS);
    });
    expect(result.current.get("u1")).toEqual({ x: 5, y: 9 });
  });

  it("self(내 id)도 스트림에 포함한다 (로스터와 달리 제외 안 함)", () => {
    const { result } = renderHook(() => useRemotePositions());
    act(() => {
      captured?.({ id: "me", x: 2, y: 3 });
    });
    act(() => {
      jest.advanceTimersByTime(POSITION_STREAM_THROTTLE_MS);
    });
    expect(result.current.get("me")).toEqual({ x: 2, y: 3 });
  });

  it("수신이 없으면 새 state 로 flush 하지 않는다 (참조 안정 → 불필요한 리렌더 없음)", () => {
    const { result } = renderHook(() => useRemotePositions());
    const first = result.current;
    act(() => {
      jest.advanceTimersByTime(POSITION_STREAM_THROTTLE_MS * 2);
    });
    expect(result.current).toBe(first);
  });

  it("언마운트 시 구독 해제 + interval 정리", () => {
    const clearSpy = jest.spyOn(global, "clearInterval");
    const { unmount } = renderHook(() => useRemotePositions());
    unmount();
    expect(mockUnsub).toHaveBeenCalledTimes(1);
    expect(clearSpy).toHaveBeenCalled();
    clearSpy.mockRestore();
  });
});