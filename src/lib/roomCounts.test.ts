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

import { countActiveUsersByRoom } from "./roomCounts";

const TIMEOUT = 15_000;
// 고정 기준 시각 (Date.now() 대신 결정적인 값 사용)
const NOW = 1_700_000_000_000;

// last_active 를 "now 로부터 몇 ms 전" 으로 만드는 헬퍼
const ago = (ms: number) => new Date(NOW - ms).toISOString();

describe("countActiveUsersByRoom", () => {
  it("빈 배열이면 빈 객체를 반환한다", () => {
    expect(countActiveUsersByRoom([], NOW, TIMEOUT)).toEqual({});
  });

  it("fresh row 만 세고 stale row 는 제외한다", () => {
    const users = [
      { room_id: "a", last_active: ago(1_000) }, // fresh
      { room_id: "a", last_active: ago(20_000) }, // stale
    ];
    expect(countActiveUsersByRoom(users, NOW, TIMEOUT)).toEqual({ a: 1 });
  });

  it("여러 방에 걸친 인원 분포를 방별로 집계한다", () => {
    const users = [
      { room_id: "a", last_active: ago(1_000) },
      { room_id: "a", last_active: ago(2_000) },
      { room_id: "b", last_active: ago(500) },
      { room_id: "c", last_active: ago(30_000) }, // stale → 제외
    ];
    expect(countActiveUsersByRoom(users, NOW, TIMEOUT)).toEqual({
      a: 2,
      b: 1,
    });
  });

  it("모든 row 가 stale 이면 빈 객체를 반환한다", () => {
    const users = [
      { room_id: "a", last_active: ago(16_000) },
      { room_id: "b", last_active: ago(100_000) },
    ];
    expect(countActiveUsersByRoom(users, NOW, TIMEOUT)).toEqual({});
  });

  it("경계 시각(정확히 timeout 경계)의 row 는 살아있는 것으로 센다", () => {
    // last_active === now - timeout → cutoff 와 정확히 같음 → 포함
    const users = [{ room_id: "a", last_active: ago(TIMEOUT) }];
    expect(countActiveUsersByRoom(users, NOW, TIMEOUT)).toEqual({ a: 1 });
  });

  it("경계 바로 직전(timeout + 1ms) row 는 제외한다", () => {
    const users = [{ room_id: "a", last_active: ago(TIMEOUT + 1) }];
    expect(countActiveUsersByRoom(users, NOW, TIMEOUT)).toEqual({});
  });

  it("파싱 불가능한 last_active 는 무시한다", () => {
    const users = [
      { room_id: "a", last_active: "not-a-date" },
      { room_id: "a", last_active: ago(1_000) },
    ];
    expect(countActiveUsersByRoom(users, NOW, TIMEOUT)).toEqual({ a: 1 });
  });

  it("room_id 가 null 인 row 는 counts['null'] 유령 키를 만들지 않는다", () => {
    const users = [
      { room_id: null, last_active: ago(1_000) },
      { room_id: "a", last_active: ago(1_000) },
    ];
    expect(countActiveUsersByRoom(users, NOW, TIMEOUT)).toEqual({ a: 1 });
  });
});
