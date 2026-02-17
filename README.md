# websim-socket

WebSim-compatible multiplayer module backed by [PartyKit](https://www.partykit.io/).

Drop-in replacement for WebSim's `WebsimSocket` API — migrate your existing multiplayer code by changing one import.

**[Live Demo](https://farl.github.io/websim-socket/)** — open in two tabs to see multiplayer in action.

## Installation

```bash
npm install websim-socket
npm install partykit --save-dev
```

## Usage

### 1. Set up the server

Create a `partykit.json` in your project root:

```json
{
  "name": "my-app",
  "main": "node_modules/websim-socket/src/server/index.ts"
}
```

Or if you want to customize the server, create your own entry file and re-export:

```javascript
// server.ts
export { default } from "websim-socket/server";
```

```json
{
  "name": "my-app",
  "main": "server.ts"
}
```

### 2. Start the dev server

```bash
npx partykit dev
```

This starts a local PartyKit server on `localhost:1999`.

### 3. Connect from your client

```javascript
import { WebsimSocket } from "websim-socket";

const room = new WebsimSocket({
  host: "localhost:1999",  // use your deployed URL in production
  room: "my-room",        // optional, defaults to URL pathname
});

await room.initialize();
```

### 4. Use the API

```javascript
// --- Presence (per-player state) ---

// Update your own presence
room.updatePresence({ x: 100, y: 200, health: 99 });

// Read all players' presence
console.log(room.presence);
// { "client-a": { x: 100, y: 200, health: 99 }, "client-b": { ... } }

// Subscribe to presence changes
const unsub = room.subscribePresence((presence) => {
  // Called whenever any player's presence changes
});
unsub(); // unsubscribe when done


// --- Room State (shared game state) ---

// Update shared state (deep-merged)
room.updateRoomState({
  objects: {
    "rock-1": { x: 50, y: 80 },
  },
});

// Delete a key by setting it to null
room.updateRoomState({
  objects: { "rock-1": null },
});

// Subscribe to room state changes
room.subscribeRoomState((roomState) => {
  // Called whenever room state changes
});


// --- Events (ephemeral broadcasts) ---

// Send an event to all players
room.send({ type: "explosion", x: 50, y: 50 });

// Send without receiving it yourself
room.send({ type: "ping", echo: false });

// Handle incoming events
room.onmessage = (event) => {
  switch (event.data.type) {
    case "connected":
      console.log(`${event.data.username} joined`);
      break;
    case "disconnected":
      console.log(`${event.data.username} left`);
      break;
    case "explosion":
      playSound("boom", event.data.x, event.data.y);
      break;
  }
};


// --- Presence Update Requests ---
// Ask another player to update their own state (e.g. damage)

// Client A: request damage on Client B
room.requestPresenceUpdate("client-b-id", {
  type: "damage",
  amount: 10,
});

// Client B: handle the request
room.subscribePresenceUpdateRequests((request, fromClientId) => {
  if (request.type === "damage") {
    const me = room.presence[room.clientId];
    room.updatePresence({
      health: me.health - request.amount,
    });
  }
});


// --- Peers ---

// Get all connected players
console.log(room.peers);
// { "client-a": { username: "Guest-A1B2", avatarUrl: "..." }, ... }

// Get your own info
console.log(room.clientId);
console.log(room.peers[room.clientId].username);
```

### 5. Deploy to production

```bash
npx partykit deploy
```

This deploys to Cloudflare and gives you a URL like `my-app.username.partykit.dev`. Update your client to use it:

```javascript
const room = new WebsimSocket({
  host: "my-app.username.partykit.dev",
});
```

## API Reference

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
+ const room = new WebsimSocket({ host: "my-app.username.partykit.dev" });

  await room.initialize();
  // Everything else stays the same
```

## Contributing

```bash
git clone https://github.com/Farl/websim-socket.git
cd websim-socket
npm install
npm run dev
```

Open `http://localhost:1999` for the multiplayer cursor demo. Open a second tab to test.

## License

MIT
