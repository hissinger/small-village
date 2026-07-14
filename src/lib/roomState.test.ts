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

import { roomExists } from "./roomState";
import { supabase } from "./supabaseClient";
import { DATABASE_TABLES } from "../constants";

jest.mock("./supabaseClient", () => ({
  supabase: { from: jest.fn() },
}));

const mockedFrom = supabase.from as jest.Mock;

// select("id",{head,count}).eq("id",..) 체인이 {count,error} 로 resolve 되도록 구성
function mockQuery(result: { count?: number; error?: unknown }) {
  const eq = jest.fn().mockResolvedValue(result);
  const select = jest.fn().mockReturnValue({ eq });
  mockedFrom.mockReset();
  mockedFrom.mockReturnValue({ select });
  return { select, eq };
}

describe("roomExists", () => {
  it("returns true when the room row is present (count > 0)", async () => {
    const { select } = mockQuery({ count: 1, error: null });
    await expect(roomExists("room-1")).resolves.toBe(true);
    expect(mockedFrom).toHaveBeenCalledWith(DATABASE_TABLES.ROOMS);
    expect(select).toHaveBeenCalledWith("id", { count: "exact", head: true });
  });

  it("returns false when the room is gone (count 0) — entry must be blocked", async () => {
    mockQuery({ count: 0, error: null });
    await expect(roomExists("dead-room")).resolves.toBe(false);
  });

  it("does not block entry when the check itself errors (availability first)", async () => {
    mockQuery({ error: { message: "network" } });
    await expect(roomExists("room-1")).resolves.toBe(true);
  });
});
