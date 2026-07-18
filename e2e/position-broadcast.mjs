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
 * E2E: 위치 broadcast 가 원격 화면에 반영되는지 검증한다(issue #51).
 *
 * 리팩토링으로 위치(x/y)는 DB(postgres_changes)가 아니라 broadcast 채널
 * `position-<roomId>` 로 흐른다. 씬은 이 broadcast 를 직접 받아 원격 스프라이트를 tween 한다.
 * 이 테스트는 "A 가 움직이면 B 화면에서 A 스프라이트가 따라오는가" 를 실제 브라우저로 확인한다.
 * (기존 presence-3clients 는 멤버십만, room-flow 는 이동+409 만 봤고, 원격 위치 반영은 미검증이었다.)
 *
 * 씬 좌표는 ?e2e URL 파라미터가 있을 때만 노출되는 window.__smallVillage 훅으로 읽는다.
 *
 * 시나리오:
 *   1) Alice 가 방을 만들고 입장, Bob 이 같은 방에 입장(둘 다 ?e2e).
 *   2) Bob 화면에서 Alice 스프라이트 초기 위치 P0 를 읽는다.
 *   3) Alice 가 오른쪽으로 이동.
 *   4) Bob 화면에서 Alice 위치 P1 을 다시 읽어 P1.x > P0.x (오른쪽으로 따라옴) 확인.
 *
 * 전제: 앱이 떠 있어야 한다(기본 localhost:3000, E2E_BASE_URL override). .env.local(정리용).
 * 실행: `E2E_BASE_URL=http://localhost:3200 node e2e/position-broadcast.mjs`
 */

import fs from "node:fs";
import pw from "playwright";
import { createClient } from "@supabase/supabase-js";

const { chromium } = pw;
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const ROOM = `e2e-pos-${Date.now()}`;
const MOVE_MS = 1200;
const MIN_DX = 20; // 이 픽셀 이상 오른쪽으로 움직이면 "원격에 반영됨" 으로 본다.

function e2eUrl() {
  const url = new URL(BASE);
  url.searchParams.set("e2e", "1");
  return url.toString();
}

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

const LAUNCH_ARGS = [
  "--no-sandbox",
  "--disable-dev-shm-usage",
  "--use-gl=angle",
  "--use-angle=swiftshader",
  "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist",
  "--enable-webgl",
  "--autoplay-policy=no-user-gesture-required",
  "--use-fake-ui-for-media-stream",
  "--use-fake-device-for-media-stream",
];

const BADGE = '[data-testid="participant-count-badge"]';
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
const check = (cond, msg) => {
  console.log((cond ? "  ✅ " : "  ❌ ") + msg);
  if (!cond) failures.push(msg);
};

const enterName = (page, name) =>
  page.getByPlaceholder("e.g. Mina").fill(name);
const waitForGameReady = (page) =>
  page.waitForSelector(BADGE, { timeout: 60000 });

async function createRoom(page) {
  await page.getByPlaceholder("Room title").fill(ROOM);
  await page.getByRole("button", { name: "Create" }).click();
  await waitForGameReady(page);
}

async function joinRoom(page) {
  const row = page.getByRole("listitem").filter({ hasText: ROOM });
  for (let i = 0; i < 15 && !(await row.count()); i++) {
    await page.getByRole("button", { name: "Refresh room list" }).click();
    await sleep(1000);
  }
  await row.getByRole("button", { name: "Join" }).click();
  await waitForGameReady(page);
}

// Bob 페이지에서 aliceId 스프라이트 위치를 읽는다(없으면 null).
const remotePos = (page, id) =>
  page.evaluate((rid) => {
    const hook = window.__smallVillage;
    if (!hook) return { error: "no-hook" };
    const all = hook.remoteSprites();
    return all[rid] ?? null;
  }, id);

const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
const ctxs = [];

try {
  const mk = async () => {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      permissions: ["microphone"],
    });
    ctxs.push(ctx);
    const page = await ctx.newPage();
    page.on("pageerror", (e) => console.warn(`  pageerror: ${e.message}`));
    await page.goto(e2eUrl(), { waitUntil: "networkidle" });
    return page;
  };

  // 1) Alice 생성·입장, Bob 입장
  const alice = await mk();
  await enterName(alice, "Alice");
  console.log(`Alice: 방 생성·입장 (${ROOM})`);
  await createRoom(alice);

  const bob = await mk();
  await enterName(bob, "Bob");
  console.log("Bob: 방 입장");
  await joinRoom(bob);

  // 배지 2 수렴 대기.
  await bob
    .locator(BADGE)
    .filter({ hasText: "2" })
    .waitFor({ timeout: 30000 })
    .catch(() => {});

  const aliceId = await alice.evaluate(() =>
    localStorage.getItem("smallvillage_user_id")
  );
  console.log(`Alice userId: ${aliceId?.slice(0, 8)}…`);

  // 2) Bob 화면에 Alice 스프라이트가 생길 때까지 대기 + 초기 위치 P0.
  await bob
    .waitForFunction(
      (rid) => {
        const h = window.__smallVillage;
        return !!(h && h.remoteSprites()[rid]);
      },
      aliceId,
      { timeout: 20000 }
    )
    .catch(() => {});

  const p0 = await remotePos(bob, aliceId);
  check(
    p0 && typeof p0.x === "number",
    `Bob 화면에 Alice 스프라이트 존재 (P0=${JSON.stringify(p0)})`
  );

  // 3) Alice 오른쪽 이동.
  console.log("Alice: 오른쪽 이동...");
  const canvas = await alice.$("canvas");
  await canvas.click({ position: { x: 60, y: 60 } }).catch(() => {});
  await alice.keyboard.down("ArrowRight");
  await sleep(MOVE_MS);
  await alice.keyboard.up("ArrowRight");

  // 4) broadcast + tween 전파 대기 후 P1.
  await sleep(1500);
  const p1 = await remotePos(bob, aliceId);
  check(p1 && typeof p1.x === "number", `P1 읽기 (P1=${JSON.stringify(p1)})`);

  if (p0 && p1) {
    const dx = p1.x - p0.x;
    console.log(`  Δx(Bob 이 본 Alice) = ${dx}`);
    check(
      dx > MIN_DX,
      `Alice 이동이 Bob 화면에 broadcast 로 반영됨 (Δx=${dx} > ${MIN_DX})`
    );
  }
} finally {
  await Promise.all(ctxs.map((c) => c.close().catch(() => {})));
  await browser.close();

  // 정리(best-effort).
  try {
    const rooms = (await supabase.from("rooms").select("id").eq("title", ROOM))
      .data;
    for (const r of rooms || []) {
      await supabase.from("users").delete().eq("room_id", r.id);
      await supabase.from("rooms").delete().eq("id", r.id);
    }
  } catch (e) {
    console.warn("정리 중 경고:", e?.message);
  }
}

if (failures.length) {
  console.error(`\n❌ 실패 ${failures.length}건`);
  process.exit(1);
}
console.log("\n✅ 통과: 위치 broadcast 가 원격 화면에 반영됨");