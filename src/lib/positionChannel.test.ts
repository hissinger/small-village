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

// 모듈 레벨 싱글턴(rooms)을 매 테스트마다 리셋하려고 doMock + require 로 새로 로드한다.
// (import/export 가 없으면 isolatedModules 에서 global script 로 취급되므로 명시한다.)
export {};

type PositionUpdate = { id: string; x: number; y: number };

interface MockChannel {
  name: string;
  opts: unknown;
  handler?: (arg: { payload: PositionUpdate }) => void;
  on: jest.Mock;
  subscribe: jest.Mock;
  send: jest.Mock;
  unsubscribe: jest.Mock;
}

let subscribePositions: (
  roomId: string,
  cb: (p: PositionUpdate) => void
) => () => void;
let sendPosition: (roomId: string, update: PositionUpdate) => void;
let channelFactory: jest.Mock;

function createdChannels(): MockChannel[] {
  return channelFactory.mock.results.map((r) => r.value as MockChannel);
}

beforeEach(() => {
  jest.resetModules();

  channelFactory = jest.fn((name: string, opts: unknown) => {
    const ch: MockChannel = {
      name,
      opts,
      on: jest.fn(),
      subscribe: jest.fn(),
      send: jest.fn(),
      unsubscribe: jest.fn(),
    };
    ch.on.mockImplementation((_event, _filter, handler) => {
      ch.handler = handler;
      return ch;
    });
    ch.subscribe.mockImplementation(() => ch);
    return ch;
  });

  jest.doMock("./supabaseClient", () => ({
    supabase: { channel: channelFactory },
  }));

  const mod = require("./positionChannel");
  subscribePositions = mod.subscribePositions;
  sendPosition = mod.sendPosition;
});

describe("positionChannel", () => {
  it("방 토픽 + broadcast.self=true 로 채널을 연다", () => {
    subscribePositions("room-1", () => {});

    expect(channelFactory).toHaveBeenCalledWith("position-room-1", {
      config: { broadcast: { self: true } },
    });
    expect(createdChannels()[0].subscribe).toHaveBeenCalledTimes(1);
  });

  it("한 broadcast 를 방의 모든 로컬 구독자에게 팬아웃한다", () => {
    const a = jest.fn();
    const b = jest.fn();
    subscribePositions("room-1", a);
    subscribePositions("room-1", b);

    // 같은 방은 채널 하나만 생성(구독자 fan-out).
    expect(channelFactory).toHaveBeenCalledTimes(1);

    const payload = { id: "u1", x: 5, y: 9 };
    createdChannels()[0].handler?.({ payload });

    expect(a).toHaveBeenCalledWith(payload);
    expect(b).toHaveBeenCalledWith(payload);
  });

  it("ref-count: 마지막 구독자가 떠날 때만 unsubscribe 한다", () => {
    const unsubA = subscribePositions("room-1", () => {});
    const unsubB = subscribePositions("room-1", () => {});
    const ch = createdChannels()[0];

    unsubA();
    expect(ch.unsubscribe).not.toHaveBeenCalled();

    unsubB();
    expect(ch.unsubscribe).toHaveBeenCalledTimes(1);
  });

  it("마지막 해제 후 다시 구독하면 채널을 새로 연다", () => {
    const unsub = subscribePositions("room-1", () => {});
    unsub();
    subscribePositions("room-1", () => {});

    expect(channelFactory).toHaveBeenCalledTimes(2);
  });

  it("구독 전 sendPosition 은 no-op (채널 없음)", () => {
    expect(() => sendPosition("room-1", { id: "u1", x: 1, y: 2 })).not.toThrow();
    expect(channelFactory).not.toHaveBeenCalled();
  });

  it("sendPosition 은 payload 를 방 채널로 broadcast 한다", () => {
    subscribePositions("room-1", () => {});
    const update = { id: "u1", x: 3, y: 4 };

    sendPosition("room-1", update);

    expect(createdChannels()[0].send).toHaveBeenCalledWith({
      type: "broadcast",
      event: "position",
      payload: update,
    });
  });
});
