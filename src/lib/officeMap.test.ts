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
  objects: Array<{
    name?: string;
    type?: string;
    x?: number;
    y?: number;
    properties?: Array<{ name: string; value: unknown }>;
  }>;
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

  it("가구가 세로 벽면 타일을 덮어쓰지 않는다", () => {
    const collisionLayer = map.layers.find(
      (layer: TileLayer) => layer.name === "decoration_0"
    ) as TileLayer;
    const tile = (x: number, y: number) =>
      collisionLayer.data[y * map.width + x];
    const passages = new Set([6, 7, 16, 17]);

    for (let y = 2; y < map.height; y += 1) {
      if (!passages.has(y)) {
        expect(tile(16, y)).toBe(20);
      }
    }
  });

  it("방향 변환 플래그 없이 원본 투시를 유지한다", () => {
    const transformFlags = 0xe0000000;
    map.layers
      .filter((layer: TileLayer | ObjectLayer) => layer.type === "tilelayer")
      .forEach((layer: TileLayer) =>
        layer.data.forEach((gid) => expect(gid & transformFlags).toBe(0))
      );
  });

  it("네 업무 구역만 정의하고 캐릭터를 맵 데이터에 넣지 않는다", () => {
    const zones = map.layers.find(
      (layer: ObjectLayer) => layer.name === "zones"
    ) as ObjectLayer;

    expect(zones.objects.map(({ name }) => name)).toEqual([
      "Reception",
      "Open Workspace",
      "Focus Room",
      "Lounge",
    ]);
    expect(
      map.layers
        .filter(
          (layer: TileLayer | ObjectLayer) => layer.type === "objectgroup"
        )
        .flatMap((layer: ObjectLayer) => layer.objects)
        .some((object: { type?: string }) => object.type === "character")
    ).toBe(false);
  });

  it("예시의 다섯 워크스테이션을 사람·동물 없이 가구 메타데이터로 정의한다", () => {
    const furniture = map.layers.find(
      (layer: ObjectLayer) => layer.name === "furniture"
    ) as ObjectLayer;

    expect(furniture.objects.map(({ name }) => name)).toEqual([
      "workstation_pod_1",
      "workstation_pod_2",
      "workstation_pod_3",
      "workstation_pod_4",
      "workstation_pod_5",
    ]);
    expect(
      furniture.objects.some(({ type }) =>
        ["character", "animal"].includes(type ?? "")
      )
    ).toBe(false);
    furniture.objects.forEach(({ properties }) => {
      expect(properties).toContainEqual({
        name: "frontPartition",
        type: "bool",
        value: true,
      });
      expect(properties).toContainEqual({
        name: "frontPlant",
        type: "bool",
        value: true,
      });
      expect(properties).toContainEqual({
        name: "centralWallStartPx",
        type: "int",
        value: 0,
      });
      expect(properties).toContainEqual({
        name: "centralWallEndPx",
        type: "int",
        value: 60,
      });
    });

    const openWorkspace = furniture.objects.filter(
      ({ x, y }) =>
        (x ?? 0) >= 16 * map.tilewidth && (y ?? 0) < 11 * map.tileheight
    );
    const focusRoom = furniture.objects.filter(
      ({ x, y }) =>
        (x ?? 0) < 16 * map.tilewidth && (y ?? 0) >= 11 * map.tileheight
    );
    expect(openWorkspace).toHaveLength(4);
    expect(focusRoom).toHaveLength(1);
    expect(Math.min(...openWorkspace.map(({ x }) => x ?? 0))).toBe(
      20.5 * map.tilewidth
    );
    expect(focusRoom[0]).toMatchObject({
      x: 7.5 * map.tilewidth,
      y: 16.5 * map.tileheight + 55,
    });
    expect(
      furniture.objects
        .find(({ name }) => name === "workstation_pod_5")
        ?.properties
    ).toContainEqual({
      name: "wallDecor",
      type: "string",
      value: "example-note-and-green-display",
    });
  });
});
