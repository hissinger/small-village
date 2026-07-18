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

// supabaseClient.ts
import { createClient } from "@supabase/supabase-js";

export const supabaseUrl = process.env.REACT_APP_SUPABASE_URL as string;
export const supabaseKey = process.env.REACT_APP_SUPABASE_KEY as string;

// eventsPerSecond: 클라이언트 realtime 전송 rate limit(연결 단위 공유). 기본값(통상 10/s)이면
// 위치 broadcast(~10Hz)가 채팅/리액션 broadcast 전송 예산을 잠식할 수 있어 여유를 둔다.
export const supabase = createClient(supabaseUrl, supabaseKey, {
  realtime: { params: { eventsPerSecond: 24 } },
});
