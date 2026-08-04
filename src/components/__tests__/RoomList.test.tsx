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
import RoomList from "../RoomList";

describe("RoomList", () => {
  it("방 목록 로딩 상태를 흰색 오버레이 없이 목록 영역 안에 표시한다", () => {
    render(
      <RoomList
        disabled={false}
        rooms={[]}
        counts={{}}
        onEnterRoom={() => {}}
        loading
        refetch={async () => {}}
      />
    );

    const loading = screen.getByRole("status", { name: "Loading rooms" });

    expect(loading).toHaveTextContent("Loading rooms...");
    expect(loading).not.toHaveClass("absolute", "bg-white");
  });
});
