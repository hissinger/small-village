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

/**
 * 아트 저작자 표시.
 *
 * Classic 맵 타일셋(LimeZu, Serene Village revamped)은 **CC-BY 4.0** 이라 저작자
 * 표시가 라이선스 의무다. README 만으로는 게임을 플레이하는 사람에게 표시가 닿지
 * 않으므로 로비에 같이 둔다. 나머지 팩은 표시 의무가 없지만 같이 적어 둔다.
 *
 * 팩을 추가·교체할 때 이 목록과 [README](../../README.md) 의 표를 같이 고쳐야 한다.
 */

type Credit = {
  /** 팩 이름 */
  pack: string;
  /** 저작자 — 라이선스가 요구하는 표기 문구를 그대로 쓴다. */
  author: string;
  /** 라이선스 이름. 링크가 있으면 그 조건을 확인할 수 있게 건다. */
  licence: string;
  href: string;
};

export const ASSET_CREDITS: Credit[] = [
  {
    pack: "Serene Village – revamped",
    author: "LimeZu",
    licence: "CC BY 4.0",
    href: "https://limezu.itch.io/serenevillagerevamped",
  },
  {
    pack: "Top Down Pixel Art Characters",
    author: "Jephed, Game Between The Lines",
    licence: "free for commercial use",
    href: "https://gamebetweenthelines.itch.io/top-down-pixel-art-characters",
  },
  {
    pack: "Tiny RPG Town",
    author: "Luis Zuno (@ansimuz)",
    licence: "GameDev Market Pro Licence",
    href: "https://ansimuz.com",
  },
  {
    pack: "Tiny Top Down Pack",
    author: "Screaming Brain Studios",
    licence: "CC0",
    href: "https://screamingbrainstudios.itch.io/tiny-top-down-pack",
  },
  {
    pack: "Pixel Office Asset Pack",
    author: "2D Pig",
    licence: "CC0",
    href: "https://2dpig.itch.io/pixel-office",
  },
];

const AssetCredits: React.FC = () => (
  <footer className="mt-6 text-center text-[10px] leading-relaxed text-orange-100/60">
    <h2 className="sr-only">Artwork credits</h2>
    <ul className="inline-flex flex-wrap justify-center gap-x-3 gap-y-1">
      {ASSET_CREDITS.map(({ pack, author, licence, href }) => (
        <li key={pack}>
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            className="underline decoration-dotted underline-offset-2 hover:text-orange-100"
          >
            {pack}
          </a>
          {` — ${author} (${licence})`}
        </li>
      ))}
    </ul>
  </footer>
);

export default AssetCredits;
