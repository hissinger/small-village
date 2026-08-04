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

import { MAPS } from "./mapKind";
import { supabase } from "./supabaseClient";
import { createMeeting } from "./supabaseFunctions";

jest.mock("./supabaseClient", () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

const invokeMock = supabase.functions.invoke as jest.MockedFunction<
  typeof supabase.functions.invoke
>;

describe("createMeeting", () => {
  let consoleErrorSpy: jest.SpyInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    consoleErrorSpy = jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    consoleErrorSpy.mockRestore();
  });

  it("서버가 Office 맵 저장을 확인한 경우에만 생성된 방 id를 반환한다", async () => {
    invokeMock.mockResolvedValue({
      data: { meeting_id: "office-room", map: MAPS.OFFICE },
      error: null,
    });

    await expect(createMeeting("Office", MAPS.OFFICE)).resolves.toBe(
      "office-room"
    );
    expect(invokeMock).toHaveBeenCalledWith("create-meeting", {
      body: { title: "Office", map: MAPS.OFFICE },
    });
  });

  it("구버전 Edge Function이 map 확인값을 반환하지 않으면 성공으로 처리하지 않는다", async () => {
    invokeMock.mockResolvedValue({
      data: { meeting_id: "silently-wrong-room" },
      error: null,
    });

    await expect(createMeeting("Office", MAPS.OFFICE)).rejects.toThrow(
      "Failed to create meeting with the selected map"
    );
  });

  it("서버가 다른 맵을 저장했다고 응답하면 성공으로 처리하지 않는다", async () => {
    invokeMock.mockResolvedValue({
      data: { meeting_id: "wrong-room", map: MAPS.VILLAGE },
      error: null,
    });

    await expect(createMeeting("Office", MAPS.OFFICE)).rejects.toThrow(
      "Failed to create meeting with the selected map"
    );
  });
});
