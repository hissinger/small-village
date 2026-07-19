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

import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import CreateNewRoom from "../CreateNewRoom";
import * as analytics from "../../lib/analytics";
import { createMeeting } from "../../lib/supabaseFunctions";
import { ANALYTICS_EVENTS } from "../../constants";
import { MAPS } from "../../lib/mapKind";

jest.mock("../../lib/analytics");
jest.mock("../../lib/supabaseFunctions", () => ({
  createMeeting: jest.fn().mockResolvedValue("new-room-id"),
}));

const createMeetingMock = createMeeting as jest.MockedFunction<
  typeof createMeeting
>;

describe("CreateNewRoom room_created 계측", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // clearAllMocks 는 mockResolvedValue 구현까지 지우므로 매번 다시 세팅한다.
    createMeetingMock.mockResolvedValue("new-room-id");
  });

  it("방 생성 성공 시 기본 맵(village)으로 room_created 를 push 한다", async () => {
    const spy = jest.spyOn(analytics, "pushEvent");
    render(
      <CreateNewRoom disabled={false} roomCount={0} onEnterRoom={() => {}} />
    );
    fireEvent.change(screen.getByPlaceholderText("Room title"), {
      target: { value: "my room" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create/i }));
    await waitFor(() =>
      expect(spy).toHaveBeenCalledWith(ANALYTICS_EVENTS.ROOM_CREATED, {
        is_public: true,
        map: MAPS.VILLAGE,
      })
    );
    // 기본 맵으로 미팅을 생성한다.
    expect(createMeetingMock).toHaveBeenCalledWith("my room", MAPS.VILLAGE);
  });

  it("Classic 맵을 고르면 그 맵으로 방을 생성하고 onEnterRoom 에 전달한다", async () => {
    const onEnterRoom = jest.fn();
    render(
      <CreateNewRoom disabled={false} roomCount={0} onEnterRoom={onEnterRoom} />
    );
    fireEvent.change(screen.getByPlaceholderText("Room title"), {
      target: { value: "classic room" },
    });
    // 맵 토글에서 Classic(tilemap) 선택
    fireEvent.click(screen.getByRole("button", { name: "Classic" }));
    fireEvent.click(screen.getByRole("button", { name: /create/i }));

    await waitFor(() =>
      expect(createMeetingMock).toHaveBeenCalledWith(
        "classic room",
        MAPS.TILEMAP
      )
    );
    expect(onEnterRoom).toHaveBeenCalledWith(
      expect.objectContaining({ id: "new-room-id", map: MAPS.TILEMAP })
    );
  });
});
