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

import { getPlayerCollisionBody } from "./playerCollisionBody";

describe("getPlayerCollisionBody", () => {
  it("20x32 캐릭터의 발밑 10x8만 충돌 영역으로 사용한다", () => {
    expect(getPlayerCollisionBody(20, 32)).toEqual({
      width: 10,
      height: 8,
      offsetX: 5,
      offsetY: 24,
    });
  });

  it("충돌 영역은 프레임 아래쪽 중앙에 맞는다", () => {
    const frameWidth = 24;
    const frameHeight = 40;
    const body = getPlayerCollisionBody(frameWidth, frameHeight);

    expect(body.offsetX * 2 + body.width).toBe(frameWidth);
    expect(body.offsetY + body.height).toBe(frameHeight);
    expect(body.offsetY).toBeGreaterThan(frameHeight / 2);
  });
});
