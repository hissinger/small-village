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

import { render, screen } from "@testing-library/react";
import GameBackdrop from "../GameBackdrop";

describe("GameBackdrop", () => {
  it("선택한 맵 이미지를 확대·블러 배경으로 표시한다", () => {
    render(<GameBackdrop map="office" />);

    const image = screen.getByRole("presentation", { hidden: true });
    expect(image).toHaveAttribute("src", "/assets/map-previews/office.png");
    expect(image).toHaveStyle({
      filter: "blur(24px) saturate(0.82) brightness(0.62)",
      transform: "scale(1.12)",
    });
  });

  it("알 수 없는 맵 값은 기본 Village 이미지로 폴백한다", () => {
    const { container } = render(<GameBackdrop map="unknown" />);

    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/assets/village-bg.png"
    );
  });
});
