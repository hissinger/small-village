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
import AssetCredits, { ASSET_CREDITS } from "../AssetCredits";

const root = path.join(__dirname, "../../..");

describe("AssetCredits", () => {
  // Classic 맵 타일셋은 CC-BY 4.0 이다 — 저작자 표시는 취향이 아니라 라이선스 의무다.
  // 지우면 게임을 배포하는 순간 라이선스 위반이 되므로 화면에 남아 있는지 잠근다.
  it("CC-BY 4.0 팩의 저작자와 라이선스를 화면에 표시한다", () => {
    render(<AssetCredits />);
    const limezu = ASSET_CREDITS.find(({ licence }) => licence === "CC BY 4.0");
    expect(limezu).toBeDefined();
    expect(screen.getByText(limezu!.pack)).toBeInTheDocument();
    expect(
      screen.getByText(`— ${limezu!.author} (${limezu!.licence})`, {
        exact: false,
      })
    ).toBeInTheDocument();
  });

  it("모든 항목이 저작자·라이선스·출처 링크를 갖는다", () => {
    expect(ASSET_CREDITS.length).toBeGreaterThan(0);
    ASSET_CREDITS.forEach(({ pack, author, licence, href }) => {
      expect(pack).toBeTruthy();
      expect(author).toBeTruthy();
      expect(licence).toBeTruthy();
      expect(href).toMatch(/^https:\/\//);
    });
  });

  it("출처 링크가 새 탭에서 안전하게 열린다", () => {
    render(<AssetCredits />);
    screen.getAllByRole("link").forEach((link) => {
      expect(link).toHaveAttribute("target", "_blank");
      expect(link).toHaveAttribute("rel", "noreferrer");
    });
  });

  // README 의 표와 화면의 표시가 갈라지면, 한쪽만 보고 팩을 지우거나 바꾸게 된다.
  it("README 의 에셋 표가 같은 팩을 모두 담고 있다", () => {
    const readme = fs.readFileSync(path.join(root, "README.md"), "utf8");
    ASSET_CREDITS.forEach(({ pack, author }) => {
      expect(readme).toContain(pack);
      expect(readme).toContain(author);
    });
  });
});
