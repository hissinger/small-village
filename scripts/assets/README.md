# Village map source assets

`village.tmj`(어느 칸에 어느 타일) 와 `village.tsx`(타일이 팩의 어디서 왔나 · 무엇인가 ·
어디가 막히나) 는 **좌표만** 든 파일이다. 그림은 한 픽셀도 들어 있지 않고, 실제 픽셀은
아래 라이선스 원본에서 온다.

## 원본 구하기

- **Tiny RPG Town** — artwork by Luis Zuno ([@ansimuz](https://ansimuz.com)),
  GameDev Market **Pro Licence**.

내려받은 압축을 풀어 리포 루트에 이렇게 둔다 (`.gitignore` 되어 있다):

```
tiny-rpg-town-files/
  tileset/tileset.png       ← 맵 오브젝트 (투명 배경, 16px 타일)
  tileset/grass-tile.png    ← 잔디 바탕 (48x48, 심 없이 반복)
  derived/village-tiles.png ← Tiled 가 쓰는 타일 아틀라스. 여기서 굽는다(커밋 안 함)
```

아틀라스는 `npm run build:village-tiles` 로 굽는다. 어느 타일이 팩의 어디서 왔는지는
`village.tsx` 의 타일 속성에 적혀 있어서, 팩 원본만 있으면 언제든 똑같이 다시 나온다.

## 라이선스 주의

Pro Licence 는 애셋을 고쳐 게임에 쓰는 것은 허용하지만, **애셋이나 그 파생물을
게임 밖으로 재배포하는 것을 금지한다.** 그래서

- `tiny-rpg-town-files/` 는 커밋하지 않는다 (이 리포는 공개다).
- `public/` 안에 원본을 두지 않는다 — 두면 URL 로 그대로 내려받힌다.
- 감사 렌더는 `.audit/` (gitignore) 로 나간다.
- 리포의 Apache-2.0 은 **소스 코드**에만 적용된다. `public/assets/` 의 그림은
  각 제공자 라이선스를 따른다 — 루트 [README](../../README.md) 참고.

`tileset.png` 에는 팩의 PSD `Credits` 레이어(우하단 `RPG TOWN TILE MAP / by Luis
Zuno` 문구, `226,240` 에서 `126x48`)가 합쳐져 있다. 두 스크립트 모두 이 덩어리를
찾아서 떼어내고, 못 찾으면 실패한다 — 워터마크가 맵에 실려 나가지 않게 하려는 것이다.

## 맵 고치기

[Tiled](https://www.mapeditor.org) 로 `village.tmj` 를 연다. 아틀라스를 먼저 구워야
그림이 보인다:

```bash
npm run build:village-tiles
```

**충돌은 타일에 그린다.** Tiled 의 타일 충돌 편집기에서 조각마다 막히는 상자를 그려 두면
그 조각을 어디에 놓든 따라온다. 예전에는 "팩의 이 영역은 벽" 이라는 좌표 표로
추정했는데, 표에서 빠진 벽 그림이 조용히 안 막혀서 캐릭터가 집 안으로 걸어 들어갔다.

레이어는 아래부터 `grass` → `objects_*` → `sorted_*` → `above_*` 순서이고, **무엇이
캐릭터를 가리는지는 레이어가 정한다** (Classic 의 `above_0/1`, Office 의 `depthY` 와 같은 규칙):

| 레이어 | 뜻 |
|---|---|
| `grass`, `objects_*` | 바닥 — 캐릭터 아래 |
| `sorted_*` (+ 레이어 속성 `depthY`) | 바닥에 선 가림 물건(울타리·통). 적어 둔 발치 y 로 캐릭터와 Y 정렬한다 — 앞에 서면 캐릭터가 이긴다 |
| `above_*` | 머리 위로 지나가는 것(지붕·수관). 늘 캐릭터를 덮는다 |

바닥에 선 물건을 `above_*` 에 넣으면 **그 앞에 서도 캐릭터가 덮인다.** 반대로 지붕을
`sorted_*` 로 내리면 지붕 안쪽에서 캐릭터가 지붕 위로 튀어나온다.
`depthY` 는 맵 원본 px(704x576 기준)이고, 빌드가 `sorted_*` 를 `village-sorted.png` 로
따로 구워 `village.json` 의 `sorted_overlays` 로 범위와 함께 내보낸다.

## 파이프라인

```
village.tsx + 팩 원본            →  build-village-tiles.py  →  derived/village-tiles.png
village.tmj + village.tsx + 아틀라스  →  build-village-map.py    →  village-bg.png
                                                                   village-above.png
                                                                   village-sorted.png
                                                                   tilemaps/village.json
```

평소 검증은:

```bash
npm run audit:village    # 빌드 → 에디터 모델 → 맵 테스트 → 충돌/네비 감사
```

원본이 없으면 두 스크립트가 무엇이 없는지 알려주고 멈춘다. 커밋된 산출물
(`village-bg.png` 등) 만으로 앱은 빌드·배포되므로, 원본 없이도 개발은 된다.

## 좌표계

팩이 16px 타일이라 레이아웃은 1x(352x288) 로 적고, 빌드가 정수 2배로 늘려
씬이 쓰는 704x576(32px 타일)을 만든다. 픽셀아트를 비정수 배율로 늘리면 색이
번진다 — 이전 소스가 68색 팩에서 139,369색까지 번져 있었던 게 그 증상이다.
