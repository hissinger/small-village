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

import { LucideProps } from "lucide-react";
import React from "react";

interface IconButtonProps {
  onClick: () => void;
  isActive?: boolean;
  ActiveIcon: React.ComponentType<LucideProps>;
  InactiveIcon?: React.ComponentType<LucideProps>;
  activeColor: string;
  inactiveColor?: string;
  size: number;
  strokeWidth: number;
  className?: string;
  ariaLabel?: string;
  ariaExpanded?: boolean;
}

// "Toggle Microphone" → "toggle-microphone" 형태로 변환한다.
const toKebabCase = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");

const IconButton: React.FC<IconButtonProps> = ({
  onClick,
  isActive,
  ActiveIcon,
  InactiveIcon,
  activeColor,
  inactiveColor,
  size,
  strokeWidth,
  className,
  ariaLabel,
  ariaExpanded,
}) => {
  return (
    <button
      // 고정 높이(h-[50px]) + 내부 세로 중앙 정렬로, SVG 아이콘 고유 높이 차이와
      // 무관하게 모든 바텀바 버튼이 같은 박스에 정렬되게 한다.
      className={`border-none rounded-lg cursor-pointer flex items-center justify-center w-[50px] h-[50px] ${className}`}
      onClick={onClick}
      aria-label={ariaLabel}
      aria-expanded={ariaExpanded}
      data-testid={ariaLabel ? `bottombar-${toKebabCase(ariaLabel)}` : undefined}
    >
      {isActive || !InactiveIcon ? (
        <ActiveIcon size={size} strokeWidth={strokeWidth} color={activeColor} />
      ) : (
        <InactiveIcon
          size={size}
          strokeWidth={strokeWidth}
          color={inactiveColor || activeColor}
        />
      )}
    </button>
  );
};

export default IconButton;
