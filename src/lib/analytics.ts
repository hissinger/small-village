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

/**
 * GTM dataLayer 로 커스텀 이벤트를 보낸다.
 *
 * 코드 전역에서 유일한 이벤트 전송 지점이다. 이름↔GA4 이벤트 매핑,
 * 파라미터 스키마, 커스텀 디멘전 연결은 GTM 콘솔에서 관리한다(배포 없이 수정).
 *
 * GTM_ID 미설정 등으로 dataLayer 가 없을 수도 있으므로 항상 안전 초기화한다.
 */
export function pushEvent(
  event: string,
  params: Record<string, unknown> = {}
): void {
  const w = window as unknown as { dataLayer?: Record<string, unknown>[] };
  w.dataLayer = w.dataLayer || [];
  const payload = { event, ...params };
  w.dataLayer.push(payload);

  if (process.env.NODE_ENV !== "production") {
    // 개발 중 GTM 미리보기 없이도 무엇이 나가는지 콘솔로 확인.
    console.debug("[analytics]", payload);
  }
}
