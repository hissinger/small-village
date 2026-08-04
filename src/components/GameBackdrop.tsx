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

import { MAP_PREVIEW_IMAGES, resolveMap } from "../lib/mapKind";

interface GameBackdropProps {
  map: string | null | undefined;
}

/**
 * 맵보다 넓은 뷰포트에서 생기는 여백을 같은 맵의 확대·블러 이미지로 채운다.
 * 실제 Phaser 월드는 위에 선명하게 렌더되므로 배경은 장식 역할만 한다.
 */
const GameBackdrop: React.FC<GameBackdropProps> = ({ map }) => {
  const mapKind = resolveMap(map);

  return (
    <div
      aria-hidden="true"
      data-testid="game-backdrop"
      className="pointer-events-none absolute inset-0 overflow-hidden bg-[#263d2b]"
    >
      <img
        src={MAP_PREVIEW_IMAGES[mapKind]}
        alt=""
        className="h-full w-full object-cover"
        style={{
          filter: "blur(24px) saturate(0.82) brightness(0.62)",
          transform: "scale(1.12)",
        }}
      />
      <div className="absolute inset-0 bg-slate-950/20" />
    </div>
  );
};

export default GameBackdrop;
