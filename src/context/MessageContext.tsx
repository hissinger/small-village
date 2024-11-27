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

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../supabaseClient";

export const CHANNEL_MESSAGE = "message";
export const RECEIVER_ALL = "all";

export enum MessageType {
  REQUEST_CALL = "request_call",
  ACCEPT_CALL = "accept_call",
  CLOSE_CALL = "close_call",
  PEER_SIGNAL = "peer_signal",
  CHAT = "chat",
  JOIN_USER = "JOIN_USER",
}

export interface Message {
  sender_id: string;
  sender_name?: string;
  receiver_id: string;
  type: MessageType;
  body?: string;
  timestamp: string;
}

interface MessageHandler {
  channelName: string;
  handler: (message: Message) => void;
}

interface MessageContextType {
  userId: string;
  sendMessage: (channelName: string, message: Message) => void;
  addMessageHandler: (
    channelName: string,
    handler: (message: Message) => void
  ) => void;
  removeMessageHandler: (
    channelName: string,
    handler: (message: Message) => void
  ) => void;
}

const MessageContext = createContext<MessageContextType | undefined>(undefined);

interface MessageProviderProps {
  children: React.ReactNode;
  userId: string;
}

export const MessageProvider: React.FC<MessageProviderProps> = ({
  children,
  userId,
}) => {
  const [channel, setChannel] = useState<RealtimeChannel | null>(null);
  const messageHandlersRef = useRef<Set<MessageHandler>>(new Set());

  useEffect(() => {
    const handleMessage = ({ payload }: { payload: Message }) => {
      const { receiver_id } = payload;
      if (receiver_id !== RECEIVER_ALL && receiver_id !== userId) {
        return;
      }

      messageHandlersRef.current.forEach(({ channelName, handler }) => {
        if (channelName === CHANNEL_MESSAGE) {
          handler(payload);
        }
      });
    };

    const config = {
      broadcast: {
        self: true,
      },
    };

    const messageChannel = supabase
      .channel(CHANNEL_MESSAGE, { config })
      .on("broadcast", { event: "message" }, handleMessage)
      .subscribe();

    setChannel(messageChannel);

    return () => {
      messageChannel.unsubscribe();
    };
  }, [userId]);

  const sendMessage = useCallback(
    async (channelName: string, message: Message) => {
      await channel?.send({
        type: "broadcast",
        event: "message",
        payload: message,
      });
    },
    [channel]
  );

  const addMessageHandler = useCallback(
    (channelName: string, handler: (message: Message) => void) => {
      messageHandlersRef.current.add({ channelName, handler });
    },
    []
  );

  const removeMessageHandler = useCallback(
    (channelName: string, handler: (message: Message) => void) => {
      messageHandlersRef.current.forEach((item) => {
        if (item.channelName === channelName && item.handler === handler) {
          messageHandlersRef.current.delete(item);
        }
      });
    },
    []
  );

  return (
    <MessageContext.Provider
      value={{
        userId,
        sendMessage,
        addMessageHandler,
        removeMessageHandler,
      }}
    >
      {children}
    </MessageContext.Provider>
  );
};

export const useMessage = () => {
  const context = useContext(MessageContext);
  if (!context) {
    throw new Error("useMessage must be used within a MessageProvider");
  }
  return context;
};
