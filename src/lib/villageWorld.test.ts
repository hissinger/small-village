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
import { auditVillageMap } from "./villageMapAudit";
import { VILLAGE_SCALE, scaleRect } from "./villageWorld";

const root = path.join(__dirname, "../..");
const read = (relative: string) =>
  JSON.parse(fs.readFileSync(path.join(root, relative), "utf8"));

const map = read("public/assets/tilemaps/village.json");
const tmj = read("scripts/assets/village.tmj");
const tsx = fs.readFileSync(
  path.join(root, "scripts/assets/village.tsx"),
  "utf8"
);
const layer = (name: string) =>
  map.layers.find((item: { name: string }) => item.name === name);
const W = map.width * map.tilewidth; // 704
const H = map.height * map.tileheight; // 576

describe("scaleRect", () => {
  it("사각형의 x/y/w/h 를 배율만큼 곱한다", () => {
    expect(scaleRect({ x: 10, y: 20, w: 30, h: 40 }, 2)).toEqual({
      x: 20,
      y: 40,
      w: 60,
      h: 80,
    });
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

// village.tmj / village.tsx 는 좌표만 든 파일이다(그림은 로컬 아틀라스에서 온다).
// Tiled 가 다시 못 여는 형태로 망가지면 맵을 손볼 수 없게 되므로 왕복 조건을 고정한다.
describe("village.tmj / village.tsx (Tiled 배치 데이터)", () => {
  const tileLayers = tmj.layers.filter(
    ({ type }: { type: string }) => type === "tilelayer"
  );
  const tileIds = new Set(
    [...tsx.matchAll(/<tile id="(\d+)"/g)].map((m) => Number(m[1]))
  );
  const count = Number(/tilecount="(\d+)"/.exec(tsx)![1]);
  const columns = Number(/\bcolumns="(\d+)"/.exec(tsx)![1]);

  it("팩 원본과 같은 1x 캔버스이고, 빌드 배율이 정수 2배다", () => {
    expect([tmj.width, tmj.height]).toEqual([22, 18]);
    expect([tmj.tilewidth, tmj.tileheight]).toEqual([16, 16]);
    expect(tmj.width * tmj.tilewidth * VILLAGE_SCALE).toBe(W);
    expect(tmj.height * tmj.tileheight * VILLAGE_SCALE).toBe(H);
  });

  // 라이선스 원본은 재배포가 금지된다. 배치가 public/ 아래나 리포 안의 그림을
  // 가리키기 시작하면 공개 리포로 애셋이 새어 나간다.
  it("그림을 담지 않고 아틀라스를 gitignore 된 경로에서만 참조한다", () => {
    expect(/<image source="([^"]+)"/.exec(tsx)![1]).toContain(
      "tiny-rpg-town-files/"
    );
    expect(tsx).not.toContain("data:image");
    expect(JSON.stringify(tmj)).not.toContain("data:image");
  });

  it("놓인 타일이 모두 타일셋 안에 있다", () => {
    expect(tileLayers.length).toBeGreaterThan(0);
    tileLayers.forEach((tileLayer: { data: number[] }) => {
      expect(tileLayer.data).toHaveLength(tmj.width * tmj.height);
      tileLayer.data.forEach((gid) => {
        expect(gid).toBeGreaterThanOrEqual(0);
        expect(gid).toBeLessThanOrEqual(count);
        if (gid) expect(tileIds.has(gid - 1)).toBe(true);
      });
    });
  });

  // 타일마다 팩의 어디서 왔는지가 적혀 있어야 아틀라스를 다시 구울 수 있다.
  // 이게 없으면 커밋된 좌표만으로는 그림을 복구하지 못한다.
  it("모든 타일이 팩 안의 출처를 들고 있다", () => {
    const sources = [
      ...tsx.matchAll(
        /<tile id="(\d+)">\s*<properties>([\s\S]*?)<\/properties>/g
      ),
    ];
    expect(sources).toHaveLength(count);
    sources.forEach(([, , properties]) => {
      const source = /name="source" value="(\w+)"/.exec(properties)![1];
      const x = Number(/name="sourceX" type="int" value="(\d+)"/.exec(properties)![1]);
      const y = Number(/name="sourceY" type="int" value="(\d+)"/.exec(properties)![1]);
      expect(["pack", "grass"]).toContain(source);
      const limit = source === "pack" ? [352 - 16, 288 - 16] : [48 - 1, 48 - 1];
      expect(x).toBeGreaterThanOrEqual(0);
      expect(y).toBeGreaterThanOrEqual(0);
      expect(x).toBeLessThanOrEqual(limit[0] + (source === "grass" ? 48 : 0));
      expect(y).toBeLessThanOrEqual(limit[1] + (source === "grass" ? 48 : 0));
    });
    expect(columns).toBeGreaterThan(0);
  });

  // 가림 오버레이는 지붕·수관만이어야 한다. 벽체까지 above 로 올리면 정문 앞에
  // 선 캐릭터가 벽 픽셀에 덮여 보이지 않는다(인게임에서 실제로 겪은 회귀).
  // 반대로 지붕 조각이 하나라도 빠지면 그 칸에서만 캐릭터가 지붕 앞으로 튀어나온다.
  it("레이어 순서가 잔디 → 오브젝트 → 가림 이다", () => {
    const names = tileLayers.map(({ name }: { name: string }) => name);
    expect(names[0]).toBe("grass");
    const above = names.findIndex((name: string) => name.startsWith("above"));
    expect(above).toBeGreaterThan(0);
    expect(
      names.slice(above).every((name: string) => name.startsWith("above"))
    ).toBe(true);
  });

  // sorted_* 레이어는 "바닥에 선 가림 물건"이고, 발치 y(depthY)로 캐릭터와 정렬한다.
  // 빌드가 같은 걸 검사하지만 그건 팩 원본이 있어야 돌아서 CI 에서는 안 돈다 —
  // 커밋된 파일만으로 확인할 수 있는 조건은 여기서 잠근다.
  it("sorted_* 레이어가 모두 depthY 를 들고 있다", () => {
    const layers = tileLayers.filter(({ name }: { name: string }) =>
      name.startsWith("sorted")
    );
    // 레이어를 다 지워도 아래 검사가 전부 공회전으로 통과하므로 개수부터 못 박는다.
    expect(layers.length).toBeGreaterThan(0);
    layers.forEach((layer: { name: string; properties?: unknown }) => {
      const depthY = (
        layer.properties as Array<{ name: string; value: unknown }> | undefined
      )?.find(({ name }) => name === "depthY")?.value;
      expect(typeof depthY).toBe("number");
      expect(depthY).toBeGreaterThan(0);
    });
    // 밴드가 하나도 없으면 village.json 의 sorted_overlays 도 비어 씬이 조용히 아무것도
    // 안 그린다 — 레이어를 지웠는지 알 수 있게 개수를 맞춰 둔다.
    expect(layer("sorted_overlays")).toBeDefined();
    expect(layer("sorted_overlays").objects).toHaveLength(layers.length);
  });

  // 씬은 이 밴드로 village-sorted.png 를 잘라 쓴다. 좌표계가 어긋나면 오버레이가
  // 통째로 안 보이는데 화면에는 배경이 그대로라 눈치채기 어렵다(실제로 겪었다).
  it("sorted_overlays 밴드가 맵 원본 px 좌표이고 경계 안에 있다", () => {
    expect(layer("sorted_overlays")).toBeDefined();
    const bands = layer("sorted_overlays").objects as {
      x: number;
      y: number;
      width: number;
      height: number;
      properties: { name: string; value: number }[];
    }[];
    expect(bands.length).toBeGreaterThan(0);
    bands.forEach(({ x, y, width, height, properties }) => {
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(x + width).toBeLessThanOrEqual(W);
      expect(y + height).toBeLessThanOrEqual(H);
      [x, y, width, height].forEach((value) =>
        expect(value % VILLAGE_SCALE).toBe(0)
      );
      const depthY = properties.find(({ name }) => name === "depthY")!.value;
      expect(depthY).toBeGreaterThan(0);
      expect(depthY).toBeLessThanOrEqual(H);
    });
    // 한 장짜리 village-sorted.png 를 사각형으로 잘라 쓰므로 겹치면 깊이가 섞인다.
    bands.forEach((a, index) =>
      bands.slice(index + 1).forEach((b) => {
        const hit =
          a.x < b.x + b.width &&
          a.x + a.width > b.x &&
          a.y < b.y + b.height &&
          a.y + a.height > b.y;
        expect(hit).toBe(false);
      })
    );
  });

  // 충돌은 타일에 그려 둔 상자가 유일한 출처다. 하나도 없으면 온 맵이 뚫린다.
  it("충돌 상자가 타일 안에 있고 비어 있지 않다", () => {
    const groups = [
      ...tsx.matchAll(/<objectgroup[\s\S]*?<\/objectgroup>/g),
    ];
    expect(groups.length).toBeGreaterThan(0);
    groups.forEach(([group]) => {
      [...group.matchAll(/<object [^>]*\/>/g)].forEach(([object]) => {
        const at = (key: string) =>
          Number(new RegExp(`${key}="([\\d.]+)"`).exec(object)![1]);
        expect(at("width")).toBeGreaterThan(0);
        expect(at("height")).toBeGreaterThan(0);
        expect(at("x") + at("width")).toBeLessThanOrEqual(tmj.tilewidth);
        expect(at("y") + at("height")).toBeLessThanOrEqual(tmj.tileheight);
      });
    });
  });
});

// 충돌 사각형과 오브젝트 목록은 빌드가 타일 정보로 계산해 타일맵에만 넣는다.
// 사람이 손으로 못 고치는 대신, 게임에서 바로 티가 나는 성질을 여기서 잠근다.
describe("village.json (빌드가 계산한 사각형)", () => {
  const rects = (name: string) =>
    layer(name).objects as {
      name: string;
      x: number;
      y: number;
      width: number;
      height: number;
    }[];
  // 카탈로그 이름은 타일 속성에서만 나와야 한다 — 손으로 적던 시절엔 그림이
  // 바뀌어도 아무도 모르게 틀어졌다.
  const tileNames = new Set(
    [...tsx.matchAll(/name="name" value="([^"]*)"/g)]
      .map((m) => m[1])
      .filter(Boolean)
  );

  it("충돌 사각형이 비어 있지 않고 2x 캔버스를 벗어나지 않으며 짝수 좌표다", () => {
    const colliders = rects("colliders");
    expect(colliders.length).toBeGreaterThan(0);
    colliders.forEach(({ x, y, width, height }) => {
      expect(width).toBeGreaterThan(0);
      expect(height).toBeGreaterThan(0);
      expect(x + width).toBeLessThanOrEqual(W);
      expect(y + height).toBeLessThanOrEqual(H);
      // 1x 좌표를 정수 배율로 올린 값이므로 전부 VILLAGE_SCALE 의 배수여야 한다.
      [x, y, width, height].forEach((value) =>
        expect(value % VILLAGE_SCALE).toBe(0)
      );
    });
  });

  // 나무는 땅에 닿는 밑동만 막는다. 그림 픽셀을 그대로 세면 수관 밑 그늘까지 벽이 되어
  // 나무와 나무 사이가 막힌다(예전엔 줄기 사이를 잇는 64x22 짜리 막대가 나왔다).
  // 나무 간격이 32px 이라 밑동이 한 타일을 넘기 시작하면 그때부터 숲이 벽이 된다.
  it("나무 충돌은 나무마다 한 칸 이하의 밑동뿐이다", () => {
    const groves = rects("objects").filter(({ name }) =>
      name.startsWith("pine-trunks")
    );
    const hit = (a: (typeof groves)[number], b: (typeof groves)[number]) =>
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y;
    const footings = rects("colliders").filter((collider) =>
      groves.some((grove) => hit(collider, grove))
    );
    expect(groves.length).toBeGreaterThan(0);
    // 숲 한 덩어리에 나무가 여러 그루다 — 덩어리 수보다 밑동이 많아야 한다.
    expect(footings.length).toBeGreaterThan(groves.length);
    footings.forEach(({ width, height }) => {
      expect(width).toBeLessThanOrEqual(map.tilewidth);
      expect(height).toBeLessThanOrEqual(map.tileheight);
    });
  });

  // "무엇이 어디 있는지" 목록의 이름은 타일 속성에서만 나와야 한다 —
  // 손으로 적던 시절엔 그림이 바뀌어도 아무도 모르게 틀어졌다.
  it("오브젝트 이름이 모두 타일 속성에서 나온다", () => {
    const objects = rects("objects");
    expect(objects.length).toBeGreaterThan(0);
    objects.forEach(({ name }) => {
      // 같은 그림이 여러 곳에 놓이면 "pine-canopy-2" 처럼 번호가 붙는다.
      expect(tileNames.has(name.replace(/-\d+$/, ""))).toBe(true);
      expect(tileNames.has(name) || /-\d+$/.test(name)).toBe(true);
    });
  });
});

// village 맵 데이터(Tiled 형식)의 무결성 — 씬이 이 파일의 레이어를 읽어
// 배경/가림/충돌/스폰을 만들므로, 형식·경계가 어긋나면 인게임이 조용히 깨진다.
describe("village.json (Tiled 맵 데이터)", () => {
  it("704x576 (22x18 @ 32px) 이다", () => {
    expect(W).toBe(704);
    expect(H).toBe(576);
  });

  it("씬이 참조하는 레이어(background/above/colliders/spawn)가 모두 있다", () => {
    expect(layer("background").type).toBe("imagelayer");
    expect(layer("background").image).toContain("village-bg.png");
    expect(layer("above").type).toBe("imagelayer");
    expect(layer("above").image).toContain("village-above.png");
    expect(layer("colliders").type).toBe("objectgroup");
    expect(layer("spawn").type).toBe("objectgroup");
  });

  it("픽셀 출처가 라이선스 원본이고 배치 가이드는 쓰이지 않았다고 기록한다", () => {
    const properties = Object.fromEntries(
      map.properties.map(
        ({ name, value }: { name: string; value: unknown }) => [name, value]
      )
    );
    expect(properties.assetSource).toBe(
      "tiny-rpg-town-files/tileset/tileset.png"
    );
    expect(properties.assetCredit).toMatch(/Luis Zuno/);
    expect(properties.layoutSource).toBe("scripts/assets/village.tmj");
    expect(properties.referenceUsedForPixels).toBe(false);
    // 빌드는 Tiled 배치 + 로컬 아틀라스만 읽는다. 배치 가이드를 다시 끌어들이면
    // 출처가 흐려지므로(가이드는 손보정된 파생물이다) 빌더에서 참조 자체를 막는다.
    const builder = fs.readFileSync(
      path.join(root, "scripts/build-village-map.py"),
      "utf8"
    );
    expect(builder).not.toContain("village-target-reference");
  });

  // 배포되는 맵은 팩 팔레트(68색)를 벗어나면 안 된다 — 벗어나면 원본이 아닌
  // 그림(예전엔 상점 미리보기를 리샘플한 139,369색 이미지였다)이 섞인 것이다.
  it("배경이 팩 팔레트를 벗어나지 않는다(인덱스 PNG 256색 이내)", () => {
    const png = fs.readFileSync(
      path.join(root, "public/assets/village-bg.png")
    );
    // PNG 시그니처 다음 IHDR 의 colour type: 3 = 팔레트(=256색 이내)
    expect(png.subarray(0, 8).toString("hex")).toBe("89504e470d0a1a0a");
    expect(png[25]).toBe(3);
  });

  it("충돌 오브젝트가 맵 경계(704x576) 안에 있다", () => {
    const objects = layer("colliders").objects as {
      x: number;
      y: number;
      width: number;
      height: number;
    }[];
    expect(objects.length).toBeGreaterThan(0);
    objects.forEach((o) => {
      expect(o.x).toBeGreaterThanOrEqual(0);
      expect(o.y).toBeGreaterThanOrEqual(0);
      expect(o.x + o.width).toBeLessThanOrEqual(W);
      expect(o.y + o.height).toBeLessThanOrEqual(H);
    });
  });

  it("스폰 point 가 정확히 하나이고 경계 안에 있다", () => {
    const objects = layer("spawn").objects;
    expect(objects).toHaveLength(1);
    const spawn = objects[0];
    expect(spawn.point).toBe(true);
    expect(spawn.x).toBeGreaterThanOrEqual(0);
    expect(spawn.x).toBeLessThanOrEqual(W);
    expect(spawn.y).toBeGreaterThanOrEqual(0);
    expect(spawn.y).toBeLessThanOrEqual(H);
  });

  it("스폰에서 사방으로 걸어갈 수 있고 길이 막히지 않았다", () => {
    expect(layer("objects").objects.length).toBeGreaterThan(0);
    expect(auditVillageMap(map)).toEqual([]);
  });

  // 인게임 회귀: 팩의 벽 그림 한 조각(여관 오른쪽 벽 패널)에 충돌이 없어서, 그 그림이
  // 깔린 박공집 아래층으로 캐릭터가 걸어 들어갔다. 길은 멀쩡히 열려 있었으므로 도달
  // 가능성 검사만으로는 통과했다 — "여기는 못 들어간다" 를 따로 센다.
  it("건물 벽 안으로 걸어 들어갈 수 없다", () => {
    expect(layer("blocked_checks").objects.length).toBeGreaterThan(0);
    expect(auditVillageMap(map)).toEqual([]);
  });

  it("건물 벽 충돌이 빠지면 감사가 잡아낸다", () => {
    const broken = JSON.parse(JSON.stringify(map));
    const colliders = broken.layers.find(
      ({ name }: { name: string }) => name === "colliders"
    );
    // 박공집 아래층(352..448 x 448..576)을 막고 있는 사각형만 걷어낸다.
    colliders.objects = colliders.objects.filter(
      (o: { x: number; y: number; width: number; height: number }) =>
        !(
          o.x < 448 &&
          o.x + o.width > 352 &&
          o.y < 576 &&
          o.y + o.height > 448
        )
    );
    expect(auditVillageMap(broken)).toContain(
      "walkable no-go: gable-house-flowerbox"
    );
  });

  // 반대 방향 회귀: 건물 오른쪽 짙은 풀은 그림자다. 울타리로 오해해 막으면
  // (예전엔 above 로도 올라가 캐릭터가 그림자에 덮였다) 여기서 걸린다.
  it("건물 그림자를 막으면 감사가 잡아낸다", () => {
    const broken = JSON.parse(JSON.stringify(map));
    broken.layers
      .find(({ name }: { name: string }) => name === "colliders")
      .objects.push({
        name: "test-shadow-blocker",
        x: 448,
        y: 416,
        width: 32,
        height: 160,
      });
    expect(auditVillageMap(broken)).toContain(
      "unreachable checkpoint: gable-shadow"
    );
  });

  it("길을 가로막는 충돌을 넣으면 감사가 잡아낸다", () => {
    const broken = JSON.parse(JSON.stringify(map));
    broken.layers
      .find(({ name }: { name: string }) => name === "colliders")
      .objects.push({
        name: "test-blocker",
        x: 544,
        y: 400,
        width: 32,
        height: 16,
      });
    expect(auditVillageMap(broken)).toContain(
      "blocked corridor: north-south-path"
    );
  });
});
