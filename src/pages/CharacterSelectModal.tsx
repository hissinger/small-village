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
import { RefreshCw } from "lucide-react";
import LoadingSpinner from "../components/LoadingSpinner";
import CharacterPreviewScene from "../scenes/CharacterPreviewScene";
import { NUM_CHARACTERS } from "../constants";
import { useRooms } from "../hooks/useRooms";
import { createMeeting } from "../lib/supabaseFunctions";

import { Room } from "../types";
import IconButton from "../components/IconButton";

interface CharacterSelectModalProps {
  onEnterRoom: (characterIndex: number, name: string, room: Room) => void;
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
  <div className="d-flex flex-column align-items-center">
    <div className="d-flex align-items-center justify-content-center mb-3">
      <Button variant="outline-secondary" onClick={onPrevious} className="me-3">
        ◀
      </Button>
      <div
        ref={previewContainerRef}
        style={{ width: "120px", height: "100px" }}
        className="border rounded"
      />
      <Button variant="outline-secondary" onClick={onNext} className="ms-3">
        ▶
      </Button>
    </div>
  </div>
);

interface NameInputProps {
  name: string;
  onChange: (value: string) => void;
}

const NameInput: React.FC<NameInputProps> = ({ name, onChange }) => (
  <Form.Group>
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
  onEnterRoom,
}) => {
  const [name, setName] = useState("");
  const [newRoomTitle, setNewRoomTitle] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const previewContainerRef = useRef<HTMLDivElement>(null);
  const gameInstance = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<CharacterPreviewScene | null>(null);
  const [readyScene, setReadyScene] = useState(false);
  const { rooms, refetch, loading } = useRooms();

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
      backgroundColor: "#f0f0f0",
    };

    const game = new Phaser.Game(config);
    gameInstance.current = game;

    game.events.once(Phaser.Scenes.Events.READY, () => {
      const scene = game.scene.getScene(
        "CharacterPreviewScene"
      ) as CharacterPreviewScene;
      if (scene) {
        sceneRef.current = scene;
        setTimeout(() => setReadyScene(true), 1000);
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

  const handleCreateRoom = async () => {
    if (!newRoomTitle) return;
    const newRoom = await createMeeting(newRoomTitle);
    onEnterRoom(currentIndex, name, {
      id: newRoom,
      title: newRoomTitle,
      created_at: new Date().toISOString(),
    });
  };

  return (
    <Modal show centered size="lg">
      <Modal.Header closeButton>
        <Modal.Title>Create Your Character & Enter a Room</Modal.Title>
      </Modal.Header>
      <Modal.Body
        style={{
          opacity: readyScene ? 1 : 0,
          transition: "opacity 0.5s ease-in-out",
        }}
        className="d-flex flex-column"
      >
        <Container fluid className="d-flex flex-column flex-grow-1">
          <Row className="flex-grow-1">
            {/* Left Panel: Character and Name */}
            <Col
              md={5}
              className="d-flex flex-column justify-content-center p-4 border-end"
            >
              <h5 className="text-center mb-4">Choose Your Character</h5>
              <CharacterPreview
                previewContainerRef={previewContainerRef}
                onPrevious={handlePrevious}
                onNext={handleNext}
              />
            </Col>

            {/* Right Panel: Room List */}
            <Col md={7} className="p-4 d-flex flex-column">
              <div className="d-flex justify-content-center align-items-center mb-4">
                <h5 className="text-center mb-0 me-2">Available Rooms</h5>
                <IconButton
                  onClick={refetch}
                  ActiveIcon={RefreshCw}
                  activeColor="#6c757d"
                  size={20}
                  strokeWidth={2}
                  style={{ width: "auto", padding: "0 8px" }}
                />
              </div>
              <div
                style={{ minHeight: 0, overflowY: "auto", maxHeight: "300px" }}
                className="pe-2"
              >
                {loading ? (
                  <div
                    className="d-flex justify-content-center align-items-center"
                    style={{ minHeight: "100px" }}
                  >
                    <LoadingSpinner message="Loading rooms..." />
                  </div>
                ) : rooms.length > 0 ? (
                  <ul className="list-group">
                    {rooms.map((room) => (
                      <li
                        key={room.id}
                        className="list-group-item d-flex justify-content-between align-items-center"
                      >
                        <div>
                          <span className="fw-bold">{room.title}</span>
                          <br />
                          <small className="text-muted">
                            {`Created at: ${new Date(
                              room.created_at
                            ).toLocaleString()}`}
                          </small>
                        </div>
                        <Button
                          size="sm"
                          variant="primary"
                          disabled={!name}
                          onClick={() => onEnterRoom(currentIndex, name, room)}
                        >
                          Enter
                        </Button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="text-center text-muted">No available rooms.</p>
                )}
              </div>
            </Col>
          </Row>
          <Row className="align-items-center">
            <Col md={5} className="p-4 border-end">
              <NameInput name={name} onChange={setName} />
            </Col>
            <Col md={7} className="p-4">
              <div>
                <Form.Group>
                  <Form.Label>Create a New Room</Form.Label>
                  <div className="d-flex">
                    <Form.Control
                      type="text"
                      placeholder="Room Title"
                      value={newRoomTitle}
                      onChange={(e) => setNewRoomTitle(e.target.value)}
                    />
                    <Button
                      variant="outline-success"
                      disabled={!name || !newRoomTitle}
                      onClick={handleCreateRoom}
                      className="ms-2"
                    >
                      CREATE
                    </Button>
                  </div>
                </Form.Group>
              </div>
            </Col>
          </Row>
        </Container>
      </Modal.Body>
      {!readyScene && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            backgroundColor: "rgba(255, 255, 255, 0.8)",
          }}
        >
          <LoadingSpinner message="Loading assets..." />
        </div>
      )}
    </Modal>
  );
};

export default CharacterSelectModal;
