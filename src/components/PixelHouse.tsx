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

import React from "react";

interface PixelHouseProps {
  size?: number;
  className?: string;
}

/**
 * A small cozy pixel-art cottage used as the empty-state illustration for the
 * room list. Rendered as crisp SVG rects so it stays sharp at any size.
 */
const PixelHouse: React.FC<PixelHouseProps> = ({ size = 72, className }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 16 16"
    shapeRendering="crispEdges"
    className={className}
    role="img"
    aria-label="A quiet little house"
  >
    {/* Roof (terracotta) */}
    <rect x="7" y="2" width="2" height="1" fill="#e2725b" />
    <rect x="6" y="3" width="4" height="1" fill="#e2725b" />
    <rect x="5" y="4" width="6" height="1" fill="#e2725b" />
    <rect x="4" y="5" width="8" height="1" fill="#c85a43" />
    {/* Walls (cream / stone) */}
    <rect x="5" y="6" width="6" height="6" fill="#fdf6e3" />
    <rect x="5" y="6" width="6" height="6" fill="none" stroke="#d6c9a8" strokeWidth="0.4" />
    {/* Door (terracotta) */}
    <rect x="7" y="9" width="2" height="3" fill="#c85a43" />
    {/* Window (sky) */}
    <rect x="6" y="7" width="1" height="1" fill="#bfdbe8" />
    <rect x="9" y="7" width="1" height="1" fill="#bfdbe8" />
    {/* Ground line */}
    <rect x="3" y="12" width="10" height="1" fill="#d6c9a8" />
  </svg>
);

export default PixelHouse;
