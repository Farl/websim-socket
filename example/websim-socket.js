import PartySocket from "partysocket";

function deepMerge(target, source) {
  const result = { ...target };
  for (const key of Object.keys(source)) {
    if (source[key] === null) {
      delete result[key];
    } else if (
      typeof source[key] === "object" &&
      !Array.isArray(source[key]) &&
      typeof result[key] === "object" &&
      !Array.isArray(result[key]) &&
      result[key] !== null
    ) {
      result[key] = deepMerge(result[key], source[key]);
    } else {
      result[key] = source[key];
    }
  }
  return result;
}

export class WebsimSocket {
  _presence = {};
  _roomState = {};
  _peers = {};
  _clientId = "";
  _socket = null;
  _presenceSubs = new Set();
  _roomStateSubs = new Set();
  _presenceUpdateRequestSubs = new Set();
  onmessage = null;

  constructor(options = {}) {
    this._options = options;
  }

  get presence() { return this._presence; }
  get roomState() { return this._roomState; }
  get peers() { return this._peers; }
  get clientId() { return this._clientId; }

  async initialize() {
    const host = this._options.host || window.location.host;
    const room = this._options.room || window.location.pathname.replace(/^\/+/, "") || "default";
    const username = this._options.username || `Guest-${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    const avatarUrl = this._options.avatarUrl || "";

    this._socket = new PartySocket({
      host,
      room,
      query: () => ({ username, avatarUrl }),
    });

    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("Timeout")), 10000);

      this._socket.addEventListener("message", (event) => {
        let msg;
        try { msg = JSON.parse(event.data); } catch { return; }

        if (msg.type === "init") {
          this._clientId = msg.clientId;
          this._roomState = msg.roomState;
          this._presence = msg.presence;
          this._peers = msg.peers;
          clearTimeout(timeout);
          resolve();
          return;
        }
        this._handleMessage(msg);
      });

      this._socket.addEventListener("error", (err) => {
        clearTimeout(timeout);
        reject(err);
      });
    });
  }

  updatePresence(presence) {
    this._presence[this._clientId] = deepMerge(this._presence[this._clientId] || {}, presence);
    this._send({ type: "update-presence", presence });
  }

  updateRoomState(roomState) {
    this._send({ type: "update-room-state", roomState });
  }

  requestPresenceUpdate(clientId, update) {
    this._send({ type: "request-presence-update", targetClientId: clientId, update });
  }

  subscribePresence(cb) {
    this._presenceSubs.add(cb);
    return () => this._presenceSubs.delete(cb);
  }

  subscribeRoomState(cb) {
    this._roomStateSubs.add(cb);
    return () => this._roomStateSubs.delete(cb);
  }

  subscribePresenceUpdateRequests(cb) {
    this._presenceUpdateRequestSubs.add(cb);
    return () => this._presenceUpdateRequestSubs.delete(cb);
  }

  send(event) {
    this._send({ type: "broadcast-event", event });
  }

  _handleMessage(msg) {
    switch (msg.type) {
      case "presence-updated":
        this._presence[msg.clientId] = msg.presence;
        for (const cb of this._presenceSubs) cb(this._presence);
        break;
      case "room-state-updated":
        this._roomState = msg.roomState;
        for (const cb of this._roomStateSubs) cb(this._roomState);
        break;
      case "presence-update-request":
        for (const cb of this._presenceUpdateRequestSubs) cb(msg.update, msg.fromClientId);
        break;
      case "peer-joined":
        this._peers[msg.clientId] = { username: msg.username, avatarUrl: msg.avatarUrl };
        this.onmessage?.({ data: { type: "connected", clientId: msg.clientId, username: msg.username } });
        break;
      case "peer-left": {
        const info = this._peers[msg.clientId];
        delete this._peers[msg.clientId];
        delete this._presence[msg.clientId];
        this.onmessage?.({ data: { type: "disconnected", clientId: msg.clientId, username: info?.username || "" } });
        for (const cb of this._presenceSubs) cb(this._presence);
        break;
      }
      case "event":
        this.onmessage?.({ data: msg.data });
        break;
    }
  }

  _send(msg) {
    if (this._socket && this._socket.readyState === WebSocket.OPEN) {
      this._socket.send(JSON.stringify(msg));
    }
  }
}
