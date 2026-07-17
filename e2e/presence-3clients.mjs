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
 * E2E: presence 단일 소스 회귀 — 3 클라이언트 참여자 패널.
 *
 * 재현 방지 대상(docs/presence-source-refactor-plan.md 의 S1/S2/S3):
 *   먼저 입장해 가만히 있는 유저가 나중 입장자의 화면(패널/씬)에서 누락되던 버그.
 *
 * 시나리오:
 *   1) Alice 가 방을 만들고 입장한 뒤 가만히 있는다.
 *   2) Bob 이 같은 방에 입장.
 *   3) Carol 이 같은 방에 입장.
 *   4) 세 클라이언트 각각에서 참여자 배지 = 3, 패널에 Alice/Bob/Carol 이 모두 보이는지 확인.
 *      (특히 Carol 이 "가만히 있던 Alice" 를 보는지 = 핵심 회귀.)
 *
 * 전제(실제 백엔드 통합 테스트):
 *   1) 앱이 떠 있어야 한다 — 기본 http://localhost:3000 (E2E_BASE_URL 로 override).
 *      worktree 코드로 테스트하려면 .env.local 을 링크해 빌드한 뒤 정적 서빙한다(README 참조).
 *   2) .env.local 에 REACT_APP_SUPABASE_URL/KEY (정리용).
 *   3) 최초 1회: `npx playwright install chromium`.
 *
 * 실행: `node e2e/presence-3clients.mjs`
 */

import fs from "node:fs";
import pw from "playwright";
import { createClient } from "@supabase/supabase-js";

const { chromium } = pw;
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const ROOM = `e2e-3p-${Date.now()}`;
const NAMES = ["Alice", "Bob", "Carol"];

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

// 헤드리스에서 오디오/WebGL 이 필요한 씬·RTK join 을 위해.
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

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const failures = [];
function check(cond, msg) {
  if (cond) {
    console.log("  ✅ " + msg);
  } else {
    console.error("  ❌ " + msg);
    failures.push(msg);
  }
}

const BADGE = '[data-testid="participant-count-badge"]';

async function enterName(page, name) {
  await page.getByPlaceholder("e.g. Mina").fill(name);
}

// 게임 진입 확인은 캔버스가 아니라 배지(BottomBar 마운트=isReady)로 판정한다.
// 로비에도 캐릭터 미리보기 캔버스가 있어 canvas 만으로는 진입을 보장 못 하고,
// RTK join 완료(isReady)까지 ~10초 이상 로딩 스피너가 뜬다.
async function waitForGameReady(page) {
  await page.waitForSelector(BADGE, { timeout: 60000 });
}

async function createRoom(page) {
  await page.getByPlaceholder("Room title").fill(ROOM);
  await page.getByRole("button", { name: "Create" }).click();
  await waitForGameReady(page);
}

async function joinRoom(page) {
  // 방 목록에 ROOM 이 나타날 때까지 새로고침하며 대기.
  const row = page.getByRole("listitem").filter({ hasText: ROOM });
  for (let i = 0; i < 15 && !(await row.count()); i++) {
    await page.getByRole("button", { name: "Refresh room list" }).click();
    await sleep(1000);
  }
  await row.getByRole("button", { name: "Join" }).click();
  await waitForGameReady(page);
}

// 배지가 기대 수가 될 때까지 폴링(presence sync + fetch 수렴 대기).
async function waitForCount(page, expected, timeoutMs = 30000) {
  const badge = page.locator(BADGE);
  const deadline = Date.now() + timeoutMs;
  let last = "?";
  while (Date.now() < deadline) {
    last = (await badge.textContent().catch(() => null))?.trim() ?? "?";
    if (last === String(expected)) return true;
    await sleep(500);
  }
  console.error(`    (마지막 배지 값=${last}, 기대=${expected})`);
  return false;
}

async function openPanelNames(page) {
  await page.getByRole("button", { name: "Toggle Participants" }).click();
  // 패널 헤더가 뜰 때까지 대기(슬라이드 인).
  await page.getByRole("heading", { name: /Participants/ }).waitFor({
    timeout: 10000,
  });
  await sleep(500);
  // 패널 목록 각 행 텍스트 수집(캐릭터 이름은 DOM 에만 있고 캔버스 라벨은 제외됨).
  const texts = await page.locator("ul li").allInnerTexts();
  return texts.map((t) => t.replace(/\s+/g, " ").trim());
}

const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
const pages = [];

try {
  // 1) Alice 생성·입장
  for (let i = 0; i < NAMES.length; i++) {
    const ctx = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      permissions: ["microphone"],
    });
    const page = await ctx.newPage();
    page.on("pageerror", (e) =>
      console.warn(`  [${NAMES[i]}] pageerror: ${e.message}`)
    );
    // RTK(Cloudflare) join 실패는 게임 화면(isReady)을 막아 로스터 자체가 시작 안 된다.
    // 원인이 우리 코드가 아닌 RTK/네트워크임을 드러내기 위해 관련 콘솔 에러를 표면화한다.
    page.on("console", (m) => {
      if (
        m.type() === "error" &&
        /join|realtime|websocket|cloudflare/i.test(m.text())
      ) {
        console.warn(`  [${NAMES[i]}] rtk: ${m.text().slice(0, 120)}`);
      }
    });
    await page.goto(BASE, { waitUntil: "networkidle" });
    await enterName(page, NAMES[i]);
    if (i === 0) {
      console.log(`${NAMES[i]}: 방 생성·입장 (${ROOM})`);
      await createRoom(page);
    } else {
      console.log(`${NAMES[i]}: 방 입장`);
      await joinRoom(page);
    }
    await sleep(3000); // 씬 create + 최초 등록/track
    pages.push(page);
  }

  // presence sync 수렴 여유.
  await sleep(4000);

  // 2) 각 클라이언트 검증
  for (let i = 0; i < pages.length; i++) {
    const who = NAMES[i];
    console.log(`\n[${who}] 화면 검증`);
    const okCount = await waitForCount(pages[i], 3);
    check(okCount, `${who}: 참여자 배지 = 3`);

    const names = await openPanelNames(pages[i]);
    for (const other of NAMES) {
      check(
        names.some((n) => n.includes(other)),
        `${who}: 패널에 ${other} 보임`
      );
    }
  }
} finally {
  await browser.close();
  // 테스트 흔적 정리(best-effort).
  try {
    const rooms = (
      await supabase.from("rooms").select("id").eq("title", ROOM)
    ).data;
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
  process.exitCode = 1;
} else {
  console.log("\n✅ 통과: 3 클라이언트 모두 서로를 봄 (기존 유저 누락 없음)");
}
