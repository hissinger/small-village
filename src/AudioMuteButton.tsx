import { useCallback, useEffect, useState } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faMicrophone,
  faMicrophoneSlash,
} from "@fortawesome/free-solid-svg-icons";
import { useLocalStream } from "./context/LocalStreamContext";

export default function AudioMuteButton() {
  const [isMuted, setIsMuted] = useState(false);
  const { localAudioStream } = useLocalStream();

  useEffect(() => {
    if (!localAudioStream) {
      return;
    }

    const audioTrack = localAudioStream.getAudioTracks()[0];
    setIsMuted(!audioTrack.enabled);
  }, [localAudioStream]);

  const handleMuteClick = useCallback(() => {
    localAudioStream?.getAudioTracks().forEach((track) => {
      setIsMuted(track.enabled);
      track.enabled = !track.enabled;
    });
  }, [localAudioStream]);

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
