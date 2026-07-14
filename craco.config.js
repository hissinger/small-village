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

// CRA(react-scripts) 는 node_modules 를 `babel-preset-react-app/dependencies` 로
// 트랜스파일하는데, 여기서는 `transform-parameters` 만 적용되고 `transform-classes`
// 는 빠져 있다. @cloudflare/realtimekit 2.x 의 ESM 번들은 rest 파라미터를 가진
// arrow function 안에서 `super(...args)` 를 호출하는 패턴을 담고 있어, classes
// 변환 없이 parameters 만 변환하면 Babel 이 컴파일을 거부한다
// ("it's not possible to compile `super()` in an arrow function ...").
// dependencies 용 babel-loader 에만 transform-classes 를 주입해 이 조합을
// 성립시킨다(아래 isDependenciesLoader 참고). 커스텀 웹팩을 새로 짜는 게 아니라
// CRA 기본 설정에 플러그인 하나만 더하는 것이다.
const transformClasses = require.resolve("@babel/plugin-transform-classes");

// CRA 의 node_modules 전용 babel-loader 만 골라낸다. 이 규칙은
// `babel-preset-react-app/dependencies` 프리셋을 쓰며, 앱 소스용 규칙과 달리
// class-properties 변환이 없다. 앱 소스 규칙(메인 preset)에 transform-classes 를
// 넣으면 class-properties 와 순서가 꼬여("Missing class properties transform")
// 우리 TS 클래스가 깨지므로, 반드시 dependencies 규칙에만 주입해야 한다.
function isDependenciesLoader(options) {
  if (!options || !Array.isArray(options.presets)) return false;
  // require.resolve 가 돌려준 절대경로라 OS 구분자(posix `/`, Windows `\`)
  // 양쪽을 허용한다.
  return /babel-preset-react-app[\\/]dependencies/.test(
    JSON.stringify(options.presets)
  );
}

function addTransformClasses(entry) {
  if (
    entry &&
    typeof entry.loader === "string" &&
    entry.loader.includes("babel-loader") &&
    entry.options &&
    typeof entry.options === "object" &&
    isDependenciesLoader(entry.options)
  ) {
    entry.options.plugins = entry.options.plugins || [];
    if (!entry.options.plugins.includes(transformClasses)) {
      entry.options.plugins.push(transformClasses);
    }
  }
}

function walkRules(rules) {
  rules.forEach((rule) => {
    if (!rule) return;
    if (Array.isArray(rule.oneOf)) walkRules(rule.oneOf);
    addTransformClasses(rule);
  });
}

module.exports = {
  webpack: {
    configure: (webpackConfig) => {
      walkRules(webpackConfig.module.rules);
      return webpackConfig;
    },
  },
};
