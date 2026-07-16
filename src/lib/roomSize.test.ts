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

import { fetchRoomSize } from "./roomSize";

jest.mock("./supabaseClient", () => ({
  supabase: { from: jest.fn() },
}));
import { supabase } from "./supabaseClient";

describe("fetchRoomSize", () => {
  it("해당 방의 활성 유저 수를 센다 (나 포함)", async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: () => ({
        eq: () =>
          Promise.resolve({
            data: [
              { room_id: "r1", last_active: new Date().toISOString() },
              { room_id: "r1", last_active: new Date().toISOString() },
            ],
            error: null,
          }),
      }),
    });
    const size = await fetchRoomSize("r1");
    expect(size).toBe(2);
  });

  it("에러 시 0 을 반환한다(계측이 흐름을 깨지 않게)", async () => {
    (supabase.from as jest.Mock).mockReturnValue({
      select: () => ({
        eq: () => Promise.resolve({ data: null, error: new Error("boom") }),
      }),
    });
    expect(await fetchRoomSize("r1")).toBe(0);
  });
});
