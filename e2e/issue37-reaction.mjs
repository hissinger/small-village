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
 * E2E 검증: PR #38 "이모지 리액션" (issue #37)
 *   검증 A (DOM, 핵심): 바텀바 리액션 토글 → 이모지 그리드(6개) 노출
 *   검증 B (broadcast): 이모지 클릭 → Supabase realtime WS 로 reaction broadcast 송신
 *   검증 C (canvas, 보조): 리액션 발동 후 Phaser 캔버스 nonBlackPct 변화
 *
 * 실행: node e2e/issue37-reaction.mjs
 * 전제: 앱이 떠 있어야 한다(npm start, http://localhost:3000).
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const OUT = "/tmp/sv-review/issue37";
fs.mkdirSync(OUT, { recursive: true });

// interactive-review.mjs 의 LAUNCH_ARGS 재사용 (swiftshader/webgl/미디어 페이크)
const LAUNCH_ARGS = [
  "--no-sandbox", "--disable-dev-shm-usage",
  "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist", "--enable-webgl",
  "--autoplay-policy=no-user-gesture-required",
  "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// interactive-review.mjs 재사용: 가장 큰 캔버스의 비검은 픽셀 비율.
async function analyzeBiggestCanvas(page) {
  const res = await page.evaluate(() => {
    const cvs = Array.from(document.querySelectorAll("canvas"));
    if (!cvs.length) return { hasCanvas: false };
    let big = cvs[0];
    for (const c of cvs) if (c.width * c.height > big.width * big.height) big = c;
    return { hasCanvas: true, w: big.width, h: big.height, url: big.toDataURL("image/png") };
  });
  if (!res.hasCanvas) return res;
  const stats = await page.evaluate(async (url) => {
    const img = new Image();
    await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = url; });
    const off = document.createElement("canvas"); off.width = img.width; off.height = img.height;
    const ctx = off.getContext("2d"); ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, off.width, off.height);
    let nb = 0; const total = data.length / 4;
    for (let i = 0; i < data.length; i += 4) { if (data[i] + data[i + 1] + data[i + 2] > 24) nb++; }
    return { nonBlackPct: +(100 * nb / total).toFixed(1) };
  }, res.url);
  return { ...res, ...stats };
}

(async () => {
  const result = { A: "fail", B: "fail", C: "n/a" };
  const errors = [];
  // Supabase realtime WS 프레임에서 reaction broadcast 송신 감시
  const sentReactionFrames = [];
  const sentBroadcastFrames = [];

  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();

  page.on("pageerror", (e) => { errors.push(e.message); });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error(" [Console Error]", msg.text());
  });

  page.on("websocket", (ws) => {
    if (!/realtime/i.test(ws.url())) return;
    console.log(" [WS] realtime 연결:", ws.url().slice(0, 80));
    ws.on("framesent", (frame) => {
      const p = typeof frame.payload === "string" ? frame.payload : "";
      if (p.includes('"event":"broadcast"') || p.includes('"broadcast"')) {
        sentBroadcastFrames.push(p.slice(0, 200));
      }
      if (p.includes('"reaction"') || p.includes("\\ud83d") /* emoji surrogate */) {
        sentReactionFrames.push(p.slice(0, 300));
      }
    });
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
    await page.getByPlaceholder("Room title").fill("reaction-" + Date.now());
    await page.getByRole("button", { name: "Create" }).click();

    // 바텀바 대기 (리액션 토글 버튼이 뜰 때까지)
    let bottombar = false;
    try {
      await page.getByLabel("Toggle Reactions").waitFor({ timeout: 25000 });
      bottombar = true;
    } catch {}
    await sleep(2500);
    console.log("  바텀바(Toggle Reactions):", bottombar);

    // ── 검증 C 준비: 리액션 전 캔버스 상태 ──
    const beforeCanvas = await analyzeBiggestCanvas(page);

    // ── 검증 A: 리액션 토글 → 이모지 그리드 ──
    console.log("▶ 검증 A: 리액션 피커 토글");
    await page.getByLabel("Toggle Reactions").click();
    await sleep(600);
    const emojiButtons = page.getByLabel(/^reaction-/);
    const emojiCount = await emojiButtons.count();
    console.log("  이모지 그리드 버튼 개수:", emojiCount);
    if (emojiCount === 6) result.A = "pass";
    await page.screenshot({ path: `${OUT}/01_reaction_picker.png` });
    console.log("  → 01_reaction_picker.png");

    // ── 검증 B: 이모지 클릭 → broadcast 송신 ──
    console.log("▶ 검증 B: 이모지 클릭 → broadcast 송신 감시");
    const beforeReactionFrames = sentReactionFrames.length;
    const beforeBroadcastFrames = sentBroadcastFrames.length;
    if (emojiCount > 0) {
      // ❤️ 우선, 없으면 첫 버튼
      const heart = page.getByLabel("reaction-❤️");
      if (await heart.count()) await heart.click();
      else await emojiButtons.first().click();
    }
    await sleep(1500);
    const newReaction = sentReactionFrames.length - beforeReactionFrames;
    const newBroadcast = sentBroadcastFrames.length - beforeBroadcastFrames;
    console.log("  reaction 포함 WS 프레임 송신:", newReaction);
    console.log("  broadcast WS 프레임 송신:", newBroadcast);
    if (sentReactionFrames.length > 0) {
      console.log("  샘플 프레임:", sentReactionFrames[sentReactionFrames.length - 1]);
    }
    if (newReaction > 0 || newBroadcast > 0) result.B = "pass";

    // ── 검증 C: 리액션 발동 후 캔버스 변화 ──
    console.log("▶ 검증 C: 캔버스 nonBlackPct 변화 (300ms~1s)");
    await sleep(400);
    const afterCanvas = await analyzeBiggestCanvas(page);
    const beforePct = beforeCanvas.hasCanvas ? beforeCanvas.nonBlackPct : null;
    const afterPct = afterCanvas.hasCanvas ? afterCanvas.nonBlackPct : null;
    console.log("  nonBlackPct before:", beforePct, "after:", afterPct);
    console.log("  ※ headless 는 emoji 폰트 부재로 tofu/공백일 수 있음 — 캔버스는 보조 지표");
    if (afterCanvas.hasCanvas) result.C = afterPct !== beforePct ? "changed" : "no-change";
    await page.screenshot({ path: `${OUT}/02_game_after_reaction.png` });
    console.log("  → 02_game_after_reaction.png");

    // ─────── 최종 보고 ───────
    console.log("\n================ 검증 결과 ================");
    console.log(`검증 A (이모지 그리드 6개 노출): ${result.A}  (버튼 ${emojiCount}개)`);
    console.log(`검증 B (broadcast 송신 감지):    ${result.B}  (reaction프레임 ${newReaction}, broadcast프레임 ${newBroadcast})`);
    console.log(`검증 C (캔버스 변화, 보조):       ${result.C}  (before ${beforePct} → after ${afterPct})`);
    console.log("런타임 에러:", errors.length ? errors.slice(0, 8).join(" | ") : "없음");
    console.log("스크린샷:");
    console.log(`  ${OUT}/01_reaction_picker.png`);
    console.log(`  ${OUT}/02_game_after_reaction.png`);
    console.log("==========================================");
  } catch (e) {
    console.error("스크립트 오류:", e.message);
    errors.push(e.message);
    // 실패해도 현 상태 스크린샷 남긴다
    await page.screenshot({ path: `${OUT}/02_game_after_reaction.png` }).catch(() => {});
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
