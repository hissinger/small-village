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

import React, { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { Modal, Button, Form, Container, Row, Col } from "react-bootstrap";
import LoadingSpinner from "./LoadingSpinner";
import CharacterPreviewScene from "./scenes/CharacterPreviewScene";
import { NUM_CHARACTERS } from "./constants";

interface CharacterSelectModalProps {
  onSelect: (characterIndex: number, name: string) => void;
}

interface CharacterPreviewProps {
  previewContainerRef: React.RefObject<HTMLDivElement>;
  onPrevious: () => void;
  onNext: () => void;
}

const CharacterPreview: React.FC<CharacterPreviewProps> = ({
  previewContainerRef,
  onPrevious,
  onNext,
}) => (
  <Row className="justify-content-center mb-3 align-items-center">
    <Col xs="auto">
      <Button variant="outline-secondary" onClick={onPrevious}>
        ◀
      </Button>
    </Col>
    <Col xs="auto">
      <div
        ref={previewContainerRef}
        style={{ width: "120px", height: "100px" }}
      />
    </Col>
    <Col xs="auto">
      <Button variant="outline-secondary" onClick={onNext}>
        ▶
      </Button>
    </Col>
  </Row>
);
interface NameInputProps {
  name: string;
  onChange: (value: string) => void;
}

const NameInput: React.FC<NameInputProps> = ({ name, onChange }) => (
  <Form.Group className="mt-3">
    <Form.Label>Enter Your Name</Form.Label>
    <Form.Control
      type="text"
      placeholder="Name"
      value={name}
      onChange={(e) => onChange(e.target.value)}
    />
  </Form.Group>
);

const CharacterSelectModal: React.FC<CharacterSelectModalProps> = ({
  onSelect,
}) => {
  const [name, setName] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const gameInstance = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<CharacterPreviewScene | null>(null);
  const [readyScene, setReadyScene] = useState(false);

  useEffect(() => {
    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      width: 120,
      height: 100,
      parent: previewContainerRef.current as HTMLDivElement,
      scene: CharacterPreviewScene,
      pixelArt: true,
      audio: {
        noAudio: true,
      },
    };

    const game = new Phaser.Game(config);
    gameInstance.current = game;

    game.events.once(Phaser.Scenes.Events.READY, () => {
      const scene = game.scene.getScene(
        "CharacterPreviewScene"
      ) as CharacterPreviewScene;
      if (scene) {
        sceneRef.current = scene;

        setTimeout(() => {
          setReadyScene(true);
        }, 1_000);
      }
    });

    return () => {
      gameInstance.current?.destroy(true);
      gameInstance.current = null;
    };
  }, []);

  const handleNext = () => {
    if (!sceneRef.current) return;
    const nextIndex = (currentIndex + 1) % NUM_CHARACTERS;
    setCurrentIndex(nextIndex);
    sceneRef.current.updateCharacter(nextIndex);
  };

  const handlePrevious = () => {
    if (!sceneRef.current) return;
    const prevIndex = (currentIndex - 1 + NUM_CHARACTERS) % NUM_CHARACTERS;
    setCurrentIndex(prevIndex);
    sceneRef.current.updateCharacter(prevIndex);
  };

  return (
    <Modal show centered>
      <Modal.Header style={{ visibility: readyScene ? "visible" : "hidden" }}>
        <Modal.Title>Select Your Character</Modal.Title>
      </Modal.Header>
      <Modal.Body style={{ visibility: readyScene ? "visible" : "hidden" }}>
        <Container>
          <CharacterPreview
            previewContainerRef={previewContainerRef}
            onPrevious={handlePrevious}
            onNext={handleNext}
          />
          <NameInput name={name} onChange={setName} />
        </Container>
      </Modal.Body>
      <Modal.Footer style={{ visibility: readyScene ? "visible" : "hidden" }}>
        <Button
          variant="primary"
          onClick={() => onSelect(currentIndex, name)}
          disabled={!name}
        >
          Confirm
        </Button>
      </Modal.Footer>
      {!readyScene && <LoadingSpinner message="Loading..." />}
    </Modal>
  );
};

export default CharacterSelectModal;
