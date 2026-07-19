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
import { VILLAGE_SCALE, scaleRect } from "./villageWorld";

describe("scaleRect", () => {
  it("사각형의 x/y/w/h 를 배율만큼 곱한다", () => {
    expect(scaleRect({ x: 10, y: 20, w: 30, h: 40 }, 2)).toEqual({
      x: 20,
      y: 40,
      w: 60,
      h: 80,
    });
  });

  it("배율 1 은 항등(입력 그대로)", () => {
    const r = { x: 5, y: 6, w: 7, h: 8 };
    expect(scaleRect(r, 1)).toEqual(r);
  });

  it("원본 입력을 변형하지 않는다(순수 함수)", () => {
    const r = { x: 1, y: 2, w: 3, h: 4 };
    scaleRect(r, 3);
    expect(r).toEqual({ x: 1, y: 2, w: 3, h: 4 });
  });

  it("VILLAGE_SCALE 은 픽셀아트 선명도를 위해 양의 정수여야 한다", () => {
    expect(Number.isInteger(VILLAGE_SCALE)).toBe(true);
    expect(VILLAGE_SCALE).toBeGreaterThanOrEqual(1);
  });
});

// village 맵 데이터(Tiled 형식)의 무결성 — 씬이 이 파일의 오브젝트 레이어를 읽어
// 충돌/가림/스폰을 만들므로, 형식·경계가 어긋나면 인게임이 조용히 깨진다.
describe("village.json (Tiled 맵 데이터)", () => {
  const map = JSON.parse(
    fs.readFileSync(
      path.join(__dirname, "../../public/assets/tilemaps/village.json"),
      "utf8"
    )
  );
  const W = map.width * map.tilewidth; // 704
  const H = map.height * map.tileheight; // 576
  const layer = (name: string) =>
    map.layers.find((l: { name: string }) => l.name === name);

  it("704x576 (22x18 @ 32px) 이다", () => {
    expect(W).toBe(704);
    expect(H).toBe(576);
  });

  it("씬이 참조하는 레이어(background/colliders/above/spawn)가 모두 있다", () => {
    ["background", "colliders", "above", "spawn"].forEach((n) =>
      expect(layer(n)).toBeDefined()
    );
    expect(layer("background").type).toBe("imagelayer");
    expect(layer("background").image).toContain("village-bg.png");
  });

  it.each(["colliders", "above"])(
    "%s 오브젝트가 맵 경계(704x576) 안에 있다",
    (name) => {
      const objs = layer(name).objects as {
        x: number;
        y: number;
        width: number;
        height: number;
      }[];
      expect(objs.length).toBeGreaterThan(0);
      objs.forEach((o) => {
        expect(o.x).toBeGreaterThanOrEqual(0);
        expect(o.y).toBeGreaterThanOrEqual(0);
        expect(o.x + o.width).toBeLessThanOrEqual(W);
        expect(o.y + o.height).toBeLessThanOrEqual(H);
      });
    }
  );

  it("스폰 point 가 정확히 하나이고 경계 안에 있다", () => {
    const objs = layer("spawn").objects;
    expect(objs).toHaveLength(1);
    const s = objs[0];
    expect(s.point).toBe(true);
    expect(s.x).toBeGreaterThanOrEqual(0);
    expect(s.x).toBeLessThanOrEqual(W);
    expect(s.y).toBeGreaterThanOrEqual(0);
    expect(s.y).toBeLessThanOrEqual(H);
  });
});
