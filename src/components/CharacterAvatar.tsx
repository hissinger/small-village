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

// 캐릭터 스프라이트 시트 기하 (CharacterPreviewScene/SmallVillageScene 와 동일):
//   64x128 시트 = 20x32 프레임을 3열 x 4행으로 배치.
//   행 = 방향(0:down, 1:left, 2:right, 3:up), 각 행 첫 프레임(열 0)이 정지 포즈.
// 아바타는 정면(down) 정지 프레임(0번, 좌상단)을 쓴다.
const FRAME_W = 20;
const SHEET_W = 64;
const SHEET_H = 128;
// 상체만 보이도록 프레임 위쪽만 잘라낸다 (머리+어깨/몸통, 다리 제외).
const CROP_H = 20;

interface CharacterAvatarProps {
  characterIndex: number;
  // 픽셀 확대 배율. 표시 크기 = 20*scale (가로) x CROP_H*scale (세로).
  scale?: number;
}

/**
 * 참가자 아바타 — 캐릭터 스프라이트의 정면 상체를 CSS 로 잘라 렌더한다.
 * Phaser 없이 background-image + background-position 만으로 프레임 0(정면 정지)을 보여주고,
 * 위쪽 CROP_H 픽셀만 남겨 상체로 만든다. NEAREST(pixelated) 로 픽셀아트 선명도를 유지한다.
 *
 * 이름 텍스트가 바로 옆에 있으므로 아바타는 장식용(aria-hidden)으로 둬 스크린리더 중복을 피한다.
 */
const CharacterAvatar = ({ characterIndex, scale = 2 }: CharacterAvatarProps) => {
  const padded = characterIndex.toString().padStart(3, "0");
  return (
    <div
      aria-hidden="true"
      data-testid="character-avatar"
      className="flex-shrink-0 bg-gray-100 rounded-md overflow-hidden"
      style={{
        width: FRAME_W * scale,
        height: CROP_H * scale,
        backgroundImage: `url(/assets/characters/${padded}.png)`,
        backgroundRepeat: "no-repeat",
        // 프레임 0 은 좌상단(0,0) → position 도 0,0. 시트 전체를 scale 배로 확대.
        backgroundPosition: "0px 0px",
        backgroundSize: `${SHEET_W * scale}px ${SHEET_H * scale}px`,
        imageRendering: "pixelated",
      }}
    />
  );
};

export default CharacterAvatar;
