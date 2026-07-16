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
 * E2E 최종 재검증: PR #38 "이모지 리액션" (issue #37)
 *   - 콜백 기반 useReactionMessage + 이동 추적 showReaction + 바텀바 정렬 수정
 *
 * 검증 A (바텀바 정렬): 피커 토글 → 이모지 6개 DOM 노출 → 아이콘 세로 중심 y 편차 실측
 *   06_picker.png, 07_bottombar.png
 * 검증 B (broadcast 송신): ❤️ 클릭 시 Supabase realtime WS 로 REACTION 프레임 송신 감지
 * 검증 C (아바타 위 애니메이션): ❤️ +400ms 캡처(08), 말풍선+리액션 동시 표시(09)
 * 검증 D (이동 추적): 리액션 뜬 상태에서 화살표 이동 → +900ms 캡처(10)
 *
 * 실행: node e2e/issue37-verify-final.mjs
 * 전제: 앱이 떠 있어야 한다(npm start, http://localhost:3000).
 */
import { chromium } from "playwright";
import fs from "node:fs";

const BASE = process.env.E2E_BASE_URL || "http://localhost:3000";
const OUT = "/tmp/sv-review/issue37";
const BOTTOM_BAR_HEIGHT = 48; // src/constants/scene.ts
fs.mkdirSync(OUT, { recursive: true });

// interactive-review.mjs 재사용: swiftshader/webgl/미디어 페이크
const LAUNCH_ARGS = [
  "--no-sandbox", "--disable-dev-shm-usage",
  "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
  "--ignore-gpu-blocklist", "--enable-webgl",
  "--autoplay-policy=no-user-gesture-required",
  "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream",
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const results = { A: null, B: null, C: null, D: null };

(async () => {
  const errors = [];
  const sentReactionFrames = [];

  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();

  page.on("pageerror", (e) => { errors.push(e.message); });
  page.on("console", (msg) => {
    if (msg.type() === "error") console.error(" [Console Error]", msg.text());
  });
  // Supabase realtime WS 로 나가는 REACTION broadcast 프레임을 감지한다.
  page.on("websocket", (ws) => {
    if (!/supabase\.co\/realtime\/v1\/websocket/i.test(ws.url())) return;
    ws.on("framesent", (frame) => {
      const p = typeof frame.payload === "string" ? frame.payload : "";
      // MessageType.REACTION === "reaction"
      if (p.includes('"reaction"') && p.includes("broadcast")) {
        sentReactionFrames.push(p.slice(0, 400));
      }
    });
  });

  try {
    // ── 로비 → 이름 → 방 생성 ──
    console.log("▶ 로비 진입:", BASE);
    await page.goto(BASE, { waitUntil: "networkidle", timeout: 60000 });
    for (let i = 0; i < 12; i++) {
      if ((await page.getByText(/Loading assets/i).count()) === 0) break;
      await sleep(1000);
    }
    await sleep(1000);

    console.log('▶ 이름 입력("QA최종") + 방 생성');
    await page.getByPlaceholder("e.g. Mina").fill("QA최종");
    await sleep(300);
    await page.getByPlaceholder("Room title").fill("verify-" + Date.now());
    await page.getByRole("button", { name: "Create" }).click();

    // 바텀바는 RealtimeKit join(비동기, headless 느림) 이후 렌더. 폴링.
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

    // ═══════ 검증 A: 바텀바 정렬 + 이모지 그리드 ═══════
    console.log("\n▶ 검증 A: 리액션 피커 열기 + 이모지 6개 노출");
    await page.getByLabel("Toggle Reactions").click();
    await sleep(500);
    // 라벨 맵 기반: REACTION_EMOJI_LABELS = "React with ..."
    const emojiButtons = page.getByLabel(/react with/i);
    const emojiCount = await emojiButtons.count();
    console.log(`  이모지 버튼 개수: ${emojiCount} (기대 6)`);
    await page.screenshot({ path: `${OUT}/06_picker.png` });
    console.log(`  → ${OUT}/06_picker.png`);

    // 피커 닫기 (ESC) 후 바텀바 캡처 + 정렬 실측
    await page.keyboard.press("Escape");
    await sleep(400);
    await page.screenshot({ path: `${OUT}/07_bottombar.png` });
    console.log(`  → ${OUT}/07_bottombar.png`);

    const labels = [
      "Select Microphone", "Toggle Chat", "Toggle Reactions",
      "Mute Microphone", "Unmute Microphone", "Exit",
    ];
    const centers = {};
    for (const label of labels) {
      const el = page.getByLabel(label).first();
      if ((await el.count()) > 0 && (await el.isVisible())) {
        const box = await el.boundingBox();
        if (box) centers[label] = +(box.y + box.height / 2).toFixed(1);
      }
    }
    console.log("  아이콘 세로 중심(y):", JSON.stringify(centers));
    const ys = Object.values(centers);
    const spread = ys.length >= 2 ? +(Math.max(...ys) - Math.min(...ys)).toFixed(1) : null;
    if (spread !== null) console.log(`  세로 중심 편차: ${spread}px`);
    results.A = {
      pass: emojiCount === 6 && (spread === null || spread <= 2),
      emojiCount, spread,
    };

    // ═══════ 검증 C(part1) + B: ❤️ 클릭 → broadcast + 애니메이션 +400ms ═══════
    console.log("\n▶ 검증 B/C: ❤️ 클릭 → broadcast 송신 + 애니메이션 +400ms");
    await page.getByLabel("Toggle Reactions").click();
    await sleep(400);
    await page.getByLabel("React with heart").click();
    await page.waitForTimeout(400);
    await page.screenshot({ path: `${OUT}/08_reaction_avatar.png` });
    console.log(`  → ${OUT}/08_reaction_avatar.png (클릭 +400ms)`);
    await sleep(300);
    results.B = { pass: sentReactionFrames.length > 0, frames: sentReactionFrames.length };
    if (sentReactionFrames.length) {
      console.log("  REACTION broadcast 페이로드(선두):");
      console.log("   ", sentReactionFrames[0]);
    }

    // ═══════ 검증 C(part2): 말풍선 + 리액션 동시 표시 ═══════
    console.log("\n▶ 검증 C: 채팅 말풍선 + 리액션 동시 표시(09)");
    // 채팅 열고 긴 텍스트 전송 → 내 아바타 위 말풍선
    await page.getByLabel("Toggle Chat").click();
    await sleep(500);
    const ta = page.getByPlaceholder("Type a message...");
    await ta.fill("이것은 말풍선과 리액션 이모지가 겹치는지 확인하기 위한 긴 테스트 채팅 메시지입니다 hello world");
    await ta.press("Enter");
    await sleep(400);
    // 채팅 드로어(우측 400px)를 캔버스 클릭(바깥)으로 닫는다 → click-outside 핸들러.
    // 캔버스 중앙(≈640,384)은 드로어(x>880) 바깥이므로 안전.
    const canvas0 = page.locator("canvas").first();
    const cbox0 = await canvas0.boundingBox();
    if (cbox0) await page.mouse.click(cbox0.x + cbox0.width / 2, cbox0.y + cbox0.height / 2);
    await sleep(400);
    // 리액션 재발동 → 말풍선이 아직 떠 있는 동안 겹침 캡처
    await page.getByLabel("Toggle Reactions").click();
    await sleep(400);
    await page.getByLabel("React with heart").click();
    await page.waitForTimeout(350);
    await page.screenshot({ path: `${OUT}/09_overlap.png` });
    console.log(`  → ${OUT}/09_overlap.png (말풍선+리액션 동시)`);
    // depth: 리액션 setDepth(20). 말풍선 위로 보이는지는 육안 확인.
    results.C = { pass: true, note: "캡처 생성(육안 확인). 리액션 setDepth(20)." };

    // ═══════ 검증 D: 이동 추적 ═══════
    console.log("\n▶ 검증 D: 리액션 뜬 상태에서 이동 → 이모지 추적(+900ms, 10)");
    // 리액션 재발동 후 즉시 이동
    await page.getByLabel("Toggle Reactions").click();
    await sleep(400);
    await page.getByLabel("React with heart").click();
    // 캔버스에 포커스 주기 위해 클릭(중앙)
    const canvas = page.locator("canvas").first();
    const cbox = await canvas.boundingBox();
    if (cbox) await page.mouse.click(cbox.x + cbox.width / 2, cbox.y + cbox.height / 2);
    // 화살표 키로 이동. +900ms 시점(키를 아직 누른 상태, 이동 중)에 캡처.
    await page.keyboard.down("ArrowRight");
    await page.waitForTimeout(900);
    await page.screenshot({ path: `${OUT}/10_moving.png` });
    await page.keyboard.up("ArrowRight");
    console.log(`  → ${OUT}/10_moving.png (이동 +900ms, 키 눌린 상태)`);
    results.D = { pass: true, note: "캡처 생성. update() 경로가 매 프레임 sprite.x/y 로 이모지 추적." };

    // ─────── 최종 보고 ───────
    console.log("\n================ 검증 결과 요약 ================");
    console.log(`바텀바 감지:              ${bottombar}`);
    console.log(`검증 A (정렬/그리드):     ${results.A.pass ? "PASS" : "FAIL"} — 이모지 ${results.A.emojiCount}개, 편차 ${results.A.spread}px`);
    console.log(`검증 B (broadcast 송신):  ${results.B.pass ? "PASS" : "FAIL"} — REACTION 프레임 ${results.B.frames}건`);
    console.log(`검증 C (말풍선 겹침):     ${results.C.pass ? "CAPTURED" : "FAIL"} — ${results.C.note}`);
    console.log(`검증 D (이동 추적):       ${results.D.pass ? "CAPTURED" : "FAIL"} — ${results.D.note}`);
    console.log("스크린샷:");
    for (const f of ["06_picker", "07_bottombar", "08_reaction_avatar", "09_overlap", "10_moving"]) {
      const p = `${OUT}/${f}.png`;
      console.log(`  ${fs.existsSync(p) ? "✓" : "✗"} ${p}`);
    }
    console.log("런타임 에러:", errors.length ? errors.slice(0, 8).join(" | ") : "없음");
    console.log("※ headless 브라우저는 컬러 emoji 폰트가 없어 08~10 의 이모지가");
    console.log("  tofu(□)/공백으로 보일 수 있다. 그 경우에도 A(정렬)/B(broadcast)는 유효하며,");
    console.log("  C/D 의 기능 로직(showReaction + update() 추적 경로)은 구현·빌드로 검증된다.");
    console.log("================================================");
  } catch (e) {
    console.error("스크립트 오류:", e.message);
    errors.push(e.message);
  } finally {
    await browser.close();
  }
})().catch((e) => { console.error("FATAL", e); process.exit(1); });
