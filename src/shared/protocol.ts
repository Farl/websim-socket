// ============================================================
// Client → Server messages
// ============================================================

export interface UpdatePresenceMessage {
  type: "update-presence";
  presence: Record<string, any>;
}

export interface UpdateRoomStateMessage {
  type: "update-room-state";
  roomState: Record<string, any>;
}

export interface RequestPresenceUpdateMessage {
  type: "request-presence-update";
  targetClientId: string;
  update: Record<string, any>;
}

export interface BroadcastEventMessage {
  type: "broadcast-event";
  event: {
    type: string;
    echo?: boolean;
    [key: string]: any;
  };
}

export type ClientToServerMessage =
  | UpdatePresenceMessage
  | UpdateRoomStateMessage
  | RequestPresenceUpdateMessage
  | BroadcastEventMessage;

// ============================================================
// Server → Client messages
// ============================================================

export interface InitMessage {
  type: "init";
  clientId: string;
  roomState: Record<string, any>;
  presence: Record<string, Record<string, any>>;
  peers: Record<string, { username: string; avatarUrl: string }>;
}

export interface PresenceUpdatedMessage {
  type: "presence-updated";
  clientId: string;
  presence: Record<string, any>;
}

export interface RoomStateUpdatedMessage {
  type: "room-state-updated";
  roomState: Record<string, any>;
}

export interface PresenceUpdateRequestMessage {
  type: "presence-update-request";
  update: Record<string, any>;
  fromClientId: string;
}

export interface PeerJoinedMessage {
  type: "peer-joined";
  clientId: string;
  username: string;
  avatarUrl: string;
}

export interface PeerLeftMessage {
  type: "peer-left";
  clientId: string;
}

export interface EventMessage {
  type: "event";
  data: {
    type: string;
    clientId: string;
    username: string;
    [key: string]: any;
  };
}

export type ServerToClientMessage =
  | InitMessage
  | PresenceUpdatedMessage
  | RoomStateUpdatedMessage
  | PresenceUpdateRequestMessage
  | PeerJoinedMessage
  | PeerLeftMessage
  | EventMessage;
