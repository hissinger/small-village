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

describe("CharacterPreviewScene", () => {
  beforeAll(() => {
    (global as any).Phaser = {
      Scene: class {},
      Textures: { FilterMode: { NEAREST: "nearest" } },
    };
  });

  it("캐릭터를 픽셀 정수 배율인 3배로 확대한다", () => {
    const CharacterPreviewScene = require("./CharacterPreviewScene").default;
    const sprite = {
      setScale: jest.fn(),
      setOrigin: jest.fn(),
      texture: { setFilter: jest.fn() },
      play: jest.fn(),
    };
    const scene = new CharacterPreviewScene();
    scene.add = { sprite: jest.fn(() => sprite) };

    scene.showCharacter(0);

    expect(sprite.setScale).toHaveBeenCalledWith(3);
  });
});

export {};
