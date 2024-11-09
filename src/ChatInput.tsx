import { useCallback, useEffect, useState } from "react";
import {
  CHANNEL_MESSAGE,
  Message,
  MessageType,
  RECEIVER_ALL,
  useMessage,
} from "./MessageContext";

interface ChatInputProps {
  userId: string;
  onMessage: (senderId: string, message: string) => void;
}

export default function ChatInput(props: ChatInputProps) {
  const [message, setMessage] = useState<string>("");
  const { sendMessage, addMessageHandler, removeMessageHandler } = useMessage();

  const handleSendMessage = () => {
    if (message.trim() === "") {
      return;
    }

    const payload: Message = {
      type: MessageType.CHAT,
      sender_id: props.userId,
      receiver_id: RECEIVER_ALL,
      body: message,
    };

    sendMessage(CHANNEL_MESSAGE, payload);
  };

  const handleMessage = useCallback((message: Message) => {
    const { sender_id, body, type } = message;
    if (type === MessageType.CHAT) {
      props.onMessage(sender_id, body as string);
    }
  }, []);

  useEffect(() => {
    addMessageHandler(CHANNEL_MESSAGE, handleMessage);
    return () => {
      removeMessageHandler(CHANNEL_MESSAGE, handleMessage);
    };
  }, [addMessageHandler, removeMessageHandler, handleMessage]);

  return (
    <div
      style={{
        position: "absolute",
        bottom: 80, // 하단과의 간격 조정
        left: "50%",
        transform: "translateX(-50%)",
        display: "flex",
        width: "80%",
        maxWidth: 600,
      }}
    >
      <input
        type="text"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        placeholder="Enter your message..."
        style={{
          flex: 1,
          padding: "10px",
          fontSize: "16px",
          borderRadius: "5px 0 0 5px",
          border: "1px solid #ccc",
        }}
      />
      <button
        onClick={handleSendMessage}
        style={{
          padding: "10px 20px",
          fontSize: "16px",
          borderRadius: "0 5px 5px 0",
          border: "none",
          backgroundColor: "#4CAF50",
          color: "white",
          cursor: "pointer",
        }}
      >
        Send
      </button>
    </div>
  );
}
