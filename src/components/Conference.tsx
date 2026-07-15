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

import type RTKClient from "@cloudflare/realtimekit";
import {
  RTKParticipants,
  useRealtimeKitSelector,
} from "@cloudflare/realtimekit-react";
import { SpatialAudioController } from "./SpatialAudioController";
import { useLocalParticipant } from "../hooks/useLocalParticipant";

interface ConferenceProps {
  userId: string;
}

/**
 * useRealtimeKitSelector 용 selector.
 * 매 호출마다 새 객체로 래핑하면 리렌더 churn 이 늘어나므로, 참조가 안정적인
 * 단일 값(participants)만 그대로 리턴한다.
 */
export const selectParticipants = (meeting: RTKClient): RTKParticipants =>
  meeting.participants;

export default function Conference({ userId }: ConferenceProps) {
  const localUser = useLocalParticipant();
  const participants = useRealtimeKitSelector(selectParticipants);

  const myPosition = localUser ? { x: localUser.x, y: localUser.y } : null;

  // join 은 SmallVillageScreen 의 join effect 에서 await 로 처리한다.
  // 여기서는 이미 join 된 meeting 의 participants 만 소비한다.

  if (!myPosition) {
    return null;
  }

  return (
    <SpatialAudioController participants={participants} myPosition={myPosition} />
  );
}
