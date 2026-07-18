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

// headless WebGL 은 GPU 드라이버 부재로 캔버스가 검게 나온다 → SwiftShader 소프트웨어
// 렌더링 플래그 강제(issue37-verify-final.mjs 와 동일 레시피).
const LAUNCH_ARGS = [
  "--no-sandbox", "--disable-dev-shm-usage",
  "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist", "--enable-webgl",
  "--autoplay-policy=no-user-gesture-required",
  "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
];
const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
// 게터가 준비될 때까지 폴링(로딩 오버레이/씬 create 타이밍에 따라 undefined 가 될 수 있어 방어).
async function waitForHook(timeoutMs = 40000) {
  const t0 = Date.now();
  while (Date.now() - t0 < timeoutMs) {
    const ok = await page.evaluate(
      () =>
        !!(window.__smallVillage && window.__smallVillage.proximityRing && window.__smallVillage.proximityRing())
    );
    if (ok) return true;
    await sleep(1000);
  }
  return false;
}

try {
  console.log(`로비 로드: ${BASE}/?e2e`);
  // ?e2e 쿼리로 e2e 훅(window.__smallVillage) 활성화.
  await page.goto(`${BASE}/?e2e`, { waitUntil: "networkidle" });

  // 로딩 오버레이("Loading assets…")가 사라질 때까지 대기 — 입력 타이밍보다 앞서야
  // placeholder 채움이 오버레이에 가려 무시되는 회귀를 막는다(issue37 패턴).
  for (let i = 0; i < 12; i++) {
    if ((await page.getByText(/Loading assets/i).count()) === 0) break;
    await sleep(1000);
  }
  await sleep(1000);

  await page.getByPlaceholder("e.g. Mina").fill("E2EBot");
  await page.getByPlaceholder("Room title").fill(ROOM_TITLE);
  await page.getByRole("button", { name: "Create" }).click();

  // 씬 create() + 최초 등록 + ring draw — 게터 노출까지 폴링 대기(고정 sleep 대신).
  const ready = await waitForHook();
  if (!ready) fail("씬/게터 준비 타임아웃 — ring 이 생성되지 않음");

  // [판정] 입장 직후 좌표 assert
  if (!(await ringAlignsWithSelf(page))) {
    fail("입장 직후 ring 이 self 발밑에 정렬되지 않음(게터 null 포함)");
  } else {
    console.log("✅ 입장 직후: ring 이 self 발밑에 정렬됨");
  }

  // [판정] 가시성 픽셀 검증 — 좌표 assert 만으로는 "안 보임"을 못 잡는다(과거 회귀).
  // 캔버스 중앙(카메라가 캐릭터 추종) 기준 FILL(120px) 영역에 링 색(0x38bdf8 파랑계열)
  // 픽셀이 최소 threshold 개수 있어야 렌더됐다고 본다.
  const visible = await page.evaluate(() => {
    const c = document.querySelector("canvas");
    if (!c || c.width < 10) return -1;
    const tmp = document.createElement("canvas");
    tmp.width = c.width; tmp.height = c.height;
    const ctx = tmp.getContext("2d");
    ctx.drawImage(c, 0, 0);
    const d = ctx.getImageData(0, 0, c.width, c.height).data;
    const cx = c.width / 2, cy = c.height / 2, R = 120;
    let cnt = 0;
    for (let y = Math.max(0, cy - R); y < Math.min(c.height, cy + R); y++) {
      for (let x = Math.max(0, cx - R); x < Math.min(c.width, cx + R); x++) {
        if ((x - cx) ** 2 + (y - cy) ** 2 > R * R) continue;
        const i = (y * c.width + x) * 4;
        const r = d[i], g = d[i + 1], b = d[i + 2];
        if (b > g + 30 && g > r + 20) cnt++; // 파랑계열(링 색)
      }
    }
    return cnt;
  });
  // FILL(120px) 원 면적 ~ π*120² ≈ 45k px 중 링 색이 차지하는 최소 기대치.
  // alpha 0.18 채움 + 3px stroke 가 섞이면 수백~수천 px 는 나와야 정상. 50 미만이면 미렌더.
  if (visible < 50) {
    fail(`ring 이 캔버스에 렌더되지 않음(중심 120px 내 파랑픽셀 ${visible}개 < 50)`);
  } else {
    console.log(`✅ 가시성: 캐릭터 중심 120px 내 링 색 픽셀 ${visible}개`);
  }

  // 스크린샷 A 앞 인게임 진입 확정 대기 — "Strolling into…" 오버레이가 사라지고
  // 바텀바(Exit)가 떠 있어야 실제 게임 화면을 찍는다(로딩 화면 오탐 방지).
  for (let i = 0; i < 30; i++) {
    const strolling = (await page.getByText(/Strolling into/i).count()) > 0;
    const exitVisible =
      (await page.getByLabel("Exit").count()) > 0 &&
      (await page.getByLabel("Exit").first().isVisible().catch(() => false));
    if (!strolling && exitVisible) break;
    await sleep(1000);
  }
  await sleep(800);

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
