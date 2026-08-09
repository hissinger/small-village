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

import {
  getPlayerCollisionBody,
  getPlayerCollisionFootprint,
  getPlayerSortY,
  syncPlayerCompanionDepth,
} from "./playerCollisionBody";

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

describe("getPlayerCollisionFootprint", () => {
  it("Office 맵 감사에 실제 Phaser 배율과 발 바디 오프셋을 반영한다", () => {
    expect(getPlayerCollisionFootprint(20, 32, 2.5, 2)).toEqual({
      x: -6.25,
      y: 10,
      width: 12.5,
      height: 10,
    });
  });

});

describe("getPlayerSortY", () => {
  it("캐릭터 중심이 아니라 화면에 표시된 발끝을 깊이 기준으로 사용한다", () => {
    expect(getPlayerSortY(280, 64)).toBe(312);
  });
});

describe("syncPlayerCompanionDepth", () => {
  it("Office에서 이동한 캐릭터의 현재 depth를 링에 반영한다", () => {
    const companion = { setDepth: jest.fn() };

    syncPlayerCompanionDepth(companion, { depth: 1.75 });

    expect(companion.setDepth).toHaveBeenCalledWith(1.75);
  });
});
