#!/usr/bin/env node
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
 * E2E 캡처: 바텀바 정렬 잔여 이슈 수정 확인 (issue #37 / PR #38)
 *   IconButton 고정 높이(h-[50px]) + 세로 중앙 정렬 적용 후, 채팅/나가기 아이콘이
 *   오디오/스마일/마이크와 같은 세로선에 정렬되는지 육안 검사용 크롭 캡처.
 *   → /tmp/sv-review/issue37/05_bottombar_final.png
 *
 * 실행: node e2e/issue37-bottombar-final.mjs
 * 전제: 앱이 떠 있어야 한다(npm start, http://localhost:3000).
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const OUT = "/tmp/sv-review/issue37";
const BOTTOM_BAR_HEIGHT = 48; // src/constants/scene.ts
fs.mkdirSync(OUT, { recursive: true });

const LAUNCH_ARGS = [
  "--no-sandbox", "--disable-dev-shm-usage",
  "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist", "--enable-webgl",
  "--autoplay-policy=no-user-gesture-required",
  "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const errors = [];
  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();

  page.on("pageerror", (e) => { errors.push(e.message); });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error(" [Console Error]", msg.text());
  });

  try {
    console.log("▶ 로비 진입:", BASE);
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
    for (let i = 0; i < 12; i++) {
      if ((await page.getByText(/Loading assets/i).count()) === 0) break;
      await sleep(1000);
    }
    await sleep(1000);

    console.log("▶ 이름 입력 + 방 생성");
    await page.getByPlaceholder("e.g. Mina").fill("리액션QA");
    await sleep(300);
    await page.getByPlaceholder("Room title").fill("bottombar-" + Date.now());
    await page.getByRole("button", { name: "Create" }).click();

    // 바텀바 아이콘은 RealtimeKit 미팅 join(비동기) 이후에야 렌더된다. 폴링한다.
    let bottombar = false;
    const toggle = page.getByLabel("Toggle Reactions");
    for (let i = 0; i < 60; i++) {
      if ((await toggle.count()) > 0 && (await toggle.first().isVisible())) {
        bottombar = true;
        break;
      }
      await sleep(1000);
    }
    await sleep(1500);
    console.log("  바텀바(Toggle Reactions) 표시:", bottombar);

    // 각 아이콘 버튼의 중심 y 를 읽어 세로 정렬을 수치로 검증한다.
    const labels = [
      "Select Microphone",
      "Toggle Chat",
      "Toggle Reactions",
      "Mute Microphone",
      "Unmute Microphone",
      "Exit",
    ];
    const centers = {};
    for (const label of labels) {
      const el = page.getByLabel(label).first();
      if ((await el.count()) > 0) {
        const box = await el.boundingBox();
        if (box) centers[label] = +(box.y + box.height / 2).toFixed(1);
      }
    }
    console.log("  아이콘 세로 중심(y):", JSON.stringify(centers));
    const ys = Object.values(centers);
    if (ys.length >= 2) {
      const spread = +(Math.max(...ys) - Math.min(...ys)).toFixed(1);
      console.log(`  세로 중심 편차(min~max): ${spread}px  → ${spread <= 2 ? "정렬 OK" : "여전히 어긋남"}`);
    }

    // 아이콘 클러스터(우측)를 확대 크롭해 세로 중앙 정렬을 육안 검사 가능하게 한다.
    console.log("▶ 05: 바텀바 정렬 최종 캡처 (피커 닫힘)");
    await page.screenshot({
      path: `${OUT}/05_bottombar_final.png`,
      clip: { x: 760, y: 800 - BOTTOM_BAR_HEIGHT - 8, width: 520, height: BOTTOM_BAR_HEIGHT + 8 },
    });
    console.log(`  → ${OUT}/05_bottombar_final.png`);

    console.log("\n================ 결과 ================");
    console.log("바텀바 감지:", bottombar);
    console.log("런타임 에러:", errors.length ? errors.slice(0, 8).join(" | ") : "없음");
    console.log("=====================================");
  } catch (e) {
    console.error("스크립트 오류:", e.message);
    errors.push(e.message);
    await page.screenshot({ path: `${OUT}/05_bottombar_final.png` }).catch(() => {});
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
