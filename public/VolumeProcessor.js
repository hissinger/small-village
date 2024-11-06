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
