import type * as Party from "partykit/server";
import { deepMerge } from "../shared/deep-merge";
import type {
  ClientToServerMessage,
  ServerToClientMessage,
} from "../shared/protocol";

interface PeerInfo {
  username: string;
  avatarUrl: string;
}

export default class WebsimServer implements Party.Server {
  private peers: Map<string, PeerInfo> = new Map();
  private presence: Record<string, Record<string, any>> = {};
  private roomState: Record<string, any> = {};

  constructor(readonly room: Party.Room) {}

  onConnect(conn: Party.Connection, ctx: Party.ConnectionContext) {
    const url = new URL(ctx.request.url);
    const username =
      url.searchParams.get("username") || `Guest-${conn.id.slice(0, 4)}`;
    const avatarUrl =
      url.searchParams.get("avatarUrl") ||
      `https://api.dicebear.com/7.x/pixel-art/svg?seed=${conn.id}`;

    // Store peer info
    this.peers.set(conn.id, { username, avatarUrl });

    // Initialize empty presence for this client
    this.presence[conn.id] = {};

    // Build peers object for init message
    const peersObj: Record<string, { username: string; avatarUrl: string }> = {};
    for (const [id, info] of this.peers) {
      peersObj[id] = { username: info.username, avatarUrl: info.avatarUrl };
    }

    // Send init to the new client
    this.send(conn, {
      type: "init",
      clientId: conn.id,
      roomState: this.roomState,
      presence: this.presence,
      peers: peersObj,
    });

    // Broadcast peer-joined to all OTHER clients
    this.broadcast(
      {
        type: "peer-joined",
        clientId: conn.id,
        username,
        avatarUrl,
      },
      [conn.id]
    );

    // Broadcast the new client's empty presence to other clients
    // (the new client already has this from the init message)
    this.broadcast(
      {
        type: "presence-updated",
        clientId: conn.id,
        presence: {},
      },
      [conn.id]
    );
  }

  onMessage(message: string, sender: Party.Connection) {
    let msg: ClientToServerMessage;
    try {
      msg = JSON.parse(message);
    } catch {
      return;
    }

    const senderInfo = this.peers.get(sender.id);
    if (!senderInfo) return;

    switch (msg.type) {
      case "update-presence": {
        this.presence[sender.id] = deepMerge(
          this.presence[sender.id] || {},
          msg.presence
        );
        this.broadcast({
          type: "presence-updated",
          clientId: sender.id,
          presence: this.presence[sender.id],
        });
        break;
      }

      case "update-room-state": {
        this.roomState = deepMerge(this.roomState, msg.roomState);
        this.broadcast({
          type: "room-state-updated",
          roomState: this.roomState,
        });
        break;
      }

      case "request-presence-update": {
        const targetConn = this.getConnection(msg.targetClientId);
        if (targetConn) {
          this.send(targetConn, {
            type: "presence-update-request",
            update: msg.update,
            fromClientId: sender.id,
          });
        }
        break;
      }

      case "broadcast-event": {
        const { echo = true, type: eventType, ...rest } = msg.event;
        const eventData = {
          type: eventType,
          clientId: sender.id,
          username: senderInfo.username,
          ...rest,
        };
        const exclude = echo ? [] : [sender.id];
        this.broadcast({ type: "event", data: eventData }, exclude);
        break;
      }
    }
  }

  onClose(conn: Party.Connection) {
    const peerInfo = this.peers.get(conn.id);
    if (!peerInfo) return;

    // Remove from peers and presence
    this.peers.delete(conn.id);
    delete this.presence[conn.id];

    // Broadcast peer-left (client synthesizes the "disconnected" event from this)
    this.broadcast({
      type: "peer-left",
      clientId: conn.id,
    });
  }

  // --- Helpers ---

  private send(conn: Party.Connection, msg: ServerToClientMessage) {
    conn.send(JSON.stringify(msg));
  }

  private broadcast(msg: ServerToClientMessage, exclude: string[] = []) {
    const raw = JSON.stringify(msg);
    for (const conn of this.room.getConnections()) {
      if (!exclude.includes(conn.id)) {
        conn.send(raw);
      }
    }
  }

  private getConnection(id: string): Party.Connection | undefined {
    for (const conn of this.room.getConnections()) {
      if (conn.id === id) return conn;
    }
    return undefined;
  }
}

WebsimServer satisfies Party.Worker;
