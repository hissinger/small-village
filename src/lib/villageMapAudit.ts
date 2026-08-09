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
type MapObject = {
  name?: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  point?: boolean;
  properties?: Property[];
};
type MapLayer = { name: string; objects?: MapObject[] };
export type AuditableVillageMap = {
  width: number;
  height: number;
  tilewidth: number;
  tileheight: number;
  layers: MapLayer[];
};

const FOOTPRINT = getPlayerCollisionFootprint(20, 32, 2.5, 2);
const SEARCH_STEP = 2;

const objects = (map: AuditableVillageMap, name: string) =>
  map.layers.find((layer) => layer.name === name)?.objects ?? [];
const property = (object: MapObject, name: string) =>
  object.properties?.find((entry) => entry.name === name)?.value;
const rect = (object: MapObject) => ({
  x: object.x ?? 0,
  y: object.y ?? 0,
  width: object.width ?? 0,
  height: object.height ?? 0,
});
const overlaps = (a: ReturnType<typeof rect>, b: ReturnType<typeof rect>) =>
  a.x < b.x + b.width &&
  a.x + a.width > b.x &&
  a.y < b.y + b.height &&
  a.y + a.height > b.y;

function reachableNames(
  map: AuditableVillageMap,
  obstacles: ReturnType<typeof rect>[],
  checkpoints: MapObject[]
): Set<string> {
  const width = map.width * map.tilewidth;
  const height = map.height * map.tileheight;
  const columns = Math.floor(width / SEARCH_STEP) + 1;
  const rows = Math.floor(height / SEARCH_STEP) + 1;
  const cell = (x: number, y: number) => ({
    column: Math.max(0, Math.min(columns - 1, Math.round(x / SEARCH_STEP))),
    row: Math.max(0, Math.min(rows - 1, Math.round(y / SEARCH_STEP))),
  });
  const blocked = (column: number, row: number) => {
    const x = column * SEARCH_STEP;
    const y = row * SEARCH_STEP;
    const body = {
      x: x + FOOTPRINT.x,
      y: y + FOOTPRINT.y,
      width: FOOTPRINT.width,
      height: FOOTPRINT.height,
    };
    return (
      body.x < 0 ||
      body.y < 0 ||
      body.x + body.width > width ||
      body.y + body.height > height ||
      obstacles.some((obstacle) => overlaps(body, obstacle))
    );
  };

  const spawn = checkpoints.find(({ name }) => name === "spawn");
  if (!spawn) return new Set();
  const start = cell(spawn.x ?? 0, spawn.y ?? 0);
  if (blocked(start.column, start.row)) return new Set();
  const visited = new Uint8Array(columns * rows);
  const queue = [start];
  visited[start.row * columns + start.column] = 1;
  for (let head = 0; head < queue.length; head += 1) {
    const current = queue[head];
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const column = current.column + dx;
      const row = current.row + dy;
      if (column < 0 || row < 0 || column >= columns || row >= rows) continue;
      const index = row * columns + column;
      if (visited[index] || blocked(column, row)) continue;
      visited[index] = 1;
      queue.push({ column, row });
    }
  }
  return new Set(checkpoints.flatMap((checkpoint) => {
    const target = cell(checkpoint.x ?? 0, checkpoint.y ?? 0);
    return visited[target.row * columns + target.column]
      ? [checkpoint.name ?? "unnamed"]
      : [];
  }));
}

export function auditVillageMap(map: AuditableVillageMap): string[] {
  const issues: string[] = [];
  const colliders = objects(map, "colliders").map(rect);
  const checkpoints = objects(map, "navigation_checks");
  const noGo = objects(map, "blocked_checks");
  const corridors = objects(map, "navigation_corridors");
  const spots = [...checkpoints, ...noGo];
  const reachable = reachableNames(map, colliders, spots);

  // 도달성 판정을 **이름**으로 주고받으므로 이름이 겹치면 한쪽 검사가 다른 쪽 결과를
  // 그대로 받아 조용히 사라진다(이름 없는 점 둘도 똑같이 "unnamed" 로 뭉친다).
  const names = spots.map(({ name }) => name ?? "unnamed");
  new Set(names.filter((name, index) => names.indexOf(name) !== index)).forEach(
    (name) => issues.push(`duplicate checkpoint name: ${name}`)
  );
  if (objects(map, "objects").length === 0) {
    issues.push("recognized object catalog must not be empty");
  }
  if (noGo.length === 0) {
    issues.push("no-go checkpoint list must not be empty");
  }
  checkpoints.forEach((checkpoint) => {
    if (!reachable.has(checkpoint.name ?? "unnamed")) {
      issues.push(`unreachable checkpoint: ${checkpoint.name ?? "unnamed"}`);
    }
  });
  // 벽 조각의 충돌 상자가 빠지면 길은 그대로 열린 채 건물 안만 뚫린다 —
  // 도달 가능성만 보는 위 검사로는 안 잡히므로 "여기는 못 들어간다" 를 따로 못 박는다.
  noGo.forEach((spot) => {
    if (reachable.has(spot.name ?? "unnamed")) {
      issues.push(`walkable no-go: ${spot.name ?? "unnamed"}`);
    }
  });
  corridors.forEach((corridor) => {
    const bounds = rect(corridor);
    const axis = property(corridor, "axis");
    const clearance = axis === "vertical" ? bounds.width : bounds.height;
    if (clearance < Number(property(corridor, "minClearance"))) {
      issues.push(`narrow corridor: ${corridor.name ?? "unnamed"}`);
    }
    if (colliders.some((collider) => overlaps(bounds, collider))) {
      issues.push(`blocked corridor: ${corridor.name ?? "unnamed"}`);
    }
  });
  return issues;
}
