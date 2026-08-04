# Office map source assets

The office map is generated directly from these two source images:

- `Tiny_Top_Down_32x32.png` — [Tiny Top Down Pack](https://screamingbrainstudios.itch.io/tiny-top-down-pack), Screaming Brain Studios, CC0.
- `PixelOfficeAssets.png` — [Pixel Office Asset Pack](https://2dpig.itch.io/pixel-office), 2D Pig, CC0.

Both downloaded archives include an internal license/readme that permits use
under the Creative Commons Zero (CC0) public-domain dedication.

## Pixel Office asset identification

The names below were verified against the pack's included
`LargePixelOffice.png` example scene before being used by
`scripts/generate-office-map.py`.

| Generator name | Source rectangle (x1, y1, x2, y2) | Asset |
| --- | --- | --- |
| `vending_machine` | `159,123,183,157` | Vending machine |
| `bookshelf` | `184,126,208,157` | Filled bookcase |
| `plant` | `170,65,184,84` | Potted office plant |
| `long_desk` | `115,47,155,63` | Long orange desk |
| `short_desk` | `85,47,111,63` | Short orange desk |
| `couch_gray` | `119,66,152,81` | Gray sofa |
| `couch_blue` | `120,83,153,99` | Blue sofa |
| `couch_green` | `120,102,153,118` | Green sofa |
| `couch_peach` | `120,121,153,137` | Peach sofa |
| `chair` | `6,41,17,63` | Red office chair |
| `calendar` | `234,81,251,92` | Wall calendar |
| `clock` | `159,108,178,114` | Digital wall clock |
| `water_cooler` | `147,140,156,157` | Water cooler |
| `bin_green/red/blue` | `116..145,143..157` | Recycling/waste bins |
| `computer` | `233,106,248,125` | Computer and keyboard unit |
| `cat` | `59,146,83,157` | Resting cat |

The blue strip at `3,68,76,92` is part of the example scene's floor/platform,
not a table. The gray strip at `171,44,250,61` is a cubicle/wall partition,
not a cabinet. The white block at `84,70,110,90` is a wall panel. These scene
construction pieces are intentionally not placed as freestanding furniture.

## Composition rules

Pixel Office is a scene-asset pack rather than a directional tileset. The map
therefore does not rotate chairs, desks, computers, or sofas to invent missing
views. `scripts/generate-office-map.py` builds only these source-compatible
prefabs before placing furniture:

- `workstation_left` — source-facing chair and adjacent desk/computer aligned
  to the left side of a partition.
- `workstation_right` — the same unrotated composition shifted to the right
  side of a partition. It is not mirrored because no opposite-facing chair is
  provided by the source pack.
- `service_counter` — horizontal desk, small terminal, and tower.

Wall decorations are anchored to wall faces. Front-facing sofas, bookcases,
vending machines, water coolers, and plants are placed along perimeter walls
with usable floor space left clear in front of them.
