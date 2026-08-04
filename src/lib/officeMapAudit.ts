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

import { getPlayerCollisionFootprint } from "./playerCollisionBody";

type Property = { name: string; value: unknown };
type Rect = { x: number; y: number; width: number; height: number };
type MapObject = Partial<Rect> & {
  name?: string;
  properties?: Property[];
};
type MapLayer = {
  name: string;
  type: string;
  data?: number[];
  objects?: MapObject[];
  properties?: Property[];
};
type Tileset = {
  firstgid: number;
  tiles?: Array<{ id: number; properties?: Property[] }>;
};
export type AuditableOfficeMap = {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: MapLayer[];
  tilesets: Tileset[];
};

// SmallVillageScene의 20x32, sprite scale 2.5, Office tilemap scale 2와
// 반드시 같은 실제 발 충돌체다. 체크포인트 좌표는 스프라이트 중심 좌표다.
const PLAYER_FOOTPRINT = getPlayerCollisionFootprint(20, 32, 2.5, 2);
const SEARCH_STEP = 2;
const GID_MASK = 0x1fffffff;

function property(object: { properties?: Property[] }, name: string) {
  return object.properties?.find((entry) => entry.name === name)?.value;
}

function objectLayer(map: AuditableOfficeMap, name: string): MapObject[] {
  return map.layers.find((layer) => layer.name === name)?.objects ?? [];
}

function collisionGids(map: AuditableOfficeMap): Set<number> {
  return new Set(
    map.tilesets.flatMap((tileset) =>
      (tileset.tiles ?? [])
        .filter((tile) => property(tile, "collides") === true)
        .map((tile) => tileset.firstgid + tile.id)
    )
  );
}

function collisionRects(map: AuditableOfficeMap): Rect[] {
  const colliding = collisionGids(map);
  const tileRects = map.layers
    .filter(
      (layer) =>
        ["decoration_0", "decoration_1", "decoration_2"].includes(
          layer.name
        ) && layer.data
    )
    .flatMap((layer) =>
      (layer.data ?? []).flatMap((rawGid, index) => {
        if (!colliding.has(rawGid & GID_MASK)) return [];
        return [
          {
            x: (index % map.width) * map.tilewidth,
            y: Math.floor(index / map.width) * map.tileheight,
            width: map.tilewidth,
            height: map.tileheight,
          },
        ];
      })
    );
  const objectRects = objectLayer(map, "furniture_colliders").map(
    (object) => ({
      x: object.x ?? 0,
      y: object.y ?? 0,
      width: object.width ?? 0,
      height: object.height ?? 0,
    })
  );
  return [...tileRects, ...objectRects];
}

function overlaps(a: Rect, b: Rect): boolean {
  return (
    a.x < b.x + b.width &&
    a.x + a.width > b.x &&
    a.y < b.y + b.height &&
    a.y + a.height > b.y
  );
}

function reachableCheckpoints(
  map: AuditableOfficeMap,
  obstacles: Rect[],
  checkpoints: MapObject[]
): Set<string> {
  const worldWidth = map.width * map.tilewidth;
  const worldHeight = map.height * map.tileheight;
  const columns = Math.floor(worldWidth / SEARCH_STEP) + 1;
  const rows = Math.floor(worldHeight / SEARCH_STEP) + 1;
  const center = (column: number, row: number) => ({
    x: column * SEARCH_STEP,
    y: row * SEARCH_STEP,
  });
  const cell = (x: number, y: number) => ({
    column: Math.max(0, Math.min(columns - 1, Math.round(x / SEARCH_STEP))),
    row: Math.max(0, Math.min(rows - 1, Math.round(y / SEARCH_STEP))),
  });
  const blocked = (column: number, row: number) => {
    const point = center(column, row);
    const body = {
      x: point.x + PLAYER_FOOTPRINT.x,
      y: point.y + PLAYER_FOOTPRINT.y,
      width: PLAYER_FOOTPRINT.width,
      height: PLAYER_FOOTPRINT.height,
    };
    if (
      body.x < 0 ||
      body.y < 0 ||
      body.x + body.width > worldWidth ||
      body.y + body.height > worldHeight
    ) {
      return true;
    }
    return obstacles.some((obstacle) => overlaps(body, obstacle));
  };
  const startObject = checkpoints.find(({ name }) => name === "spawn");
  if (!startObject) return new Set();
  const start = cell(startObject.x ?? 0, startObject.y ?? 0);
  if (blocked(start.column, start.row)) return new Set();
  const visited = new Uint8Array(columns * rows);
  const queue: Array<{ column: number; row: number }> = [start];
  visited[start.row * columns + start.column] = 1;

  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const column = current.column + dx;
      const row = current.row + dy;
      if (column < 0 || row < 0 || column >= columns || row >= rows) continue;
      const index = row * columns + column;
      if (visited[index] || blocked(column, row)) continue;
      visited[index] = 1;
      queue.push({ column, row });
    }
  }

  return new Set(
    checkpoints.flatMap((checkpoint) => {
      const target = cell(checkpoint.x ?? 0, checkpoint.y ?? 0);
      return visited[target.row * columns + target.column]
        ? [checkpoint.name ?? "unnamed"]
        : [];
    })
  );
}

export function auditOfficeMapNavigation(map: AuditableOfficeMap): string[] {
  const issues: string[] = [];
  const obstacles = collisionRects(map);
  const checkpoints = objectLayer(map, "navigation_checks");
  const corridors = objectLayer(map, "navigation_corridors");
  if (checkpoints.length === 0) issues.push("missing navigation checkpoints");
  if (corridors.length === 0) issues.push("missing navigation corridors");
  const reachable = reachableCheckpoints(map, obstacles, checkpoints);

  checkpoints.forEach((checkpoint) => {
    if (!reachable.has(checkpoint.name ?? "unnamed")) {
      issues.push(`unreachable checkpoint: ${checkpoint.name ?? "unnamed"}`);
    }
  });

  corridors.forEach((corridor) => {
    const rect = {
      x: corridor.x ?? 0,
      y: corridor.y ?? 0,
      width: corridor.width ?? 0,
      height: corridor.height ?? 0,
    };
    const axis = property(corridor, "axis");
    const minClearance = Number(property(corridor, "minClearance"));
    const clearance = axis === "vertical" ? rect.width : rect.height;
    if (clearance < minClearance) {
      issues.push(
        `narrow corridor: ${corridor.name ?? "unnamed"} (${clearance}px)`
      );
    }
    if (obstacles.some((obstacle) => overlaps(rect, obstacle))) {
      issues.push(`blocked corridor: ${corridor.name ?? "unnamed"}`);
    }
  });

  for (let index = 1; index <= 5; index += 1) {
    const depths = ["back", "furniture", "front", "plant"].map((part) => {
      const layer = map.layers.find(
        ({ name }) => name === `workstation_pod_${index}_${part}`
      );
      return Number(layer ? property(layer, "depthY") : Number.NaN);
    });
    if (
      depths.some((depth) => !Number.isFinite(depth)) ||
      !depths.every((depth, depthIndex) =>
        depthIndex === 0 ? true : depths[depthIndex - 1] < depth
      )
    ) {
      issues.push(`invalid depth order: workstation_pod_${index}`);
    }
  }

  objectLayer(map, "furniture_colliders")
    .filter(({ name }) => !name?.startsWith("workstation_pod_"))
    .forEach((collider) => {
      const layer = map.layers.find(
        ({ name }) => name === `floor_${collider.name}`
      );
      const depthY = Number(layer ? property(layer, "depthY") : Number.NaN);
      const expectedDepth = (collider.y ?? 0) + (collider.height ?? 0);
      if (depthY !== expectedDepth) {
        issues.push(`invalid furniture depth: ${collider.name ?? "unnamed"}`);
      }
    });

  const horizontalPartition = map.layers.find(
    ({ name }) => name === "partition_horizontal"
  );
  if (
    Number(
      horizontalPartition
        ? property(horizontalPartition, "depthY")
        : Number.NaN
    ) !==
    12 * map.tileheight
  ) {
    issues.push("invalid partition depth: horizontal");
  }
  map.layers
    .filter(({ name }) => name.startsWith("partition_vertical_"))
    .forEach((layer) => {
      const row = Number(layer.name.replace("partition_vertical_", ""));
      if (Number(property(layer, "depthY")) !== (row + 1) * map.tileheight) {
        issues.push(`invalid partition depth: vertical-${row}`);
      }
    });

  return issues;
}
