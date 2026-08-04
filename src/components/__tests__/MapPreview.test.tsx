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

import { fireEvent, render, screen } from "@testing-library/react";
import MapPreview from "../MapPreview";
import { MAPS } from "../../lib/mapKind";

describe("MapPreview", () => {
  it("선택한 맵의 실제 미리보기 이미지와 순번을 표시한다", () => {
    render(<MapPreview mapKind={MAPS.TILEMAP} onChange={() => {}} />);

    expect(screen.getByAltText("Classic map preview")).toHaveAttribute(
      "src",
      "/assets/map-previews/classic.png"
    );
    expect(screen.getByText("2/3")).toBeInTheDocument();
  });

  it("좌우 버튼으로 순환하며 맵을 선택한다", () => {
    const onChange = jest.fn();
    const { rerender } = render(
      <MapPreview mapKind={MAPS.VILLAGE} onChange={onChange} />
    );

    fireEvent.click(screen.getByRole("button", { name: "Previous map" }));
    expect(onChange).toHaveBeenLastCalledWith(MAPS.OFFICE);

    rerender(<MapPreview mapKind={MAPS.OFFICE} onChange={onChange} />);
    fireEvent.click(screen.getByRole("button", { name: "Next map" }));
    expect(onChange).toHaveBeenLastCalledWith(MAPS.VILLAGE);
  });
});
