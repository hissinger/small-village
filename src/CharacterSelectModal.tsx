import React, { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { Modal, Button, Form, Container, Row, Col } from "react-bootstrap";
import LoadingSpinner from "./LoadingSpinner";

const NUM_CHARACTERS = 40;

interface CharacterSelectModalProps {
  onSelect: (characterIndex: number, name: string) => void;
}

class CharacterPreviewScene extends Phaser.Scene {
  private currentIndex = 0;
  private sprite: Phaser.GameObjects.Sprite | null = null;

  constructor() {
    super({ key: "CharacterPreviewScene" });
  }

  preload() {
    for (let i = 0; i < NUM_CHARACTERS; i++) {
      const index = i.toString().padStart(3, "0");
      this.load.spritesheet(
        `character_${i}`,
        `/assets/characters/${index}.png`,
        {
          frameWidth: 20,
          frameHeight: 32,
        }
      );
    }
  }

  create() {
    this.createAnimations();
    this.showCharacter(this.currentIndex);
  }
  private createAnimations() {
    for (let i = 0; i < NUM_CHARACTERS; i++) {
      // 각 캐릭터에 대한 애니메이션 정의 (위쪽 방향 걷기)
      this.anims.create({
        key: `walk_${i}`,
        frames: this.anims.generateFrameNumbers(`character_${i}`, {
          start: 0, // 각 캐릭터의 첫 번째 프레임 인덱스
          end: 2, // 세 번째 프레임까지 사용 (0, 1, 2)
        }),
        frameRate: 3, // 초당 프레임 수
        repeat: -1, // 무한 반복
      });
    }
  }

  updateCharacter(index: number) {
    this.currentIndex = index;
    this.showCharacter(this.currentIndex);
  }

  private showCharacter(index: number) {
    if (this.sprite) {
      this.sprite.destroy();
    }

    this.sprite = this.add.sprite(60, 50, `character_${index}`, 0);
    this.sprite.setScale(2);
    this.sprite.setOrigin(0.5, 0.5);
    this.sprite.texture.setFilter(Phaser.Textures.FilterMode.NEAREST);
    this.sprite.play(`walk_${index}`); // 애니메이션 실행
  }
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
