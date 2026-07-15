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

import { getOrCreateUserId, getStoredName, setStoredName } from "./storage";

// 간단한 인메모리 localStorage 목. 테스트마다 새로 갈아끼워 상태를 격리한다.
function createLocalStorageMock(): Storage {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => (key in store ? store[key] : null),
    setItem: (key: string, value: string) => {
      store[key] = String(value);
    },
    removeItem: (key: string) => {
      delete store[key];
    },
    clear: () => {
      store = {};
    },
    key: (index: number) => Object.keys(store)[index] ?? null,
    get length() {
      return Object.keys(store).length;
    },
  };
}

beforeEach(() => {
  Object.defineProperty(window, "localStorage", {
    value: createLocalStorageMock(),
    writable: true,
  });
});

describe("getOrCreateUserId", () => {
  it("returns the same value on repeated calls", () => {
    const first = getOrCreateUserId();
    const second = getOrCreateUserId();
    expect(first).toBe(second);
  });

  it("persists the generated id to localStorage", () => {
    const id = getOrCreateUserId();
    expect(localStorage.getItem("smallvillage_user_id")).toBe(id);
  });

  it("reuses an id already stored in localStorage", () => {
    localStorage.setItem("smallvillage_user_id", "existing-id");
    expect(getOrCreateUserId()).toBe("existing-id");
  });
});

describe("getStoredName / setStoredName", () => {
  it("returns null when nothing is stored", () => {
    expect(getStoredName()).toBeNull();
  });

  it("returns the value stored by setStoredName", () => {
    setStoredName("Mina");
    expect(getStoredName()).toBe("Mina");
  });

  it("truncates names longer than the 20-char maxLength", () => {
    const longName = "a".repeat(30);
    setStoredName(longName);
    expect(getStoredName()).toBe("a".repeat(20));
  });
});
