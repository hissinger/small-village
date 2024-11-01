import React, { useEffect, useRef, useState } from "react";
import Phaser from "phaser";
import { Modal, Button, Form, Container, Row, Col } from "react-bootstrap";

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
      this.load.spritesheet(`character_${i}`, `/assets/${index}.png`, {
        frameWidth: 20,
        frameHeight: 32,
      });
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

const CharacterSelectModal: React.FC<CharacterSelectModalProps> = ({
  onSelect,
}) => {
  const [name, setName] = useState("");
  const [currentIndex, setCurrentIndex] = useState(0);
  const previewContainer = useRef<HTMLDivElement>(null);
  const gameInstance = useRef<Phaser.Game | null>(null);
  const sceneRef = useRef<CharacterPreviewScene | null>(null);

  useEffect(() => {
    if (!gameInstance.current) {
      const config: Phaser.Types.Core.GameConfig = {
        type: Phaser.AUTO,
        width: 120,
        height: 100,
        parent: previewContainer.current as HTMLDivElement,
        scene: CharacterPreviewScene,
        pixelArt: true,
      };

      const game = new Phaser.Game(config);
      gameInstance.current = game;

      game.events.once(Phaser.Scenes.Events.READY, () => {
        const scene = game.scene.getScene(
          "CharacterPreviewScene"
        ) as CharacterPreviewScene;
        if (scene) {
          sceneRef.current = scene;
        }
      });
    }

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

  const handleNameChange = React.useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setName(e.target.value);
    },
    []
  );

  return (
    <Modal show centered>
      <Modal.Header>
        <Modal.Title>Select Your Character</Modal.Title>
      </Modal.Header>
      <Modal.Body>
        <Container>
          <Row className="justify-content-center mb-3 align-items-center">
            <Col xs="auto">
              <Button variant="outline-secondary" onClick={handlePrevious}>
                ◀
              </Button>
            </Col>
            <Col xs="auto">
              <div
                ref={previewContainer}
                style={{ width: "120px", height: "100px" }}
              />
            </Col>
            <Col xs="auto">
              <Button variant="outline-secondary" onClick={handleNext}>
                ▶
              </Button>
            </Col>
          </Row>
          <Form.Group className="mt-3">
            <Form.Label>Enter Your Name</Form.Label>
            <Form.Control
              type="text"
              placeholder="Name"
              value={name}
              onChange={handleNameChange}
            />
          </Form.Group>
        </Container>
      </Modal.Body>
      <Modal.Footer>
        <Button
          variant="primary"
          onClick={() => onSelect(currentIndex, name)}
          disabled={!name}
        >
          Confirm
        </Button>
      </Modal.Footer>
    </Modal>
  );
};

export default CharacterSelectModal;
