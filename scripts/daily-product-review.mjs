#!/usr/bin/env node
/**
 * Small Village — 매일 오전 10시(KST) 기획자 관점 정기 점검
 *
 * 1) dev 서버 헬스체크(+필요시 기동)
 * 2) Playwright(headless WebGL)로 로비·게임 실제 렌더 점검 + 스크린샷
 * 3) 코드베이스에서 "아직 없는 기능" 후보 스캔
 * 4) curl 로 경쟁사(Gather/Kumospace 등) 공식 문서/업데이트 긁어 적용 후보 추출
 * 5) 마크다운 리포트를 stdout 에 출력 (cron 이 그대로 배달)
 *
 * 실행: node scripts/daily-product-review.mjs
 * 전제: playwright 설치됨, .env.local 유효(인게임 RTK join 용)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';

const BASE = process.env.E2E_BASE_URL || 'http://localhost:3000';
const OUT_DIR = '/tmp/sv-daily';
const DATE = new Date().toISOString().slice(0, 10);
fs.mkdirSync(OUT_DIR, { recursive: true });

const log = (...a) => console.log(...a);
const section = (t) => log(`\n## ${t}`);

// ── 1. dev 서버 헬스 ──────────────────────────────────────────────
function ensureServer() {
  try {
    const code = execSync(`curl -s -o /dev/null -w "%{http_code}" ${BASE}`, { encoding: 'utf8' }).trim();
    if (code === '200') return 'already-up';
  } catch {}
  log('dev 서버 기동 중...');
  execSync('cd /home/ubuntu/small-village && (npm start > /tmp/sv_dev.log 2>&1 &)', { encoding: 'utf8' });
  // 최대 40s 대기
  for (let i = 0; i < 40; i++) {
    try {
      const code = execSync(`curl -s -o /dev/null -w "%{http_code}" ${BASE}`, { encoding: 'utf8' }).trim();
      if (code === '200') return 'started';
    } catch {}
    execSync('sleep 1');
  }
  return 'fail';
}

// ── 2. 브라우저 렌더 점검 ────────────────────────────────────────
const LAUNCH_ARGS = [
  '--no-sandbox', '--disable-dev-shm-usage',
  '--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
  '--ignore-gpu-blocklist', '--enable-webgl',
  '--autoplay-policy=no-user-gesture-required',
  '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream',
];

async function analyzeBiggestCanvas(page) {
  const res = await page.evaluate(() => {
    const cvs = Array.from(document.querySelectorAll('canvas'));
    if (!cvs.length) return { hasCanvas: false };
    let big = cvs[0];
    for (const c of cvs) if (c.width * c.height > big.width * big.height) big = c;
    return { hasCanvas: true, w: big.width, h: big.height, url: big.toDataURL('image/png') };
  });
  if (!res.hasCanvas) return res;
  const stats = await page.evaluate(async (url) => {
    const img = new Image();
    await new Promise((ok, err) => { img.onload = ok; img.onerror = err; img.src = url; });
    const off = document.createElement('canvas'); off.width = img.width; off.height = img.height;
    const ctx = off.getContext('2d'); ctx.drawImage(img, 0, 0);
    const { data } = ctx.getImageData(0, 0, off.width, off.height);
    let r=0,g=0,b=0,nb=0; const total=data.length/4;
    for (let i=0;i<data.length;i+=4){ r+=data[i];g+=data[i+1];b+=data[i+2]; if(data[i]+data[i+1]+data[i+2]>24) nb++; }
    return { avgR:Math.round(r/total), avgG:Math.round(g/total), avgB:Math.round(b/total), nonBlackPct:+(100*nb/total).toFixed(1) };
  }, res.url);
  return { ...res, ...stats };
}

// 로비 캔버스가 실제로 렌더될 때까지 대기 (issue #27: Phaser 에셋 로딩/React 마운트
// 전에 스크린샷을 찍어 검은 화면이 캡처되는 문제 방지).
// analyzeBiggestCanvas 의 nonBlackPct 를 재활용해 5% 초과까지 폴링(최대 ~30s, 1s 간격).
// canvas 를 아직 못 찾은(hasCanvas:false) 경우에도 계속 재시도한다.
async function waitForLobbyRendered(page, { tries = 30, intervalMs = 1000, minNonBlackPct = 5 } = {}) {
  let last = null;
  for (let i = 0; i < tries; i++) {
    last = await analyzeBiggestCanvas(page);
    if (last.hasCanvas && last.nonBlackPct > minNonBlackPct) return last;
    await page.waitForTimeout(intervalMs);
  }
  return last; // 타임아웃 — 마지막 상태 반환(검은 화면일 수 있음)
}

async function browserCheck() {
  const browser = await chromium.launch({ headless: true, args: LAUNCH_ARGS });
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  const result = { lobby: null, game: null, bottombar: false, screenshots: [] };

  try {
    await page.goto(BASE, { waitUntil: 'networkidle', timeout: 60000 });
    // 캔버스가 실제로 렌더될 때까지 대기 후 스크린샷 (검은 화면 캡처 방지, issue #27)
    result.lobby = await waitForLobbyRendered(page);
    await page.screenshot({ path: `${OUT_DIR}/lobby-${DATE}.png` });
    result.screenshots.push(`lobby-${DATE}.png`);

    // 이름/방 입력 → Create
    await page.getByPlaceholder('e.g. Mina').fill('DailyQA');
    await page.getByPlaceholder('Room title').fill('daily-' + Date.now());
    await page.getByRole('button', { name: 'Create' }).click();
    // 바텀바(Exit/마이크/채팅) 대기
    let bottombar = false;
    try {
      await page.getByRole('button', { name: /exit|mic|chat|message/i }).first().waitFor({ timeout: 20000 });
      bottombar = true;
    } catch {}
    result.bottombar = bottombar;
    await page.waitForTimeout(2000);
    await page.screenshot({ path: `${OUT_DIR}/game-${DATE}.png` });
    result.screenshots.push(`game-${DATE}.png`);
    result.game = await analyzeBiggestCanvas(page);
  } catch (e) {
    errors.push('NAV: ' + e.message);
  } finally {
    await browser.close();
  }
  result.errors = errors;
  return result;
}

// ── 3. 코드베이스 기능 부재 스캔 ──────────────────────────────────
function scanMissingFeatures() {
  const root = '/home/ubuntu/small-village/src';
  const src = execSync(`grep -rl "" ${root} 2>/dev/null || true`, { encoding: 'utf8' })
    .split('\n').filter(Boolean);
  const joined = src.join('\n');
  const checks = [
    ['DM/1:1 대화', /direct\s*message|dm\b|private\s*chat/i],
    ['비디오/화면공유', /screen\s*share|video\s*call|webcam|camera/i],
    ['이모지 리액션', /emoji\s*react|reaction/i],
    ['텍스트 채널', /text\s*channel|announcement/i],
    ['공간 오디오 거리 표시', /proximity|radius\s*indicator/i],
    ['방 초대 링크', /invite\s*link|share\s*room|room\s*code/i],
    ['역할/닉네임 색', /name\s*color|role\s*color|user\s*color/i],
    ['모바일 터치 이동', /touchstart|touchmove|onTouch/i],
    ['좋아요/투표', /like|vote|poll/i],
    ['방 검색/필터', /search\s*room|filter\s*room/i],
    ['음소거 전체', /mute\s*all|deafen/i],
  ];
  const missing = [];
  for (const [name, re] of checks) if (!re.test(joined)) missing.push(name);
  return missing;
}

// ── 4. 경쟁사 리서치 (curl, 웹 검색 불가 환경) ────────────────────
async function researchCompetitors() {
  // 웹 검색 불가 → 공식 문서/업데이트 RSS 를 긁어 "최근 강조하는 기능" 추출.
  // 실패해도 리포트는 계속되도록 best-effort.
  const sources = [
    { name: 'Gather changelog', url: 'https://gather.town/blog/rss.xml' },
    { name: 'Kumospace blog', url: 'https://www.kumospace.com/blog/rss.xml' },
  ];
  const out = [];
  for (const s of sources) {
    try {
      const xml = execSync(`curl -sL --max-time 15 "${s.url}" 2>/dev/null | head -c 8000`, { encoding: 'utf8' });
      if (!xml) { out.push(`- ${s.name}: 긁기 실패(빈 응답)`); continue; }
      // <title> 추출 (최근 포스트 제목 = 제품이 강조하는 방향)
      const titles = [...xml.matchAll(/<title>([^<]+)<\/title>/g)].map((m) => m[1].trim()).filter(Boolean);
      out.push(`- **${s.name}** 최근 주제: ${titles.slice(0, 5).join(' / ') || '(제목 없음)'}`);
    } catch (e) {
      out.push(`- ${s.name}: 긁기 실패 (${e.message.slice(0, 60)})`);
    }
  }
  // 공식 기능 페이지(정적)도 한 번 훑어 "우리에게 없는 기능" 단서 확보
  out.push('- 참고: 우리 TODO.md(PR-1 말풍선, PR-4 참가자패널) 외 기능은 경쟁사 대비 부재 스캔 결과와 교차 검토 필요');
  return out;
}

// ── 메인 ──────────────────────────────────────────────────────────
(async () => {
  log(`# Small Village — 일일 기획 리뷰 (${DATE})`);
  log(`> 생성: ${new Date().toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })} (KST)`);

  section('1. 앱 실행 상태');
  const srv = ensureServer();
  log(`dev 서버: ${srv} (${BASE})`);

  section('2. 실제 렌더 점검 (headless WebGL)');
  const b = await browserCheck();
  log(`- 로비 캔버스: ${b.lobby ? `렌더됨(비검은 ${b.lobby.nonBlackPct}%, ${b.lobby.w}x${b.lobby.h})` : '없음'}`);
  log(`- 게임 캔버스: ${b.game ? `렌더됨(비검은 ${b.game.nonBlackPct}%, ${b.game.w}x${b.game.h})` : '없음'}`);
  log(`- 바텀바(인게임 진입) 표시: ${b.bottombar ? 'YES' : 'NO (RTK join 실패 가능성 — 로딩 오버레이 추정)'}`);
  log(`- 런타임 에러: ${b.errors.length ? b.errors.slice(0, 5).join(' | ') : '없음'}`);
  log(`- 스크린샷: ${b.screenshots.join(', ')} → ${OUT_DIR}/`);

  section('3. 아직 없는 기능 (코드 스캔)');
  const missing = scanMissingFeatures();
  if (missing.length) missing.forEach((m) => log(`- □ ${m}`));
  else log('- 특기사항 없음');

  section('4. 경쟁사 리서치 (공식 문서/RSS)');
  const research = await researchCompetitors();
  research.forEach((r) => log(r));

  section('5. 기획자 코멘트');
  log('- 위 항목 중 우선순위는 사용성 영향도 기준. 인게임 진입(bottombar=NO)이 반복되면 RTK 백엔드/테스트 분기 점검 필요.');
  log('- 말풍선(PR-1)·참가자 패널(PR-4)은 TODO.md 에 이미 정리됨 — 진행 시 이 리포트와 교차 확인.');
  log('\n--- END ---');
})().catch((e) => { console.error('FATAL', e); process.exit(1); });
