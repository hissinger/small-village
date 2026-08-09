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

import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import GameBackdrop from "../GameBackdrop";

const readSource = (relative: string) =>
  fs.readFileSync(path.join(__dirname, "../..", relative), "utf8");

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

  // 게임 화면은 캔버스가 배경을 덮으면 이 컴포넌트가 아예 보이지 않는다. Phaser 는
  // React 밖 명령형 코드라 렌더 결과로 확인할 수 없으므로 설정을 소스에서 검사한다.
  describe("게임 화면이 배경을 가리지 않는다", () => {
    it("Phaser 캔버스를 투명하게 만든다", () => {
      const source = readSource("pages/SmallVillageScreen.tsx");

      expect(source).toContain("transparent: true");
      expect(source).not.toMatch(/backgroundColor:\s*"#/);
      expect(source).toContain("<GameBackdrop");
    });

    it("카메라가 월드 바깥을 단색으로 칠하지 않는다", () => {
      const source = readSource("scenes/SmallVillageScene.ts");

      expect(source).toMatch(
        /setBackgroundColor\(\s*"rgba\(0,\s*0,\s*0,\s*0\)"\s*\)/
      );
    });
  });
});
