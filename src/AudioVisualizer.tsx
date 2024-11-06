import { useEffect, useRef, useState } from "react";

interface AudioVisualizerProps {
  stream: MediaStream | null;
  width: string;
}

const AudioVisualizer = (props: AudioVisualizerProps) => {
  const [volume, setVolume] = useState(0);
  const pidsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!props.stream) {
      return;
    }

    const handleAudioStream = async (stream: MediaStream) => {
      try {
        const audioContext = new AudioContext();
        await audioContext.audioWorklet.addModule("volumeProcessor.js");
        const microphone = audioContext.createMediaStreamSource(stream);
        const volumeNode = new AudioWorkletNode(
          audioContext,
          "volume-processor"
        );

        volumeNode.port.onmessage = (event) => {
          setVolume(event.data);
        };

        microphone.connect(volumeNode);
        volumeNode.connect(audioContext.destination);
      } catch (err) {
        console.error("Error accessing audio stream:", err);
      }
    };

    handleAudioStream(props.stream);
  }, [props.stream]);

  const colorPids = () => {
    const numberOfPidsToColor = Math.round(volume / 10);
    return Array.from({ length: 10 }, (_, i) =>
      i < numberOfPidsToColor ? "#69ce2b" : "#e6e7e8"
    );
  };

  return (
    <div
      style={{
        width: props.width,
        display: "flex",
        justifyContent: "space-between",
        gap: "5px",
        border: "1px solid #bbb",
        borderRadius: "8px",
        padding: "5px",
      }}
    >
      {colorPids().map((color, index) => (
        <div
          key={index}
          ref={(el) => (pidsRef.current[index] = el)}
          style={{
            width: "calc(10% - 10px)",
            height: "6px",
            backgroundColor: color,
            borderRadius: "3px",
          }}
        />
      ))}
    </div>
  );
};

export default AudioVisualizer;
