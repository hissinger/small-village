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

import { render } from "@testing-library/react";
import LobbyBackground from "../LobbyBackground";

describe("LobbyBackground", () => {
  it("긴 모바일 로비를 스크롤해도 배경이 뷰포트에 고정된다", () => {
    const { container } = render(<LobbyBackground />);

    expect(container.firstChild).toHaveClass("fixed", "inset-0");
    expect(container.firstChild).not.toHaveClass("absolute");
  });
});
