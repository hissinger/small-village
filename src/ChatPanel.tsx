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
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane, faTimes } from "@fortawesome/free-solid-svg-icons";
import {
  CHANNEL_MESSAGE,
  Message,
  MessageType,
  RECEIVER_ALL,
  useMessage,
} from "./context/MessageContext";
import { useChatMessage } from "./hooks/useChatMessage";
import { useRoomContext } from "./context/RoomContext";

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
  const { currentUserId: userId, currentUserName: userName } = useRoomContext();

  const formatTime = (date: string) => {
    return new Date(date).toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    });
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

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
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const chatMessage = useChatMessage();
  useEffect(() => {
    if (!chatMessage) return;

    setMessages((prev) => {
      // Prevent duplicate messages
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
        width: "300px",
        backgroundColor: "white",
        boxShadow: "0 0 10px rgba(0,0,0,0.1)",
        transform: isOpen ? "translateX(0)" : "translateX(100%)",
        transition: "transform 0.3s ease-in-out",
        zIndex: 100,
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
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
          <FontAwesomeIcon icon={faTimes} />
        </button>
      </div>

      {/* Messages */}
      <div
        style={{
          flex: 1,
          overflowY: "auto",
          padding: "16px",
          height: "calc(100% - 130px)",
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

      {/* Input */}
      <div
        style={{
          padding: "16px",
          borderTop: "1px solid #dee2e6",
          backgroundColor: "white",
        }}
      >
        <div
          style={{
            display: "flex",
            gap: "8px",
          }}
        >
          <input
            type="text"
            value={inputMessage}
            onChange={(e) => setInputMessage(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Type a message..."
            style={{
              flex: 1,
              padding: "8px 12px",
              border: "1px solid #dee2e6",
              borderRadius: "8px",
              outline: "none",
            }}
          />
          <button
            onClick={handleSendMessage}
            style={{
              padding: "8px 12px",
              backgroundColor: "#0d6efd",
              color: "white",
              border: "none",
              borderRadius: "8px",
              cursor: "pointer",
            }}
          >
            <FontAwesomeIcon icon={faPaperPlane} />
          </button>
        </div>
      </div>
    </div>
  );
};

export default ChatPanel;
