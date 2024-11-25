/**
 * Copyright 2024 SmallVillageProject
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

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
