# Building a multiplayer game
At a high level, building a multiplayer game requires
1. initializing the game state
2. sending updates to the game state

In websim, game state is stored in two places:

1. Room State (\`room.roomState\`): Shared game state that is synchronized across all clients.
  - Example: World item positions.

2. Player Presence (\`room.presence\`): Per-client state that is owned by the client. This is also synchronized across all clients.
  - Example: Player positions, cursor positions, health, etc.

NOTE: room state and presence do not support arrays. Use objects for collections.

## Initializing the game state

To initialize the game state, we want to subscribe to the room state and player states.

\`\`\`javascript
const room = new WebsimSocket(); // WebsimSocket is available globally. No need to import it!

await room.initialize();

room.subscribePresence((currentPresence) => {
  // NOTE: \`room.presence\` is already kept up to date before this callback is called.
  // This is more for game-specific side effects.
});

room.subscribeRoomState((currentRoomState) => {
  // NOTE: \`room.roomState\` is already kept up to date before this callback is called.
  // This is more for game-specific side effects.
});
\`\`\`

After initializing, you can access the room state, presence, and peers via the readonly values \`room.roomState\`, \`room.presence\`, and \`room.peers\`.    
These will automatically be updated as the room state and presence are updated.

## Updating the game state

To update the game state, depending on the type of update, you have a few options:

### Updating one's own player state

\`\`\`javascript
room.updatePresence({
  x: 100,
  y: 200,
  health: 99,
});

// You can update a subset of your player state
room.updatePresence({
  health: 99,
});
\`\`\`

### Updating the room state

\`\`\`javascript
// Placing a new object at 100, 200
room.updateRoomState({
  objectPositions: {
    "rock-1": {
      x: 100,
      y: 200,
    },
  },
});

// Moving an existing object
room.updateRoomState({
  objectPositions: {
    "rock-1": {
      x: 110,
      y: 210,
    },
  },
});

// You can update a subset of the room state
room.updateRoomState({
  objectPositions: {
    "rock-1": {
      x: 110,
    },
  },
});

// Deleting an existing object
room.updateRoomState({
  objectPositions: {
    "rock-1": null,
  },
});
\`\`\`

### Requesting updates to other players' presence

Every client is responsible for their own presence state.
To affect the state of other players, you request an update from the other player.

For example, to damage another player, you request an update from the other player with the damage amount.

\`\`\`javascript
// Client A:
room.requestPresenceUpdate('client-b', {
  type: 'damage',
  amount: 10,
});
\`\`\`

The other player's client will receive the request and broadcast their updated presence:
\`\`\`javascript
// Client B:
room.subscribePresenceUpdateRequests((updateRequest, fromClientId) => {
  const clientPresence = room.presence[room.client.id];
  if (updateRequest.type === 'damage') {
    // Update and broadcast your updated presence:
    room.updatePresence({
      ...clientPresence,
      health: clientPresence.health - updateRequest.amount,
      dead: (clientPresence.health - updateRequest.amount) <= 0,
    });
  }
});
\`\`\`

### Broadcasting Events

Events are ephemeral and have the following signature:
\`\`\`ts
{
  data: {
    type: string; // The type of event
    echo?: boolean; // Whether the sender should be included in the broadcast. Default is true.
    [key: string]: any; // Additional event data
  }
}
\`\`\`

Events are too low-level for syncronizing state, but they're useful for trigging sound effects or other one-time effects.

To broadcast events, use the \`send\` method:

\`\`\`
room.send({
  type: "yourCustomEventType",
  echo: true,
  // Additional event data
  locationX: 100,
  locationY: 100,
  volume: 0.5,
});
\`\`\`
 
## Handling Events

To handle incoming events, use the \`onmessage\` property:

\`\`\`javascript
room.onmessage = (event) => {
  const data = event.data;
  switch (data.type) {
    // built-in events
    case "connected":
      console.log(\`Client \${data.clientId}, \${data.username}\`);
      break;
    case "disconnected":
      console.log(\`Client \${data.clientId}, \${data.username}\`);
      break;
    // custom events
    case "yourCustomEventType":
      console.log(\`New position: (\${data.locationX}, \${data.locationY})\`);
      console.log(\`Event sent by client: \${data.clientId}\`);
      console.log(\`Event sent by username: \${data.username}\`);
      // Handle your custom event
      break;
    default:
      console.log("Received event:", data);
  }
};
\`\`\`

## Get client and peer info

Every player's username and avatar are automatically handled by the library. There is no need to ask for player username or present a login.

The \`room.peers\` object is always up-to-date with the latest list of connected clients, e.g. for a lobby or leaderboard.

\`\`\`javascript
const {
  username,
  avatarUrl,
  id, // clientId
} = room.peers['some-client-id'];
\`\`\`

This is useful for getting a list of connected clients, e.g. for a lobby or leaderboard.

You can get your own client ID from \`room.clientId\`, which you can then index into \`room.peers\` to get your own username and avatar.

\`\`\`javascript
const { 
  username,
  avatarUrl,
  id, // clientId
} = room.peers[room.clientId];
\`\`\`

NOTE: Changes to the list of peers can be subscribed to via \`room.subscribePresence\`.

# API

\`\`\`typescript
interface Room {
  /**
   * Object containing the current presence state of all connected peers, including this client.
   * This is always up-to-date after awaiting initialize.
   */
  readonly presence: Record<string, any>;

  /**
   * Object containing the current room-wide state.
   * This is always up-to-date after awaiting initialize.
   */
  readonly roomState: Record<string, any>;

  /**
   * Object containing the current list of connected clients, including this client (you).
   * This is always up-to-date after awaiting initialize.
   */
  readonly peers: Record<string, {
    username: string;
    avatarUrl: string;
  }>;

  /**
   * The current client's ID.
   */
  readonly clientId: string;

  initialize(): Promise<void>;

  updatePresence(presence: Record<string, any>): void;
  updateRoomState(roomState: Record<string, any>): void;
  requestPresenceUpdate(clientId: string, update: Record<string, any>): void;

  // NOTE: subscribe functions return a function to unsubscribe from the updates.
  subscribePresence(callback: (presence: Record<string, any>) => void): () => void;
  subscribeRoomState(callback: (roomState: Record<string, any>) => void): () => void;
  subscribePresenceUpdateRequests(callback: (updateRequest: Record<string, any>, fromClientId: string) => void): () => void;

  send(event: Record<string, any>): void;
  onmessage: (event: Record<string, any>) => void;
}
\`\`\`