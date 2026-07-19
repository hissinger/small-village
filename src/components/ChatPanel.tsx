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
import { ChevronDown, Send, X } from "lucide-react";
import {
  CHANNEL_MESSAGE,
  Message,
  MessageType,
  RECEIVER_ALL,
  useMessage,
} from "../context/MessageContext";
import { useChatMessage } from "../hooks/useChatMessage";
import { useRoomContext } from "../context/RoomContext";
import { pushEvent } from "../lib/analytics";
import { ANALYTICS_EVENTS } from "../constants";
import Linkify from "linkify-react";
import { isScrolledToBottom } from "../lib/chatScroll";

const CHAT_CONSTANTS = {
  INPUT: {
    MIN_HEIGHT: 40,
    MAX_HEIGHT: 120,
    LINE_HEIGHT: 20,
  },
  LAYOUT: {
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
  const [isComposing, setIsComposing] = useState(false);
  const [showJumpButton, setShowJumpButton] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const { sendMessage } = useMessage();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const isAtBottomRef = useRef(true);
  const chatPanelRef = useRef<HTMLDivElement>(null);
  const textAreaRef = useRef<HTMLTextAreaElement>(null);
  const { userId, userName, roomId } = useRoomContext();

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

  // 맨 아래에 붙었다고 표시하고 점프 버튼/안 읽은 배지를 초기화한다.
  const markAtBottom = () => {
    isAtBottomRef.current = true;
    setShowJumpButton(false);
    setUnreadCount(0);
  };

  const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
    messagesEndRef.current?.scrollIntoView({ behavior });
    markAtBottom();
  };

  const handleScroll = () => {
    const container = scrollContainerRef.current;
    if (!container) return;
    if (isScrolledToBottom(container)) {
      markAtBottom();
    } else {
      // 위로 스크롤해 있는 동안은 항상 "최근 메시지로 이동" 버튼을 노출한다.
      isAtBottomRef.current = false;
      setShowJumpButton(true);
    }
  };

  // 맨 아래에 붙어 있을 때만 새 메시지를 따라 내려간다.
  // 위로 스크롤해 과거 메시지를 보는 중이면 위치를 유지하고 안 읽은 수만 센다.
  // 패널이 닫혀 있으면 아무 것도 하지 않는다(재오픈 시 아래 isOpen 효과가 맨 아래로 보냄).
  useEffect(() => {
    if (!isOpen || messages.length === 0) return;
    if (isAtBottomRef.current) {
      // 즉시 스크롤 — smooth 애니메이션 중 onScroll 이 "맨 아래 아님"으로 오판해
      // 점프 버튼이 깜빡이는 걸 막는다.
      scrollToBottom("auto");
    } else {
      // 위로 스크롤 중이면 handleScroll 이 이미 버튼을 켜둔 상태 — 배지 수만 올린다.
      setUnreadCount((count) => count + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [messages]);

  useEffect(() => {
    if (isOpen && textAreaRef.current) {
      textAreaRef.current.style.height = `${CHAT_CONSTANTS.INPUT.MIN_HEIGHT}px`;
    }

    if (isOpen) {
      scrollToBottom("auto");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    const trimmed = inputMessage.trim();
    if (trimmed === "") return;

    const payload: Message = {
      type: MessageType.CHAT,
      sender_id: userId,
      sender_name: userName,
      receiver_id: RECEIVER_ALL,
      body: inputMessage,
      timestamp: new Date().toISOString(),
    };
    sendMessage(CHANNEL_MESSAGE, payload);
    // 내가 보낸 메시지는 위치와 무관하게 항상 맨 아래로 따라 내려간다.
    isAtBottomRef.current = true;
    // 본문(개인정보)은 절대 보내지 않는다 — 길이만 계측한다.
    pushEvent(ANALYTICS_EVENTS.CHAT_MESSAGE_SENT, {
      room_id: roomId,
      length: trimmed.length,
    });
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
      if (!isComposing) {
        handleSendMessage();
      }
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setInputMessage(e.target.value);
    adjustTextAreaHeight();
  };

  const handleCompositionStart = () => {
    setIsComposing(true);
  };

  const handleCompositionEnd = (
    e: React.CompositionEvent<HTMLTextAreaElement>
  ) => {
    setIsComposing(false);
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
      className={`fixed right-0 top-0 h-full w-[400px] min-w-[400px] max-w-[400px] bg-white shadow-lg transition-transform duration-300 ease-in-out z-50 flex flex-col ${
        isOpen ? "translate-x-0" : "translate-x-full"
      }`}
    >
      <div className="flex justify-between items-center py-3 px-4 bg-gray-100 border-b border-gray-200">
        <h3 className="m-0 text-lg font-semibold">Chat</h3>
        <button
          onClick={onClose}
          className="bg-none border-none cursor-pointer p-1"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden">
        <div
          ref={scrollContainerRef}
          onScroll={handleScroll}
          className="h-full overflow-y-auto p-4"
          data-testid="chat-scroll"
        >
          {messages.map((msg, index) => {
          const isMine = msg.senderId === userId;
          return (
            <div
              key={index}
              className={`mb-4 flex flex-col ${
                isMine ? "items-end" : "items-start"
              } max-w-full`}
            >
              {!isMine && (
                <span className="text-xs text-gray-600 mb-1 font-medium">
                  {msg.senderName}:
                </span>
              )}
              <div
                className={`px-3 py-2 rounded-lg ${
                  isMine ? "bg-blue-500 text-white" : "bg-gray-200 text-black"
                } break-all whitespace-pre-wrap`}
              >
                <Linkify
                  options={{
                    target: "_blank",
                    className: isMine
                      ? "text-white underline break-all"
                      : "text-blue-600 underline break-all",
                  }}
                >
                  {msg.message}
                </Linkify>
              </div>
              <span className="text-xs text-gray-600 mt-1">
                {formatTime(msg.timestamp)}
              </span>
            </div>
          );
        })}
          <div ref={messagesEndRef} />
        </div>

        {showJumpButton && (
          <button
            onClick={() => scrollToBottom()}
            className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 rounded-full bg-blue-500 text-white text-sm font-medium shadow-md hover:bg-blue-600 transition-colors"
            aria-label="최근 메시지로 이동"
            data-testid="chat-jump-button"
          >
            {unreadCount > 0 && <span>새 메시지 {unreadCount}개</span>}
            <ChevronDown size={16} />
          </button>
        )}
      </div>

      <div className="p-4 border-t border-gray-200 bg-white">
        <div className="flex gap-2 items-end">
          <textarea
            ref={textAreaRef}
            value={inputMessage}
            onChange={handleInputChange}
            onKeyDown={handleKeyDown}
            onCompositionStart={handleCompositionStart}
            onCompositionEnd={handleCompositionEnd}
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
