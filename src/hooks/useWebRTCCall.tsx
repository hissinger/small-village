import { useEffect, useState, useRef } from "react";
import Peer from "simple-peer";
import {
  CHANNEL_MESSAGE,
  Message,
  useMessage,
  MessageType,
} from "../MessageContext";

interface UseWebRTCCallProps {
  isInitiator: boolean;
  userId: string;
  partnerId: string;
}

export default function useWebRTCCall(props: UseWebRTCCallProps) {
  const [stream, setStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);
  const peerRef = useRef<Peer.Instance | null>(null);
  const { sendMessage, addMessageHandler, removeMessageHandler } = useMessage();

  useEffect(() => {
    const handleMessage = (message: Message) => {
      if (message.type !== MessageType.PEER_SIGNAL) {
        return;
      }

      if (!message.body) {
        console.error("Message body is null");
        return;
      }

      if (message.sender_id === props.partnerId) {
        const signalData = JSON.parse(message.body);
        peerRef.current?.signal(signalData);
      }
    };

    addMessageHandler(CHANNEL_MESSAGE, handleMessage);

    const handleSignal = (signalData: Peer.SignalData) => {
      const message: Message = {
        type: MessageType.PEER_SIGNAL,
        sender_id: props.userId,
        receiver_id: props.partnerId,
        body: JSON.stringify(signalData),
      };
      sendMessage(CHANNEL_MESSAGE, message);
    };

    const initAudioCall = async () => {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      setStream(mediaStream);

      const iceServers = [{ urls: "stun:stun.l.google.com:19302" }];

      peerRef.current = new Peer({
        initiator: props.isInitiator,
        trickle: true,
        stream: mediaStream,
        config: { iceServers },
      });

      peerRef.current.on("signal", handleSignal);
      peerRef.current.on("stream", (remoteStream: MediaStream) => {
        setRemoteStream(remoteStream);
      });
      peerRef.current.on("connect", () => {
        console.log("Peer connection established");
      });
      peerRef.current.on("error", (error: Error) => {
        console.error("Peer error", error);
      });
      peerRef.current.on("close", () => {
        console.log("Peer connection closed");
      });
    };

    initAudioCall();

    return () => {
      console.log("WebRTC call cleanup");
      removeMessageHandler(CHANNEL_MESSAGE, handleMessage);
      peerRef.current?.destroy();
    };
  }, [
    props.isInitiator,
    props.userId,
    props.partnerId,
    sendMessage,
    addMessageHandler,
    removeMessageHandler,
  ]);

  useEffect(() => {
    return () => {
      stream?.getTracks().forEach((track) => track.stop());
    };
  }, [stream]);

  return { stream, remoteStream };
}
