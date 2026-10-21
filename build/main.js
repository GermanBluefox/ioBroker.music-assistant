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
var import_objects = require("./lib/objects");
const DOCKER_PORT = 8095;
const DOCKER_USED_PORTS = [DOCKER_PORT, 8097];
const MIN_PASSWORD_LENGTH = 8;
const USED_RESOURCES_FEATURE = "CONTROLLER_USED_RESOURCES";
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
    var _a, _b, _c, _d;
    if (await this.updateWebUiLink()) {
      this.log.info("The link to the Music Assistant web interface was updated, the instance restarts");
      return;
    }
    await this.setState("info.connection", false, true);
    const docker = !!((_a = this.config.dockerMusicAssistant) == null ? void 0 : _a.enabled);
    const host = (docker ? "127.0.0.1" : (_b = this.config.host) == null ? void 0 : _b.trim()) || "";
    const port = docker ? DOCKER_PORT : Number(this.config.port) || 8095;
    const token = docker ? void 0 : (_c = this.config.token) == null ? void 0 : _c.trim();
    const username = (_d = this.config.username) == null ? void 0 : _d.trim();
    const password = this.config.password;
    if (docker) {
      void this.reportUsedPorts();
      if (!username || !password || password.length < MIN_PASSWORD_LENGTH) {
        this.log.error(
          `Music Assistant runs in Docker: enter a username and a password with at least ${MIN_PASSWORD_LENGTH} characters in the adapter settings`
        );
        return;
      }
    } else if (!host || !token && !(username && password)) {
      this.log.error(
        "Music Assistant host and an API token or username/password must be configured in the adapter settings"
      );
      return;
    }
    await this.extendObjectAsync("players", { type: "folder", common: { name: "Players" }, native: {} });
    await this.extendObjectAsync("queues", { type: "folder", common: { name: "Queues" }, native: {} });
    this.subscribeStates("players.*");
    this.subscribeStates("queues.*");
    const client = new import_ma_client.MaClient(
      host,
      port,
      { token, username, password, setupIfNeeded: docker },
      {
        setTimeout: (cb, ms) => this.setTimeout(cb, ms),
        clearTimeout: (timer) => this.clearTimeout(timer)
      }
    );
    this.client = client;
    client.on(
      "setupDone",
      (user) => this.log.info(
        `Created the admin user "${user}" in Music Assistant. Log in with it at http://<ioBroker-host>:${DOCKER_PORT} to finish the setup (music sources, player providers)`
      )
    );
    client.on("authFailed", (err) => {
      this.log.error(`${err.message}. Correct the credentials in the adapter settings`);
      void this.setState("info.connection", false, true);
    });
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
      if (!(err instanceof import_ma_client.MaAuthError)) {
        this.log.warn(`Could not connect to Music Assistant server: ${err.message}`);
      }
    }
  }
  /**
   * Shows the web interface of the Music Assistant running in Docker as link on the intro page and
   * in the instance list of admin. Admin cannot hide a link depending on the configuration, so the
   * link is written into `common.localLinks` of the instance.
   *
   * @returns true if the instance object was changed - js-controller restarts the instance then
   */
  async updateWebUiLink() {
    var _a;
    const instanceObj = await this.getForeignObjectAsync(`system.adapter.${this.namespace}`);
    if (!(instanceObj == null ? void 0 : instanceObj.common)) {
      return false;
    }
    const localLinks = { ...instanceObj.common.localLinks || {} };
    let link;
    if ((_a = this.config.dockerMusicAssistant) == null ? void 0 : _a.enabled) {
      link = {
        // `%ip%` lets admin find the address of the host that is reachable from the browser
        link: `http://%ip%:${DOCKER_PORT}/`,
        name: "Music Assistant",
        description: {
          en: "Web interface of Music Assistant running in Docker",
          de: "Weboberfl\xE4che des in Docker laufenden Music Assistant",
          ru: "\u0412\u0435\u0431-\u0438\u043D\u0442\u0435\u0440\u0444\u0435\u0439\u0441 Music Assistant, \u0440\u0430\u0431\u043E\u0442\u0430\u044E\u0449\u0435\u0433\u043E \u0432 Docker"
        },
        color: "#03A9F4",
        intro: true
      };
    }
    if (JSON.stringify(localLinks.webUi) === JSON.stringify(link)) {
      return false;
    }
    if (link) {
      localLinks.webUi = link;
    } else {
      delete localLinks.webUi;
    }
    if (Object.keys(localLinks).length) {
      instanceObj.common.localLinks = localLinks;
    } else {
      delete instanceObj.common.localLinks;
    }
    try {
      await this.setForeignObjectAsync(instanceObj._id, instanceObj);
    } catch (err) {
      this.log.warn(`Cannot update the link to the Music Assistant web interface: ${err.message}`);
      return false;
    }
    return true;
  }
  /**
   * Whether the used ports may be reported to the registry of js-controller 8.
   * A host without the feature never answers, so every call would sit out the timeout of the adapter API.
   */
  canReportUsedResources() {
    const api = this;
    if (typeof api.registerUsedResource !== "function" || typeof api.checkUsedResource !== "function") {
      this.log.debug("Used ports are not reported: js-controller is older than 8");
      return false;
    }
    if (typeof api.supportsFeature !== "function" || !api.supportsFeature(USED_RESOURCES_FEATURE)) {
      this.log.debug(`Used ports are not reported: js-controller does not support "${USED_RESOURCES_FEATURE}"`);
      return false;
    }
    return true;
  }
  /**
   * Reports the ports of the Music Assistant container to js-controller (>= 8), so they show up as
   * occupied by this instance, and warns if another instance already holds one of them.
   * Without Docker the adapter occupies no port: `native.port` is the port of a remote server, which is
   * why `common.declareUsedResources` is set and js-controller does not derive an entry from it.
   */
  async reportUsedPorts() {
    if (!this.canReportUsedResources()) {
      return;
    }
    const api = this;
    for (const port of DOCKER_USED_PORTS) {
      try {
        const holders = await api.checkUsedResource("tcpPort", { port });
        if (holders.length) {
          this.log.warn(
            `Port ${port} is already used by ${holders.map((h) => h.instance).join(", ")}. Music Assistant in Docker will probably not work.`
          );
        }
      } catch (err) {
        this.log.debug(`Cannot check if port ${port} is free: ${err.message}`);
      }
      try {
        await api.registerUsedResource("tcpPort", { port });
      } catch (err) {
        this.log.warn(`Cannot register port ${port} as used: ${err.message}`);
      }
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
    await this.removeDeletedPlayers(players, queues);
  }
  /**
   * Removes the players (and their queues) that were deleted in Music Assistant while the adapter was not
   * connected. `players/all` alone is not enough: right after a restart of Music Assistant it lacks the
   * players whose provider has not registered them yet. Only a player without a configuration is gone for
   * good - Music Assistant deletes the configuration when a player is removed.
   *
   * @param players what `players/all` returned
   * @param queues what `player_queues/all` returned
   */
  async removeDeletedPlayers(players, queues) {
    if (!this.client) {
      return;
    }
    let configs;
    try {
      configs = await this.client.sendCommand("config/players");
    } catch (err) {
      this.log.debug(`Cannot read the player configurations, no clean-up: ${err.message}`);
      return;
    }
    const keep = new Set([...players, ...configs].map((p) => sanitizeId(p.player_id)));
    await this.removeStaleChannels("players", keep);
    for (const queue of queues) {
      keep.add(sanitizeId(queue.queue_id));
    }
    await this.removeStaleChannels("queues", keep);
  }
  /**
   * Deletes the channels below `players` or `queues` whose player or queue Music Assistant no longer reports.
   *
   * @param folder `players` or `queues`
   * @param keep the sanitized ids that still exist
   */
  async removeStaleChannels(folder, keep) {
    const channels = await this.getForeignObjectsAsync(`${this.namespace}.${folder}.*`, "channel");
    const prefix = `${this.namespace}.${folder}.`;
    const stale = /* @__PURE__ */ new Set();
    for (const id of Object.keys(channels)) {
      const safeId = id.substring(prefix.length).split(".")[0];
      if (safeId && !keep.has(safeId)) {
        stale.add(safeId);
      }
    }
    for (const safeId of stale) {
      this.log.info(`Removing ${folder}.${safeId}: no longer known to Music Assistant`);
      await this.removeChannel(folder, safeId);
    }
  }
  /**
   * Deletes a player or queue channel with everything below it and forgets it.
   *
   * @param folder `players` or `queues`
   * @param safeId sanitized id of the player or queue
   */
  async removeChannel(folder, safeId) {
    if (folder === "players") {
      this.playerIds.delete(safeId);
      this.knownPlayerObjects.delete(safeId);
    } else {
      this.queueIds.delete(safeId);
      this.knownQueueObjects.delete(safeId);
    }
    try {
      await this.delObjectAsync(`${folder}.${safeId}`, { recursive: true });
    } catch (err) {
      this.log.warn(`Cannot delete ${folder}.${safeId}: ${err.message}`);
    }
  }
  async handleEvent(evt) {
    switch (evt.event) {
      case "player_added":
      case "player_updated":
        await this.applyPlayer(evt.data);
        break;
      case "player_removed": {
        const safeId = sanitizeId(evt.object_id);
        this.log.info(`Player ${evt.object_id} was removed from Music Assistant`);
        await this.removeChannel("players", safeId);
        await this.removeChannel("queues", safeId);
        break;
      }
      case "queue_added":
      case "queue_updated":
        await this.applyQueue(evt.data);
        break;
      case "queue_time_updated": {
        const safeId = sanitizeId(evt.object_id);
        const data = evt.data;
        if (data && typeof data.elapsed_time === "number") {
          if (this.queueIds.has(safeId)) {
            await this.setStateChangedAsync(`queues.${safeId}.elapsedTime`, data.elapsed_time, true);
          }
          if (this.playerIds.has(safeId)) {
            await this.setStateChangedAsync(`players.${safeId}.elapsedTime`, data.elapsed_time, true);
          }
        }
        break;
      }
      default:
        break;
    }
  }
  // ---------- Objects ----------
  /**
   * Creates or updates the objects of one player or queue. `extendObject` is used instead of
   * `setObjectNotExists`, so that a changed definition (role, type, states) reaches existing installations.
   *
   * @param base id of the channel, e.g. `players.<id>`
   * @param name name of the channel
   * @param channelRole role of the channel
   * @param states the states directly in the channel
   * @param buttons the buttons
   * @param buttonChannel id of the sub-channel of the buttons, relative to `base`, or `''`
   */
  async writeChannelObjects(base, name, channelRole, states, buttons, buttonChannel) {
    await this.extendObjectAsync(base, {
      type: "channel",
      common: channelRole ? { name, role: channelRole } : { name },
      native: {}
    });
    for (const [key, common] of Object.entries(states)) {
      await this.extendObjectAsync(`${base}.${key}`, {
        type: "state",
        common: { ...common, def: (0, import_objects.defaultValue)(common) },
        native: {}
      });
    }
    const buttonBase = buttonChannel ? `${base}.${buttonChannel}` : base;
    if (buttonChannel) {
      await this.extendObjectAsync(buttonBase, { type: "channel", common: { name: "Control" }, native: {} });
    }
    for (const [key, btn] of Object.entries(buttons)) {
      await this.extendObjectAsync(`${buttonBase}.${key}`, {
        type: "state",
        common: { name: btn.name, type: "boolean", role: btn.role, read: false, write: true, def: false },
        native: {}
      });
    }
  }
  // ---------- Players ----------
  async ensurePlayerObjects(safeId, name) {
    if (this.knownPlayerObjects.has(safeId)) {
      return;
    }
    this.knownPlayerObjects.add(safeId);
    const base = `players.${safeId}`;
    if (await this.getObjectAsync(`${base}.control`)) {
      this.log.info(`Moving the buttons of ${base} from "control" into the player channel`);
      await this.delObjectAsync(`${base}.control`, { recursive: true });
    }
    await this.writeChannelObjects(base, name, "media.music", import_objects.PLAYER_STATES, import_objects.PLAYER_BUTTONS, "");
  }
  async applyPlayer(player) {
    var _a, _b, _c, _d, _e, _f, _g, _h, _i, _j;
    const safeId = sanitizeId(player.player_id);
    this.playerIds.set(safeId, player.player_id);
    await this.ensurePlayerObjects(safeId, player.name);
    const base = `players.${safeId}`;
    const media = player.current_media;
    const values = {
      playerId: player.player_id,
      name: player.name,
      available: !!player.available,
      powered: !!player.powered,
      state: (_a = import_objects.MEDIA_STATE[player.playback_state]) != null ? _a : import_objects.MEDIA_STATE.unknown,
      playbackState: player.playback_state,
      volume: (_b = player.volume_level) != null ? _b : 0,
      muted: !!player.volume_muted,
      activeSource: (_c = player.active_source) != null ? _c : "",
      // the own queue of a player has the id of the player
      queueId: player.player_id,
      mediaTitle: (_d = media == null ? void 0 : media.title) != null ? _d : "",
      mediaArtist: (_e = media == null ? void 0 : media.artist) != null ? _e : "",
      mediaAlbum: (_f = media == null ? void 0 : media.album) != null ? _f : "",
      mediaImage: (_g = media == null ? void 0 : media.image_url) != null ? _g : "",
      elapsedTime: (_i = (_h = player.elapsed_time) != null ? _h : media == null ? void 0 : media.elapsed_time) != null ? _i : 0,
      duration: (_j = media == null ? void 0 : media.duration) != null ? _j : 0
    };
    for (const [key, val] of Object.entries(values)) {
      await this.setStateChangedAsync(`${base}.${key}`, val, true);
    }
  }
  // ---------- Player queues ----------
  async ensureQueueObjects(safeId, name) {
    if (this.knownQueueObjects.has(safeId)) {
      return;
    }
    this.knownQueueObjects.add(safeId);
    await this.writeChannelObjects(`queues.${safeId}`, name, void 0, import_objects.QUEUE_STATES, import_objects.QUEUE_BUTTONS, "control");
  }
  async applyQueue(queue) {
    var _a, _b, _c, _d;
    const safeId = sanitizeId(queue.queue_id);
    this.queueIds.set(safeId, queue.queue_id);
    await this.ensureQueueObjects(safeId, queue.display_name);
    const base = `queues.${safeId}`;
    const values = {
      queueId: queue.queue_id,
      displayName: queue.display_name,
      available: !!queue.available,
      state: queue.state,
      shuffleEnabled: !!queue.shuffle_enabled,
      repeatMode: queue.repeat_mode,
      elapsedTime: (_a = queue.elapsed_time) != null ? _a : 0,
      currentItemName: (_c = (_b = queue.current_item) == null ? void 0 : _b.name) != null ? _c : ""
    };
    for (const [key, val] of Object.entries(values)) {
      await this.setStateChangedAsync(`${base}.${key}`, val, true);
    }
    if (this.playerIds.has(safeId)) {
      await this.setStateChangedAsync(`players.${safeId}.shuffle`, !!queue.shuffle_enabled, true);
      await this.setStateChangedAsync(
        `players.${safeId}.repeat`,
        (_d = import_objects.REPEAT_TO_NUMBER[queue.repeat_mode]) != null ? _d : import_objects.REPEAT_TO_NUMBER.off,
        true
      );
    }
  }
  // ---------- Command dispatch ----------
  async onStateChange(id, state) {
    if (!state || state.ack !== false || !this.client) {
      return;
    }
    const relative = id.substring(this.namespace.length + 1);
    const parts = relative.split(".");
    if (parts.length < 3 || parts[0] !== "players" && parts[0] !== "queues") {
      return;
    }
    let result = "none";
    try {
      result = parts[0] === "players" ? await this.handlePlayerCommand(parts[1], parts.slice(2), state) : await this.handleQueueCommand(parts[1], parts.slice(2), state);
    } catch (err) {
      this.log.error(`Command for ${id} failed: ${err.message}`);
      result = "refresh";
    }
    try {
      if (result === "ack") {
        await this.setState(id, state.val, true);
      } else if (result === "refresh") {
        await this.refresh(parts[0], parts[1]);
      }
    } catch (err) {
      this.log.debug(`Cannot confirm ${id}: ${err.message}`);
    }
  }
  /**
   * Reads a player or queue anew and applies it, which acknowledges its states with the real values.
   *
   * @param folder `players` or `queues`
   * @param safeId sanitized id of the player or queue
   */
  async refresh(folder, safeId) {
    if (!this.client) {
      return;
    }
    if (folder === "players") {
      const playerId = this.playerIds.get(safeId);
      const player = playerId ? await this.client.sendCommand("players/get", { player_id: playerId }) : null;
      if (player) {
        await this.applyPlayer(player);
      }
    }
    const queueId = this.queueIds.get(safeId);
    const queue = queueId ? await this.client.sendCommand("player_queues/get", { queue_id: queueId }) : null;
    if (queue) {
      await this.applyQueue(queue);
    }
  }
  async handlePlayerCommand(safeId, path, state) {
    var _a;
    const playerId = this.playerIds.get(safeId);
    if (!playerId || !this.client || path.length !== 1) {
      return "none";
    }
    const key = path[0];
    const button = import_objects.PLAYER_BUTTONS[key];
    if (button) {
      if (state.val) {
        await this.client.sendCommand(button.command, { player_id: playerId });
      }
      return "ack";
    }
    switch (key) {
      case "powered":
        await this.client.sendCommand("players/cmd/power", { player_id: playerId, powered: !!state.val });
        return "refresh";
      case "volume":
        await this.client.sendCommand("players/cmd/volume_set", {
          player_id: playerId,
          volume_level: Math.round(Math.min(100, Math.max(0, Number(state.val) || 0)))
        });
        return "refresh";
      case "muted":
        await this.client.sendCommand("players/cmd/volume_mute", { player_id: playerId, muted: !!state.val });
        return "refresh";
      case "shuffle":
        await this.client.sendCommand("player_queues/shuffle", {
          queue_id: playerId,
          shuffle_enabled: !!state.val
        });
        return "refresh";
      case "repeat": {
        const mode = import_objects.NUMBER_TO_REPEAT[Number(state.val)];
        if (!mode) {
          throw new Error(`Unknown repeat mode ${String(state.val)}, use 0 (off), 1 (all) or 2 (one)`);
        }
        await this.client.sendCommand("player_queues/repeat", { queue_id: playerId, repeat_mode: mode });
        return "refresh";
      }
      case "seek":
        await this.client.sendCommand("players/cmd/seek", {
          player_id: playerId,
          position: Math.max(0, Math.round(Number(state.val) || 0))
        });
        return "ack";
      case "playMedia":
        await this.playMedia(playerId, String((_a = state.val) != null ? _a : ""));
        return "ack";
      default:
        return "none";
    }
  }
  /**
   * Plays a URI, or searches for the text and plays the best hit, on the queue of a player.
   *
   * @param playerId id of the player in Music Assistant
   * @param text what was written into `playMedia`
   */
  async playMedia(playerId, text) {
    const request = (0, import_objects.parsePlayMedia)(text);
    if (!request || !this.client) {
      return;
    }
    let uri;
    if ("uri" in request) {
      uri = request.uri;
    } else {
      const results = await this.client.sendCommand("music/search", {
        search_query: request.query,
        limit: 5,
        ...request.mediaType ? { media_types: [request.mediaType] } : {}
      });
      uri = (0, import_objects.pickSearchResult)(results, request.query, request.mediaType);
      if (!uri) {
        throw new Error(`Nothing found for "${text}"`);
      }
      this.log.debug(`"${text}" \u2192 ${uri}`);
    }
    await this.client.sendCommand("player_queues/play_media", { queue_id: playerId, media: uri });
  }
  async handleQueueCommand(safeId, path, state) {
    const queueId = this.queueIds.get(safeId);
    if (!queueId || !this.client) {
      return "none";
    }
    if (path[0] === "control" && path.length === 2) {
      const button = import_objects.QUEUE_BUTTONS[path[1]];
      if (!button) {
        return "none";
      }
      if (state.val) {
        await this.client.sendCommand(button.command, { queue_id: queueId });
      }
      return "ack";
    }
    if (path[0] === "shuffleEnabled") {
      await this.client.sendCommand("player_queues/shuffle", { queue_id: queueId, shuffle_enabled: !!state.val });
      return "refresh";
    }
    if (path[0] === "repeatMode") {
      await this.client.sendCommand("player_queues/repeat", { queue_id: queueId, repeat_mode: state.val });
      return "refresh";
    }
    return "none";
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
