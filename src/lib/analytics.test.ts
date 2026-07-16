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

import { pushEvent } from "./analytics";

describe("pushEvent", () => {
  beforeEach(() => {
    (window as any).dataLayer = undefined;
  });

  it("window.dataLayer 가 없으면 새로 만들어 push 한다", () => {
    pushEvent("enter_room", { room_id: "r1" });
    expect((window as any).dataLayer).toEqual([
      { event: "enter_room", room_id: "r1" },
    ]);
  });

  it("기존 dataLayer 에 append 한다", () => {
    (window as any).dataLayer = [{ event: "prior" }];
    pushEvent("exit_room", { duration_sec: 12 });
    expect((window as any).dataLayer).toHaveLength(2);
    expect((window as any).dataLayer[1]).toEqual({
      event: "exit_room",
      duration_sec: 12,
    });
  });

  it("params 없이 호출해도 event 키만 push 한다", () => {
    pushEvent("room_list_view");
    expect((window as any).dataLayer[0]).toEqual({ event: "room_list_view" });
  });
});
