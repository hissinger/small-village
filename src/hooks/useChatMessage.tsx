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

import { useState, useEffect, useCallback } from "react";
import {
  Message,
  MessageType,
  CHANNEL_MESSAGE,
  useMessage,
} from "../context/MessageContext";

export const useChatMessage = () => {
  const [message, setMessage] = useState<Message>();
  const { addMessageHandler, removeMessageHandler } = useMessage();

  const handleMessage = useCallback((message: Message) => {
    if (message.type === MessageType.CHAT) {
      setMessage(message);
    }
  }, []);

  useEffect(() => {
    addMessageHandler(CHANNEL_MESSAGE, handleMessage);
    return () => {
      removeMessageHandler(CHANNEL_MESSAGE, handleMessage);
    };
  }, [addMessageHandler, removeMessageHandler, handleMessage]);

  return message;
};
