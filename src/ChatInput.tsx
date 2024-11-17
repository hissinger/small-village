import { useCallback, useEffect, useState } from "react";
import {
  CHANNEL_MESSAGE,
  Message,
  MessageType,
  RECEIVER_ALL,
  useMessage,
} from "./context/MessageContext";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { faPaperPlane } from "@fortawesome/free-solid-svg-icons";

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

    // send message to all users
    const payload: Message = {
      type: MessageType.CHAT,
      sender_id: props.userId,
      receiver_id: RECEIVER_ALL,
      body: message,
    };
    sendMessage(CHANNEL_MESSAGE, payload);

    // clear message input
    setMessage("");
  };

  const handleMessage = useCallback(
    (message: Message) => {
      const { sender_id, body, type } = message;
      if (type === MessageType.CHAT) {
        props.onMessage(sender_id, body as string);
      }
    },
    [props]
  );

  useEffect(() => {
    addMessageHandler(CHANNEL_MESSAGE, handleMessage);
    return () => {
      removeMessageHandler(CHANNEL_MESSAGE, handleMessage);
    };
  }, [addMessageHandler, removeMessageHandler, handleMessage]);

  return (
    <div
      style={{
        left: "50%",
        display: "flex",
        width: "80%",
        maxWidth: 600,
        height: "100%",
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
          padding: "0px 20px",
          fontSize: "16px",
          borderRadius: "0 5px 5px 0",
          border: "none",
          backgroundColor: "#4CAF50",
          color: "white",
          cursor: "pointer",
        }}
      >
        <FontAwesomeIcon icon={faPaperPlane} />
      </button>
    </div>
  );
}
