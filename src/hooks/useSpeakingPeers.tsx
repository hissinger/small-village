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
import { useRealtimeKitMeeting } from "@cloudflare/realtimekit-react";
import {
  POLL_INTERVAL_MS,
  SPEAKING_HANGOVER_MS,
  SPEAKING_RMS_THRESHOLD,
  SpeakingEntry,
  computeRms,
  setsEqual,
  updateSpeaking,
} from "../lib/speakingPeers";

// AnalyserNode FFT 크기. 시간영역 샘플 길이도 이 값과 같다. 발화 판정엔 512 로 충분.
const FFT_SIZE = 512;

// userId(customParticipantId) 별 오디오 측정 슬롯.
interface AnalyserSlot {
  track: MediaStreamTrack;
  source: MediaStreamAudioSourceNode;
  analyser: AnalyserNode;
  // 원격 트랙을 WebAudio 로 흐르게 하는 muted sink (아래 makeSlot 주석 참고).
  sink: HTMLAudioElement;
  buffer: Uint8Array;
}

/**
 * "지금 말하는 userId 집합" 을 돌려준다. RTK 이벤트가 아니라 각 참가자의 audioTrack
 * 을 WebAudio AnalyserNode 로 직접 재서 판정한다.
 *  - 왜: RTK v2 `activeSpeaker` 는 dominant speaker 가 바뀔 때만 1회 emit 되고 동시에
 *    1명만 표현한다. 연속/다중 발화를 표시하려면 볼륨을 직접 측정해야 한다.
 *  - self(내 마이크) + 원격 참가자 모두 대상. 음소거(audioEnabled === false)는 제외.
 *  - analyser 는 destination 에 연결하지 않으므로 오디오가 이중 재생되지 않는다.
 *  - POLL_INTERVAL_MS 마다 RMS 를 재고 hangover(hysteresis)로 깜빡임을 막는다.
 *  - 집합(membership)이 바뀔 때만 리렌더한다(폴링 tick 마다 setState 하지 않음).
 */
export function useSpeakingPeers(): Set<string> {
  const { meeting } = useRealtimeKitMeeting();
  const [speaking, setSpeaking] = useState<Set<string>>(new Set());
  const speakingRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!meeting) return;

    const audioContext = new AudioContext();
    // 사용자 제스처 이후 마운트되지만, suspended 상태면 analyser 가 돌지 않으므로 깨운다.
    audioContext.resume().catch(() => {});

    const slots = new Map<string, AnalyserSlot>(); // userId → 슬롯
    const entries = new Map<string, SpeakingEntry>(); // userId → 발화 상태

    const makeSlot = (track: MediaStreamTrack): AnalyserSlot => {
      const stream = new MediaStream([track]);
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      // destination 에 연결하지 않는다 → 측정만 하고 소리는 내지 않는다.
      source.connect(analyser);

      // 원격 MediaStreamTrack 은 미디어엘리먼트 sink 가 없으면 WebAudio 그래프로
      // 데이터가 흐르지 않는 크롬 이슈가 있다(analyser 가 계속 무음으로 읽힘).
      // muted <audio> 에 스트림을 붙여 트랙이 흐르게 한다(소리는 안 남).
      const sink = new Audio();
      sink.muted = true;
      sink.srcObject = stream;
      sink.play().catch(() => {});

      return {
        track,
        source,
        analyser,
        sink,
        buffer: new Uint8Array(analyser.fftSize),
      };
    };

    const disposeSlot = (slot: AnalyserSlot) => {
      slot.source.disconnect();
      slot.analyser.disconnect();
      slot.sink.pause();
      slot.sink.srcObject = null;
    };

    // 측정 대상: 음소거 아니고 audioTrack 이 있는 self + 원격 참가자.
    const desiredTargets = (): Map<string, MediaStreamTrack> => {
      const targets = new Map<string, MediaStreamTrack>();
      const self = meeting.self;
      if (self.customParticipantId && self.audioEnabled && self.audioTrack) {
        targets.set(self.customParticipantId, self.audioTrack);
      }
      meeting.participants.joined.forEach((p) => {
        if (p.customParticipantId && p.audioEnabled && p.audioTrack) {
          targets.set(p.customParticipantId, p.audioTrack);
        }
      });
      return targets;
    };

    const tick = () => {
      const targets = desiredTargets();

      // 1) 사라졌거나 트랙이 교체된 슬롯 정리.
      slots.forEach((slot, userId) => {
        const track = targets.get(userId);
        if (!track || track.id !== slot.track.id) {
          disposeSlot(slot);
          slots.delete(userId);
          entries.delete(userId);
        }
      });
      // 2) 새 대상 슬롯 생성.
      targets.forEach((track, userId) => {
        if (!slots.has(userId)) {
          slots.set(userId, makeSlot(track));
        }
      });

      // 3) RMS 측정 → 발화 상태 갱신.
      const now = Date.now();
      const next = new Set<string>();
      slots.forEach((slot, userId) => {
        slot.analyser.getByteTimeDomainData(slot.buffer);
        const entry = updateSpeaking(
          entries.get(userId),
          computeRms(slot.buffer),
          now,
          SPEAKING_RMS_THRESHOLD,
          SPEAKING_HANGOVER_MS
        );
        entries.set(userId, entry);
        if (entry.active) next.add(userId);
      });

      // 집합이 바뀐 경우에만 리렌더(SpeakerIndicators effect churn 방지).
      if (!setsEqual(next, speakingRef.current)) {
        speakingRef.current = next;
        setSpeaking(next);
      }
    };

    const interval = setInterval(tick, POLL_INTERVAL_MS);

    return () => {
      clearInterval(interval);
      slots.forEach(disposeSlot);
      slots.clear();
      audioContext.close().catch(() => {});
    };
  }, [meeting]);

  return speaking;
}
