import React, { useState, useRef } from "react";
import { Container, Row, Col, Form, Button, Alert } from "react-bootstrap";
import AudioVisualizer from "./AudioVisualizer";
import { useDeviceSelect } from "./hooks/useDeviceSelect";
import { useRoomContext } from "./context/RoomContext";

interface DeviceFormProps {
  width: string;
  audioInputs: MediaDeviceInfo[];
  audioOutputs: MediaDeviceInfo[] | null;
  selectedAudioInput: string;
  selectedAudioOutput: string;
  onAudioInputChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onAudioOutputChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  onConfirm: () => void;
}

const DeviceForm: React.FC<DeviceFormProps> = ({
  audioInputs,
  audioOutputs,
  selectedAudioInput,
  selectedAudioOutput,
  onAudioInputChange,
  onAudioOutputChange,
  onConfirm,
  width,
}) => {
  const disabledConfirm =
    audioInputs.length === 0 || audioOutputs?.length === 0;

  return (
    <Form>
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
      {audioOutputs && (
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
      )}
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
  const { localAudioTrack } = useRoomContext();
  const [permissionError, setPermissionError] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const {
    audioInputs,
    audioOutputs,
    microphoneId,
    speakerId,
    setMicrophoneId,
    setSpeakerId,
  } = useDeviceSelect();

  const handleConfirm = () => {
    props.onExit();
  };

  return (
    <Container
      fluid
      className="d-flex align-items-center justify-content-center vh-100"
    >
      <Row className="w-100 justify-content-center">
        <Col md="auto">
          {permissionError && <Alert variant="danger">{permissionError}</Alert>}
          <AudioVisualizer track={localAudioTrack} width="400px" />
          <DeviceForm
            audioInputs={audioInputs}
            audioOutputs={audioOutputs}
            selectedAudioInput={microphoneId}
            selectedAudioOutput={speakerId}
            onAudioInputChange={(e) => setMicrophoneId(e.target.value)}
            onAudioOutputChange={(e) => setSpeakerId(e.target.value)}
            onConfirm={handleConfirm}
            width="400px"
          />
        </Col>
      </Row>
    </Container>
  );
};

export default DeviceSelector;
