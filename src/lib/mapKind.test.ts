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

import { DEFAULT_MAP, MAPS, resolveMap } from "./mapKind";

describe("resolveMap", () => {
  it("유효한 맵 값은 그대로 통과시킨다", () => {
    expect(resolveMap("village")).toBe(MAPS.VILLAGE);
    expect(resolveMap("tilemap")).toBe(MAPS.TILEMAP);
  });

  it("null/undefined 는 기본 맵으로 폴백한다(오래된 rooms row 방어)", () => {
    expect(resolveMap(null)).toBe(DEFAULT_MAP);
    expect(resolveMap(undefined)).toBe(DEFAULT_MAP);
  });

  it("알 수 없는 값·빈 문자열은 기본 맵으로 폴백한다", () => {
    expect(resolveMap("")).toBe(DEFAULT_MAP);
    expect(resolveMap("garbage")).toBe(DEFAULT_MAP);
    expect(resolveMap("VILLAGE")).toBe(DEFAULT_MAP); // 대소문자 구분
  });

  it("기본 맵은 village 다(첫 화면과 동일한 월드)", () => {
    expect(DEFAULT_MAP).toBe(MAPS.VILLAGE);
  });
});
