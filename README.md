![](https://velog.velcdn.com/images/woody_ahn/post/5e3c1f0d-a06b-4df2-87ab-a168c2d5a854/image.png)

# Small Village

Small Village is a project that will be developed similarly to Gather Town. It will be a serverless service built using Supabase, ReactJS, WebRTC, Phaser, and Netlify.

Join the village and start chatting with other villagers. https://smallvillage.netlify.app


## Architecture
- **Supabase**: Supabase is used as a database to store user information and chat messages.
- **Cloudflare RealtimeKit**: Cloudflare RealtimeKit is SFU media server that is used to create voice calls between users.


## Installation

This project is developed based on a serverless architecture, so you don’t need to prepare a server. All you need to do is sign up for Supabase and Cloudflare.

### Supabase Schema
first, you have to create a table in the Supabase database. `schema.sql` file contains the schema for the Supabase database. You can run this file in the SQL editor of the Supabase dashboard.

### Environment Variables
Create a `.env` file in the root directory of the project and add the following environment variables.

1. supabase environment variables
- `REACT_APP_SUPABASE_URL`: Supabase URL
- `REACT_APP_SUPABASE_KEY`: Supabase Key


### npm install

```bash
npm install
```

## Running

```bash
npm start
```


## References
- [Modular Game Worlds in Phaser 3 (Tilemaps #1) — Static Maps](https://medium.com/@michaelwesthadley/modular-game-worlds-in-phaser-3-tilemaps-1-958fc7e6bbd6)
- [Cloudflare RealtimeKit documents](https://docs.realtime.cloudflare.com/)
- [Using WebRTC + React + WebAudio to create spatial audio](https://blog.livekit.io/tutorial-using-webrtc-react-webaudio-to-create-spatial-audio/)

## Assets

The artwork is **not** covered by this repository's Apache-2.0 licence — see
[License](#license) below. Each pack keeps its own terms:

| Used for | Pack | Author | Licence | In this repo? |
| --- | --- | --- | --- | --- |
| Classic map | [Serene Village – revamped](https://limezu.itch.io/serenevillagerevamped) | LimeZu | **CC BY 4.0** — attribution required | yes (redistribution allowed) |
| Characters | [Top Down Pixel Art Characters](https://gamebetweenthelines.itch.io/top-down-pixel-art-characters) | Jephed, Game Between The Lines | free for commercial use | yes |
| Village map | [Tiny RPG Town](https://ansimuz.com) | Luis Zuno (@ansimuz) | GameDev Market **Pro Licence** — redistribution forbidden | **no** — [how to obtain](scripts/assets/README.md) |
| Office map | [Tiny Top Down Pack](https://screamingbrainstudios.itch.io/tiny-top-down-pack) | Screaming Brain Studios | CC0 | yes |
| Office map | [Pixel Office Asset Pack](https://2dpig.itch.io/pixel-office) | 2D Pig | CC0 | yes |

Serene Village is **CC BY 4.0**, so attribution is a licence obligation rather
than a courtesy — the credits are shown in the lobby
([AssetCredits.tsx](src/components/AssetCredits.tsx)) as well as here. Keep the
two lists in sync when a pack is added or replaced; a test enforces it.

The Tiny RPG Town Pro Licence permits modifying the art and shipping it inside
the game, but forbids redistributing the asset or a derivative of it outside the
game. So its source files live outside this repo (gitignored) and only the baked
map (`public/assets/village-bg.png`, `village-above.png`) is committed —
regenerate it with `npm run audit:village` once you have the pack locally.

## License

The **source code** in this repository is licensed under the Apache License,
Version 2.0. It does **not** grant any rights to the third-party artwork under
`public/assets/` — see [Assets](#assets) for each pack's terms.

You may use, modify, and distribute this software in compliance with the License.  

A copy of the License is available at:  
[http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  
See the License for the specific language governing permissions and limitations under the License.