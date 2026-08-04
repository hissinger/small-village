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
import { auditOfficeMapNavigation } from "./officeMapAudit";
import { getPlayerCollisionFootprint } from "./playerCollisionBody";

type TileLayer = {
  name: string;
  type: "tilelayer";
  data: number[];
  properties?: Array<{ name: string; value: unknown }>;
};

type ObjectLayer = {
  name: string;
  type: "objectgroup";
  objects: Array<{
    name?: string;
    type?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
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
  it("전체 체크포인트·통로·깊이 감사를 통과한다", () => {
    expect(auditOfficeMapNavigation(map)).toEqual([]);
  });

  it("전체 감사가 막힌 경로·좁은 통로·잘못된 깊이를 함께 검출한다", () => {
    const brokenMap = JSON.parse(JSON.stringify(map));
    const checks = brokenMap.layers.find(
      ({ name }: { name: string }) => name === "navigation_checks"
    );
    const blockedCheck = checks.objects.find(
      ({ name }: { name: string }) => name === "open-row-aisle-left"
    );
    blockedCheck.x = 0;
    blockedCheck.y = 0;

    const corridors = brokenMap.layers.find(
      ({ name }: { name: string }) => name === "navigation_corridors"
    );
    const narrowCorridor = corridors.objects.find(
      ({ name }: { name: string }) => name === "open-between-rows"
    );
    narrowCorridor.height = 20;

    const frontLayer = brokenMap.layers.find(
      ({ name }: { name: string }) => name === "workstation_pod_1_front"
    );
    frontLayer.properties.find(
      ({ name }: { name: string }) => name === "depthY"
    ).value = 0;
    const couchLayer = brokenMap.layers.find(
      ({ name }: { name: string }) => name === "floor_couch_peach_1"
    );
    couchLayer.properties.find(
      ({ name }: { name: string }) => name === "depthY"
    ).value = 0;
    const partitionLayer = brokenMap.layers.find(
      ({ name }: { name: string }) => name === "partition_horizontal"
    );
    partitionLayer.properties.find(
      ({ name }: { name: string }) => name === "depthY"
    ).value = 0;

    expect(auditOfficeMapNavigation(brokenMap)).toEqual(
      expect.arrayContaining([
        "unreachable checkpoint: open-row-aisle-left",
        "narrow corridor: open-between-rows (20px)",
        "invalid depth order: workstation_pod_1",
        "invalid furniture depth: couch_peach_1",
        "invalid partition depth: horizontal",
      ])
    );
  });

  it("32x22 타일과 현재 렌더러가 요구하는 기본 레이어를 가진다", () => {
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
    expect(
      names.filter(
        (name: string) =>
          !name.startsWith("workstation_pod_") &&
          !name.startsWith("floor_") &&
          !name.startsWith("partition_")
      )
    ).toEqual([
      "ground",
      "decoration_0",
      "decoration_1",
      "decoration_2",
      "above_0",
      "above_1",
    ]);
    expect(
      names.filter((name: string) => name.startsWith("workstation_pod_"))
    ).toEqual(
      [...Array(5)].flatMap((_, index) => [
        `workstation_pod_${index + 1}_back`,
        `workstation_pod_${index + 1}_furniture`,
        `workstation_pod_${index + 1}_front`,
        `workstation_pod_${index + 1}_plant`,
      ])
    );
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
      expect(tile(x, 11)).toBe(0);
      expect(tile(x, 12)).toBe(0);
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

  it("워크스테이션 앞 통로는 충돌 타일로 막지 않는다", () => {
    const collisionLayer = map.layers.find(
      (layer: TileLayer) => layer.name === "decoration_0"
    ) as TileLayer;
    const tile = (x: number, y: number) =>
      collisionLayer.data[y * map.width + x];

    [5, 9].forEach((y) => {
      [...Array(5)].forEach((_, offset) => {
        expect(tile(18 + offset, y)).toBe(0);
        expect(tile(26 + offset, y)).toBe(0);
      });
    });
    [...Array(5)].forEach((_, offset) => {
      expect(tile(5 + offset, 18)).toBe(0);
    });
  });

  it("각 워크스테이션 내부를 하나의 가구 섬으로 막아 측면 진입을 방지한다", () => {
    const colliders = map.layers.find(
      (layer: ObjectLayer) => layer.name === "furniture_colliders"
    ) as ObjectLayer;

    expect(colliders.objects).toHaveLength(24);
    [...Array(5)].forEach((_, index) => {
      const prefix = `workstation_pod_${index + 1}`;
      const podColliders = colliders.objects.filter(({ name }) =>
        name?.startsWith(prefix)
      );
      const furniture = (
        map.layers.find(
          (layer: ObjectLayer) => layer.name === "furniture"
        ) as ObjectLayer
      ).objects.find(({ name }) => name === prefix);
      expect(podColliders).toEqual([
        expect.objectContaining({
          name: `${prefix}_footprint`,
          x: (furniture?.x ?? 0) - 79,
          y: (furniture?.y ?? 0) - 110,
          width: 158,
          height: 94,
        }),
        expect.objectContaining({
          name: `${prefix}_front_plant`,
          x:
            (furniture?.x ?? 0) -
            72 +
            ([0, 2, 4].includes(index) ? 122 : 8),
          y: (furniture?.y ?? 0) - 8,
          width: 14,
          height: 8,
        }),
      ]);
    });

    [1, 2].forEach((topIndex) => {
      const bottomIndex = topIndex + 2;
      const topFootprint = colliders.objects.find(
        ({ name }) => name === `workstation_pod_${topIndex}_footprint`
      );
      const bottomFootprint = colliders.objects.find(
        ({ name }) => name === `workstation_pod_${bottomIndex}_footprint`
      );
      const passageHeight =
        (bottomFootprint?.y ?? 0) -
        ((topFootprint?.y ?? 0) + (topFootprint?.height ?? 0));

      expect(passageHeight).toBeGreaterThanOrEqual(48);
    });
  });

  it("소파는 빈 바닥 타일 전체가 아니라 실제 밑면만 충돌한다", () => {
    const collisionLayer = map.layers.find(
      (layer: TileLayer) => layer.name === "decoration_0"
    ) as TileLayer;
    const tile = (x: number, y: number) =>
      collisionLayer.data[y * map.width + x];
    const colliders = map.layers.find(
      (layer: ObjectLayer) => layer.name === "furniture_colliders"
    ) as ObjectLayer;

    [2, 3, 4].forEach((x) => expect(tile(x, 4)).toBe(0));
    [26, 27, 28].forEach((x) => expect(tile(x, 13)).toBe(0));
    expect(
      colliders.objects
        .filter(({ name }) => name?.startsWith("couch_"))
        .map(({ x, y, width, height }) => ({ x, y, width, height }))
    ).toEqual([
      { x: 93, y: 125, width: 58, height: 6 },
      { x: 851, y: 442, width: 58, height: 6 },
    ]);
  });

  it("카운터와 책장 사이의 보이는 틈으로 캐릭터가 통과할 수 있다", () => {
    const colliders = map.layers.find(
      (layer: ObjectLayer) => layer.name === "furniture_colliders"
    ) as ObjectLayer;
    const counter = colliders.objects.find(({ name }) =>
      name?.startsWith("service_counter_")
    );
    const bookshelf = colliders.objects.find(({ name }) =>
      name?.startsWith("bookshelf_")
    );
    const gap =
      (bookshelf?.x ?? 0) - ((counter?.x ?? 0) + (counter?.width ?? 0));
    const player = getPlayerCollisionFootprint(20, 32, 2.5, 2);

    expect(gap).toBe(31);
    expect(gap).toBeGreaterThan(player.width);

    const corridors = map.layers.find(
      (layer: ObjectLayer) => layer.name === "navigation_corridors"
    ) as ObjectLayer;
    expect(corridors.objects).toContainEqual(
      expect.objectContaining({
        name: "reception-counter-bookshelf-gap",
        x: 398,
        width: 31,
      })
    );
  });

  it("모든 일반 바닥 가구를 바닥 접점 기준 깊이 레이어로 렌더한다", () => {
    const colliders = (
      map.layers.find(
        (layer: ObjectLayer) => layer.name === "furniture_colliders"
      ) as ObjectLayer
    ).objects.filter(({ name }) => !name?.startsWith("workstation_pod_"));
    const floorLayers = map.layers.filter(
      (layer: TileLayer) => layer.name.startsWith("floor_")
    ) as TileLayer[];

    expect(floorLayers).toHaveLength(colliders.length);
    colliders.forEach((collider) => {
      const floorLayer = floorLayers.find(
        ({ name }) => name === `floor_${collider.name}`
      );
      const depthY = Number(
        floorLayer?.properties?.find(({ name }) => name === "depthY")?.value
      );

      expect(floorLayer?.data.some((gid) => gid > 0)).toBe(true);
      expect(depthY).toBe((collider.y ?? 0) + (collider.height ?? 0));
    });

    const foreground = map.layers.find(
      (layer: TileLayer) => layer.name === "above_0"
    ) as TileLayer;
    const floorGids = new Set(
      floorLayers.flatMap(({ data }) => data.filter((gid) => gid > 0))
    );
    expect(
      foreground.data.some((gid) => gid > 0 && floorGids.has(gid))
    ).toBe(false);
  });

  it("내부 가로·세로 벽을 각 바닥 경계 기준으로 깊이 정렬한다", () => {
    const above = map.layers.find(
      (layer: TileLayer) => layer.name === "above_0"
    ) as TileLayer;
    const horizontal = map.layers.find(
      (layer: TileLayer) => layer.name === "partition_horizontal"
    ) as TileLayer;
    const depthY = (layer?: TileLayer) =>
      Number(layer?.properties?.find(({ name }) => name === "depthY")?.value);

    expect(depthY(horizontal)).toBe(12 * map.tileheight);
    [...Array(map.width)].forEach((_, x) => {
      expect(above.data[11 * map.width + x]).toBe(0);
    });

    const passageRows = new Set([6, 7, 16, 17]);
    for (let y = 2; y < map.height; y += 1) {
      const vertical = map.layers.find(
        (layer: TileLayer) => layer.name === `partition_vertical_${y}`
      ) as TileLayer | undefined;
      if (passageRows.has(y)) {
        expect(vertical).toBeUndefined();
      } else {
        expect(depthY(vertical)).toBe((y + 1) * map.tileheight);
        expect(above.data[y * map.width + 15]).toBe(0);
      }
    }
  });

  it("워크스테이션은 캐릭터를 가리는 고정 전경 레이어에 배치하지 않는다", () => {
    const workstationLayers = map.layers.filter(
      (layer: TileLayer) => layer.name.startsWith("workstation_pod_")
    ) as TileLayer[];
    const foregroundLayer = map.layers.find(
      (layer: TileLayer) => layer.name === "above_0"
    ) as TileLayer;
    const footprints = [
      { left: 18, right: 22, top: 2, bottom: 5 },
      { left: 26, right: 30, top: 2, bottom: 5 },
      { left: 18, right: 22, top: 6, bottom: 9 },
      { left: 26, right: 30, top: 6, bottom: 9 },
      { left: 5, right: 9, top: 14, bottom: 18 },
    ];

    footprints.forEach(({ left, right, top, bottom }) => {
      let furnitureTileCount = 0;
      for (let y = top; y <= bottom; y += 1) {
        for (let x = left; x <= right; x += 1) {
          const index = y * map.width + x;
          expect(foregroundLayer.data[index]).toBe(0);
          if (workstationLayers.some(({ data }) => data[index] !== 0)) {
            furnitureTileCount += 1;
          }
        }
      }
      expect(furnitureTileCount).toBeGreaterThan(0);
    });

    [...Array(5)].forEach((_, index) => {
      const back = workstationLayers.find(
        ({ name }) => name === `workstation_pod_${index + 1}_back`
      );
      const furniture = workstationLayers.find(
        ({ name }) => name === `workstation_pod_${index + 1}_furniture`
      );
      const front = workstationLayers.find(
        ({ name }) => name === `workstation_pod_${index + 1}_front`
      );
      const plant = workstationLayers.find(
        ({ name }) => name === `workstation_pod_${index + 1}_plant`
      );
      const depthY = (layer?: TileLayer) =>
        Number(layer?.properties?.find(({ name }) => name === "depthY")?.value);

      expect(depthY(back)).toBeLessThan(depthY(furniture));
      expect(depthY(furniture)).toBeLessThan(depthY(front));
      expect(depthY(front)).toBeLessThan(depthY(plant));
    });
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
        (x ?? 0) >= 16 * map.tilewidth && (y ?? 0) < 12 * map.tileheight
    );
    const focusRoom = furniture.objects.filter(
      ({ x, y }) =>
        (x ?? 0) < 16 * map.tilewidth && (y ?? 0) >= 12 * map.tileheight
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
