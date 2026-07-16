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

import { useEffect, useCallback, useRef } from "react";
import {
  Message,
  MessageType,
  CHANNEL_MESSAGE,
  useMessage,
} from "../context/MessageContext";

export interface ReactionMessage {
  sender_id: string;
  emoji: string;
}

/**
 * REACTION broadcast 를 콜백으로 흘려보낸다.
 *
 * 리액션은 채팅과 달리 동시다발적이라, 단일 useState 슬롯에 담으면 같은 React 18
 * 배칭 틱에 여러 개가 도착할 때 마지막만 남고 나머지가 유실된다. 그래서 상태를
 * 두지 않고 수신할 때마다 즉시 callback 을 호출한다(배칭과 무관하게 각 이벤트 처리).
 *
 * callback 은 렌더마다 새 함수여도 되도록 ref 로 보관해, broadcast 구독 자체는
 * 마운트 동안 안정적으로 1회만 유지한다.
 */
export const useReactionMessage = (
  onReaction: (reaction: ReactionMessage) => void
) => {
  const { addMessageHandler, removeMessageHandler } = useMessage();
  const callbackRef = useRef(onReaction);
  callbackRef.current = onReaction;

  const handleMessage = useCallback((message: Message) => {
    if (message.type === MessageType.REACTION && message.body) {
      callbackRef.current({
        sender_id: message.sender_id,
        emoji: message.body,
      });
    }
  }, []);

  useEffect(() => {
    addMessageHandler(CHANNEL_MESSAGE, handleMessage);
    return () => {
      removeMessageHandler(CHANNEL_MESSAGE, handleMessage);
    };
  }, [addMessageHandler, removeMessageHandler, handleMessage]);
};
