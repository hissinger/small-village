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

import { RTKParticipant } from "@cloudflare/realtimekit-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { SPATIAL_AUDIO } from "../constants";
import { spatialAudioGain } from "../lib/spatialAudioRange";

type SpatialAudioRendererProps = {
  participant: RTKParticipant;
  position: { x: number; y: number };
  myPosition: { x: number; y: number };
  audioContext: AudioContext;
};

export function SpatialAudioRenderer({
  participant,
  position,
  myPosition,
  audioContext,
}: SpatialAudioRendererProps) {
  const audioEl = useRef<HTMLAudioElement | null>(null);
  const sourceNode = useRef<MediaStreamAudioSourceNode | null>(null);
  const panner = useRef<PannerNode | null>(null);
  // ring EDGE 밖 하드 컷용 게이트. exponential PannerNode 는 maxDistance 밖에서도
  // gain 을 0 으로 자르지 않으므로(#29) 뒤에 GainNode 를 달아 거리로 직접 무음 처리한다.
  const gainNode = useRef<GainNode | null>(null);
  const [relativePosition, setRelativePosition] = useState<{
    x: number;
    y: number;
  }>({
    x: 1000,
    y: 1000,
  }); // Set as very far away for our initial values

  // Get the media stream from the track publication
  const mediaStream = useMemo(() => {
    const mediaStreamTrack = participant.audioTrack;
    return new MediaStream([mediaStreamTrack]);
  }, [participant]);

  // Cleanup function for all of the WebAudio nodes we made
  const cleanupWebAudio = useCallback(() => {
    if (gainNode.current) gainNode.current.disconnect();
    if (panner.current) panner.current.disconnect();
    if (sourceNode.current) sourceNode.current.disconnect();

    gainNode.current = null;
    panner.current = null;
    sourceNode.current = null;
  }, []);

  // Calculate relative position when position changes
  useEffect(() => {
    setRelativePosition((prev) => {
      return {
        x: position.x - myPosition.x,
        y: position.y - myPosition.y,
      };
    });
  }, [myPosition.x, myPosition.y, position.x, position.y]);

  // Setup panner node for desktop
  useEffect(() => {
    // Cleanup any other nodes we may have previously created
    cleanupWebAudio();

    // Early out if we're missing anything
    if (!audioEl.current || !participant.audioTrack || !mediaStream)
      return cleanupWebAudio;

    // Create the entry-node into WebAudio.
    // This turns our mediaStream into a usable WebAudio node.
    sourceNode.current = audioContext.createMediaStreamSource(mediaStream);

    // Initialize the PannerNode and its values
    panner.current = audioContext.createPanner();
    panner.current.coneOuterAngle = 360;
    panner.current.coneInnerAngle = 360;
    panner.current.positionX.setValueAtTime(1000, 0); // set far away initially so we don't hear it at full volume
    panner.current.positionY.setValueAtTime(0, 0);
    panner.current.positionZ.setValueAtTime(0, 0);
    panner.current.distanceModel = "exponential";
    panner.current.coneOuterGain = 1;
    panner.current.refDistance = SPATIAL_AUDIO.REF_DISTANCE; // was 100
    panner.current.maxDistance = SPATIAL_AUDIO.MAX_DISTANCE; // was 500
    panner.current.rolloffFactor = 2;

    // ring EDGE(MAX_DISTANCE) 밖이면 무음으로 자르는 게이트. 초기엔 멀리 있다고 보고 0.
    gainNode.current = audioContext.createGain();
    gainNode.current.gain.setValueAtTime(0, 0);

    // Connect the nodes to each other
    sourceNode.current
      .connect(panner.current)
      .connect(gainNode.current)
      .connect(audioContext.destination);

    // Attach the mediaStream to an AudioElement. This is just a
    // quirky requirement of WebAudio to get the pipeline to play
    // when dealing with MediaStreamAudioSource nodes
    audioEl.current.srcObject = mediaStream;
    audioEl.current.play();

    return cleanupWebAudio;
  }, [
    panner,
    participant.audioTrack,
    cleanupWebAudio,
    audioContext,
    participant,
    mediaStream,
  ]);

  // Update the PannerNode's position values to our
  // calculated relative position.
  useEffect(() => {
    if (!audioEl.current || !panner.current) return;
    panner.current.positionX.setTargetAtTime(relativePosition.x, 0, 0.02);
    panner.current.positionZ.setTargetAtTime(relativePosition.y, 0, 0.02);
    // ring EDGE 밖이면 하드 컷(gain 0), 안이면 풀 게인(1). exponential 모델이 스스로
    // 자르지 못하는 구간을 여기서 무음 처리해 링 경계와 오디오 컷오프를 일치시킨다.
    if (gainNode.current) {
      const gain = spatialAudioGain(relativePosition.x, relativePosition.y);
      gainNode.current.gain.setTargetAtTime(gain, 0, 0.02);
    }
  }, [relativePosition.x, relativePosition.y, panner]);

  return <audio muted={true} ref={audioEl} />;
}
