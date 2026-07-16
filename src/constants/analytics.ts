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
 * GTM dataLayer 로 보내는 커스텀 이벤트 이름.
 * 이름↔GA4 매핑은 GTM 콘솔에서 관리하므로, 코드에서는 이 상수만 참조한다.
 */
export const ANALYTICS_EVENTS = {
  ENTER_ROOM: "enter_room",
  EXIT_ROOM: "exit_room",
  VOICE_JOIN_SUCCESS: "voice_join_success",
  VOICE_JOIN_ERROR: "voice_join_error",
  CHAT_MESSAGE_SENT: "chat_message_sent",
  CHARACTER_SELECTED: "character_selected",
  MIC_PERMISSION_DENIED: "mic_permission_denied",
  ROOM_CREATED: "room_created",
  PROXIMITY_TALK: "proximity_talk",
  ROOM_LIST_VIEW: "room_list_view",
  ROOM_NOT_FOUND: "room_not_found",
} as const;

export type AnalyticsEventName =
  (typeof ANALYTICS_EVENTS)[keyof typeof ANALYTICS_EVENTS];
