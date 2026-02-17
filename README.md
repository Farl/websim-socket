# websim-socket

WebSim-compatible multiplayer module backed by [PartyKit](https://www.partykit.io/).

Drop-in replacement for WebSim's `WebsimSocket` API — migrate your existing multiplayer code by changing one import.

## Features

- **Room State** — shared game state synchronized across all clients
- **Presence** — per-client state (cursor position, health, etc.) owned by each client
- **Events** — ephemeral broadcasts for sound effects, chat, etc.
- **Presence Update Requests** — request another player to update their own state (e.g. damage)
- **Peer Tracking** — automatic connect/disconnect notifications with username & avatar

## Quick Start

```bash
npm install websim-socket
npm install partykit --save-dev
```

### Client

```javascript
import { WebsimSocket } from "websim-socket";

const room = new WebsimSocket({
  host: "localhost:1999", // optional, defaults to localhost:1999
  room: "my-room",       // optional, defaults to URL pathname
});

await room.initialize();

// Update your presence (cursor, position, etc.)
room.updatePresence({ x: 100, y: 200 });

// Update shared room state
room.updateRoomState({ score: { team1: 5 } });

// Subscribe to changes
room.subscribePresence((presence) => { /* ... */ });
room.subscribeRoomState((roomState) => { /* ... */ });

// Broadcast ephemeral events
room.send({ type: "explosion", x: 50, y: 50 });

// Handle events
room.onmessage = (event) => {
  console.log(event.data.type); // "connected", "disconnected", or custom
};
```

### Server

In your PartyKit project, re-export the server:

```javascript
export { default } from "websim-socket/server";
```

Or use it directly in `partykit.json`:

```json
{
  "main": "node_modules/websim-socket/src/server/index.ts"
}
```

## API

```typescript
interface WebsimSocket {
  readonly presence: Record<string, any>;
  readonly roomState: Record<string, any>;
  readonly peers: Record<string, { username: string; avatarUrl: string }>;
  readonly clientId: string;

  initialize(): Promise<void>;

  updatePresence(presence: Record<string, any>): void;
  updateRoomState(roomState: Record<string, any>): void;
  requestPresenceUpdate(clientId: string, update: Record<string, any>): void;

  subscribePresence(callback: (presence) => void): () => void;
  subscribeRoomState(callback: (roomState) => void): () => void;
  subscribePresenceUpdateRequests(callback: (update, fromClientId) => void): () => void;

  send(event: { type: string; echo?: boolean; [key: string]: any }): void;
  onmessage: (event: { data: Record<string, any> }) => void;
}
```

### Constructor Options

| Option | Default | Description |
|---|---|---|
| `host` | `localhost:1999` | PartyKit server host |
| `room` | URL pathname | Room ID for this session |
| `username` | `Guest-XXXX` | Auto-generated if not provided |
| `avatarUrl` | `""` | Player avatar URL |

### State Rules

- State updates are **deep-merged** (nested objects merge recursively)
- Setting a key to `null` **deletes** it
- Arrays are **not supported** — use objects for collections

## Migration from WebSim

```diff
- const room = new WebsimSocket();
+ import { WebsimSocket } from "websim-socket";
+ const room = new WebsimSocket();

  await room.initialize();
  // Everything else stays the same
```

## Development

```bash
git clone https://github.com/Farl/websim-socket.git
cd websim-socket
npm install
npm run dev
```

Open `http://localhost:1999` for the multiplayer cursor demo. Open a second tab to test.

## License

MIT
