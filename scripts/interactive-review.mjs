#!/usr/bin/env node
/**
 * Small Village — 기획자 관점 인터랙티브 리뷰
 * 실제 사용 flow 를 시뮬레이션하며 여러 각도 스크린샷을 찍는다.
 *  1) 로비: 이름입력 + 캐릭터 변경 + 방목록 (로딩 끝난 뒤)
 *  2) 게임 입장: Create → 바텀바
 *  3) 이동: 화살표 키로 캐릭터 이동
 *  4) 채팅: 긴 URL/장문 전송 → 말풍선(PR-1 버그 재현 시도)
 *  5) 마이크 토글
 */
import { chromium } from 'playwright';
import fs from 'node:fs';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const OUT = '/tmp/sv-review';
const DATE = new Date().toISOString().slice(0, 10);
fs.mkdirSync(OUT, { recursive: true });

const LAUNCH_ARGS = [
  '--no-sandbox', '--disable-dev-shm-usage',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl',
  '--autoplay-policy=no-user-gesture-required',
  '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => {
    errors.push(e.message);
    console.error(' [Page Error]', e.message);
  });
  page.on('console', (msg) => {
    if (msg.type() === 'error') {
      console.error(' [Console Error]', msg.text());
    } else {
      console.log(' [Console Log]', msg.text());
    }
  });

  console.log('▶ 로비 진입');
  await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
  // 로딩 오버레이(Loading assets...) 사라질 때까지 대기
  for (let i = 0; i < 10; i++) {
    const loading = await page.getByText(/Loading assets/i).count();
    if (loading === 0) break;
    await sleep(1000);
  }
  await sleep(500);
  // 이름 입력
  const nameInput = page.getByPlaceholder('e.g. Mina');
  await nameInput.fill('기획QA');
  await sleep(300);
  // 캐릭터 변경(다음 화살표)
  const nextBtn = page.getByRole('button', { name: /next|>/i }).first();
  await nextBtn.click().catch(() => {});
  await sleep(400);
  await page.screenshot({ path: `${OUT}/01_lobby_ui.png` });
  console.log('  → 01_lobby_ui.png');

  // 방목록/빈방 상태
  const roomCount = await page.getByText(/Available Rooms/i).count();
  const quiet = await page.getByText(/village is quiet/i).count();
  console.log(`  방목록 헤더:${roomCount} 빈방메시지:${quiet}`);

  console.log('▶ 게임 입장 (Create)');
  await page.getByPlaceholder('Room title').fill('review-' + Date.now());
  await page.getByRole('button', { name: 'Create' }).click();
  // 바텀바 대기
  let bottombar = false;
  try {
    await page.getByRole('button', { name: /exit|mic|chat|message/i }).first().waitFor({ timeout: 20000 });
    bottombar = true;
  } catch {}
  await sleep(2500);
  await page.screenshot({ path: `${OUT}/02_game_entered.png` });
  console.log(`  → 02_game_entered.png (바텀바:${bottombar})`);

  console.log('▶ 캐릭터 이동');
  for (const k of ['ArrowRight', 'ArrowRight', 'ArrowDown']) {
    await page.keyboard.down(k); await sleep(600); await page.keyboard.up(k); await sleep(200);
  }
  await sleep(800);
  await page.screenshot({ path: `${OUT}/03_game_moved.png` });
  console.log('  → 03_game_moved.png');

  console.log('▶ 채팅 + 말풍선 (PR-1 버그 재현: 긴 URL/장문)');
  // 채팅 패널 열기
  await page.getByRole('button', { name: /chat|message/i }).first().click().catch(() => {});
  await sleep(600);
  const ta = page.locator('textarea').first();
  // 긴 URL
  await ta.fill('회의록 공유합니다 https://docs.google.com/document/d/abcdefghijklmnopqrstuvwxyz0123456789/edit?usp=sharing&invite=ABCDEF이건진짜길고잘리는지테스트합니다');
  await page.keyboard.press('Enter');
  await sleep(800);
  // 장문
  await ta.fill('안녕하세요! 이곳은 스몰빌리지 테스트입니다. 여러 명이 동시에 말하면 말풍선이 어떻게 처리되는지, 누군가 먼저 말한 뒤 다른 사람이 말하면 앞사람 말풍선이 사라지지 않는지 확인하는 중입니다.');
  await page.keyboard.press('Enter');
  await sleep(1200);
  await page.screenshot({ path: `${OUT}/04_game_chat_bubble.png` });
  console.log('  → 04_game_chat_bubble.png');

  console.log('▶ 마이크 토글');
  await page.getByRole('button', { name: /mic/i }).first().click().catch(() => {});
  await sleep(600);
  await page.screenshot({ path: `${OUT}/05_game_mic.png` });
  console.log('  → 05_game_mic.png');

  console.log('런타임에러:', errors.length ? errors.slice(0, 5).join(' | ') : '없음');
  await browser.close();
  console.log('DONE →', OUT);
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
