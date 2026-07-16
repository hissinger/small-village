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
import ParticipantPanel from "../ParticipantPanel";
import { User } from "../../types";

// B1: jest.mock 팩토리는 파일 최상단으로 hoist 되므로, 팩토리가 참조하는 가변 변수는
//     이름이 반드시 `mock` 으로 시작해야 한다(그 외 이름은 ReferenceError 로 파일 자체가 실행 안 됨).

// self.audioEnabled 를 흉내내는 가짜 meeting (RTK self 셀렉터용, 원시값 경로).
// 각 테스트가 self 마이크 상태를 바꿔 리렌더를 검증할 수 있도록 가변 객체로 둔다.
let mockMeeting: { self: { audioEnabled: boolean } };

jest.mock("@cloudflare/realtimekit-react", () => ({
  useRealtimeKitSelector: (selector: (m: unknown) => unknown) =>
    selector(mockMeeting),
}));

jest.mock("../../context/RoomContext", () => ({
  useRoomContext: () => ({
    roomId: "room-1",
    roomTitle: "R",
    userId: "me",
    userName: "나야",
  }),
}));

// B2/R1: 원격 마이크 상태는 신규 폴링 훅(useRemoteMicStates)에서 읽는다.
//        Map<customParticipantId, audioEnabled>. 목으로 결정적으로 전환한다.
let mockRemoteMic: Map<string, boolean>;
jest.mock("../../hooks/useRemoteMicStates", () => ({
  useRemoteMicStates: () => mockRemoteMic,
}));

// 발화 집합도 테스트별로 바꿀 수 있게 가변 참조로 둔다.
let mockSpeakingSet: Set<string>;
jest.mock("../../hooks/useSpeakingPeers", () => ({
  useSpeakingPeers: () => mockSpeakingSet,
}));

// R1: ParticipantPanel 은 useRemoteParticipants 를 부르지 않는다(BottomBar 가 1회만 구독).
// remoteMap 은 prop 으로 주입한다 → 이 스위트는 useRemoteParticipants 를 목하지 않는다.
const remoteMap = new Map<string, User>([
  [
    "u1",
    {
      id: "u1",
      name: "철수",
      character_index: 0,
      room_id: "room-1",
      x: 0,
      y: 0,
      last_active: "2026-01-01T00:00:00.000Z",
    },
  ],
]);

beforeEach(() => {
  // 기본: self 마이크 on, 원격 u1 마이크 off, 나(me)만 발화 중.
  mockMeeting = { self: { audioEnabled: true } };
  mockRemoteMic = new Map([["u1", false]]);
  mockSpeakingSet = new Set(["me"]);
});

describe("ParticipantPanel", () => {
  it("self 와 원격 유저를 모두 표시하고 인원수를 헤더에 보여준다", () => {
    render(<ParticipantPanel isOpen onClose={() => {}} remoteMap={remoteMap} />);
    expect(screen.getByText("나야")).toBeInTheDocument();
    expect(screen.getByText("(나)")).toBeInTheDocument();
    expect(screen.getByText("철수")).toBeInTheDocument();
    expect(screen.getByText("Participants (2)")).toBeInTheDocument();
  });

  it("마이크 on/off 아이콘을 상태별로 렌더한다", () => {
    render(<ParticipantPanel isOpen onClose={() => {}} remoteMap={remoteMap} />);
    // self(audioEnabled=true) → on, u1(false) → off
    expect(screen.getAllByLabelText("microphone on").length).toBeGreaterThanOrEqual(1);
    expect(screen.getAllByLabelText("microphone off").length).toBeGreaterThanOrEqual(1);
  });

  // B2/R1: 원격 음소거(AC2)를 폴링 소스 목으로 결정적으로 검증한다.
  it("원격 참가자가 음소거하면 해당 행 아이콘이 MicOff 로 바뀐다", () => {
    // 처음엔 원격 u1 마이크 on.
    mockRemoteMic = new Map([["u1", true]]);
    const { rerender } = render(
      <ParticipantPanel isOpen onClose={() => {}} remoteMap={remoteMap} />
    );
    // self·u1 둘 다 on → microphone on 2개.
    expect(screen.getAllByLabelText("microphone on")).toHaveLength(2);
    expect(screen.queryByLabelText("microphone off")).not.toBeInTheDocument();

    // u1 이 음소거 → 폴링 훅 값 전환 → 리렌더.
    mockRemoteMic = new Map([["u1", false]]);
    rerender(<ParticipantPanel isOpen onClose={() => {}} remoteMap={remoteMap} />);
    expect(screen.getAllByLabelText("microphone off")).toHaveLength(1);
  });

  it("speaking 집합이 바뀌면 해당 행이 발화 하이라이트를 갖는다", () => {
    const { rerender } = render(
      <ParticipantPanel isOpen onClose={() => {}} remoteMap={remoteMap} />
    );
    // 처음엔 me 만 발화 → 철수 행엔 하이라이트 없음.
    const chulsooRow = () => screen.getByText("철수").closest("li")!;
    expect(chulsooRow()).not.toHaveClass("bg-green-100");

    // u1 이 발화 시작.
    mockSpeakingSet = new Set(["me", "u1"]);
    rerender(<ParticipantPanel isOpen onClose={() => {}} remoteMap={remoteMap} />);
    expect(chulsooRow()).toHaveClass("bg-green-100");
  });

  it("패널 바깥을 mousedown 하면 onClose 가 호출된다", () => {
    const onClose = jest.fn();
    render(<ParticipantPanel isOpen onClose={onClose} remoteMap={remoteMap} />);
    // 패널 바깥(document.body)에서 mousedown → useEffect 의 바깥 클릭 닫기 발동.
    fireEvent.mouseDown(document.body);
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
