import React, { useEffect, useRef, useState } from "react";
import CallUI from "./CallUI";
import useWebRTCCall from "./hooks/useWebRTCCall";

interface WebRTCCallProps {
  userId: string;
  partnerId: string;
  isInitiator: boolean;
  onEndCall: () => void;
}

const WebRTCCall: React.FC<WebRTCCallProps> = (props) => {
  const [isMuted, setIsMuted] = useState(false);
  const remoteAudioRef = useRef<HTMLAudioElement>(null);

  const { stream, remoteStream } = useWebRTCCall({
    isInitiator: props.isInitiator,
    userId: props.userId,
    partnerId: props.partnerId,
  });

  const toggleMute = () => {
    if (stream) {
      stream
        .getAudioTracks()
        .forEach((track) => (track.enabled = !track.enabled));
      setIsMuted(!isMuted);
    }
  };

  useEffect(() => {
    if (remoteAudioRef.current && remoteStream) {
      remoteAudioRef.current.srcObject = remoteStream;
    }
  }, [remoteStream]);

  return (
    <div>
      <audio ref={remoteAudioRef} autoPlay />
      <CallUI
        stream={stream}
        remoteStream={remoteStream}
        isMuted={isMuted}
        toggleMute={toggleMute}
        endCall={props.onEndCall}
      />
    </div>
  );
};

export default WebRTCCall;
