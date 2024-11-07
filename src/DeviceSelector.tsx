import React, { useState, useEffect, useRef } from "react";
import {
  Container,
  Row,
  Col,
  Form,
  Button,
  Spinner,
  Alert,
} from "react-bootstrap";
import AudioVisualizer from "./AudioVisualizer";

interface VideoDisplayProps {
  stream: MediaStream | null;
  videoRef: React.RefObject<HTMLVideoElement>;
}

const VideoDisplay: React.FC<VideoDisplayProps> = ({ stream, videoRef }) => {
  return (
    <div className="d-flex flex-column align-items-center">
      {stream ? (
        <video
          ref={videoRef}
          autoPlay
          muted
          style={{
            objectFit: "cover",
            height: "200px",
            width: "300px",
            border: "2px solid #ccc",
            borderRadius: "8px",
            marginBottom: "10px",
            backgroundColor: "#555",
          }}
        />
      ) : (
        <div
          style={{
            height: "200px",
            width: "300px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #ccc",
            borderRadius: "8px",
            marginBottom: "10px",
            backgroundColor: "#555",
          }}
        >
          <Spinner animation="border" role="status" style={{ color: "#fff" }}>
            <span className="sr-only"></span>
          </Spinner>
        </div>
      )}
    </div>
  );
};

interface DeviceFormProps {
  videoInputs: MediaDeviceInfo[];
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[];
  selectedVideoInput: string;
  selectedAudioInput: string;
  selectedAudioOutput: string;
  onVideoInputChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onAudioInputChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onAudioOutputChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onConfirm: () => void;
}

const DeviceForm: React.FC<DeviceFormProps> = ({
  videoInputs,
  audioInputs,
  audioOutputs,
  selectedVideoInput,
  selectedAudioInput,
  selectedAudioOutput,
  onVideoInputChange,
  onAudioInputChange,
  onAudioOutputChange,
  onConfirm,
}) => {
  const width = "400px";

  const disabledConfirm =
    videoInputs.length === 0 ||
    audioInputs.length === 0 ||
    audioOutputs.length === 0;

  return (
    <Form>
      <Form.Group controlId="videoInputSelect">
        <Form.Label>Camera</Form.Label>
        <Form.Control
          as="select"
          value={selectedVideoInput}
          onChange={(e) =>
            onVideoInputChange(
              e as unknown as React.ChangeEvent<HTMLSelectElement>
            )
          }
          style={{ width: width }}
        >
          {videoInputs.length === 0 && <option>Loading...</option>}
          {videoInputs.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Camera ${device.deviceId}`}
            </option>
          ))}
        </Form.Control>
      </Form.Group>
      <Form.Group controlId="audioInputSelect" className="mt-3">
        <Form.Label>Microphone</Form.Label>
        <Form.Control
          as="select"
          value={selectedAudioInput}
          onChange={(e) =>
            onAudioInputChange(
              e as unknown as React.ChangeEvent<HTMLSelectElement>
            )
          }
          style={{ width: width }}
        >
          {audioInputs.length === 0 && <option>Loading...</option>}
          {audioInputs.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Microphone ${device.deviceId}`}
            </option>
          ))}
        </Form.Control>
      </Form.Group>
      <Form.Group controlId="audioOutputSelect" className="mt-3">
        <Form.Label>Speaker</Form.Label>
        <Form.Control
          as="select"
          value={selectedAudioOutput}
          onChange={(e) =>
            onAudioOutputChange(
              e as unknown as React.ChangeEvent<HTMLSelectElement>
            )
          }
          style={{ width: width }}
        >
          {audioOutputs.length === 0 && <option>Loading...</option>}
          {audioOutputs.map((device) => (
            <option key={device.deviceId} value={device.deviceId}>
              {device.label || `Speaker ${device.deviceId}`}
            </option>
          ))}
        </Form.Control>
      </Form.Group>
      <Button
        variant="primary"
        onClick={onConfirm}
        className="mt-3"
        disabled={disabledConfirm}
      >
        Confirm
      </Button>
    </Form>
  );
};

interface DeviceSelectorProps {
  onExit: () => void;
}

const DeviceSelector: React.FC<DeviceSelectorProps> = (
  props: DeviceSelectorProps
) => {
  const [videoInputs, setVideoInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioInputs, setAudioInputs] = useState<MediaDeviceInfo[]>([]);
  const [audioOutputs, setAudioOutputs] = useState<MediaDeviceInfo[]>([]);
  const [selectedVideoInput, setSelectedVideoInput] = useState<string>("");
  const [selectedAudioInput, setSelectedAudioInput] = useState<string>("");
  const [selectedAudioOutput, setSelectedAudioOutput] = useState<string>("");
  const [localVideoStream, setLocalVideoStream] = useState<MediaStream | null>(
    null
  );
  const [localAudioStream, setLocalAudioStream] = useState<MediaStream | null>(
    null
  );
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);

  const getDevices = async () => {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(
        (device) => device.kind === "videoinput"
      );
      const audioDevices = devices.filter(
        (device) => device.kind === "audioinput"
      );
      const outputDevices = devices.filter(
        (device) => device.kind === "audiooutput"
      );

      setVideoInputs(videoDevices);
      setAudioInputs(audioDevices);
      setAudioOutputs(outputDevices);

      if (videoDevices.length > 0) {
        setSelectedVideoInput(videoDevices[0].deviceId);
      }
      if (audioDevices.length > 0) {
        setSelectedAudioInput(audioDevices[0].deviceId);
      }
      if (outputDevices.length > 0) {
        setSelectedAudioOutput(outputDevices[0].deviceId);
      }
    } catch (error) {
      setPermissionError(
        "Failed to enumerate devices. Please check your permissions."
      );
    }
  };

  useEffect(() => {
    const requestPermissions = async () => {
      try {
        await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        getDevices();
      } catch (error) {
        setPermissionError("Camera and microphone permissions are required.");
      }
    };

    requestPermissions();

    const handleDeviceChange = () => {
      getDevices();
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);

    return () => {
      navigator.mediaDevices.removeEventListener(
        "devicechange",
        handleDeviceChange
      );
    };
  }, []);

  useEffect(() => {
    const getLocalVideoStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { deviceId: selectedVideoInput },
          audio: false,
        });
        setLocalVideoStream(stream);
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        setPermissionError("Failed to access the selected camera.");
      }
    };

    getLocalVideoStream();

    return () => {
      if (localVideoStream) {
        localVideoStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [selectedVideoInput]);

  useEffect(() => {
    const getLocalAudioStream = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: false,
          audio: { deviceId: selectedAudioInput },
        });
        setLocalAudioStream(stream);
      } catch (error) {
        setPermissionError("Failed to access the selected microphone.");
      }
    };

    getLocalAudioStream();

    return () => {
      if (localAudioStream) {
        localAudioStream.getTracks().forEach((track) => track.stop());
      }
    };
  }, [selectedAudioInput]);

  useEffect(() => {
    if (selectedAudioOutput && audioRef.current) {
      const audioElement = audioRef.current as HTMLAudioElement & {
        setSinkId?: (sinkId: string) => Promise<void>;
      };
      if (audioElement.setSinkId) {
        audioElement.setSinkId(selectedAudioOutput).catch((error) => {
          console.error("Error setting audio output device:", error);
        });
      } else {
        console.warn("setSinkId is not supported in this browser.");
      }
    }
  }, [selectedAudioOutput]);

  return (
    <Container
      fluid
      className="d-flex align-items-center justify-content-center vh-100"
    >
      <Row className="w-100 justify-content-center">
        <Col md="auto" className="d-flex align-items-center">
          <div className="d-flex flex-column align-items-center">
            <VideoDisplay stream={localVideoStream} videoRef={videoRef} />
            <AudioVisualizer stream={localAudioStream} width="300px" />
          </div>
          <audio ref={audioRef} />
        </Col>

        <Col md="auto">
          {permissionError && <Alert variant="danger">{permissionError}</Alert>}
          <DeviceForm
            videoInputs={videoInputs}
            audioInputs={audioInputs}
            audioOutputs={audioOutputs}
            selectedVideoInput={selectedVideoInput}
            selectedAudioInput={selectedAudioInput}
            selectedAudioOutput={selectedAudioOutput}
            onVideoInputChange={(e) => setSelectedVideoInput(e.target.value)}
            onAudioInputChange={(e) => setSelectedAudioInput(e.target.value)}
            onAudioOutputChange={(e) => setSelectedAudioOutput(e.target.value)}
            onConfirm={props.onExit}
          />
        </Col>
      </Row>
    </Container>
  );
};

export default DeviceSelector;
