import PartySocket from "partysocket";
import { deepMerge } from "../shared/deep-merge";
import type {
  ClientToServerMessage,
  ServerToClientMessage,
} from "../shared/protocol";

export interface WebsimSocketOptions {
  host?: string;
  room?: string;
  username?: string;
  avatarUrl?: string;
}

type PresenceCallback = (presence: Record<string, any>) => void;
type RoomStateCallback = (roomState: Record<string, any>) => void;
type PresenceUpdateRequestCallback = (
  updateRequest: Record<string, any>,
  fromClientId: string
) => void;
type MessageHandler = (event: { data: Record<string, any> }) => void;

export class WebsimSocket {
  private _presence: Record<string, any> = {};
  private _roomState: Record<string, any> = {};
  private _peers: Record<string, { username: string; avatarUrl: string }> = {};
  private _clientId: string = "";

  private socket: PartySocket | null = null;
  private presenceSubscribers: Set<PresenceCallback> = new Set();
  private roomStateSubscribers: Set<RoomStateCallback> = new Set();
  private presenceUpdateRequestSubscribers: Set<PresenceUpdateRequestCallback> =
    new Set();

  private options: WebsimSocketOptions;

  onmessage: MessageHandler | null = null;

  constructor(options?: WebsimSocketOptions) {
    this.options = options || {};
  }

  // --- Readonly properties ---

  get presence(): Record<string, any> {
    return this._presence;
  }

  get roomState(): Record<string, any> {
    return this._roomState;
  }

  get peers(): Record<string, { username: string; avatarUrl: string }> {
    return this._peers;
  }

  get clientId(): string {
    return this._clientId;
  }

  // --- Initialization ---

  async initialize(): Promise<void> {
    const host = this.options.host || `localhost:1999`;
    const room = this.options.room || this.getRoomFromUrl();
    const username =
      this.options.username ||
      `Guest-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const avatarUrl =
      this.options.avatarUrl || "";

    const query = () => ({
      username,
      avatarUrl,
    });

    this.socket = new PartySocket({
      host,
      room,
      query,
    });

    return new Promise<void>((resolve, reject) => {
      const cleanup = (err: unknown) => {
        this.socket?.close();
        this.socket = null;
        reject(err);
      };

      const timeout = setTimeout(() => {
        cleanup(new Error("WebsimSocket: initialization timed out"));
      }, 10000);

      this.socket!.addEventListener("message", (event: MessageEvent) => {
        let msg: ServerToClientMessage;
        try {
          msg = JSON.parse(event.data);
        } catch {
          return;
        }

        if (msg.type === "init") {
          this._clientId = msg.clientId;
          this._roomState = msg.roomState;
          this._presence = msg.presence;
          this._peers = msg.peers;
          clearTimeout(timeout);
          resolve();
          return;
        }

        this.handleMessage(msg);
      });

      this.socket!.addEventListener("error", (err) => {
        clearTimeout(timeout);
        cleanup(err);
      });
    });
  }

  // --- State update methods ---

  updatePresence(presence: Record<string, any>): void {
    // Optimistic local update
    this._presence[this._clientId] = deepMerge(
      this._presence[this._clientId] || {},
      presence
    );
    this.sendToServer({
      type: "update-presence",
      presence,
    });
  }

  updateRoomState(roomState: Record<string, any>): void {
    this.sendToServer({
      type: "update-room-state",
      roomState,
    });
  }

  requestPresenceUpdate(
    clientId: string,
    update: Record<string, any>
  ): void {
    this.sendToServer({
      type: "request-presence-update",
      targetClientId: clientId,
      update,
    });
  }

  // --- Subscribe methods ---

  subscribePresence(callback: PresenceCallback): () => void {
    this.presenceSubscribers.add(callback);
    return () => {
      this.presenceSubscribers.delete(callback);
    };
  }

  subscribeRoomState(callback: RoomStateCallback): () => void {
    this.roomStateSubscribers.add(callback);
    return () => {
      this.roomStateSubscribers.delete(callback);
    };
  }

  subscribePresenceUpdateRequests(
    callback: PresenceUpdateRequestCallback
  ): () => void {
    this.presenceUpdateRequestSubscribers.add(callback);
    return () => {
      this.presenceUpdateRequestSubscribers.delete(callback);
    };
  }

  // --- Event methods ---

  send(event: { type: string; echo?: boolean; [key: string]: any }): void {
    this.sendToServer({
      type: "broadcast-event",
      event,
    });
  }

  // --- Internal ---

  private handleMessage(msg: ServerToClientMessage): void {
    switch (msg.type) {
      case "presence-updated": {
        this._presence[msg.clientId] = msg.presence;
        for (const cb of this.presenceSubscribers) {
          cb(this._presence);
        }
        break;
      }

      case "room-state-updated": {
        this._roomState = msg.roomState;
        for (const cb of this.roomStateSubscribers) {
          cb(this._roomState);
        }
        break;
      }

      case "presence-update-request": {
        for (const cb of this.presenceUpdateRequestSubscribers) {
          cb(msg.update, msg.fromClientId);
        }
        break;
      }

      case "peer-joined": {
        this._peers[msg.clientId] = {
          username: msg.username,
          avatarUrl: msg.avatarUrl,
        };
        // Fire onmessage with "connected" event
        this.onmessage?.({
          data: {
            type: "connected",
            clientId: msg.clientId,
            username: msg.username,
          },
        });
        break;
      }

      case "peer-left": {
        const peerInfo = this._peers[msg.clientId];
        delete this._peers[msg.clientId];
        delete this._presence[msg.clientId];
        // Fire onmessage with "disconnected" event
        this.onmessage?.({
          data: {
            type: "disconnected",
            clientId: msg.clientId,
            username: peerInfo?.username || "",
          },
        });
        // Notify presence subscribers since a peer's presence was removed
        for (const cb of this.presenceSubscribers) {
          cb(this._presence);
        }
        break;
      }

      case "event": {
        this.onmessage?.({ data: msg.data });
        break;
      }
    }
  }

  private sendToServer(msg: ClientToServerMessage): void {
    if (this.socket && this.socket.readyState === WebSocket.OPEN) {
      this.socket.send(JSON.stringify(msg));
    }
  }

  private getRoomFromUrl(): string {
    if (typeof window !== "undefined") {
      const path = window.location.pathname.replace(/^\/+|\/+$/g, "");
      return path || "default";
    }
    return "default";
  }
}
