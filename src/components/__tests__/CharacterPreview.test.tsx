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
import CharacterPreview from "../CharacterPreview";

describe("CharacterPreview", () => {
  const defaultProps = {
    previewContainerRef: { current: null },
    onPrevious: jest.fn(),
    onNext: jest.fn(),
    currentIndex: 0,
  };

  it("에셋 로딩 표시는 캐릭터 미리보기 영역 안에만 표시한다", () => {
    render(<CharacterPreview {...defaultProps} loading />);

    const preview = screen.getByTestId("character-preview");
    const loading = screen.getByRole("status", {
      name: "Loading character",
    });

    expect(preview).toContainElement(loading);
    expect(loading).toHaveClass("absolute", "inset-0");
    expect(loading).not.toHaveClass("bg-white");
  });

  it("에셋 준비가 끝나면 로딩 표시를 제거한다", () => {
    render(<CharacterPreview {...defaultProps} loading={false} />);

    expect(
      screen.queryByRole("status", { name: "Loading character" })
    ).not.toBeInTheDocument();
  });
});
