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
 * E2E 스모크: 방 생성 → 입장 → 캐릭터 이동을 실제 브라우저로 돌리며
 * `POST /rest/v1/users` 응답을 감시한다. 한 건이라도 409(Conflict)가 나오면
 * 실패로 종료한다.
 *
 * 이 흐름은 과거 회귀를 재현·방지한다:
 *  - 이동 upsert 가 room_id 를 누락하거나(FK 위반),
 *  - 방(rooms row)이 없는데 입장해서(위치 write 마다 FK 409 flood).
 *
 * 전제(실제 백엔드가 필요한 통합 테스트다):
 *  1) 앱이 떠 있어야 한다 (`npm start`) — 기본 http://localhost:3000,
 *     E2E_BASE_URL 로 override.
 *  2) .env.local 에 REACT_APP_SUPABASE_URL/KEY 가 있어야 한다(정리용).
 *  3) 최초 1회 브라우저 설치: `npx playwright install chromium`.
 *
 * 실행: `npm run test:e2e`
 */

import fs from "node:fs";
import pw from "playwright";
import { createClient } from "@supabase/supabase-js";

const { chromium } = pw;
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";

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

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();

const posts = []; // { status }
page.on("response", (res) => {
  const url = res.url();
  if (url.includes("/rest/v1/users") && res.request().method() === "POST") {
    posts.push({ status: res.status() });
  }
});

try {
  console.log(`로비 로드: ${BASE}`);
  await page.goto(BASE, { waitUntil: "networkidle" });

  await page.getByPlaceholder("e.g. Mina").fill("E2EBot");
  await page.getByPlaceholder("Room title").fill("e2e-room-flow");
  await page.getByRole("button", { name: "Create" }).click();

  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.waitForTimeout(3000); // 씬 create() + 최초 등록

  const canvas = await page.$("canvas");
  await canvas.click({ position: { x: 60, y: 60 } }).catch(() => {});

  console.log("캐릭터 이동...");
  for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
    await page.keyboard.down(key);
    await page.waitForTimeout(700);
    await page.keyboard.up(key);
  }
  await page.waitForTimeout(1000);
} finally {
  await browser.close();
}

const conflicts = posts.filter((p) => p.status === 409).length;
const ok = posts.filter((p) => p.status < 300).length;
console.log(`POST /users: 총 ${posts.length}건, 성공 ${ok}, 409 ${conflicts}`);

if (posts.length === 0) fail("users write 가 한 건도 없다 — 흐름이 깨졌을 수 있음");
if (conflicts > 0) fail(`409 Conflict ${conflicts}건 발생`);

// 테스트가 만든 rooms/users 흔적 정리 (best-effort)
try {
  const rooms = (
    await supabase.from("rooms").select("id").eq("title", "e2e-room-flow")
  ).data;
  for (const r of rooms || []) {
    await supabase.from("users").delete().eq("room_id", r.id);
    await supabase.from("rooms").delete().eq("id", r.id);
  }
} catch (e) {
  console.warn("정리 중 경고:", e?.message);
}

if (!process.exitCode) console.log("✅ 통과: 409 없음");
