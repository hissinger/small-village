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
 * E2E: 방별 맵 선택(village | tilemap). ?e2e 일 때만 켜지는 ?map= 오버라이드로 각 맵을
 * 강제 로드해, (1) 씬이 올바른 맵으로 뜨는지(window.__smallVillage.map()), (2) 월드 크기가
 * 맵별 기대값(village 1408x1152 / tilemap 1280x960)과 맞는지 assert + 스크린샷 저장.
 * 방 생성→입장 경로 자체는 room-flow 가 커버하므로, 여기선 "맵 분기"만 검증한다.
 * 실행: node e2e/map-select.mjs
 */

import fs from "node:fs"; import pw from "playwright"; import { createClient } from "@supabase/supabase-js";
const {chromium}=pw; const BASE=process.env.E2E_BASE_URL; const SHOT="/tmp/sv-review/village";
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const env=Object.fromEntries(fs.readFileSync(new URL("../.env.local",import.meta.url),"utf8").split("\n").filter(l=>l.includes("=")).map(l=>{const i=l.indexOf("=");return[l.slice(0,i).trim(),l.slice(i+1).trim()];}));
const supabase=createClient(env.REACT_APP_SUPABASE_URL,env.REACT_APP_SUPABASE_KEY);
const ARGS=["--no-sandbox","--disable-dev-shm-usage","--use-gl=angle","--use-angle=swiftshader","--enable-unsafe-swiftshader","--ignore-gpu-blocklist","--enable-webgl","--use-fake-ui-for-media-stream","--use-fake-device-for-media-stream"];
let failed=false; const fail=m=>{console.error("❌ "+m);failed=true;};
const titles=[];
for (const map of ["village","tilemap"]) {
  const title=`e2e-mapselect-${map}`; titles.push(title);
  const b=await chromium.launch({headless:true,args:ARGS});
  const p=await(await b.newContext({viewport:{width:1280,height:800}})).newPage();
  try{
    await p.goto(`${BASE}/?e2e&map=${map}`,{waitUntil:"networkidle"});
    for(let i=0;i<12;i++){if((await p.getByText(/Loading assets/i).count())===0)break;await sleep(1000);} await sleep(1000);
    await p.getByPlaceholder("e.g. Mina").fill("MapBot");
    await p.getByPlaceholder("Room title").fill(title);
    await p.getByRole("button",{name:"Create"}).click();
    let ok=false; for(let i=0;i<40;i++){if(await p.evaluate(()=>!!(window.__smallVillage&&window.__smallVillage.map&&window.__smallVillage.myPosition()))){ok=true;break;}await sleep(1000);}
    if(!ok){fail(`[${map}] 씬/훅 준비 타임아웃`); await b.close(); continue;}
    for(let i=0;i<30;i++){const s=(await p.getByText(/Strolling into/i).count())>0;const e=(await p.getByLabel("Exit").count())>0;if(!s&&e)break;await sleep(1000);} await sleep(1200);
    const info=await p.evaluate(()=>({map:window.__smallVillage.map(),size:window.__smallVillage.worldSize(),cols:window.__smallVillage.worldColliders().length}));
    console.log(`[${map}]`,info);
    if(info.map!==map) fail(`[${map}] 씬 map 이 ${info.map} 로 로드됨`);
    else console.log(`✅ [${map}] 씬이 올바른 맵으로 로드`);
    // 예상 월드 크기: village 1408x1152, tilemap 20*32*2=1280 x 15*32*2=960
    const exp = map==="village"?{w:1408,h:1152}:{w:1280,h:960};
    if(info.size.width!==exp.w||info.size.height!==exp.h) fail(`[${map}] 월드 크기 ${info.size.width}x${info.size.height} != ${exp.w}x${exp.h}`);
    else console.log(`✅ [${map}] 월드 크기 ${info.size.width}x${info.size.height}`);
    await p.screenshot({path:`${SHOT}/map-${map}.png`});
  } finally { await b.close(); }
}
// cleanup
try{ for(const t of titles){ const rooms=(await supabase.from("rooms").select("id").eq("title",t)).data; for(const r of rooms||[]){await supabase.from("users").delete().eq("room_id",r.id);await supabase.from("rooms").delete().eq("id",r.id);} } }catch(e){console.warn("cleanup warn",e?.message);}
if(failed) process.exit(1); console.log("✅ 두 맵 검증 통과");
