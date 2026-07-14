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

import { upsertUserState } from "./userState";
import { supabase } from "./supabaseClient";
import { DATABASE_TABLES } from "../constants";

jest.mock("./supabaseClient", () => ({
  supabase: { from: jest.fn() },
}));

const mockedFrom = supabase.from as jest.Mock;

let upsert: jest.Mock;
let insert: jest.Mock;
let del: jest.Mock;

beforeEach(() => {
  // CRA 의 jest 기본값이 mock 구현을 리셋할 수 있으므로, 각 테스트마다
  // from() 이 돌려줄 쿼리 빌더를 새로 세팅한다.
  upsert = jest.fn().mockResolvedValue({ data: null, error: null });
  insert = jest.fn().mockResolvedValue({ data: null, error: null });
  del = jest.fn().mockResolvedValue({ data: null, error: null });
  mockedFrom.mockReset();
  mockedFrom.mockReturnValue({ upsert, insert, delete: del });
});

describe("upsertUserState", () => {
  // 회귀 방지: 초기 등록/이동 동기화 모두 insert 가 아니라 upsert 여야 한다.
  // 예전 create() 는 delete()+insert() 를 써서, 같은 id row 가 이미 있으면
  // PK 충돌(409 Conflict)이 반복해서 났다.
  it("uses upsert (not insert/delete) so an existing row never 409s", async () => {
    await upsertUserState({
      id: "user-1",
      name: "kim",
      character_index: 3,
      room_id: "room-1",
      x: 10,
      y: 20,
    });

    expect(mockedFrom).toHaveBeenCalledWith(DATABASE_TABLES.USERS);
    expect(upsert).toHaveBeenCalledTimes(1);
    expect(insert).not.toHaveBeenCalled();
    expect(del).not.toHaveBeenCalled();
  });

  it("forwards the full state payload to upsert", async () => {
    const state = {
      id: "user-1",
      name: "kim",
      character_index: 3,
      room_id: "room-1",
      x: 10,
      y: 20,
    };

    await upsertUserState(state);

    expect(upsert).toHaveBeenCalledWith(state);
  });

  // 회귀 방지: 이동 동기화 write 도 반드시 room_id 를 포함해야 한다.
  // row 가 GC 로 사라진 사이 움직이면 upsert 가 INSERT 로 동작하는데, room_id 를
  // 빼면 기본값 gen_random_uuid() 가 rooms FK 를 위반해 409(23503)가 났다.
  // (실측 확인: room_id 생략 → 409 foreign_key_violation, 포함 → 201.)
  it("includes room_id on movement writes so an inserted row satisfies the FK", async () => {
    await upsertUserState({
      id: "user-1",
      name: "kim",
      character_index: 3,
      room_id: "room-1",
      x: 42,
      y: 7,
    });

    expect(upsert).toHaveBeenCalledWith(
      expect.objectContaining({ room_id: "room-1" })
    );
  });
});
