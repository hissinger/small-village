import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faMicrophoneSlash,
} from "@fortawesome/free-solid-svg-icons";
import { useRoomContext } from "./context/RoomContext";

export default function AudioMuteButton() {
  const [isMuted, setIsMuted] = useState(false);
  const { localAudioTrack } = useRoomContext();

  useEffect(() => {
    if (!localAudioTrack) {
      return;
    }

    setIsMuted(!localAudioTrack.enabled);
  }, [localAudioTrack]);

  const handleMuteClick = useCallback(() => {
    if (!localAudioTrack) {
      return;
    }
    setIsMuted(localAudioTrack.enabled);
    localAudioTrack.enabled = !localAudioTrack.enabled;
  }, [localAudioTrack]);

  return (
    <button
      style={{
        backgroundColor: isMuted ? "#dc3545" : "#007bff",
        color: "white",
        border: "none",
        borderRadius: "5px",
        cursor: "pointer",
        margin: "0px 10px 0px 10px",
        padding: "0px 20px",
        height: "100%",
        width: "60px",
      }}
      onClick={handleMuteClick}
    >
      <FontAwesomeIcon icon={isMuted ? faMicrophoneSlash : faMicrophone} />
    </button>
  );
}
