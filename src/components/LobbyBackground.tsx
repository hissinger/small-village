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

import { useEffect, useState } from "react";
import villageBg from "../assets/village-bg.png";

const BG_WIDTH = 704;
const BG_HEIGHT = 576;

/**
 * Pixel-art village backdrop for the lobby.
 *
 * The image is scaled by an integer factor (never fractional) with
 * image-rendering: pixelated so pixels stay crisp — no blur. v_transparent:
 * the village fills the whole screen and a warm dark scrim floats on top —
 * lightest in the dead center so the artwork reads through, denser toward the
 * edges and behind the floating UI so light text and controls stay legible.
 */
const LobbyBackground: React.FC = () => {
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const updateScale = () => {
      setScale(
        Math.max(
          1,
          Math.ceil(
            Math.max(
              window.innerWidth / BG_WIDTH,
              window.innerHeight / BG_HEIGHT
            )
          )
        )
      );
    };
    updateScale();
    window.addEventListener("resize", updateScale);
    return () => window.removeEventListener("resize", updateScale);
  }, []);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden bg-stone-900"
    >
      {/* Integer-scaled pixel-art village — filling the whole screen, crisp (no blur) */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `url(${villageBg})`,
          backgroundSize: `${BG_WIDTH * scale}px ${BG_HEIGHT * scale}px`,
          backgroundPosition: "center",
          backgroundRepeat: "no-repeat",
          imageRendering: "pixelated",
        }}
      />

      {/* Warm dark scrim: lightest in the center so the village shows through,
          denser toward the edges (and behind the floating UI) for text contrast. */}
      <div
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 62% 58% at 50% 50%, rgba(28,20,14,0.28) 0%, rgba(28,20,14,0.42) 45%, rgba(24,16,10,0.6) 74%, rgba(20,13,8,0.72) 100%)",
        }}
      />

      {/* Warm top/bottom wash so the hero title and page edges stay legible */}
      <div className="absolute inset-0 bg-gradient-to-b from-stone-950/55 via-transparent to-stone-950/50" />
    </div>
  );
};

export default LobbyBackground;
