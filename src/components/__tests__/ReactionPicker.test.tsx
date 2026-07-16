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

import { render, screen, fireEvent } from "@testing-library/react";
import ReactionPicker from "../ReactionPicker";
import {
  MessageType,
  RECEIVER_ALL,
  CHANNEL_MESSAGE,
} from "../../context/MessageContext";

const mockSendMessage = jest.fn();

// MessageContext 는 supabaseClient 를 전이 import 하는데, CRA 는 test 모드에서
// .env.local 을 로드하지 않아 createClient 가 던진다. 클라이언트를 스텁으로 막는다.
jest.mock("../../lib/supabaseClient", () => ({
  supabase: { channel: jest.fn() },
}));

// useMessage / useRoomContext 는 Provider 에 의존하므로 mock 으로 대체한다.
jest.mock("../../context/MessageContext", () => {
  const actual = jest.requireActual("../../context/MessageContext");
  return {
    ...actual,
    useMessage: () => ({
      sendMessage: mockSendMessage,
    }),
  };
});

jest.mock("../../context/RoomContext", () => ({
  useRoomContext: () => ({
    userId: "me",
    userName: "tester",
    roomId: "room-1",
    roomTitle: "room",
  }),
}));

describe("ReactionPicker", () => {
  beforeEach(() => {
    mockSendMessage.mockClear();
  });

  it("이모지 클릭 시 REACTION 타입으로 broadcast 발송한다", () => {
    render(<ReactionPicker />);

    // 리액션 패널을 연다.
    fireEvent.click(screen.getByRole("button", { name: "Toggle Reactions" }));
    // aria-label = `reaction-${emoji}`
    fireEvent.click(screen.getByLabelText("reaction-❤️"));

    expect(mockSendMessage).toHaveBeenCalledWith(
      CHANNEL_MESSAGE,
      expect.objectContaining({
        type: MessageType.REACTION,
        receiver_id: RECEIVER_ALL,
        body: "❤️",
        sender_id: "me",
      })
    );
  });
});
