# Small Village

Small Village is a project that will be developed similarly to Gather Town. It will be a serverless service built using Supabase, ReactJS, WebRTC, Phaser, and Netlify.

Join the village and start chatting with other villagers. https://smallvillage.netlify.app


## Architecture
- **Supabase**: Supabase is used as a database to store user information and chat messages.
- **Cloudflare Calls**: Cloudflare Calls is SFU media server that is used to create voice calls between users.


## Installation

This project is developed based on a serverless architecture, so you don’t need to prepare a server. All you need to do is sign up for Supabase and Cloudflare.

### Supabase Schema
first, you have to create a table in the Supabase database. `schema.sql` file contains the schema for the Supabase database. You can run this file in the SQL editor of the Supabase dashboard.

### Environment Variables
Create a `.env` file in the root directory of the project and add the following environment variables.

1. supabase environment variables
- `REACT_APP_SUPABASE_URL`: Supabase URL
- `REACT_APP_SUPABASE_KEY`: Supabase Key

2. turn server environment variables
- `REACT_APP_TURN_SERVER_URL`: Turn server URL
- `REACT_APP_TURN_SERVER_USERNAME`: Turn server username
- `REACT_APP_TURN_SERVER_CREDENTIAL`: Turn server credential

3. cloudflare environment variables
- `REACT_APP_CLOUDFLARE_APP_ID`: Cloudflare app id
- `REACT_APP_CLOUDFLARE_APP_SECRET`: Cloudflare app secret

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
- [Cloudflare Calls documents](https://developers.cloudflare.com/calls/)
- [Using WebRTC + React + WebAudio to create spatial audio](https://blog.livekit.io/tutorial-using-webrtc-react-webaudio-to-create-spatial-audio/)

## Assets
- https://itch.io/
- https://limezu.itch.io/serenevillagerevamped
- https://gamebetweenthelines.itch.io/top-down-pixel-art-characters

## License

This project is licensed under the Apache License, Version 2.0.  
You may use, modify, and distribute this software in compliance with the License.  

A copy of the License is available at:  
[http://www.apache.org/licenses/LICENSE-2.0](http://www.apache.org/licenses/LICENSE-2.0)

Unless required by applicable law or agreed to in writing, software distributed under the License is distributed on an "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.  
See the License for the specific language governing permissions and limitations under the License.