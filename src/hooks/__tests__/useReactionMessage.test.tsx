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
import { useReactionMessage } from "../useReactionMessage";
import { MessageType, RECEIVER_ALL } from "../../context/MessageContext";

const mockHandlerRef: { handler: ((m: any) => void) | null } = {
  handler: null,
};

// MessageContext 는 supabaseClient 를 전이 import 하는데, CRA 는 test 모드에서
// .env.local 을 로드하지 않아 createClient 가 던진다. 클라이언트를 스텁으로 막는다.
jest.mock("../../lib/supabaseClient", () => ({
  supabase: { channel: jest.fn() },
}));

// useMessage를 mock
jest.mock("../../context/MessageContext", () => {
  const actual = jest.requireActual("../../context/MessageContext");
  return {
    ...actual,
    useMessage: () => ({
      addMessageHandler: jest.fn((_ch: string, handler: (m: any) => void) => {
        mockHandlerRef.handler = handler;
      }),
      removeMessageHandler: jest.fn(),
    }),
  };
});

describe("useReactionMessage", () => {
  beforeEach(() => {
    mockHandlerRef.handler = null;
  });

  it("REACTION 메시지를 수신할 때마다 callback 을 호출한다", () => {
    const onReaction = jest.fn();
    renderHook(() => useReactionMessage(onReaction));

    act(() => {
      mockHandlerRef.handler?.({
        type: MessageType.REACTION,
        sender_id: "u2",
        receiver_id: RECEIVER_ALL,
        body: "❤️",
        timestamp: new Date().toISOString(),
      });
    });

    expect(onReaction).toHaveBeenCalledTimes(1);
    expect(onReaction).toHaveBeenCalledWith({ emoji: "❤️", sender_id: "u2" });
  });

  it("연속 도착한 REACTION 을 유실 없이 각각 callback 으로 처리한다", () => {
    const onReaction = jest.fn();
    renderHook(() => useReactionMessage(onReaction));

    // 같은 배칭 틱에 두 개가 도착해도 각각 즉시 호출되어야 한다.
    act(() => {
      mockHandlerRef.handler?.({
        type: MessageType.REACTION,
        sender_id: "u2",
        receiver_id: RECEIVER_ALL,
        body: "❤️",
        timestamp: new Date().toISOString(),
      });
      mockHandlerRef.handler?.({
        type: MessageType.REACTION,
        sender_id: "u3",
        receiver_id: RECEIVER_ALL,
        body: "🎉",
        timestamp: new Date().toISOString(),
      });
    });

    expect(onReaction).toHaveBeenCalledTimes(2);
    expect(onReaction).toHaveBeenNthCalledWith(1, { emoji: "❤️", sender_id: "u2" });
    expect(onReaction).toHaveBeenNthCalledWith(2, { emoji: "🎉", sender_id: "u3" });
  });

  it("CHAT 메시지는 무시한다", () => {
    const onReaction = jest.fn();
    renderHook(() => useReactionMessage(onReaction));
    act(() => {
      mockHandlerRef.handler?.({
        type: MessageType.CHAT,
        sender_id: "u2",
        receiver_id: RECEIVER_ALL,
        body: "hello",
        timestamp: new Date().toISOString(),
      });
    });
    expect(onReaction).not.toHaveBeenCalled();
  });
});
