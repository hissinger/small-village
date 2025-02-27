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

class VolumeProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this.volume = 0;
  }

  process(inputs, outputs, parameters) {
    const input = inputs[0];
    if (input) {
      const samples = input[0];
      let sum = 0;
      for (let i = 0; i < samples.length; i++) {
        sum += samples[i] * samples[i];
      }
      this.volume = Math.sqrt(sum / samples.length);

      this.port.postMessage(this.volume * 200);
    }
    return true;
  }
}

registerProcessor("volume-processor", VolumeProcessor);
