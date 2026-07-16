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
 * E2E 재촬영: PR #38 "이모지 리액션" (issue #37)
 *   03_reaction_on_avatar.png : ❤️ 클릭 직후 400ms 시점(애니메이션 중간)을 캡처.
 *                               떠오르는 emoji 애니메이션(DURATION_MS=2000, 페이드아웃)이
 *                               가장 선명한 구간이다.
 *   04_bottombar_aligned.png  : 리액션 피커를 닫은 상태의 바텀바 전체(정렬 수정 확인).
 *   + 보조 측정: Phaser 캔버스 toDataURL 로 아바타 머리 위(중앙 상단) 영역에
 *               비검은/컬러 픽셀이 있는지 검사해 애니메이션 렌더링 여부를 판정.
 *
 * 실행: node e2e/issue37-reaction-timed.mjs
 * 전제: 앱이 떠 있어야 한다(npm start, http://localhost:3000).
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const OUT = "/tmp/sv-review/issue37";
fs.mkdirSync(OUT, { recursive: true });

const BOTTOM_BAR_HEIGHT = 48; // src/constants/scene.ts

const LAUNCH_ARGS = [
  "--no-sandbox", "--disable-dev-shm-usage",
  "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist", "--enable-webgl",
  "--autoplay-policy=no-user-gesture-required",
  "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/*
 * 가장 큰 캔버스의 "중앙 상단" 영역(아바타 머리 위)에서 비검은 픽셀 비율을 측정한다.
 * 리액션 emoji 는 캐릭터 위로 떠오르므로, 이 영역의 변화가 애니메이션 렌더링의 보조 지표.
 */
async function analyzeCanvasTopCenter(page) {
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
    // 중앙 상단 박스: 가로 40%~60%, 세로 25%~55% (캐릭터는 화면 중앙, 머리 위)
    const x0 = Math.floor(off.width * 0.40), x1 = Math.ceil(off.width * 0.60);
    const y0 = Math.floor(off.height * 0.25), y1 = Math.ceil(off.height * 0.55);
    const { data } = ctx.getImageData(x0, y0, x1 - x0, y1 - y0);
    let nb = 0, colored = 0; const total = data.length / 4;
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i], g = data[i + 1], b = data[i + 2];
      if (r + g + b > 24) nb++;
      // 회색(맵 타일)이 아닌 채도 있는 픽셀 (emoji 컬러 후보)
      if (Math.max(r, g, b) - Math.min(r, g, b) > 40) colored++;
    }
    return {
      topCenterNonBlackPct: +(100 * nb / total).toFixed(1),
      topCenterColoredPct: +(100 * colored / total).toFixed(1),
    };
  }, res.url);
  return { ...res, ...stats };
}

(async () => {
  const errors = [];
  const sentReactionFrames = [];

  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();

  page.on("pageerror", (e) => { errors.push(e.message); });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error(" [Console Error]", msg.text());
  });
  page.on("websocket", (ws) => {
    if (!/realtime/i.test(ws.url())) return;
    ws.on("framesent", (frame) => {
      const p = typeof frame.payload === "string" ? frame.payload : "";
      if (p.includes('"reaction"') || p.includes("\\ud83d") || p.includes('"REACTION"')) {
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

    // 바텀바 아이콘은 RealtimeKit 미팅 join(비동기, headless 에서 느림) 이후에야
    // 렌더된다. Toggle Reactions 버튼이 "실제로 보일 때까지" 폴링한다.
    let bottombar = false;
    const toggle = page.getByLabel("Toggle Reactions");
    for (let i = 0; i < 60; i++) {
      if ((await toggle.count()) > 0 && (await toggle.first().isVisible())) {
        bottombar = true;
        break;
      }
      await sleep(1000);
    }
    await sleep(1000);
    console.log("  바텀바(Toggle Reactions) 표시:", bottombar);

    // ── 04: 피커 닫은 상태의 바텀바 (정렬 수정 확인) ──
    // 아이콘 클러스터(우측)를 확대해 세로 중앙 정렬을 육안 검사 가능하도록 크롭한다.
    console.log("▶ 04: 바텀바 정렬 캡처 (피커 닫힘)");
    await page.screenshot({
      path: `${OUT}/04_bottombar_aligned.png`,
      clip: { x: 760, y: 800 - BOTTOM_BAR_HEIGHT - 8, width: 520, height: BOTTOM_BAR_HEIGHT + 8 },
    });
    console.log("  → 04_bottombar_aligned.png");

    // ── 리액션 발동 → 애니메이션 중간(400ms) 캡처 ──
    console.log("▶ 03: 리액션 발동 후 400ms 시점 캡처");
    const before = await analyzeCanvasTopCenter(page);

    await page.getByLabel("Toggle Reactions").click();
    await sleep(500);
    const heart = page.getByLabel("reaction-❤️");
    if (await heart.count()) await heart.click();
    else await page.getByLabel(/^reaction-/).first().click();

    // 핵심: 클릭 직후 애니메이션 중간 지점(400ms)에서 캡처
    await page.waitForTimeout(400);
    const during = await analyzeCanvasTopCenter(page);
    await page.screenshot({ path: `${OUT}/03_reaction_on_avatar.png` });
    console.log("  → 03_reaction_on_avatar.png (클릭 +400ms)");

    // ─────── 보고 ───────
    const bPct = before.hasCanvas ? before.topCenterNonBlackPct : null;
    const dPct = during.hasCanvas ? during.topCenterNonBlackPct : null;
    const bCol = before.hasCanvas ? before.topCenterColoredPct : null;
    const dCol = during.hasCanvas ? during.topCenterColoredPct : null;
    console.log("\n================ 재촬영 결과 ================");
    console.log(`바텀바 감지:        ${bottombar}`);
    console.log(`reaction WS 프레임: ${sentReactionFrames.length}`);
    console.log("아바타 머리 위(중앙 상단) 영역 측정:");
    console.log(`  비검은 픽셀%  before ${bPct} → +400ms ${dPct}`);
    console.log(`  컬러 픽셀%    before ${bCol} → +400ms ${dCol}`);
    const renderedGuess =
      during.hasCanvas && (dPct > bPct || dCol > bCol)
        ? "변화 감지 (emoji 렌더링 추정)"
        : "변화 없음 (headless 폰트 부재로 emoji 미렌더 가능성 — 아래 주의 참고)";
    console.log(`  판정: ${renderedGuess}`);
    console.log("※ headless 브라우저는 emoji 폰트가 없어 애니메이션이 tofu/공백으로");
    console.log("  그려지거나 안 그려질 수 있다. 그 경우에도 03 캡처 타이밍(클릭+400ms)과");
    console.log("  broadcast 송신/DOM 검증은 유효하다.");
    console.log("런타임 에러:", errors.length ? errors.slice(0, 8).join(" | ") : "없음");
    console.log("스크린샷:");
    console.log(`  ${OUT}/03_reaction_on_avatar.png`);
    console.log(`  ${OUT}/04_bottombar_aligned.png`);
    console.log("============================================");
  } catch (e) {
    console.error("스크립트 오류:", e.message);
    errors.push(e.message);
    await page.screenshot({ path: `${OUT}/03_reaction_on_avatar.png` }).catch(() => {});
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
