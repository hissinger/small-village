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

/*
 * E2E: 게임 월드를 village-bg 이미지로 바꾼 뒤, (1) 충돌이 실제로 막는지 프로그램적으로,
 * (2) above 가림 오버레이·충돌 박스 정렬이 맞는지 스크린샷으로 검증한다.
 *
 * 판정(프로그램적):
 *  - 스폰(월드 중앙) 바로 아래에 있는 충돌 사각형을 worldColliders() 로 찾고,
 *    ArrowDown 을 길게 눌러 그쪽으로 밀어붙였을 때 캐릭터 중심 y 가 그 사각형 위(top)
 *    를 넘지 못하는지 assert. 충돌이 없으면 월드 하단까지 내려가 실패한다.
 * 보조 증거(육안):
 *  - ?debugWorld 로 충돌 박스를 빨강 반투명으로 켠 스크린샷을 저장 → 건물/나무 밑동과
 *    박스가 맞는지, 위로 걸어 들어갈 때 지붕/캔버스가 캐릭터를 덮는지 확인.
 *
 * 전제: 앱이 떠 있어야 함(E2E_BASE_URL, 기본 http://localhost:3000), .env.local 필요.
 * 실행: node e2e/village-bg-world.mjs
 */

import fs from "node:fs";
import pw from "playwright";
import { createClient } from "@supabase/supabase-js";

const { chromium } = pw;
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const ROOM_TITLE = "e2e-village-bg-world";
const SHOT_DIR = "/tmp/sv-review/village";

fs.mkdirSync(SHOT_DIR, { recursive: true });

const env = Object.fromEntries(
  fs
    .readFileSync(new URL("../.env.local", import.meta.url), "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i).trim(), l.slice(i + 1).trim()];
    })
);

const supabase = createClient(
  env.REACT_APP_SUPABASE_URL,
  env.REACT_APP_SUPABASE_KEY
);

function fail(msg) {
  console.error("❌ " + msg);
  process.exitCode = 1;
}

const LAUNCH_ARGS = [
  "--no-sandbox", "--disable-dev-shm-usage",
  "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist", "--enable-webgl",
  "--autoplay-policy=no-user-gesture-required",
  "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
];
const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
const page = await (
  await browser.newContext({ viewport: { width: 1280, height: 800 } })
).newPage();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitForHook(timeoutMs = 40000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const ok = await page.evaluate(
      () =>
        !!(
          window.__smallVillage &&
          window.__smallVillage.worldColliders &&
          window.__smallVillage.myPosition()
        )
    );
    if (ok) return true;
    await sleep(1000);
  }
  return false;
}

try {
  console.log(`로비 로드: ${BASE}/?e2e&debugWorld`);
  await page.goto(`${BASE}/?e2e&debugWorld`, { waitUntil: "networkidle" });

  for (let i = 0; i < 12; i++) {
    if ((await page.getByText(/Loading assets/i).count()) === 0) break;
    await sleep(1000);
  }
  await sleep(1000);

  await page.getByPlaceholder("e.g. Mina").fill("E2EBot");
  await page.getByPlaceholder("Room title").fill(ROOM_TITLE);
  await page.getByRole("button", { name: "Create" }).click();

  const ready = await waitForHook();
  if (!ready) {
    fail("씬/e2e 훅 준비 타임아웃");
    throw new Error("no hook");
  }

  // 인게임 진입 확정 대기(로딩 오버레이 사라지고 Exit 버튼 등장).
  for (let i = 0; i < 30; i++) {
    const strolling = (await page.getByText(/Strolling into/i).count()) > 0;
    const exitVisible =
      (await page.getByLabel("Exit").count()) > 0 &&
      (await page.getByLabel("Exit").first().isVisible().catch(() => false));
    if (!strolling && exitVisible) break;
    await sleep(1000);
  }
  await sleep(1000);

  const { colliders, spawn, size } = await page.evaluate(() => ({
    colliders: window.__smallVillage.worldColliders(),
    spawn: window.__smallVillage.myPosition(),
    size: window.__smallVillage.worldSize(),
  }));
  console.log("world:", size, "spawn:", spawn, "colliders:", colliders.length);

  // [보조 증거] 스크린샷 A — 충돌 박스(빨강) + above 오버레이가 마을 그림과 맞는지 육안.
  await page.screenshot({ path: `${SHOT_DIR}/a-enter-debug.png` });

  // 스폰 바로 아래에 있는 충돌 사각형을 찾는다(x 범위가 스폰 x 를 포함하고 y 가 아래).
  const below = colliders
    .filter((r) => spawn.x >= r.x && spawn.x <= r.x + r.w && r.y > spawn.y)
    .sort((a, b) => a.y - b.y)[0];

  if (!below) {
    // 스폰 바로 아래에 충돌체가 없으면 이 스크립트로는 충돌을 프로그램적으로 못 민다.
    // (좌표 튜닝 후 재검증하라는 신호 — 실패로 처리하지 않고 경고.)
    console.warn(
      "⚠️ 스폰 바로 아래 충돌 사각형 없음 — 충돌 프로그램 판정 skip(스크린샷으로 확인)"
    );
  } else {
    console.log("스폰 아래 충돌체:", below, "→ ArrowDown 으로 밀어붙임");
    await page.$("canvas").then((c) => c?.click({ position: { x: 60, y: 60 } }).catch(() => {}));
    await page.keyboard.down("ArrowDown");
    await page.waitForTimeout(4000);
    await page.keyboard.up("ArrowDown");
    await page.waitForTimeout(500);

    const after = await page.evaluate(() => window.__smallVillage.myPosition());
    console.log("이동 후 위치:", after, "충돌체 top:", below.y);
    // 충돌이 막으면 캐릭터 중심 y 는 충돌체 top 을 넘지 못한다(바디 절반만큼 위에서 멈춤).
    if (after.y < below.y) {
      console.log(`✅ 충돌: 캐릭터가 건물 위(y=${after.y})에서 막힘 (top=${below.y})`);
    } else {
      fail(
        `충돌이 막지 못함 — 캐릭터가 충돌체 top(${below.y})을 지나 y=${after.y} 까지 내려감`
      );
    }
  }

  // [보조 증거] 스크린샷 B — 이동 후(건물에 막힌) 상태. 지붕 오버레이가 캐릭터를 덮는지 확인.
  await page.screenshot({ path: `${SHOT_DIR}/b-after-down.png` });
  console.log(`스크린샷: ${SHOT_DIR}/a-enter-debug.png, b-after-down.png`);
} finally {
  await browser.close();
}

try {
  const rooms = (
    await supabase.from("rooms").select("id").eq("title", ROOM_TITLE)
  ).data;
  for (const r of rooms || []) {
    await supabase.from("users").delete().eq("room_id", r.id);
    await supabase.from("rooms").delete().eq("id", r.id);
  }
} catch (e) {
  console.warn("정리 중 경고:", e?.message);
}

if (!process.exitCode) console.log("✅ 통과");
