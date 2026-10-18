"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var utils = __toESM(require("@iobroker/adapter-core"));
var import_ma_client = require("./lib/ma-client");
function sanitizeId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}
class MusicAssistant extends utils.Adapter {
  client = null;
  playerIds = /* @__PURE__ */ new Map();
  // sanitized -> raw player_id
  queueIds = /* @__PURE__ */ new Map();
  // sanitized -> raw queue_id
  knownPlayerObjects = /* @__PURE__ */ new Set();
  knownQueueObjects = /* @__PURE__ */ new Set();
  constructor(options = {}) {
    super({
      ...options,
      name: "music-assistant"
    });
    this.on("ready", this.onReady.bind(this));
    this.on("stateChange", this.onStateChange.bind(this));
    this.on("unload", this.onUnload.bind(this));
  }
  async onReady() {
    var _a, _b;
    await this.setState("info.connection", false, true);
    const host = (_a = this.config.host) == null ? void 0 : _a.trim();
    const port = Number(this.config.port) || 8095;
    const token = (_b = this.config.token) == null ? void 0 : _b.trim();
    if (!host || !token) {
      this.log.error("Music Assistant host and API token must be configured in the adapter settings");
      return;
    }
    this.subscribeStates("players.*.control.*");
    this.subscribeStates("players.*.powered");
    this.subscribeStates("players.*.volume");
    this.subscribeStates("players.*.muted");
    this.subscribeStates("queues.*.control.*");
    this.subscribeStates("queues.*.shuffleEnabled");
    this.subscribeStates("queues.*.repeatMode");
    const client = new import_ma_client.MaClient(host, port, token, {
      setTimeout: (cb, ms) => this.setTimeout(cb, ms),
      clearTimeout: (timer) => this.clearTimeout(timer)
    });
    this.client = client;
    client.on("connected", () => {
      this.log.info("Connected to Music Assistant server");
      void this.setState("info.connection", true, true);
      this.syncAll().catch((err) => this.log.error(`Initial sync failed: ${err.message}`));
    });
    client.on("disconnected", () => {
      this.log.warn("Lost connection to Music Assistant server, will keep retrying");
      void this.setState("info.connection", false, true);
    });
    client.on("error", (err) => this.log.debug(`Music Assistant client error: ${err.message}`));
    client.on("event", (evt) => {
      this.handleEvent(evt).catch(
        (err) => this.log.error(`Failed to handle event ${evt.event}: ${err.message}`)
      );
    });
    try {
      await client.connect();
    } catch (err) {
      this.log.warn(`Could not connect to Music Assistant server: ${err.message}`);
    }
  }
  async syncAll() {
    if (!this.client) {
      return;
    }
    const players = await this.client.sendCommand("players/all");
    for (const player of players) {
      await this.applyPlayer(player);
    }
    const queues = await this.client.sendCommand("player_queues/all");
    for (const queue of queues) {
      await this.applyQueue(queue);
    }
  }
  async handleEvent(evt) {
    switch (evt.event) {
      case "player_added":
      case "player_updated":
        await this.applyPlayer(evt.data);
        break;
      case "queue_added":
      case "queue_updated":
        await this.applyQueue(evt.data);
        break;
      case "queue_time_updated": {
        const safeId = sanitizeId(evt.object_id);
        const data = evt.data;
        if (data && typeof data.elapsed_time === "number" && this.queueIds.has(safeId)) {
          await this.setState(`queues.${safeId}.elapsedTime`, data.elapsed_time, true);
        }
        break;
      }
      default:
        break;
    }
  }
  // ---------- Players ----------
  async ensurePlayerObjects(safeId, name) {
    if (this.knownPlayerObjects.has(safeId)) {
      return;
    }
    this.knownPlayerObjects.add(safeId);
    const base = `players.${safeId}`;
    await this.setObjectNotExistsAsync(base, {
      type: "channel",
      common: { name },
      native: {}
    });
    const states = {
      playerId: { name: "Player ID", type: "string", role: "text", read: true, write: false },
      name: { name: "Name", type: "string", role: "text", read: true, write: false },
      available: { name: "Available", type: "boolean", role: "indicator.reachable", read: true, write: false },
      powered: { name: "Powered", type: "boolean", role: "switch.power", read: true, write: true },
      playbackState: { name: "Playback state", type: "string", role: "media.state", read: true, write: false },
      volume: { name: "Volume", type: "number", role: "level.volume", min: 0, max: 100, read: true, write: true },
      muted: { name: "Muted", type: "boolean", role: "media.mute", read: true, write: true },
      activeSource: { name: "Active source", type: "string", role: "text", read: true, write: false },
      queueId: { name: "Queue ID", type: "string", role: "text", read: true, write: false },
      elapsedTime: {
        name: "Elapsed time",
        type: "number",
        role: "media.elapsed",
        unit: "s",
        read: true,
        write: false
      },
      mediaTitle: { name: "Title", type: "string", role: "media.title", read: true, write: false },
      mediaArtist: { name: "Artist", type: "string", role: "media.artist", read: true, write: false },
      mediaAlbum: { name: "Album", type: "string", role: "media.album", read: true, write: false },
      mediaImage: { name: "Cover image URL", type: "string", role: "media.cover", read: true, write: false }
    };
    for (const [key, common] of Object.entries(states)) {
      await this.setObjectNotExistsAsync(`${base}.${key}`, {
        type: "state",
        common: { ...common, def: common.type === "boolean" ? false : common.type === "number" ? 0 : "" },
        native: {}
      });
    }
    await this.setObjectNotExistsAsync(`${base}.control`, {
      type: "channel",
      common: { name: "Control" },
      native: {}
    });
    const buttons = ["play", "pause", "playPause", "stop", "next", "previous"];
    for (const btn of buttons) {
      await this.setObjectNotExistsAsync(`${base}.control.${btn}`, {
        type: "state",
        common: { name: btn, type: "boolean", role: "button", read: false, write: true, def: false },
        native: {}
      });
    }
  }
  async applyPlayer(player) {
    var _a, _b, _c, _d, _e, _f, _g, _h;
    const safeId = sanitizeId(player.player_id);
    this.playerIds.set(safeId, player.player_id);
    await this.ensurePlayerObjects(safeId, player.name);
    const base = `players.${safeId}`;
    await this.setState(`${base}.playerId`, player.player_id, true);
    await this.setState(`${base}.name`, player.name, true);
    await this.setState(`${base}.available`, !!player.available, true);
    await this.setState(`${base}.powered`, !!player.powered, true);
    await this.setState(`${base}.playbackState`, player.playback_state, true);
    await this.setState(`${base}.volume`, (_a = player.volume_level) != null ? _a : 0, true);
    await this.setState(`${base}.muted`, !!player.volume_muted, true);
    await this.setState(`${base}.activeSource`, (_b = player.active_source) != null ? _b : "", true);
    const media = player.current_media;
    await this.setState(`${base}.mediaTitle`, (_c = media == null ? void 0 : media.title) != null ? _c : "", true);
    await this.setState(`${base}.mediaArtist`, (_d = media == null ? void 0 : media.artist) != null ? _d : "", true);
    await this.setState(`${base}.mediaAlbum`, (_e = media == null ? void 0 : media.album) != null ? _e : "", true);
    await this.setState(`${base}.mediaImage`, (_f = media == null ? void 0 : media.image_url) != null ? _f : "", true);
    await this.setState(`${base}.elapsedTime`, (_h = (_g = player.elapsed_time) != null ? _g : media == null ? void 0 : media.elapsed_time) != null ? _h : 0, true);
  }
  // ---------- Player queues ----------
  async ensureQueueObjects(safeId, name) {
    if (this.knownQueueObjects.has(safeId)) {
      return;
    }
    this.knownQueueObjects.add(safeId);
    const base = `queues.${safeId}`;
    await this.setObjectNotExistsAsync(base, {
      type: "channel",
      common: { name },
      native: {}
    });
    const states = {
      queueId: { name: "Queue ID", type: "string", role: "text", read: true, write: false },
      displayName: { name: "Display name", type: "string", role: "text", read: true, write: false },
      available: { name: "Available", type: "boolean", role: "indicator.reachable", read: true, write: false },
      state: { name: "State", type: "string", role: "media.state", read: true, write: false },
      shuffleEnabled: { name: "Shuffle", type: "boolean", role: "media.mode.shuffle", read: true, write: true },
      repeatMode: {
        name: "Repeat mode",
        type: "string",
        role: "media.mode.repeat",
        read: true,
        write: true,
        states: { off: "off", one: "one", all: "all" }
      },
      elapsedTime: {
        name: "Elapsed time",
        type: "number",
        role: "media.elapsed",
        unit: "s",
        read: true,
        write: false
      },
      currentItemName: { name: "Current item", type: "string", role: "media.title", read: true, write: false }
    };
    for (const [key, common] of Object.entries(states)) {
      await this.setObjectNotExistsAsync(`${base}.${key}`, {
        type: "state",
        common: { ...common, def: common.type === "boolean" ? false : common.type === "number" ? 0 : "" },
        native: {}
      });
    }
    await this.setObjectNotExistsAsync(`${base}.control`, {
      type: "channel",
      common: { name: "Control" },
      native: {}
    });
    const buttons = ["play", "pause", "playPause", "stop", "next", "previous"];
    for (const btn of buttons) {
      await this.setObjectNotExistsAsync(`${base}.control.${btn}`, {
        type: "state",
        common: { name: btn, type: "boolean", role: "button", read: false, write: true, def: false },
        native: {}
      });
    }
  }
  async applyQueue(queue) {
    var _a, _b, _c;
    const safeId = sanitizeId(queue.queue_id);
    this.queueIds.set(safeId, queue.queue_id);
    await this.ensureQueueObjects(safeId, queue.display_name);
    const base = `queues.${safeId}`;
    await this.setState(`${base}.queueId`, queue.queue_id, true);
    await this.setState(`${base}.displayName`, queue.display_name, true);
    await this.setState(`${base}.available`, !!queue.available, true);
    await this.setState(`${base}.state`, queue.state, true);
    await this.setState(`${base}.shuffleEnabled`, !!queue.shuffle_enabled, true);
    await this.setState(`${base}.repeatMode`, queue.repeat_mode, true);
    await this.setState(`${base}.elapsedTime`, (_a = queue.elapsed_time) != null ? _a : 0, true);
    await this.setState(`${base}.currentItemName`, (_c = (_b = queue.current_item) == null ? void 0 : _b.name) != null ? _c : "", true);
  }
  // ---------- Command dispatch ----------
  async onStateChange(id, state) {
    if (!state || state.ack !== false || !this.client) {
      return;
    }
    const relative = id.substring(this.namespace.length + 1);
    const parts = relative.split(".");
    try {
      if (parts[0] === "players" && parts.length >= 3) {
        await this.handlePlayerCommand(parts[1], parts.slice(2), state);
      } else if (parts[0] === "queues" && parts.length >= 3) {
        await this.handleQueueCommand(parts[1], parts.slice(2), state);
      }
      await this.setState(id, state.val, true);
    } catch (err) {
      this.log.error(`Command for ${id} failed: ${err.message}`);
    }
  }
  async handlePlayerCommand(safeId, path, state) {
    const playerId = this.playerIds.get(safeId);
    if (!playerId || !this.client) {
      return;
    }
    if (path[0] === "control" && path[1]) {
      const cmdByButton = {
        play: "players/cmd/play",
        pause: "players/cmd/pause",
        playPause: "players/cmd/play_pause",
        stop: "players/cmd/stop",
        next: "players/cmd/next",
        previous: "players/cmd/previous"
      };
      const command = cmdByButton[path[1]];
      if (command) {
        await this.client.sendCommand(command, { player_id: playerId });
      }
      return;
    }
    if (path[0] === "powered") {
      await this.client.sendCommand("players/cmd/power", { player_id: playerId, powered: !!state.val });
    } else if (path[0] === "volume") {
      await this.client.sendCommand("players/cmd/volume_set", {
        player_id: playerId,
        volume_level: Number(state.val)
      });
    } else if (path[0] === "muted") {
      await this.client.sendCommand("players/cmd/volume_mute", { player_id: playerId, muted: !!state.val });
    }
  }
  async handleQueueCommand(safeId, path, state) {
    const queueId = this.queueIds.get(safeId);
    if (!queueId || !this.client) {
      return;
    }
    if (path[0] === "control" && path[1]) {
      const cmdByButton = {
        play: "player_queues/play",
        pause: "player_queues/pause",
        playPause: "player_queues/play_pause",
        stop: "player_queues/stop",
        next: "player_queues/next",
        previous: "player_queues/previous"
      };
      const command = cmdByButton[path[1]];
      if (command) {
        await this.client.sendCommand(command, { queue_id: queueId });
      }
      return;
    }
    if (path[0] === "shuffleEnabled") {
      await this.client.sendCommand("player_queues/shuffle", { queue_id: queueId, shuffle_enabled: !!state.val });
    } else if (path[0] === "repeatMode") {
      await this.client.sendCommand("player_queues/repeat", { queue_id: queueId, repeat_mode: state.val });
    }
  }
  onUnload(callback) {
    var _a;
    try {
      (_a = this.client) == null ? void 0 : _a.close();
      this.client = null;
      callback();
    } catch (error) {
      this.log.error(`Error during unloading: ${error.message}`);
      callback();
    }
  }
}
if (require.main !== module) {
  module.exports = (options) => new MusicAssistant(options);
} else {
  (() => new MusicAssistant())();
}
//# sourceMappingURL=main.js.map
