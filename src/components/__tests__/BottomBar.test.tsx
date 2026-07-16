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

import { render, screen } from "@testing-library/react";
import { MessageCircle } from "lucide-react";
import IconButton from "../IconButton";
import ExitButton from "../ExitButton";
import BottomBar from "../BottomBar";

// AudioMuteButton / AudioInputSelect 는 RealtimeKit 훅에 의존하므로
// BottomBar 단위 테스트에서는 자식 컴포넌트를 목(mock)으로 대체한다.
jest.mock("../AudioMuteButton", () => () => (
  <div data-testid="mock-audio-mute-button" />
));
jest.mock("../AudioInputSelect", () => () => (
  <div data-testid="mock-audio-input-select" />
));
jest.mock("../ChatPanel", () => () => (
  <div data-testid="mock-chat-panel" />
));
// ReactionPicker 는 Message/Room Context 에 의존하므로 목으로 대체한다.
jest.mock("../ReactionPicker", () => () => (
  <div data-testid="mock-reaction-picker" />
));

describe("IconButton 접근성 속성", () => {
  it("ariaLabel 을 주면 button 이 해당 aria-label 을 갖는다", () => {
    render(
      <IconButton
        onClick={() => {}}
        ariaLabel="Toggle Microphone"
        ActiveIcon={MessageCircle}
        activeColor="#000000"
        size={25}
        strokeWidth={2}
      />
    );

    const button = screen.getByRole("button", { name: "Toggle Microphone" });
    expect(button).toHaveAttribute("aria-label", "Toggle Microphone");
    expect(button).toHaveAttribute("data-testid", "bottombar-toggle-microphone");
  });

  it("ariaLabel 이 없으면 data-testid 를 붙이지 않는다", () => {
    render(
      <IconButton
        onClick={() => {}}
        ActiveIcon={MessageCircle}
        activeColor="#000000"
        size={25}
        strokeWidth={2}
      />
    );

    const button = screen.getByRole("button");
    expect(button).not.toHaveAttribute("data-testid");
  });
});

describe("ExitButton", () => {
  it("getByRole('button', { name: 'Exit' }) 로 찾을 수 있다", () => {
    render(<ExitButton onClick={() => {}} />);
    expect(screen.getByRole("button", { name: "Exit" })).toBeInTheDocument();
  });
});

describe("BottomBar", () => {
  it("채팅 토글 버튼이 'Toggle Chat' 접근성 이름으로 찾아진다", () => {
    render(<BottomBar userId="test-user" onExit={() => {}} />);
    expect(
      screen.getByRole("button", { name: "Toggle Chat" })
    ).toBeInTheDocument();
  });
});
