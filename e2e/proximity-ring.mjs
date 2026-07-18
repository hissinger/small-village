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
 * E2E: proximity ring(#29) 이 내 캐릭터에만 뜨고, 내가 움직이면 따라오는지
 * 실제 브라우저로 검증한다. 반경식 회귀는 유닛 테스트(proximityRing.test.ts)가
 * 막으므로, 이 스크립트는 유닛이 커버하지 못하는 self-정렬·이동추종의 보조 증거다.
 *
 * 판정(프로그램적):
 *  - 입장 직후 / 이동 후 두 시점에 `proximityRing()` 게터와 `myPosition()` 을 읽어
 *    ring 중심이 self 발밑(sprite.y + offsetY)에 정렬됐는지 허용오차(<1px)로 assert.
 *    게터가 null(미생성)이면 실패.
 * 보조 증거(육안):
 *  - 스크린샷 A(입장 직후) / B(이동 후) 를 /tmp/sv-review/ 에 저장한다.
 *
 * 전제(실제 백엔드가 필요한 통합 테스트다):
 *  1) 앱이 떠 있어야 한다 (`npm start`) — 기본 http://localhost:3000,
 *     E2E_BASE_URL 로 override.
 *  2) .env.local 에 REACT_APP_SUPABASE_URL/KEY 가 있어야 한다(정리용).
 *  3) 최초 1회 브라우저 설치: `npx playwright install chromium`.
 *
 * 실행: `node e2e/proximity-ring.mjs`
 */

import fs from "node:fs";
import pw from "playwright";
import { createClient } from "@supabase/supabase-js";

const { chromium } = pw;
const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const ROOM_TITLE = "e2e-proximity-ring";
const SHOT_DIR = "/tmp/sv-review";

// 스크린샷 저장 디렉터리 보장(없으면 생성).
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

// ring 중심이 self 발밑에 정렬됐는지 프로그램적으로 판정한다.
// 게터(r)는 raw float, myPosition(p)은 Math.round 값이라 정확 일치 대신 <1px 허용오차로 본다.
// 기대 y 는 게터가 노출한 r.offsetY 로 계산(리터럴 30 하드코딩 금지). 게터 null 이면 실패.
async function ringAlignsWithSelf(page) {
  return page.evaluate(() => {
    const r = window.__smallVillage.proximityRing();
    const p = window.__smallVillage.myPosition();
    if (!r || !p) return false; // ring 미생성/미준비 방어(게터 null)
    return Math.abs(r.x - p.x) < 1 && Math.abs(r.y - (p.y + r.offsetY)) < 1;
  });
}

const browser = await chromium.launch();
const page = await (await browser.newContext()).newPage();

try {
  console.log(`로비 로드: ${BASE}/?e2e`);
  // ?e2e 쿼리로 e2e 훅(window.__smallVillage) 활성화.
  await page.goto(`${BASE}/?e2e`, { waitUntil: "networkidle" });

  await page.getByPlaceholder("e.g. Mina").fill("E2EBot");
  await page.getByPlaceholder("Room title").fill(ROOM_TITLE);
  await page.getByRole("button", { name: "Create" }).click();

  await page.waitForSelector("canvas", { timeout: 20000 });
  await page.waitForTimeout(3000); // 씬 create() + 최초 등록 + ring draw

  // [판정] 입장 직후 좌표 assert
  if (!(await ringAlignsWithSelf(page))) {
    fail("입장 직후 ring 이 self 발밑에 정렬되지 않음(게터 null 포함)");
  } else {
    console.log("✅ 입장 직후: ring 이 self 발밑에 정렬됨");
  }

  // [보조 증거] 스크린샷 A — self 발밑에 fill+edge 원 1개(self-only),
  // 500px 경계선 원이 decoration 위에 overlay 되는지 육안 확인.
  await page.screenshot({ path: `${SHOT_DIR}/issue-29-a-enter.png` });

  const canvas = await page.$("canvas");
  await canvas.click({ position: { x: 60, y: 60 } }).catch(() => {});

  console.log("캐릭터 이동...");
  for (const key of ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"]) {
    await page.keyboard.down(key);
    await page.waitForTimeout(700);
    await page.keyboard.up(key);
  }
  await page.waitForTimeout(1000);

  // [판정] 이동 후 좌표 assert — 이동에도 ring 이 발밑을 유지·추종하는지
  if (!(await ringAlignsWithSelf(page))) {
    fail("이동 후 ring 이 self 를 따라오지 않음(게터 null 포함)");
  } else {
    console.log("✅ 이동 후: ring 이 self 를 따라옴");
  }

  // [보조 증거] 스크린샷 B — 원이 캐릭터를 따라 발밑에 유지된 채 이동했는지 육안 확인.
  await page.screenshot({ path: `${SHOT_DIR}/issue-29-b-moved.png` });
  console.log(`스크린샷 저장: ${SHOT_DIR}/issue-29-a-enter.png, issue-29-b-moved.png`);
} finally {
  await browser.close();
}

// 테스트가 만든 rooms/users 흔적 정리 (best-effort — 매 실행 방 row leak 방지)
// 판정 exit code 는 정리 성공/실패와 무관하다.
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

if (!process.exitCode) console.log("✅ 통과: ring self-정렬·이동추종 확인");
