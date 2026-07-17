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
import { render, act } from "@testing-library/react";
import SmallVillage from "../SmallVillage";
import { JOIN_TOAST_WARMUP_MS } from "../../constants";
import { Room, User } from "../../types";

// 씬은 목. updateUsers 호출 인자만 검증한다.
const mockUpdateUsers = jest.fn();
const mockScene = {
  updateUsers: mockUpdateUsers,
  showChatMessage: jest.fn(),
  showReaction: jest.fn(),
} as never;

// useRemoteParticipants 가 돌려줄 맵을 테스트가 제어한다.
let mockParticipants: Map<string, User>;
jest.mock("../../context/RoomParticipantsContext", () => ({
  useRemoteParticipants: () => mockParticipants,
}));

const mockToastShow = jest.fn();
jest.mock("../../hooks/useToast", () => ({
  useToast: () => ({ show: mockToastShow }),
}));

jest.mock("../../hooks/useChatMessage", () => ({
  useChatMessage: () => null,
}));
jest.mock("../../hooks/useReactionMessage", () => ({
  useReactionMessage: () => {},
}));

// Conference/SpeakerIndicators 는 RTK/Phaser 에 의존하므로 목으로 대체.
jest.mock("../Conference", () => () => <div data-testid="conference" />);
jest.mock("../SpeakerIndicators", () => () => <div data-testid="speakers" />);

// heartbeat 의 supabase 접근을 스텁.
jest.mock("../../lib/supabaseClient", () => {
  const chain: Record<string, unknown> = {};
  chain.delete = () => chain;
  chain.update = () => chain;
  chain.match = () => Promise.resolve({ error: null });
  return { supabase: { from: () => chain } };
});

// 퇴장 시 row 삭제 헬퍼를 목킹해 배선(언로드 이벤트 → deleteUserRow)만 검증한다.
const mockDeleteUserRow = jest.fn();
jest.mock("../../lib/leaveRoom", () => ({
  deleteUserRow: (id: string) => mockDeleteUserRow(id),
}));

const room: Room = { id: "room-1", title: "방" } as Room;

const userRow = (id: string, name: string): User =>
  ({
    id,
    name,
    room_id: "room-1",
    character_index: 0,
    x: 0,
    y: 0,
    last_active: "2026-01-01T00:00:00.000Z",
  } as User);

const mapOf = (...users: User[]) =>
  new Map(users.map((u) => [u.id, u]));

const renderSV = () =>
  render(
    <SmallVillage
      room={room}
      userId="me"
      characterIndex={0}
      characterName="나"
      scene={mockScene}
      onExit={() => {}}
    />
  );

beforeEach(() => {
  jest.useFakeTimers();
  mockUpdateUsers.mockClear();
  mockToastShow.mockClear();
  mockDeleteUserRow.mockClear();
  mockParticipants = new Map();
});

afterEach(() => {
  jest.useRealTimers();
});

describe("SmallVillage — 로스터 단일 소스 브리지", () => {
  it("프로바이더 맵을 scene.updateUsers 에 그대로 전달한다", () => {
    mockParticipants = mapOf(userRow("u1", "철수"));
    const { rerender } = renderSV();
    expect(mockUpdateUsers).toHaveBeenLastCalledWith([userRow("u1", "철수")]);

    // 새 유저가 로스터에 추가되면 갱신된 목록으로 다시 호출.
    mockParticipants = mapOf(userRow("u1", "철수"), userRow("u2", "영희"));
    act(() => {
      rerender(
        <SmallVillage
          room={room}
          userId="me"
          characterIndex={0}
          characterName="나"
          scene={mockScene}
          onExit={() => {}}
        />
      );
    });
    expect(mockUpdateUsers).toHaveBeenLastCalledWith([
      userRow("u1", "철수"),
      userRow("u2", "영희"),
    ]);
  });

  it("로스터에서 빠진 유저(퇴장)는 줄어든 목록으로 반영된다", () => {
    mockParticipants = mapOf(userRow("u1", "철수"), userRow("u2", "영희"));
    const { rerender } = renderSV();

    mockParticipants = mapOf(userRow("u1", "철수"));
    act(() => {
      rerender(
        <SmallVillage
          room={room}
          userId="me"
          characterIndex={0}
          characterName="나"
          scene={mockScene}
          onExit={() => {}}
        />
      );
    });
    expect(mockUpdateUsers).toHaveBeenLastCalledWith([userRow("u1", "철수")]);
  });

  it("워밍업 창 동안 채워지는 기존 접속자는 입장 토스트를 띄우지 않는다", () => {
    mockParticipants = mapOf(userRow("u1", "철수"));
    const { rerender } = renderSV();
    // 워밍업 창 안에서 또 한 명 채워짐 → 여전히 토스트 없음.
    mockParticipants = mapOf(userRow("u1", "철수"), userRow("u2", "영희"));
    act(() => {
      rerender(
        <SmallVillage
          room={room}
          userId="me"
          characterIndex={0}
          characterName="나"
          scene={mockScene}
          onExit={() => {}}
        />
      );
    });
    expect(mockToastShow).not.toHaveBeenCalled();
  });

  it("워밍업 창이 지난 뒤 새로 등장한 유저만 입장 토스트를 띄운다", () => {
    mockParticipants = mapOf(userRow("u1", "철수"));
    const { rerender } = renderSV();

    act(() => {
      jest.advanceTimersByTime(JOIN_TOAST_WARMUP_MS + 1);
    });

    mockParticipants = mapOf(userRow("u1", "철수"), userRow("u3", "민수"));
    act(() => {
      rerender(
        <SmallVillage
          room={room}
          userId="me"
          characterIndex={0}
          characterName="나"
          scene={mockScene}
          onExit={() => {}}
        />
      );
    });
    expect(mockToastShow).toHaveBeenCalledTimes(1);
    expect(mockToastShow).toHaveBeenCalledWith("민수 has joined");
  });
});

describe("SmallVillage — 퇴장 시 row 삭제 배선", () => {
  it("beforeunload 에서 내 row 를 삭제한다", () => {
    renderSV();
    act(() => {
      window.dispatchEvent(new Event("beforeunload"));
    });
    expect(mockDeleteUserRow).toHaveBeenCalledWith("me");
  });

  it("pagehide(실제 종료, persisted=false)에서 내 row 를 삭제한다", () => {
    renderSV();
    act(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: false })
      );
    });
    expect(mockDeleteUserRow).toHaveBeenCalledWith("me");
  });

  it("pagehide(bfcache, persisted=true)에서는 삭제하지 않는다", () => {
    renderSV();
    act(() => {
      window.dispatchEvent(
        new PageTransitionEvent("pagehide", { persisted: true })
      );
    });
    expect(mockDeleteUserRow).not.toHaveBeenCalled();
  });

  it("언마운트 후에는 언로드 이벤트로 삭제하지 않는다(리스너 해제)", () => {
    const { unmount } = renderSV();
    unmount();
    act(() => {
      window.dispatchEvent(new Event("beforeunload"));
    });
    expect(mockDeleteUserRow).not.toHaveBeenCalled();
  });
});
