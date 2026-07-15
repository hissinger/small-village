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

import { v4 as uuidv4 } from "uuid";
import { NAME_MAX_LENGTH } from "../constants";

// 방문(브라우저 세션)을 넘어 살아남아야 하는 값들은 localStorage 에 둔다.
// sessionStorage 는 탭을 닫으면 사라지므로 재방문 시 신원/이름이 초기화됐다.
const USER_ID_KEY = "smallvillage_user_id";
const USER_NAME_KEY = "smallvillage_user_name";

/**
 * 유저 id 를 가져온다. 없으면 uuid v4 를 새로 만들어 저장하고 반환한다.
 *
 * 로그인이 없는 앱이라 이 uuid 가 곧 유저의 신원이다. localStorage 에 두어
 * 같은 브라우저에서 재방문해도 같은 신원을 유지한다.
 */
export function getOrCreateUserId(): string {
  const storedUserId = localStorage.getItem(USER_ID_KEY);
  if (storedUserId) {
    return storedUserId;
  }
  const newUserId = uuidv4();
  localStorage.setItem(USER_ID_KEY, newUserId);
  return newUserId;
}

/**
 * 저장된 표시 이름을 반환한다. 저장된 값이 없으면 null.
 */
export function getStoredName(): string | null {
  return localStorage.getItem(USER_NAME_KEY);
}

/**
 * 표시 이름을 저장한다. NAME_MAX_LENGTH 를 넘는 이름은 잘라서 저장한다.
 */
export function setStoredName(name: string): void {
  localStorage.setItem(USER_NAME_KEY, name.slice(0, NAME_MAX_LENGTH));
}
