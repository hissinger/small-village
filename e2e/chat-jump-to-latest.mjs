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
 * E2E: 채팅 "최근 메시지로 이동" 버튼 + auto-stick 스크롤.
 *
 * 이 기능이 막는 회귀: 과거 메시지를 보려고 위로 스크롤해도, 새 메시지가 오면
 * 스크롤이 강제로 맨 아래로 끌려 내려가 읽던 위치를 잃던 동작.
 *
 * 검증(실제 브라우저 레이아웃이 있어야 scrollHeight/clientHeight 가 의미를 가진다 →
 * jsdom 단위 테스트로는 못 잡는 부분이라 e2e 로 둔다):
 *   1) 대량 메시지를 보내면 목록이 넘치고 맨 아래에 자동으로 붙는다(버튼 숨김).
 *   2) 위로 스크롤하면 "최근 메시지로 이동" 버튼이 뜬다.
 *   3) 버튼을 누르면 맨 아래로 돌아가고 버튼이 사라진다.
 *   4) 위로 스크롤한 상태에서 "다른 사람"이 보낸 메시지가 오면
 *      → 스크롤 위치는 유지되고(맨 아래로 안 끌려감), 버튼에 "새 메시지 N개" 배지가 뜬다. ★핵심 회귀
 *   5) 버튼을 누르면 맨 아래로 이동 + 배지 사라지고 그 새 메시지가 보인다.
 *
 * 전제(실제 백엔드 통합 테스트):
 *   1) 앱이 떠 있어야 한다 — 기본 http://localhost:3000 (E2E_BASE_URL 로 override).
 *   2) .env.local 에 REACT_APP_SUPABASE_URL/KEY (정리용).
 *   3) 최초 1회: `npx playwright install chromium`.
 *
 * 실행: `node e2e/chat-jump-to-latest.mjs`
 */

import fs from "node:fs";
import pw from "playwright";
import { createClient } from "@supabase/supabase-js";

const { chromium } = pw;
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const ROOM = `e2e-chat-${Date.now()}`;
const BULK = 25; // 스크롤 영역을 확실히 넘기기 위한 Alice 의 메시지 수
const BOB_MSG = `BOB-${Date.now()}`;

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

// 헤드리스에서 씬(WebGL)·RTK join 을 위해.
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
const SCROLL = '[data-testid="chat-scroll"]';
const JUMP = '[data-testid="chat-jump-button"]';

async function enterName(page, name) {
  await page.getByPlaceholder("e.g. Mina").fill(name);
}

// 게임 진입 확인은 캔버스가 아니라 배지(BottomBar 마운트=isReady)로 판정한다.
async function waitForGameReady(page) {
  await page.waitForSelector(BADGE, { timeout: 60000 });
}

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

async function openChat(page) {
  await page.getByRole("button", { name: "Toggle Chat" }).click();
  await page.waitForSelector(SCROLL, { state: "visible", timeout: 10000 });
}

async function sendChat(page, text) {
  const input = page.getByPlaceholder("Type a message...");
  await input.fill(text);
  await input.press("Enter");
}

// 스크롤 컨테이너의 기하 정보를 읽는다. self:true 라 내가 보낸 메시지도 되돌아와 목록에 쌓인다.
// 자식 수 = 메시지 수 + 맨 아래 sentinel div 1개.
async function scrollState(page) {
  return page.locator(SCROLL).evaluate((el) => ({
    scrollTop: el.scrollTop,
    scrollHeight: el.scrollHeight,
    clientHeight: el.clientHeight,
    childCount: el.children.length,
    atBottom: el.scrollHeight - el.scrollTop - el.clientHeight <= 50,
    overflowing: el.scrollHeight - el.clientHeight > 50,
  }));
}

async function pollScroll(page, pred, timeoutMs = 15000) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await scrollState(page);
    if (pred(last)) return last;
    await sleep(300);
  }
  return last;
}

const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
const contexts = [];

async function newClient(name) {
  const ctx = await browser.newContext({
    viewport: { width: 1280, height: 800 },
    permissions: ["microphone"],
  });
  contexts.push(ctx);
  const page = await ctx.newPage();
  page.on("pageerror", (e) => console.warn(`  [${name}] pageerror: ${e.message}`));
  await page.goto(BASE, { waitUntil: "networkidle" });
  await enterName(page, name);
  return page;
}

try {
  // ── 1) Alice 방 생성·입장, 채팅 열고 대량 전송 ─────────────────────────────
  console.log(`Alice: 방 생성·입장 (${ROOM})`);
  const alice = await newClient("Alice");
  await createRoom(alice);
  await sleep(2000);
  await openChat(alice);

  console.log(`Alice: 메시지 ${BULK}건 전송`);
  for (let i = 1; i <= BULK; i++) {
    await sendChat(alice, `A-${i}`);
    await sleep(120);
  }
  // 모든 메시지 도착(childCount) + 넘침 + 맨 아래 붙음까지 대기.
  const filled = await pollScroll(
    alice,
    (s) => s.childCount >= BULK + 1 && s.overflowing && s.atBottom
  );
  check(filled?.overflowing, "대량 전송 후 목록이 스크롤 영역을 넘침");
  check(filled?.atBottom, "전송 직후 맨 아래에 자동으로 붙어 있음(auto-stick)");
  check(
    !(await alice.locator(JUMP).isVisible()),
    "맨 아래에서는 점프 버튼이 숨겨져 있음"
  );

  // ── 2) 위로 스크롤 → 버튼 노출 ────────────────────────────────────────────
  console.log("Alice: 맨 위로 스크롤");
  await alice.locator(SCROLL).evaluate((el) => (el.scrollTop = 0));
  await alice.locator(JUMP).waitFor({ state: "visible", timeout: 5000 });
  check(
    await alice.locator(JUMP).isVisible(),
    "위로 스크롤하면 점프 버튼이 노출됨(B1)"
  );

  // ── 3) 버튼 클릭 → 맨 아래 복귀 ───────────────────────────────────────────
  console.log("Alice: 점프 버튼 클릭");
  await alice.locator(JUMP).click();
  const backDown = await pollScroll(alice, (s) => s.atBottom, 5000);
  check(backDown?.atBottom, "버튼 클릭 시 맨 아래로 이동");
  await alice.locator(JUMP).waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  check(
    !(await alice.locator(JUMP).isVisible()),
    "맨 아래 복귀 후 버튼이 사라짐"
  );

  // ── 4) 다시 위로 스크롤 후, Bob 이 보낸 메시지 도착 → 위치 유지 + 배지 ─────
  console.log("Alice: 다시 맨 위로 스크롤");
  await alice.locator(SCROLL).evaluate((el) => (el.scrollTop = 0));
  await alice.locator(JUMP).waitFor({ state: "visible", timeout: 5000 });
  const beforeBob = await scrollState(alice);

  console.log("Bob: 방 입장 후 메시지 전송");
  const bob = await newClient("Bob");
  await joinRoom(bob);
  await sleep(2000);
  await openChat(bob);
  await sendChat(bob, BOB_MSG);

  // Alice: 배지가 뜰 때까지(원격 메시지 반영) 대기.
  const badgeText = await (async () => {
    const deadline = Date.now() + 15000;
    while (Date.now() < deadline) {
      const t = (await alice.locator(JUMP).innerText().catch(() => "")) || "";
      if (/새 메시지\s*\d+개/.test(t)) return t.replace(/\s+/g, " ").trim();
      await sleep(400);
    }
    return "";
  })();
  const afterBob = await scrollState(alice);

  check(/새 메시지\s*\d+개/.test(badgeText), `안 읽은 배지 노출: "${badgeText}"`);
  check(
    !afterBob.atBottom && afterBob.scrollTop <= beforeBob.scrollTop + 30,
    "★원격 메시지가 와도 스크롤이 맨 아래로 끌려가지 않고 위치 유지"
  );

  // ── 5) 버튼 클릭 → 맨 아래로 이동 + 새 메시지 보임 + 배지 사라짐 ───────────
  console.log("Alice: 점프 버튼 클릭(새 메시지 확인)");
  await alice.locator(JUMP).click();
  const finalDown = await pollScroll(alice, (s) => s.atBottom, 5000);
  check(finalDown?.atBottom, "버튼 클릭 시 맨 아래로 이동(새 메시지까지)");
  check(
    await alice.getByText(BOB_MSG).isVisible(),
    "맨 아래에서 Bob 의 새 메시지가 보임"
  );
  await alice.locator(JUMP).waitFor({ state: "hidden", timeout: 5000 }).catch(() => {});
  check(
    !(await alice.locator(JUMP).isVisible()),
    "맨 아래 복귀 후 배지/버튼이 사라짐"
  );
} finally {
  await browser.close();
  // 테스트 흔적 정리(best-effort).
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
  process.exitCode = 1;
} else {
  console.log("\n✅ 통과: 점프 버튼 + auto-stick + 위치 유지(원격 메시지) 모두 정상");
}
