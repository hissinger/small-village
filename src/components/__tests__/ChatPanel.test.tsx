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
import ChatPanel from "../ChatPanel";
import * as analytics from "../../lib/analytics";
import { ANALYTICS_EVENTS } from "../../constants";

jest.mock("../../lib/analytics");
// MessageContext 는 requireActual 로 상수(MessageType/RECEIVER_ALL 등)를 살리되,
// 그 안에서 import 하는 supabaseClient 는 env 없이도 로드되도록 목킹한다.
jest.mock("../../lib/supabaseClient", () => ({
  supabase: { channel: jest.fn(), from: jest.fn() },
}));
jest.mock("../../context/MessageContext", () => ({
  ...jest.requireActual("../../context/MessageContext"),
  useMessage: () => ({ sendMessage: jest.fn() }),
}));
jest.mock("../../context/RoomContext", () => ({
  useRoomContext: () => ({
    userId: "u1",
    userName: "kim",
    roomId: "r1",
    roomTitle: "t",
  }),
}));
jest.mock("../../hooks/useChatMessage", () => ({
  useChatMessage: () => undefined,
}));

describe("ChatPanel chat_message_sent 계측", () => {
  beforeAll(() => {
    // jsdom 은 scrollIntoView 를 구현하지 않는다 → 스크롤 side-effect 만 무력화한다.
    window.HTMLElement.prototype.scrollIntoView = jest.fn();
  });

  it("메시지 전송 시 room_id 와 length 를 push 한다", () => {
    const spy = jest.spyOn(analytics, "pushEvent");
    render(<ChatPanel isOpen={true} onClose={() => {}} />);
    const textarea = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(textarea, { target: { value: "hello" } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(spy).toHaveBeenCalledWith(ANALYTICS_EVENTS.CHAT_MESSAGE_SENT, {
      room_id: "r1",
      length: 5,
    });
  });

  it("공백만 있는 메시지는 push 하지 않는다", () => {
    const spy = jest.spyOn(analytics, "pushEvent");
    render(<ChatPanel isOpen={true} onClose={() => {}} />);
    const textarea = screen.getByPlaceholderText("Type a message...");
    fireEvent.change(textarea, { target: { value: "   " } });
    fireEvent.keyDown(textarea, { key: "Enter" });
    expect(spy).not.toHaveBeenCalled();
  });
});
