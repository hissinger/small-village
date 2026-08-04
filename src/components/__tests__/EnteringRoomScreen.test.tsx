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
import EnteringRoomScreen from "../EnteringRoomScreen";

describe("EnteringRoomScreen", () => {
  it("선택한 맵과 캐릭터로 입장 화면을 렌더링한다", () => {
    render(
      <EnteringRoomScreen
        map="office"
        characterIndex={7}
        message="Strolling into the Small Village..."
      />
    );

    expect(screen.getByRole("status", { name: "Entering room" })).toBeVisible();
    expect(screen.getByText("Small Village")).toHaveClass("sv-font-pixel");
    expect(screen.getByTestId("game-backdrop").querySelector("img")).toHaveAttribute(
      "src",
      "/assets/map-previews/office.png"
    );
    expect(screen.getByTestId("entering-character")).toHaveStyle({
      backgroundImage: 'url("/assets/characters/007.png")',
    });
  });

  it("캐릭터 파일명은 세 자리로 맞춘다", () => {
    render(<EnteringRoomScreen map="village" characterIndex={39} />);

    expect(screen.getByTestId("entering-character")).toHaveStyle({
      backgroundImage: 'url("/assets/characters/039.png")',
    });
  });
});
