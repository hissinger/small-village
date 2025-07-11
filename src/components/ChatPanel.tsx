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

import React, { useEffect, useRef, useState } from "react";
import { Send, X } from "lucide-react";
import {
  CHANNEL_MESSAGE,
  Message,
  MessageType,
  RECEIVER_ALL,
  useMessage,
} from "../context/MessageContext";
import { useChatMessage } from "../hooks/useChatMessage";
import { useRoomContext } from "../context/RoomContext";

const CHAT_CONSTANTS = {
  INPUT: {
    MIN_HEIGHT: 40,
    MAX_HEIGHT: 120,
    LINE_HEIGHT: 20,
  },
  LAYOUT: {
    PANEL_WIDTH: 300,
    PADDING: 16,
  },
} as const;

interface ChatMessage {
  senderId: string;
  senderName: string;
  message: string;
  timestamp: string;
}

interface ChatPanelProps {
  isOpen: boolean;
  onClose: () => void;
}

const ChatPanel = ({ isOpen, onClose }: ChatPanelProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputMessage, setInputMessage] = useState("");
  const { sendMessage } = useMessage();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const { currentUserId: userId, currentUserName: userName } = useRoomContext();

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const adjustTextAreaHeight = () => {
    const textArea = textAreaRef.current;
    if (textArea) {
      textArea.style.height = `${CHAT_CONSTANTS.INPUT.MIN_HEIGHT}px`;
      const scrollHeight = textArea.scrollHeight;
      textArea.style.height = `${Math.min(
        scrollHeight,
        CHAT_CONSTANTS.INPUT.MAX_HEIGHT
      )}px`;
    }
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    if (isOpen && textAreaRef.current) {
      textAreaRef.current.style.height = `${CHAT_CONSTANTS.INPUT.MIN_HEIGHT}px`;
    }

    if (isOpen && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        chatPanelRef.current &&
        !chatPanelRef.current.contains(event.target as Node) &&
        isOpen
      ) {
        onClose();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isOpen, onClose]);

  const handleSendMessage = () => {
    if (inputMessage.trim() === "") return;

    const payload: Message = {
      type: MessageType.CHAT,
      sender_id: userId,
      sender_name: userName,
      receiver_id: RECEIVER_ALL,
      body: inputMessage,
      timestamp: new Date().toISOString(),
    };
    sendMessage(CHANNEL_MESSAGE, payload);
    setInputMessage("");

    if (textAreaRef.current) {
      textAreaRef.current.style.height = `${CHAT_CONSTANTS.INPUT.MIN_HEIGHT}px`;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Prevent keyboard events from reaching Phaser when textarea is focused
    e.stopPropagation();

    // handle Enter key
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    adjustTextAreaHeight();
  };

  const chatMessage = useChatMessage();
  useEffect(() => {
    if (!chatMessage) return;

    setMessages((prev) => {
      if (
        prev.some(
          (msg) =>
            msg.timestamp === chatMessage.timestamp &&
            msg.senderId === chatMessage.sender_id
        )
      ) {
        return prev;
      }
      return [
        ...prev,
        {
          senderId: chatMessage.sender_id,
          senderName: chatMessage.sender_name as string,
          message: chatMessage.body as string,
          timestamp: chatMessage.timestamp,
        },
      ];
    });
  }, [chatMessage]);

  return (
    <div
      ref={chatPanelRef}
      className={`fixed right-0 top-0 h-full w-[${CHAT_CONSTANTS.LAYOUT.PANEL_WIDTH}px] bg-white shadow-lg transition-transform duration-300 ease-in-out z-50 flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
    >
      <div
        className="flex justify-between items-center py-3 px-4 bg-gray-100 border-b border-gray-200"
      >
        <h3 className="m-0 text-lg font-semibold">Chat</h3>
        <button
          onClick={onClose}
          className="bg-none border-none cursor-pointer p-1"
        >
          <X size={20} />
        </button>
      </div>

      <div
        className="flex-1 overflow-y-auto p-4"
      >
        {messages.map((msg, index) => {
          const isMine = msg.senderId === userId;
          return (
            <div
              key={index}
              className={`mb-4 flex flex-col ${isMine ? 'items-end' : 'items-start'} max-w-full`}
            >
              {!isMine && (
                <span
                  className="text-xs text-gray-600 mb-1 font-medium"
                >
                  {msg.senderName}:
                </span>
              )}
              <div
                className={`max-w-[80%] px-3 py-2 rounded-lg ${isMine ? 'bg-blue-500 text-white' : 'bg-gray-200 text-black'} break-words whitespace-pre-wrap overflow-wrap`}
              >
                <p className="m-0 text-sm">{msg.message}</p>
              </div>
              <span
                className="text-xs text-gray-600 mt-1"
              >
                {formatTime(msg.timestamp)}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div
        className="p-4 border-t border-gray-200 bg-white"
      >
        <div
          className="flex gap-2 items-end"
        >
          <textarea
            ref={textAreaRef}
            value={inputMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            placeholder="Type a message..."
            className="flex-1 p-2.5 border border-gray-200 rounded-lg outline-none resize-none"
            style={{
              minHeight: `${CHAT_CONSTANTS.INPUT.MIN_HEIGHT}px`,
              maxHeight: `${CHAT_CONSTANTS.INPUT.MAX_HEIGHT}px`,
              lineHeight: `${CHAT_CONSTANTS.INPUT.LINE_HEIGHT}px`,
              transition: "height 0.1s ease-in-out",
            }}
          />
          <button
            onClick={handleSendMessage}
            className="px-3 py-2 text-white border-none rounded-lg cursor-pointer h-[40px] flex-shrink-0"
            style={{ backgroundColor: "#0d6efd" }}
          >
            <Send size={25} strokeWidth={2} color={"white"} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
