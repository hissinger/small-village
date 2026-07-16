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
import { ANALYTICS_EVENTS } from "../../constants";

jest.mock("../../lib/analytics");
jest.mock("../../lib/supabaseFunctions", () => ({
  createMeeting: jest.fn().mockResolvedValue("new-room-id"),
}));

describe("CreateNewRoom room_created 계측", () => {
  it("방 생성 성공 시 room_created 를 push 한다", async () => {
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
      })
    );
  });
});
