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

import fs from "fs";
import path from "path";

type TileLayer = {
  name: string;
  type: "tilelayer";
  data: number[];
};

type ObjectLayer = {
  name: string;
  type: "objectgroup";
  objects: Array<{ x?: number; y?: number }>;
};

const map = JSON.parse(
  fs.readFileSync(
    path.join(process.cwd(), "public/assets/tilemaps/office.json"),
    "utf8"
  )
);

describe("office Tiled map", () => {
  it("32x22 타일과 현재 렌더러가 요구하는 6개 레이어를 가진다", () => {
    expect(map).toMatchObject({
      type: "map",
      width: 32,
      height: 22,
      tilewidth: 32,
      tileheight: 32,
    });

    const names = map.layers
      .filter((layer: TileLayer | ObjectLayer) => layer.type === "tilelayer")
      .map((layer: TileLayer) => layer.name);
    expect(names).toEqual([
      "ground",
      "decoration_0",
      "decoration_1",
      "decoration_2",
      "above_0",
      "above_1",
    ]);
    map.layers
      .filter((layer: TileLayer | ObjectLayer) => layer.type === "tilelayer")
      .forEach((layer: TileLayer) =>
        expect(layer.data).toHaveLength(map.width * map.height)
      );
  });

  it("원본 두 에셋의 타일셋을 직접 참조한다", () => {
    expect(map.tilesets.map((tileset: { name: string }) => tileset.name)).toEqual(
      ["Tiny_Top_Down_32x32", "Office_Furniture_32x32"]
    );
  });

  it("스폰 지점은 충돌 타일 위가 아니다", () => {
    const spawnLayer = map.layers.find(
      (layer: ObjectLayer) => layer.name === "spawn"
    ) as ObjectLayer;
    const collisionLayer = map.layers.find(
      (layer: TileLayer) => layer.name === "decoration_0"
    ) as TileLayer;
    const spawn = spawnLayer.objects[0];
    const tileX = Math.floor((spawn.x ?? 0) / map.tilewidth);
    const tileY = Math.floor((spawn.y ?? 0) / map.tileheight);

    expect(collisionLayer.data[tileY * map.width + tileX]).toBe(0);
  });

  it("네 구획 사이의 가로·세로 통로가 열려 있다", () => {
    const collisionLayer = map.layers.find(
      (layer: TileLayer) => layer.name === "decoration_0"
    ) as TileLayer;
    const tile = (x: number, y: number) =>
      collisionLayer.data[y * map.width + x];

    [7, 8, 23, 24].forEach((x) => {
      expect(tile(x, 10)).toBe(0);
      expect(tile(x, 11)).toBe(0);
    });
    [6, 7, 16, 17].forEach((y) => {
      expect(tile(15, y)).toBe(0);
      expect(tile(16, y)).toBe(0);
    });
  });
});
