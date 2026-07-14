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

import { useEffect, useRef } from "react";
import SmallVillageScene from "../scenes/SmallVillageScene";
import { useSpeakingPeers } from "../hooks/useSpeakingPeers";

interface SpeakerIndicatorsProps {
  scene: SmallVillageScene;
}

/**
 * useSpeakingPeers 의 발화 집합 변화를 씬 명령(setSpeaking)으로 브리지한다.
 * React state → 명령형 Phaser 씬 패턴(SmallVillage.tsx)을 따른다. 렌더 결과는 없다.
 */
export default function SpeakerIndicators({ scene }: SpeakerIndicatorsProps) {
  const speaking = useSpeakingPeers();
  const prevRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const prev = prevRef.current;

    // 새로 켜진 id → 링 표시
    speaking.forEach((id) => {
      if (!prev.has(id)) {
        scene.setSpeaking(id, true);
      }
    });

    // 꺼진 id → 링 숨김
    prev.forEach((id) => {
      if (!speaking.has(id)) {
        scene.setSpeaking(id, false);
      }
    });

    prevRef.current = new Set(speaking);
  }, [speaking, scene]);

  return null;
}
