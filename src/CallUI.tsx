import React from "react";
import { Button } from "react-bootstrap";
import { FaMicrophone, FaMicrophoneSlash } from "react-icons/fa";

interface CallUIProps {
  stream: MediaStream | null;
  remoteStream: MediaStream | null;
  isMuted: boolean;
  toggleMute: () => void;
  endCall: () => void;
}

const CallUI: React.FC<CallUIProps> = ({
  stream,
  remoteStream,
  isMuted,
  toggleMute,
  endCall,
}) => (
  <div
    style={{
      position: "fixed",
      top: 70,
      right: 20,
      zIndex: 1000,
    }}
  >
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        padding: "10px",
        backgroundColor: "#FFF",
        borderRadius: "4px",
      }}
    >
      <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
        <Button variant={isMuted ? "danger" : "success"} onClick={toggleMute}>
          {isMuted ? <FaMicrophoneSlash /> : <FaMicrophone />}
        </Button>
        <Button variant="danger" onClick={endCall} style={{ fontSize: "14px" }}>
          End Call
        </Button>
      </div>
    </div>
  </div>
);

export default CallUI;
