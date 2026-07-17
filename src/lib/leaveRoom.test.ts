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

// createClient 를 태우지 않도록 supabaseClient 를 상수만 노출하게 목킹한다.
jest.mock("./supabaseClient", () => ({
  supabaseUrl: "https://test.supabase.co",
  supabaseKey: "test-anon-key",
}));

import { deleteUserRow } from "./leaveRoom";

describe("deleteUserRow", () => {
  const originalFetch = global.fetch;
  let fetchMock: jest.Mock;

  beforeEach(() => {
    fetchMock = jest.fn(() => Promise.resolve({ ok: true } as Response));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterEach(() => {
    global.fetch = originalFetch;
    jest.clearAllMocks();
  });

  it("언로드 중에도 살아남도록 keepalive DELETE 요청을 보낸다", () => {
    deleteUserRow("user-123");

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(
      "https://test.supabase.co/rest/v1/users?id=eq.user-123"
    );
    expect(init.method).toBe("DELETE");
    expect(init.keepalive).toBe(true);
    expect(init.headers.apikey).toBe("test-anon-key");
    expect(init.headers.Authorization).toBe("Bearer test-anon-key");
  });

  it("userId 를 URL 인코딩한다", () => {
    deleteUserRow("a b/c");
    const [url] = fetchMock.mock.calls[0];
    expect(url).toBe("https://test.supabase.co/rest/v1/users?id=eq.a%20b%2Fc");
  });

  it("userId 가 비면 요청하지 않는다", () => {
    deleteUserRow("");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetch 가 reject 해도(언로드 취소) throw 하지 않는다", () => {
    fetchMock.mockReturnValue(Promise.reject(new Error("aborted")));
    expect(() => deleteUserRow("user-123")).not.toThrow();
  });

  it("fetch 가 동기적으로 throw 해도 삼킨다", () => {
    fetchMock.mockImplementation(() => {
      throw new Error("no fetch");
    });
    expect(() => deleteUserRow("user-123")).not.toThrow();
  });
});
