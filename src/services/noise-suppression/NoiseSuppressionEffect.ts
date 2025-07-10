/**
 * Returns the base URL of the app.
 *
 * @param {Object} w - Window object to use instead of the built in one.
 * @returns {string}
 */
function getBaseUrl(w: typeof window = window) {
  const doc = w.document;
  const base = doc.querySelector("base");

  if (base?.href) {
    return base.href;
  }

  const { protocol, host } = w.location;

  return `${protocol}//${host}`;
}

let audioContext: AudioContext;

/**
 * Class Implementing the effect interface expected by a JitsiLocalTrack.
 * Effect applies rnnoise denoising on a audio JitsiLocalTrack.
 */
export class NoiseSuppressionEffect {
  /**
   * Source that will be attached to the track affected by the effect.
   */
  private _audioSource!: MediaStreamAudioSourceNode;

  /**
   * Destination that will contain denoised audio from the audio worklet.
   */
  private _audioDestination!: MediaStreamAudioDestinationNode;

  /**
   * `AudioWorkletProcessor` associated node.
   */
  private _noiseSuppressorNode?: AudioWorkletNode;

  /**
   * Audio track extracted from the original MediaStream to which the effect is applied.
   */
  private _originalMediaTrack!: MediaStreamTrack;

  /**
   * Noise suppressed audio track extracted from the media destination node.
   */
  private _outputMediaTrack!: MediaStreamTrack;

  /**
   * Instantiates a noise suppressor audio effect which will use rnnoise.
   */
  constructor() {
    console.log(`NoiseSuppressionEffect created with RNNoise`);
  }

  /**
   * Effect interface called by source JitsiLocalTrack.
   * Applies effect that uses a {@code NoiseSuppressor} service initialized with {@code RnnoiseProcessor}
   * for denoising.
   *
   * @param {MediaStream} audioStream - Audio stream which will be mixed with _mixAudio.
   * @returns {MediaStream} - MediaStream containing both audio tracks mixed together.
   */
  startEffect(audioStream: MediaStream): MediaStream {
    this._originalMediaTrack = audioStream.getAudioTracks()[0];

    if (!audioContext) {
      audioContext = new AudioContext();
    }

    this._audioSource = audioContext.createMediaStreamSource(audioStream);
    this._audioDestination = audioContext.createMediaStreamDestination();
    this._outputMediaTrack = this._audioDestination.stream.getAudioTracks()[0];

    let init;

    init = _initializeKRnnoise().then((filterNode) => {
      this._noiseSuppressorNode = filterNode;
    });

    // Connect the audio processing graph MediaStream -> AudioWorkletNode -> MediaStreamAudioDestinationNode

    init.then(() => {
      if (this._noiseSuppressorNode) {
        this._audioSource.connect(this._noiseSuppressorNode);
        this._noiseSuppressorNode.connect(this._audioDestination);
      }
    });

    // Sync the effect track muted state with the original track state.
    this._outputMediaTrack.enabled = this._originalMediaTrack.enabled;

    // We enable the audio on the original track because mute/unmute action will only affect the audio destination
    // output track from this point on.
    this._originalMediaTrack.enabled = true;

    return this._audioDestination.stream;
  }

  /**
   * Checks if the JitsiLocalTrack supports this effect.
   *
   * @param {JitsiLocalTrack} sourceLocalTrack - Track to which the effect will be applied.
   * @returns {boolean} - Returns true if this effect can run on the specified track, false otherwise.
   */
  isEnabled(sourceLocalTrack: any): boolean {
    // JitsiLocalTracks needs to be an audio track.
    return sourceLocalTrack.isAudioTrack();
  }

  /**
   * Clean up resources acquired by noise suppressor and rnnoise processor.
   *
   * @returns {void}
   */
  stopEffect(): void {
    // Sync original track muted state with effect state before removing the effect.
    this._originalMediaTrack.enabled = this._outputMediaTrack.enabled;

    // Technically after this process the Audio Worklet along with it's resources should be garbage collected,
    // however on chrome there seems to be a problem as described here:
    // https://bugs.chromium.org/p/chromium/issues/detail?id=1298955
    this._noiseSuppressorNode?.port?.close();

    this._audioDestination?.disconnect();
    this._noiseSuppressorNode?.disconnect();
    this._audioSource?.disconnect();

    audioContext.suspend();
  }
}

/**
 * Initializes the RNNoise audio worklet and creates the filter node.
 *
 * @returns {Promise<AudioWorkletNode | undefined>}
 */
async function _initializeKRnnoise(): Promise<AudioWorkletNode | undefined> {
  await audioContext.resume();

  const baseUrl = `${getBaseUrl()}public/`;
  const workletUrl = `${baseUrl}noise-suppressor-worklet.min.js`;

  try {
    await audioContext.audioWorklet.addModule(workletUrl);
  } catch (e) {
    console.error("Error while adding audio worklet module: ", e);

    return;
  }

  // After the resolution of module loading, an AudioWorkletNode can be constructed.

  return new AudioWorkletNode(audioContext, "NoiseSuppressorWorklet");
}
