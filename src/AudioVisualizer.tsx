import { useEffect, useRef, useState } from "react";

interface AudioVisualizerProps {
  track: MediaStreamTrack | null;
  width: string;
}

const AudioVisualizer = (props: AudioVisualizerProps) => {
  const [volume, setVolume] = useState(0);
  const pidsRef = useRef<(HTMLDivElement | null)[]>([]);

  useEffect(() => {
    if (!props.track) {
      return;
    }

    const handleAudioStream = async (track: MediaStreamTrack) => {
      try {
        const audioContext = new AudioContext();
        await audioContext.audioWorklet.addModule("volumeProcessor.js");
        const microphone = audioContext.createMediaStreamSource(
          new MediaStream([track])
        );
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

    handleAudioStream(props.track);
  }, [props.track]);

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
        borderRadius: "5px",
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
