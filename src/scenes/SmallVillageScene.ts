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

import { User } from "../types";
import { upsertUserState } from "../lib/userState";
import {
  NUM_CHARACTERS,
  POSITION_BROADCAST_INTERVAL_MS,
  REACTION_ANIMATION,
} from "../constants";
import { sendPosition, subscribePositions } from "../lib/positionChannel";
import { proximityRingRadii } from "../lib/proximityRing";
import { SpeechBubble } from "./SpeechBubble";
import { Rect, VILLAGE_SCALE, scaleRect } from "../lib/villageWorld";
import { DEFAULT_MAP, MAPS, MapKind, resolveMap } from "../lib/mapKind";

const GAME_CONFIG = {
  SPRITE: {
    SCALE: 2.5,
    FRAME_WIDTH: 20,
    FRAME_HEIGHT: 32,
  },
  LAYER: {
    TILE_WIDTH: 32,
    TILE_HEIGHT: 32,
    SCALE: 2,
  },
  // village 월드 치수·배율은 villageWorld.VILLAGE_BG 가 단일 출처다(콜라이더/스폰 좌표계와
  // 공유하므로 여기 재선언하지 않는다). LAYER.SCALE 은 타일맵 전용으로 별개.
  MOVEMENT: {
    SPEED: 160,
  },
  NAME: {
    OFFSET_Y: -50,
    FONT_SIZE: "16px",
    COLOR: "#fff",
    ALIGN: "center",
    STROKE: "#000000",
    STROKE_THICKNESS: 3,
  },
  MESSAGE: {
    OFFSET_Y: -50,
    FONT_SIZE: "14px",
    COLOR: "#fff",
    ALIGN: "center",
    STROKE: "#000000",
    STROKE_THICKNESS: 3,
  },
  ANIMATION: {
    FRAME_RATE: 3,
  },
  // 발화 표시 링(스피커 링): 캐릭터 발밑의 반투명 초록 타원. 발화 중 pulsing.
  RING: {
    OFFSET_Y: 30, // 스프라이트 중심 기준 발밑으로 내리는 값
    WIDTH: 48,
    HEIGHT: 24,
    COLOR: 0x22c55e,
    ALPHA: 0.45,
    PULSE_SCALE: 1.15,
    PULSE_DURATION: 600,
  },
  // 공간 오디오 전송 범위 링(#29): 내 캐릭터 발밑의 정적 가이드. self-only, pulse 없음.
  // 모던 리디자인: 플랫 원판 대신 (1) 중심→바깥으로 사라지는 radial gradient glow,
  // (2) 풀볼륨 존을 표시하는 은은한 안쪽 링, (3) dashed + soft halo 로 그린 바깥 경계선.
  //  - 반경 숫자는 여기 두지 않는다. proximityRingRadii() 헬퍼가 SPATIAL_AUDIO 에서 파생.
  //    이 블록은 색/알파/스텝 등 시각 속성만 담는다.
  PROXIMITY_RING: {
    OFFSET_Y: 30, // RING 과 동일하게 발밑 정렬
    COLOR: 0x38bdf8, // sky-400 — 잔디 대비 선명한 단일 액센트(전체 톤 통일)
    // radial gradient glow: EDGE→중심으로 동심원을 겹쳐 그려 누적 알파로 중심을 밝힌다.
    // Phaser Graphics 는 radial gradient 미지원 → 동심원 누적이 표준 근사법.
    GLOW_STEPS: 24, // 동심원 개수(많을수록 부드러움, 성능 비용 ↑)
    GLOW_STEP_ALPHA: 0.012, // 스텝당 알파. 중심 누적 ≈ 1-(1-a)^steps ≈ 0.25
    // 안쪽 풀볼륨 존(FILL) 표시 링 — 얇고 은은하게.
    INNER_ALPHA: 0.35,
    INNER_WIDTH: 1.5,
    // 바깥 경계(EDGE): 넓고 흐린 halo + 그 위 dashed 크리스프 라인.
    EDGE_ALPHA: 0.9, // dashed 본선 알파
    EDGE_WIDTH: 2, // dashed 본선 두께
    EDGE_HALO_ALPHA: 0.15, // 뒤에 깔리는 soft halo 알파
    EDGE_HALO_WIDTH: 8, // halo 두께(번짐 느낌)
    EDGE_DASH: 14, // dash 길이(px, 호 기준 근사)
    EDGE_GAP: 12, // dash 간격(px)
  },
} as const;

interface GameSceneConfig {
  characterIndex: number;
  characterName: string;
  roomId: string;
  userId: string;
  users: User[];
  // 방의 게임 월드 맵. 누락/무효면 resolveMap 이 기본 맵으로 폴백한다.
  map?: string;
}

export default class SmallVillageScene extends Phaser.Scene {
  private cursors: Phaser.Types.Input.Keyboard.CursorKeys | null = null;
  private sprite: Phaser.Physics.Arcade.Sprite | null = null;
  private mapWidth: number = 0;
  private mapHeight: number = 0;
  private nameText: Phaser.GameObjects.Text | null = null;
  private speechBubble: SpeechBubble | null = null;
  private userSprites: Record<
    string,
    {
      sprite: Phaser.GameObjects.Sprite;
      nameText: Phaser.GameObjects.Text;
      speechBubble: SpeechBubble;
    }
  > = {};

  // 발화 링: userId(로컬 포함) → 타원 GameObject + pulsing tween. lazy 생성.
  // ring/tween 을 한 엔트리로 묶어 생성·정리·삭제가 한 곳에서만 일어나게 한다.
  private speakerRings: Record<
    string,
    { ring: Phaser.GameObjects.Ellipse; tween?: Phaser.Tweens.Tween }
  > = {};

  // 공간 오디오 전송 범위 링(#29): 내 캐릭터에만 그리는 Graphics 1개(self-only).
  // create() 에서 1회 생성하고 update() 에서 스프라이트를 따라 이동시킨다.
  private proximityRing: Phaser.GameObjects.Graphics | null = null;

  // 떠오르는 리액션 이모지. 여러 개가 동시에 뜰 수 있어 배열로 관리한다.
  // 각 Text 는 소속 userId(`reactionUserId`)와 시작 시각(`reactionStart`)을 data 로 갖고,
  // update() 에서 해당 스프라이트를 매 프레임 따라가며 위로 떠오른다.
  private reactionEmojis: Phaser.GameObjects.Text[] = [];

  private roomId: string = "";
  private userId: string = "";
  private characterIndex: number = 0;
  private characterName: string = "";
  // 이 방의 월드 맵 종류(방별 고정). init 에서 resolveMap 으로 확정한다.
  private mapKind: MapKind = DEFAULT_MAP;
  // 타일맵 모드에서 충돌을 걸 decoration 레이어들(applyWorldCollisions 가 사용).
  private decorationLayers: Phaser.Tilemaps.TilemapLayer[] = [];
  // village 맵: village.json 오브젝트 레이어에서 읽은 충돌·가림 사각형(원본 px).
  // buildVillageWorld 에서 채우고 createWorldColliders/Overlays·e2e 훅이 쓴다.
  private villageColliders: Rect[] = [];
  private villageAbove: Rect[] = [];
  private onUserClick: (user: User) => void;
  // rooms row 보장 + 최초 users 등록이 끝나기 전에는 이동 write 를 막는 플래그.
  // 초기화 중 움직이면 users write 가 rooms 보장보다 앞서 FK 위반(409)을 낼 수 있다.
  private ready: boolean = false;

  users: User[] = [];

  // 원격 유저의 최신 위치(broadcast 수신). updateOtherUsers 가 이 값으로 tween 하고,
  // 아직 broadcast 를 못 받은 유저는 roster(this.users)의 seed x/y 로 폴백한다.
  private remotePositions: Map<string, { x: number; y: number }> = new Map();
  // 위치 broadcast 스로틀용 마지막 송신 시각(ms).
  private lastPositionSentAt = 0;
  // 직전 프레임 이동 여부. 이동이 막 멈춘 프레임에 최종 위치를 1회 방송하기 위함.
  private wasMoving = false;
  // 위치 채널 구독 해제자. SHUTDOWN 에서 호출한다(React 밖이라 자동 정리가 안 됨).
  private unsubscribePositions?: () => void;

  constructor(onUserClick: (user: User) => void) {
    super({ key: "SmallVillageScene" });
    this.onUserClick = onUserClick;
  }

  init(data: GameSceneConfig) {
    this.characterIndex = data.characterIndex;
    this.characterName = data.characterName;
    this.roomId = data.roomId;
    this.userId = data.userId;
    this.users = data.users || [];
    this.mapKind = resolveMap(data.map);
    // e2e/개발 검증용: ?e2e 가 있을 때만 ?map= 으로 맵을 강제할 수 있다. 프로덕션
    // 사용 흐름(?e2e 없음)에는 영향이 없어 방별 맵 정합성을 깨지 않는다.
    if (typeof window !== "undefined") {
      const q = new URLSearchParams(window.location.search);
      const override = q.get("map");
      if (q.has("e2e") && override) this.mapKind = resolveMap(override);
    }
  }

  preload() {
    // character sprites
    for (let i = 0; i < NUM_CHARACTERS; i++) {
      const index = i.toString().padStart(3, "0");
      this.load.spritesheet(
        `character_${i}`,
        `/assets/characters/${index}.png`,
        {
          frameWidth: GAME_CONFIG.SPRITE.FRAME_WIDTH,
          frameHeight: GAME_CONFIG.SPRITE.FRAME_HEIGHT,
        }
      );
    }

    // speech bubble
    this.load.spritesheet("bubble-border", "/assets/bubble/bubble-border.png", {
      frameWidth: 9,
      frameHeight: 9,
    });
    this.load.image("bubble-tail", "/assets/bubble/bubble-tail.png");

    // 게임 월드 배경 — 방의 map 에 따라 필요한 애셋만 로드한다.
    if (this.mapKind === MAPS.TILEMAP) {
      // 기존 Serene Village 타일맵(레이어드).
      this.load.image("map", "/assets/tilesets/Serene_Village_32x32.png");
      this.load.tilemapTiledJSON("map", "/assets/tilemaps/default.json");
    } else {
      // 로비 첫 화면과 동일한 마을 픽셀아트 이미지(다른 게임 애셋과 같이 public/assets 에서 로드).
      this.load.image("village-bg", "/assets/village-bg.png");
      // 월드 데이터(충돌·가림·스폰)는 default.json 과 같은 Tiled 형식 파일에서 읽는다.
      this.load.tilemapTiledJSON("village-map", "/assets/tilemaps/village.json");
    }
  }

  async create() {
    this.cursors = this.input.keyboard?.createCursorKeys() || null;

    // 방의 map 에 따라 월드 배경을 만든다(village 이미지 / tilemap 레이어).
    // 각 빌더가 배경을 그리고 월드 크기 + 스폰 좌표를 돌려준다.
    const world =
      this.mapKind === MAPS.TILEMAP
        ? this.buildTilemapWorld()
        : this.buildVillageWorld();
    if (!world) return; // 맵 데이터 로드 실패(타일셋/레이어 null, village.json 빈 맵) 방어

    const { width, height, spawn } = world;

    this.physics.world.setBounds(0, 0, width, height);
    const cam = this.cameras.main;
    cam.setBackgroundColor("#3a5a40");

    this.sprite = this.physics.add
      .sprite(spawn.x, spawn.y, `character_${this.characterIndex}`, 0)
      .setScale(GAME_CONFIG.SPRITE.SCALE)
      .setCollideWorldBounds(true)
      .setOrigin(0.5, 0.5);

    // 충돌: 맵 종류에 맞게 적용(타일맵=decoration 레이어 충돌 / village=static 존).
    this.applyWorldCollisions(this.sprite);

    // 공간 오디오 전송 범위 링(#29): 스프라이트 생성 직후 1회 그린다(발밑, self-only).
    this.drawProximityRing();

    // 카메라는 startFollow/ setBounds 대신 update() 의 positionCamera() 에서
    // 축별로 수동 제어한다. (setBounds + follow 는 맵보다 뷰포트가 넓은 축에서
    // 스크롤이 0 으로 클램프돼 맵이 한쪽에 붙는 문제가 있다.)
    this.mapWidth = width;
    this.mapHeight = height;
    this.positionCamera();

    this.nameText = this.add
      .text(
        this.sprite.x,
        this.sprite.y + GAME_CONFIG.NAME.OFFSET_Y,
        this.characterName,
        {
          fontSize: GAME_CONFIG.NAME.FONT_SIZE,
          color: GAME_CONFIG.NAME.COLOR,
          align: GAME_CONFIG.NAME.ALIGN,
          stroke: GAME_CONFIG.NAME.STROKE,
          strokeThickness: GAME_CONFIG.NAME.STROKE_THICKNESS,
        }
      )
      .setOrigin(0.5, 0.5);

    this.speechBubble = new SpeechBubble(
      this,
      this.sprite.x,
      this.sprite.y,
      200,
      GAME_CONFIG.MESSAGE.OFFSET_Y,
      ""
    )
      .setAlpha(0)
      .setDepth(12);

    try {
      // 초기 사용자 데이터 등록. 같은 id(localStorage uuid) row 가 이미
      // 있을 수 있으므로(재접속·이전 세션·StrictMode 이중 마운트 등) insert 대신
      // upsert 로 멱등하게 쓴다. insert + 선행 delete 는 비원자적이라 레이스 시
      // PK 충돌(409)이 났다. 이동 동기화(update)도 동일하게 upsert 를 쓴다.
      await upsertUserState({
        id: this.userId,
        name: this.characterName,
        character_index: this.characterIndex,
        room_id: this.roomId,
        x: Math.floor(this.sprite.x),
        y: Math.floor(this.sprite.y),
      });
    } catch (error) {
      console.error(error);
    }

    // rooms 보장 + 최초 등록이 끝났으니 이제 이동 write 를 허용한다.
    this.ready = true;

    // 위치 broadcast 구독 — 원격 유저 이동을 저지연으로 받아 remotePositions 에 반영.
    // 자기 위치는 자기 스프라이트(this.sprite)로 그리므로 무시한다.
    this.unsubscribePositions = subscribePositions(this.roomId, (p) => {
      if (p.id === this.userId) return;
      this.remotePositions.set(p.id, { x: p.x, y: p.y });
    });
    // 씬은 React 밖이라 game.destroy(true) 만으로는 채널이 안 닫힌다 → SHUTDOWN 에서 명시 해제.
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubscribePositions?.();
      this.unsubscribePositions = undefined;
    });

    this.exposeE2EHooks();

    this.createAnimations();
  }

  // URL 에 ?debugWorld 가 있으면 충돌 영역을 반투명 빨강으로 그려 좌표 튜닝을 돕는다.
  private isWorldDebug(): boolean {
    return (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).has("debugWorld")
    );
  }

  /**
   * village 맵: 로비 첫 화면과 동일한 village-bg 픽셀아트를 통짜 이미지로 깔고,
   * above 가림 오버레이를 얹는다. 월드 크기 + 스폰을 돌려준다.
   * 치수·충돌·가림·스폰은 모두 village.json(Tiled 형식)에서 읽는다
   * (스폰은 spawn 레이어의 point — 월드 중앙은 INN 위라 개방된 길에 찍어 뒀다).
   * village.json 로드 실패 시 빈 맵(width 0)이 되므로 buildTilemapWorld 와 대칭으로 null 을 돌려준다.
   */
  private buildVillageWorld(): {
    width: number;
    height: number;
    spawn: { x: number; y: number };
  } | null {
    const scale = VILLAGE_SCALE;
    // 맵 데이터(치수·충돌·가림·스폰)는 village.json(Tiled 형식)에서 읽는다.
    const map = this.make.tilemap({ key: "village-map" });
    if (!map.widthInPixels || !map.heightInPixels) {
      console.error("village-map is empty (village.json 로드 실패?)");
      return null;
    }
    const width = map.widthInPixels * scale;
    const height = map.heightInPixels * scale;

    this.add.image(0, 0, "village-bg").setOrigin(0, 0).setScale(scale);

    // 오브젝트 레이어 → 원본 px 사각형. 충돌/가림에서 각각 소비한다.
    this.villageColliders = this.readObjectRects(map, "colliders");
    this.villageAbove = this.readObjectRects(map, "above");
    this.createWorldOverlays();

    // 스폰 point(원본 px) → 월드 좌표. 없으면 월드 중앙 폴백.
    const spawnObj = map.getObjectLayer("spawn")?.objects?.[0];
    const spawn = spawnObj
      ? { x: (spawnObj.x ?? 0) * scale, y: (spawnObj.y ?? 0) * scale }
      : { x: width / 2, y: height / 2 };
    return { width, height, spawn };
  }

  // Tiled objectgroup 의 사각형 오브젝트를 원본 px Rect 배열로 읽는다.
  private readObjectRects(map: Phaser.Tilemaps.Tilemap, name: string): Rect[] {
    return (map.getObjectLayer(name)?.objects ?? []).map((o) => ({
      x: o.x ?? 0,
      y: o.y ?? 0,
      w: o.width ?? 0,
      h: o.height ?? 0,
    }));
  }

  /**
   * tilemap 맵: 기존 Serene Village 타일맵을 레이어별로 렌더한다.
   *  - ground/decoration_0..2/above_0..1 을 SCALE 배로 그린다.
   *  - decoration 레이어는 collides 속성으로 충돌을 켜 두고(this.decorationLayers 에 저장),
   *    실제 collider 결선은 applyWorldCollisions 에서 스프라이트 생성 후에 한다.
   *  - above_0/1 은 depth 10/11 로 캐릭터 위에 그려 가림 입체감을 낸다.
   * tileset/필수 레이어가 null 이면 null 을 돌려주고 create() 가 안전하게 중단한다.
   */
  private buildTilemapWorld(): {
    width: number;
    height: number;
    spawn: { x: number; y: number };
  } | null {
    const L = GAME_CONFIG.LAYER;
    const map = this.make.tilemap({
      key: "map",
      tileWidth: L.TILE_WIDTH,
      tileHeight: L.TILE_HEIGHT,
    });
    const tileset = map.addTilesetImage("Serene_Village_32x32", "map");
    if (!tileset) {
      console.error("Tileset is null");
      return null;
    }

    const layer = (name: string, depth?: number) => {
      const l = map.createLayer(name, tileset, 0, 0);
      if (!l) {
        console.error(`Layer '${name}' is null`);
        return null;
      }
      l.setScale(L.SCALE);
      if (depth !== undefined) l.setDepth(depth);
      return l;
    };

    const ground = layer("ground");
    const decoration0 = layer("decoration_0");
    const decoration1 = layer("decoration_1");
    const decoration2 = layer("decoration_2");
    const above0 = layer("above_0", 10);
    const above1 = layer("above_1", 11);
    if (
      !ground ||
      !decoration0 ||
      !decoration1 ||
      !decoration2 ||
      !above0 ||
      !above1
    ) {
      return null;
    }

    // decoration 레이어에 충돌 속성을 켜 두고(결선은 applyWorldCollisions), 참조를 저장한다.
    this.decorationLayers = [decoration0, decoration1, decoration2];
    this.decorationLayers.forEach((l) =>
      l.setCollisionByProperty({ collides: true })
    );

    const width = L.TILE_WIDTH * map.width * L.SCALE;
    const height = L.TILE_HEIGHT * map.height * L.SCALE;
    // 타일맵은 중앙 스폰(기존 동작 유지).
    return { width, height, spawn: { x: width / 2, y: height / 2 } };
  }

  /**
   * 맵 종류에 맞게 충돌을 스프라이트에 결선한다.
   *  - tilemap: decoration 레이어들과 collider.
   *  - village: VILLAGE_COLLIDERS 기반 static 존과 collider(createWorldColliders).
   */
  private applyWorldCollisions(sprite: Phaser.Physics.Arcade.Sprite): void {
    if (this.mapKind === MAPS.TILEMAP) {
      this.decorationLayers.forEach((l) =>
        this.physics.add.collider(sprite, l)
      );
    } else {
      this.createWorldColliders(sprite);
    }
  }

  /**
   * above(가림) 오버레이 생성. 같은 village-bg 텍스처를 VILLAGE_ABOVE_REGIONS 각 영역만
   * setCrop 으로 잘라 캐릭터 위(depth 10)에 다시 얹는다. 원본과 동일 위치·배율이라 정확히
   * 겹친다. 캐릭터가 밑동으로 들어가면 이 조각이 위를 덮어 가림 입체감을 만든다.
   */
  private createWorldOverlays(): void {
    const scale = VILLAGE_SCALE;
    this.villageAbove.forEach((region) => {
      // setCrop 은 텍스처 원본 px 좌표계라 미확대 region 을 그대로 쓴다.
      this.add
        .image(0, 0, "village-bg")
        .setOrigin(0, 0)
        .setScale(scale)
        .setCrop(region.x, region.y, region.w, region.h)
        .setDepth(10);
    });
  }

  /**
   * 충돌 static 바디 생성. VILLAGE_COLLIDERS 각 영역(원본 px)을 배율 환산해 보이지 않는
   * 사각형 존으로 만들고 내 스프라이트와 collider 로 묶는다. ?debugWorld 시 존을 빨강으로 표시.
   */
  private createWorldColliders(sprite: Phaser.Physics.Arcade.Sprite): void {
    const scale = VILLAGE_SCALE;
    const debug = this.isWorldDebug();
    const zones = this.villageColliders.map((region) => {
      const s = scaleRect(region, scale);
      // rectangle 은 origin 0.5 → 중심 좌표로 배치한다.
      const zone = this.add.rectangle(
        s.x + s.w / 2,
        s.y + s.h / 2,
        s.w,
        s.h,
        0xff0000,
        debug ? 0.35 : 0
      );
      zone.setVisible(debug);
      if (debug) zone.setDepth(30);
      this.physics.add.existing(zone, true); // static body
      return zone;
    });
    this.physics.add.collider(sprite, zones);
  }

  // e2e 테스트 훅: URL 에 ?e2e 가 있을 때만 원격 스프라이트/내 위치를 읽기 전용으로 노출한다.
  // 위치 broadcast 가 원격 화면에 반영되는지(#51)를 headless 브라우저에서 assert 하기 위함이며,
  // 프로덕션 사용 흐름에는 파라미터가 없어 노출되지 않는다(좌표 외의 정보는 노출하지 않는다).
  private exposeE2EHooks() {
    if (
      typeof window === "undefined" ||
      !new URLSearchParams(window.location.search).has("e2e")
    ) {
      return;
    }
    (window as unknown as { __smallVillage?: unknown }).__smallVillage = {
      remoteSprites: () => this.getRemoteSpritePositions(),
      myPosition: () =>
        this.sprite
          ? { x: Math.round(this.sprite.x), y: Math.round(this.sprite.y) }
          : null,
      // proximity ring(#29) 중심 좌표 + 반경. ring 이 self 발밑에 정렬·추종하는지
      // e2e 좌표 assert 로 검증하기 위함이다. 반경은 렌더와 동일한 proximityRingRadii()
      // 헬퍼로 파생해 재선언 drift 를 막는다(B1). 좌표 외 정보는 노출하지 않는다.
      proximityRing: () => {
        if (!this.proximityRing) return null; // ring 미생성 방어(게터 null)
        const { FILL, EDGE } = proximityRingRadii(); // 렌더와 동일 헬퍼(재선언 금지)
        return {
          x: this.proximityRing.x, // raw float 스프라이트 좌표
          y: this.proximityRing.y,
          fillRadius: FILL,
          edgeRadius: EDGE,
          offsetY: GAME_CONFIG.PROXIMITY_RING.OFFSET_Y,
        };
      },
      // 현재 방의 맵 종류. e2e 가 올바른 맵이 로드됐는지 assert 할 때 쓴다.
      map: () => this.mapKind,
      // 충돌 영역(월드 좌표 사각형). village 맵에서만 사각형 기반이라 그때만 노출한다
      // (타일맵은 타일 기반 충돌이라 사각형 목록이 없다 → 빈 배열).
      worldColliders: () =>
        this.mapKind === MAPS.VILLAGE
          ? this.villageColliders.map((r) => scaleRect(r, VILLAGE_SCALE))
          : [],
      // 월드 크기(경계 검증/이동 계획용). 실제 로드된 맵 크기를 돌려준다.
      worldSize: () => ({ width: this.mapWidth, height: this.mapHeight }),
    };
  }

  // 원격 스프라이트(self 제외)의 현재 렌더 위치. e2e 훅 전용.
  getRemoteSpritePositions(): Record<string, { x: number; y: number }> {
    const out: Record<string, { x: number; y: number }> = {};
    Object.entries(this.userSprites).forEach(([id, us]) => {
      out[id] = { x: Math.round(us.sprite.x), y: Math.round(us.sprite.y) };
    });
    return out;
  }

  // userId 로 스프라이트를 찾는다(로컬은 this.sprite, 원격은 userSprites). 없으면 undefined.
  private getSprite(userId: string): Phaser.GameObjects.Sprite | undefined {
    return userId === this.userId
      ? this.sprite ?? undefined
      : this.userSprites[userId]?.sprite;
  }

  /**
   * 발화 표시 링을 켜고 끈다. 대상 스프라이트가 아직 없으면 no-op.
   *  - 링은 userId 별 최초 1회 lazy 생성(발밑, 스프라이트보다 한 단계 뒤).
   *  - speaking=true → 보이기 + pulsing tween, false → 숨김 + tween 정지.
   */
  setSpeaking(userId: string, speaking: boolean) {
    const sprite = this.getSprite(userId);
    if (!sprite) return;

    // off 는 항상 on 이후에만 오므로, speaking=false 인데 링이 없으면 만들 필요가 없다.
    let ring = this.speakerRings[userId]?.ring;
    if (!speaking && !ring) return;

    if (!ring) {
      ring = this.add
        .ellipse(
          sprite.x,
          sprite.y + GAME_CONFIG.RING.OFFSET_Y,
          GAME_CONFIG.RING.WIDTH,
          GAME_CONFIG.RING.HEIGHT,
          GAME_CONFIG.RING.COLOR,
          GAME_CONFIG.RING.ALPHA
        )
        .setVisible(false);
      // 스프라이트와 같은 depth(0) 로 두되 표시목록에서 스프라이트 바로 뒤로 보낸다.
      // ground 레이어(depth 0, 먼저 삽입됨) 위·캐릭터 아래에 그려지게 한다.
      ring.setDepth(sprite.depth);
      this.children.moveBelow(ring, sprite);
      this.speakerRings[userId] = { ring };
    }

    const entry = this.speakerRings[userId];
    if (speaking) {
      ring.setVisible(true);
      if (!entry.tween) {
        entry.tween = this.tweens.add({
          targets: ring,
          scaleX: GAME_CONFIG.RING.PULSE_SCALE,
          scaleY: GAME_CONFIG.RING.PULSE_SCALE,
          duration: GAME_CONFIG.RING.PULSE_DURATION,
          yoyo: true,
          repeat: -1,
          ease: "Sine.easeInOut",
        });
      }
    } else {
      ring.setVisible(false);
      if (entry.tween) {
        entry.tween.stop();
        entry.tween = undefined;
      }
      ring.setScale(1);
    }
  }

  private syncSpeakerRings() {
    Object.entries(this.speakerRings).forEach(([userId, { ring }]) => {
      const sprite = this.getSprite(userId);
      if (sprite) {
        ring.setPosition(sprite.x, sprite.y + GAME_CONFIG.RING.OFFSET_Y);
      }
    });
  }

  /**
   * 공간 오디오 전송 범위 링(#29)을 내 캐릭터 발밑에 1회 그린다(self-only, pulse 없음).
   *  - 반경은 proximityRingRadii() 헬퍼가 SPATIAL_AUDIO 에서 파생(단일 계산처).
   *  - 시각 속성(색/알파/선두께/오프셋)은 GAME_CONFIG.PROXIMITY_RING 에서 읽는다.
   *  - (0,0) 원점 기준으로 두 원을 그려두고 이후 setPosition 으로 통째로 옮긴다.
   * this.sprite 존재 가정(create 에서 sprite 생성 직후 호출).
   */
  private drawProximityRing(): void {
    if (!this.sprite) return;
    const c = GAME_CONFIG.PROXIMITY_RING;
    const { FILL, EDGE } = proximityRingRadii(); // 반경 단일 계산처(헬퍼)
    const g = this.add.graphics();

    // (1) radial gradient glow — EDGE→중심으로 동심 원판을 겹쳐 그린다.
    // 바깥부터 그려야 안쪽 원이 위에 겹쳐 중심이 가장 밝아진다(누적 알파).
    for (let i = c.GLOW_STEPS; i >= 1; i--) {
      const r = (EDGE * i) / c.GLOW_STEPS;
      g.fillStyle(c.COLOR, c.GLOW_STEP_ALPHA);
      g.fillCircle(0, 0, r);
    }

    // (2) 안쪽 풀볼륨 존(FILL) 마커 — 얇고 은은한 실선 링.
    g.lineStyle(c.INNER_WIDTH, c.COLOR, c.INNER_ALPHA);
    g.strokeCircle(0, 0, FILL);

    // (3) 바깥 경계(EDGE): soft halo(넓고 흐린 실선) 위에 dashed 크리스프 라인.
    g.lineStyle(c.EDGE_HALO_WIDTH, c.COLOR, c.EDGE_HALO_ALPHA);
    g.strokeCircle(0, 0, EDGE);
    this.strokeDashedCircle(g, EDGE, c.EDGE_WIDTH, c.COLOR, c.EDGE_ALPHA, c.EDGE_DASH, c.EDGE_GAP);

    g.setPosition(this.sprite.x, this.sprite.y + c.OFFSET_Y);
    // 스프라이트와 같은 depth 로 두되 표시목록에서 스프라이트 바로 뒤로 보낸다.
    // decoration 타일 위·캐릭터 아래에 overlay 되게 한다(발화 링과 동일 패턴).
    g.setDepth(this.sprite.depth);
    this.children.moveBelow(g, this.sprite);
    this.proximityRing = g;
  }

  /**
   * 원점(0,0) 기준 dashed 원을 그린다. dash/gap 은 px 단위지만 호 길이로 환산해
   * 반경과 무관하게 일정한 대시 밀도를 유지한다(모던 range 인디케이터 느낌).
   */
  private strokeDashedCircle(
    g: Phaser.GameObjects.Graphics,
    radius: number,
    width: number,
    color: number,
    alpha: number,
    dash: number,
    gap: number,
  ): void {
    g.lineStyle(width, color, alpha);
    const circumference = 2 * Math.PI * radius;
    const segAngle = (dash + gap) / radius; // 한 dash+gap 이 차지하는 각도(rad)
    const dashAngle = dash / radius;
    const count = Math.max(1, Math.floor(circumference / (dash + gap)));
    for (let i = 0; i < count; i++) {
      const start = i * segAngle;
      g.beginPath();
      g.arc(0, 0, radius, start, start + dashAngle, false);
      g.strokePath();
    }
  }

  private syncProximityRing(): void {
    if (!this.proximityRing || !this.sprite) return;
    this.proximityRing.setPosition(
      this.sprite.x,
      this.sprite.y + GAME_CONFIG.PROXIMITY_RING.OFFSET_Y,
    );
  }

  private removeSpeakerRing(userId: string) {
    const entry = this.speakerRings[userId];
    if (entry) {
      entry.tween?.stop();
      entry.ring.destroy();
      delete this.speakerRings[userId];
    }
  }

  /**
   * 수신한 emoji 를 아바타 머리 위로 떠오르며 사라지게 표시한다.
   * self/remote 스프라이트 모두 getSprite 로 매칭한다. 대상이 없으면 no-op.
   * 여러 번 눌리면 emoji 가 누적 떠오르며, 소멸형이라 메모리 누수는 없다.
   *
   * 위치(x,y)는 tween 이 아니라 update() 에서 매 프레임 스프라이트를 따라가며
   * 갱신한다(이름표/말풍선과 동일). 이동 중 리액션해도 머리에서 이탈하지 않는다.
   */
  showReaction(userId: string, emoji: string) {
    const sprite = this.getSprite(userId);
    if (!sprite) return;

    const emojiText = this.add
      .text(sprite.x, sprite.y + REACTION_ANIMATION.OFFSET_Y, emoji, {
        fontSize: REACTION_ANIMATION.FONT_SIZE,
        align: "center",
      })
      .setOrigin(0.5, 0.5)
      .setDepth(20);

    emojiText.setData("reactionUserId", userId);
    emojiText.setData("reactionStart", this.time.now);

    this.reactionEmojis.push(emojiText);
  }

  /**
   * 떠오르는 리액션 이모지들을 매 프레임 갱신한다.
   *  - x,y 는 소속 스프라이트를 따라가며(이동 추적) OFFSET_Y 에서 위로 상승.
   *  - 경과에 따라 상승 offset + alpha 를 직접 계산해 tween 과 위치 추적이 충돌하지 않게 한다.
   *  - 애니메이션이 끝났거나 소속 유저가 사라지면 정리한다.
   */
  private updateReactionEmojis() {
    if (this.reactionEmojis.length === 0) return;

    const now = this.time.now;
    this.reactionEmojis = this.reactionEmojis.filter((emojiText) => {
      const userId = emojiText.getData("reactionUserId") as string;
      const startTime = emojiText.getData("reactionStart") as number;
      const sprite = this.getSprite(userId);

      const progress = Phaser.Math.Clamp(
        (now - startTime) / REACTION_ANIMATION.DURATION_MS,
        0,
        1
      );

      // 소속 스프라이트가 사라졌거나 애니메이션이 끝나면 제거한다.
      if (!sprite || progress >= 1) {
        emojiText.destroy();
        return false;
      }

      const eased = Phaser.Math.Easing.Sine.Out(progress);
      emojiText.setPosition(
        sprite.x,
        sprite.y + REACTION_ANIMATION.OFFSET_Y - REACTION_ANIMATION.RISE_DISTANCE * eased
      );
      emojiText.setAlpha(1 - progress);
      return true;
    });
  }

  private removeReactionEmojis(userId: string) {
    this.reactionEmojis = this.reactionEmojis.filter((emojiText) => {
      if (emojiText.getData("reactionUserId") === userId) {
        emojiText.destroy();
        return false;
      }
      return true;
    });
  }

  showChatMessage(userId: string, message: string) {
    // 버블 위치는 매 프레임 update()/updateOtherUsers() 에서 스프라이트 좌표로
    // 갱신되므로 여기서 setPosition 은 불필요하다. 각 버블이 자기 hideTimer 를
    // 소유하므로 동시 발화에도 서로의 타이머를 덮어쓰지 않는다.
    if (userId === this.userId) {
      this.speechBubble?.display(message);
    } else {
      this.userSprites[userId]?.speechBubble.display(message);
    }
  }

  addUserSprite(user: User) {
    const userSprite = this.physics.add.sprite(
      user.x,
      user.y,
      `character_${user.character_index}`,
      0
    );
    userSprite.setScale(GAME_CONFIG.SPRITE.SCALE);
    userSprite.setOrigin(0.5, 0.5);

    // 클릭 이벤트 추가
    userSprite.setInteractive().on("pointerdown", () => {
      this.onUserClick(user);
    });

    const nameText = this.add
      .text(user.x, user.y + GAME_CONFIG.NAME.OFFSET_Y, user.name, {
        fontSize: GAME_CONFIG.NAME.FONT_SIZE,
        color: GAME_CONFIG.NAME.COLOR,
        align: GAME_CONFIG.NAME.ALIGN,
        stroke: GAME_CONFIG.NAME.STROKE,
        strokeThickness: GAME_CONFIG.NAME.STROKE_THICKNESS,
      })
      .setOrigin(0.5, 0.5);

    this.userSprites[user.id] = {
      sprite: userSprite,
      nameText,
      speechBubble: new SpeechBubble(
        this,
        user.x,
        user.y,
        200,
        GAME_CONFIG.MESSAGE.OFFSET_Y,
        ""
      )
        .setAlpha(0)
        .setDepth(12),
    };
  }

  removeUserSprite(userId: string) {
    const userSprite = this.userSprites[userId];
    if (userSprite) {
      userSprite.nameText.destroy();
      userSprite.sprite.destroy();
      userSprite.speechBubble.destroy();
      this.removeSpeakerRing(userId);
      this.removeReactionEmojis(userId);

      delete this.userSprites[userId];
      // broadcast 로 쌓인 위치도 정리(누수 방지).
      this.remotePositions.delete(userId);
    }
  }

  createAnimations() {
    for (let i = 0; i < NUM_CHARACTERS; i++) {
      this.createWalkAnimation(i, `walk_down_${i}`, 0, 3);
      this.createWalkAnimation(i, `walk_left_${i}`, 3, 3);
      this.createWalkAnimation(i, `walk_right_${i}`, 6, 3);
      this.createWalkAnimation(i, `walk_up_${i}`, 9, 3);
    }
  }

  createWalkAnimation(
    characterIndex: number,
    key: string,
    startFrame: number,
    frameCount: number
  ): void {
    this.anims.create({
      key,
      frames: this.anims.generateFrameNumbers(`character_${characterIndex}`, {
        start: startFrame,
        end: startFrame + frameCount - 1,
      }),
      frameRate: GAME_CONFIG.ANIMATION.FRAME_RATE,
      repeat: -1,
    });
  }

  private handleMovement(): boolean {
    if (!this.sprite || !this.cursors) return false;

    let isMoving = false;

    this.sprite.setVelocity(0);

    if (this.cursors.left?.isDown) {
      isMoving = true;
      this.sprite.play(`walk_left_${this.characterIndex}`, true);
      this.sprite.setVelocityX(-GAME_CONFIG.MOVEMENT.SPEED);
    } else if (this.cursors.right?.isDown) {
      isMoving = true;
      this.sprite.play(`walk_right_${this.characterIndex}`, true);
      this.sprite.setVelocityX(GAME_CONFIG.MOVEMENT.SPEED);
    } else if (this.cursors.up?.isDown) {
      isMoving = true;
      this.sprite.play(`walk_up_${this.characterIndex}`, true);
      this.sprite.setVelocityY(-GAME_CONFIG.MOVEMENT.SPEED);
    } else if (this.cursors.down?.isDown) {
      isMoving = true;
      this.sprite.play(`walk_down_${this.characterIndex}`, true);
      this.sprite.setVelocityY(GAME_CONFIG.MOVEMENT.SPEED);
    } else {
      this.sprite.anims.stop();
    }

    return isMoving;
  }

  private updateOtherUsers() {
    const MIN_DISTANCE = 2;

    Object.entries(this.userSprites).forEach(([userId, userSprite]) => {
      let isMoving = false;
      // 캐릭터 정체성(character_index)은 roster 에서, 위치는 broadcast(remotePositions)에서.
      // 아직 broadcast 를 못 받은 유저는 roster 의 seed x/y 로 폴백한다 — tween target 과
      // walk 애니메이션 방향을 모두 이 단일 target 에서 파생해 seed/live 가 갈리지 않게 한다.
      const userData = this.users.find((u) => u.id === userId);
      if (userData) {
        const sprite = userSprite.sprite;
        const target = this.remotePositions.get(userId) ?? {
          x: userData.x,
          y: userData.y,
        };
        const distanceX = Math.abs(target.x - sprite.x);
        const distanceY = Math.abs(target.y - sprite.y);
        const characterIndex = userData.character_index;
        const currentAnimKey = sprite.anims.currentAnim?.key;

        if (distanceX > MIN_DISTANCE) {
          if (target.x < sprite.x) {
            isMoving = true;
            sprite.play(`walk_left_${characterIndex}`, true);
          } else {
            isMoving = true;
            if (currentAnimKey !== `walk_right_${characterIndex}`) {
              sprite.play(`walk_right_${characterIndex}`, true);
            }
          }
        }

        if (distanceY > MIN_DISTANCE) {
          if (target.y < sprite.y) {
            isMoving = true;
            sprite.play(`walk_up_${characterIndex}`, true);
          } else {
            isMoving = true;
            sprite.play(`walk_down_${characterIndex}`, true);
          }
        }

        if (!isMoving) {
          sprite.anims.stop();
        }

        this.tweens.add({
          targets: sprite,
          x: target.x,
          y: target.y,
          duration: 100,
          ease: "Linear",
          onUpdate: () => {
            const nameText = userSprite.nameText;
            if (nameText) {
              nameText.setPosition(
                sprite.x,
                sprite.y + GAME_CONFIG.NAME.OFFSET_Y
              );
            }

            const speechBubble = userSprite.speechBubble;
            if (speechBubble) {
              speechBubble.setPosition(sprite.x, sprite.y);
            }
          },
        });
      }
    });
  }

  /**
   * 카메라 스크롤을 X/Y 축별로 갱신한다(axisScroll 참고).
   * 매 프레임 재계산되므로 뷰포트 리사이즈에도 별도 핸들러가 필요 없다.
   */
  private positionCamera(): void {
    if (!this.sprite) return;

    const cam = this.cameras.main;
    cam.scrollX = this.axisScroll(this.mapWidth, cam.width, this.sprite.x);
    cam.scrollY = this.axisScroll(this.mapHeight, cam.height, this.sprite.y);
  }

  /**
   * 한 축의 카메라 스크롤 값을 계산한다.
   *  - 맵이 뷰포트보다 작거나 같으면: 중앙 정렬(음수 스크롤 → 양쪽 여백은 배경색).
   *  - 맵이 더 크면: 대상 위치를 따라가되 맵 경계로 클램프한다.
   */
  private axisScroll(mapSize: number, viewSize: number, target: number): number {
    return mapSize <= viewSize
      ? (mapSize - viewSize) / 2
      : Phaser.Math.Clamp(target - viewSize / 2, 0, mapSize - viewSize);
  }

  async update() {
    if (!this.sprite || !this.cursors) return;

    const isMoving = this.handleMovement();

    this.positionCamera();

    if (this.nameText) {
      this.nameText.setPosition(
        this.sprite.x,
        this.sprite.y + GAME_CONFIG.NAME.OFFSET_Y
      );
    }

    if (this.speechBubble) {
      this.speechBubble.setPosition(this.sprite.x, this.sprite.y);
    }

    try {
      // 최초 등록(create)이 끝나기 전에는 이동 write 를 보내지 않는다. 초기화 중
      // 움직이면 write 가 create 보다 앞서 나가 레이스로 409 를 낼 수 있다.
      if (this.ready) {
        const now = Date.now();
        const x = Math.floor(this.sprite.x);
        const y = Math.floor(this.sprite.y);

        if (isMoving) {
          // 이동은 broadcast(스로틀, fire-and-forget)로만 흘린다 — DB 왕복 없음.
          // PR-3: 매 프레임 upsert 를 제거했다(이동 중 초당 ~60회 write → 0).
          if (now - this.lastPositionSentAt >= POSITION_BROADCAST_INTERVAL_MS) {
            this.lastPositionSentAt = now;
            sendPosition(this.roomId, { id: this.userId, x, y });
          }
        } else if (this.wasMoving) {
          // 이동이 막 멈춘 프레임: (1) 정확한 최종 위치를 broadcast(스로틀 무시) —
          // updateOtherUsers 가 broadcast 를 tween 소스로 쓰므로 마지막 위치를 안 보내면
          // 원격 스프라이트가 어긋난 곳에 안착한다. (2) 늦은 입장자 seed 용으로 users 에
          // 최종 위치 스냅샷 1회. (이동 중이 아니라 멈출 때만 write → 부하 최소.)
          this.lastPositionSentAt = now;
          sendPosition(this.roomId, { id: this.userId, x, y });
          await upsertUserState({
            id: this.userId,
            name: this.characterName,
            character_index: this.characterIndex,
            room_id: this.roomId,
            x,
            y,
          });
        }

        this.wasMoving = isMoving;
      }
    } catch (error) {
      console.error(error);
    }

    this.updateOtherUsers();

    // 발화 링을 각 스프라이트 발밑에 동기화(이름표 패턴과 동일).
    this.syncSpeakerRings();

    // 공간 오디오 전송 범위 링(#29)을 내 스프라이트 발밑에 동기화.
    this.syncProximityRing();

    // 떠오르는 리액션 이모지를 스프라이트 머리 위에 동기화(이동 추적).
    this.updateReactionEmojis();
  }

  // 전체 로스터 스냅샷으로 원격 스프라이트를 동기화한다(단일 소스에서 매 변경마다 호출).
  // 목록에 새로 들어온 유저는 스프라이트 생성, 빠진 유저는 스프라이트 제거. self 는 제외.
  updateUsers(users: User[]) {
    this.users = users;
    const nextIds = new Set(users.map((u) => u.id));
    users.forEach((user) => {
      if (user.id === this.userId) {
        return;
      }
      if (!this.userSprites[user.id]) {
        this.addUserSprite(user);
      }
    });
    // 로스터에서 빠진 원격 유저의 스프라이트 정리.
    Object.keys(this.userSprites).forEach((id) => {
      if (!nextIds.has(id)) {
        this.removeUserSprite(id);
      }
    });
  }

  removeUser(userId: string) {
    this.removeUserSprite(userId);
  }

  remoeAllUsers() {
    Object.values(this.userSprites).forEach((userSprite) => {
      userSprite.sprite.destroy();
      userSprite.nameText.destroy();
    });
    this.userSprites = {};
    this.remotePositions.clear();
  }
}
