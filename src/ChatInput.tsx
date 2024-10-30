import { useState } from "react";

interface ChatInputProps {
  onMessage: (message: string) => void;
}

export default function ChatInput(props: ChatInputProps) {
  const [message, setMessage] = useState<string>("");

  const sendMessage = () => {
    if (message.trim() === "") {
      return;
    }

    props.onMessage(message);
    setMessage("");
  };

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
        onClick={sendMessage}
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
