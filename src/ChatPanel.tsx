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
} from "./context/MessageContext";
import { useChatMessage } from "./hooks/useChatMessage";
import { useRoomContext } from "./context/RoomContext";

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

  const handleKeyPress = (e: React.KeyboardEvent) => {
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
      style={{
        position: "fixed",
        right: 0,
        top: 0,
        height: "100%",
        width: `${CHAT_CONSTANTS.LAYOUT.PANEL_WIDTH}px`,
        backgroundColor: "white",
        boxShadow: "0 0 10px rgba(0,0,0,0.1)",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s ease-in-out",
        zIndex: 100,
        display: isOpen ? "flex" : "none",
        flexDirection: "column",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: `12px ${CHAT_CONSTANTS.LAYOUT.PADDING}px`,
          backgroundColor: "#f8f9fa",
          borderBottom: "1px solid #dee2e6",
        }}
      >
        <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 600 }}>Chat</h3>
        <button
          onClick={onClose}
          style={{
            background: "none",
            border: "none",
            cursor: "pointer",
            padding: "4px",
          }}
        >
          <X size={20} />
        </button>
      </div>

      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: CHAT_CONSTANTS.LAYOUT.PADDING,
        }}
      >
        {messages.map((msg, index) => {
          const isMine = msg.senderId === userId;
          return (
            <div
              key={index}
              style={{
                marginBottom: "16px",
                display: "flex",
                flexDirection: "column",
                alignItems: isMine ? "flex-end" : "flex-start",
                maxWidth: "100%",
              }}
            >
              {!isMine && (
                <span
                  style={{
                    fontSize: "12px",
                    color: "#666",
                    marginBottom: "4px",
                    fontWeight: 500,
                  }}
                >
                  {msg.senderName}:
                </span>
              )}
              <div
                style={{
                  maxWidth: "80%",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  backgroundColor: isMine ? "#0d6efd" : "#e9ecef",
                  color: isMine ? "white" : "black",
                  wordBreak: "break-word",
                  whiteSpace: "pre-wrap",
                  overflowWrap: "break-word",
                }}
              >
                <p style={{ margin: 0, fontSize: "14px" }}>{msg.message}</p>
              </div>
              <span
                style={{
                  fontSize: "11px",
                  color: "#666",
                  marginTop: "4px",
                }}
              >
                {formatTime(msg.timestamp)}
              </span>
            </div>
          );
        })}
        <div ref={messagesEndRef} />
      </div>

      <div
        style={{
          padding: CHAT_CONSTANTS.LAYOUT.PADDING,
          borderTop: "1px solid #dee2e6",
          backgroundColor: "white",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "flex-end",
          }}
        >
          <textarea
            ref={textAreaRef}
            value={inputMessage}
            onChange={handleInputChange}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid #dee2e6",
              borderRadius: "8px",
              outline: "none",
              resize: "none",
              minHeight: `${CHAT_CONSTANTS.INPUT.MIN_HEIGHT}px`,
              maxHeight: `${CHAT_CONSTANTS.INPUT.MAX_HEIGHT}px`,
              lineHeight: `${CHAT_CONSTANTS.INPUT.LINE_HEIGHT}px`,
              transition: "height 0.1s ease-in-out",
            }}
          />
          <button
            onClick={handleSendMessage}
            style={{
              padding: "8px 12px",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
              height: `${CHAT_CONSTANTS.INPUT.MIN_HEIGHT}px`,
              flexShrink: 0,
            }}
          >
            <Send size={25} strokeWidth={2} color={"#0d6efd"} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
