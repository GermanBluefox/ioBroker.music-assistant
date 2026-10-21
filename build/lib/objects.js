"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var objects_exports = {};
__export(objects_exports, {
  MEDIA_STATE: () => MEDIA_STATE,
  NUMBER_TO_REPEAT: () => NUMBER_TO_REPEAT,
  PLAYER_BUTTONS: () => PLAYER_BUTTONS,
  PLAYER_STATES: () => PLAYER_STATES,
  QUEUE_BUTTONS: () => QUEUE_BUTTONS,
  QUEUE_STATES: () => QUEUE_STATES,
  REPEAT_TO_NUMBER: () => REPEAT_TO_NUMBER,
  defaultValue: () => defaultValue,
  parsePlayMedia: () => parsePlayMedia,
  pickSearchResult: () => pickSearchResult
});
module.exports = __toCommonJS(objects_exports);
const MEDIA_STATE = { paused: 0, playing: 1, idle: 2, unknown: 2 };
const REPEAT_TO_NUMBER = { off: 0, all: 1, one: 2, unknown: 0 };
const NUMBER_TO_REPEAT = { 0: "off", 1: "all", 2: "one" };
const PLAYER_STATES = {
  playerId: { name: "Player ID", type: "string", role: "text", read: true, write: false },
  name: { name: "Name", type: "string", role: "media.player.name", read: true, write: false },
  available: { name: "Available", type: "boolean", role: "indicator.reachable", read: true, write: false },
  powered: { name: "Powered", type: "boolean", role: "switch.power", read: true, write: true },
  state: {
    name: "State",
    type: "number",
    role: "media.state",
    read: true,
    write: false,
    states: { 0: "pause", 1: "play", 2: "stop" }
  },
  playbackState: { name: "Playback state (raw)", type: "string", role: "text", read: true, write: false },
  volume: {
    name: "Volume",
    type: "number",
    role: "level.volume",
    min: 0,
    max: 100,
    unit: "%",
    read: true,
    write: true
  },
  muted: { name: "Muted", type: "boolean", role: "media.mute", read: true, write: true },
  shuffle: { name: "Shuffle", type: "boolean", role: "media.mode.shuffle", read: true, write: true },
  repeat: {
    name: "Repeat",
    type: "number",
    role: "media.mode.repeat",
    read: true,
    write: true,
    states: { 0: "off", 1: "all", 2: "one" }
  },
  activeSource: { name: "Active source", type: "string", role: "text", read: true, write: false },
  queueId: { name: "Queue ID", type: "string", role: "text", read: true, write: false },
  elapsedTime: { name: "Elapsed time", type: "number", role: "media.elapsed", unit: "s", read: true, write: false },
  duration: { name: "Duration", type: "number", role: "media.duration", unit: "s", read: true, write: false },
  seek: { name: "Seek to position", type: "number", role: "media.seek", unit: "s", read: true, write: true },
  mediaTitle: { name: "Title", type: "string", role: "media.title", read: true, write: false },
  mediaArtist: { name: "Artist", type: "string", role: "media.artist", read: true, write: false },
  mediaAlbum: { name: "Album", type: "string", role: "media.album", read: true, write: false },
  mediaImage: { name: "Cover image URL", type: "string", role: "media.cover", read: true, write: false },
  playMedia: {
    name: "Play media (URI or search text)",
    desc: 'A Music Assistant URI, or a search text with an optional prefix "artist:", "album:", "track:", "playlist:" or "radio:"',
    type: "string",
    role: "text",
    read: true,
    write: true
  }
};
const PLAYER_BUTTONS = {
  play: { name: "Play", role: "button.play", command: "players/cmd/play" },
  pause: { name: "Pause", role: "button.pause", command: "players/cmd/pause" },
  playPause: { name: "Play/pause", role: "button", command: "players/cmd/play_pause" },
  stop: { name: "Stop", role: "button.stop", command: "players/cmd/stop" },
  next: { name: "Next", role: "button.next", command: "players/cmd/next" },
  previous: { name: "Previous", role: "button.prev", command: "players/cmd/previous" }
};
const QUEUE_STATES = {
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
  elapsedTime: { name: "Elapsed time", type: "number", role: "media.elapsed", unit: "s", read: true, write: false },
  currentItemName: { name: "Current item", type: "string", role: "media.title", read: true, write: false }
};
const QUEUE_BUTTONS = {
  play: { name: "play", role: "button", command: "player_queues/play" },
  pause: { name: "pause", role: "button", command: "player_queues/pause" },
  playPause: { name: "playPause", role: "button", command: "player_queues/play_pause" },
  stop: { name: "stop", role: "button", command: "player_queues/stop" },
  next: { name: "next", role: "button", command: "player_queues/next" },
  previous: { name: "previous", role: "button", command: "player_queues/previous" }
};
function defaultValue(common) {
  return common.type === "boolean" ? false : common.type === "number" ? 0 : "";
}
const SEARCH_PREFIXES = {
  artist: "artists",
  album: "albums",
  track: "tracks",
  playlist: "playlists",
  radio: "radio",
  podcast: "podcasts",
  audiobook: "audiobooks",
  genre: "genres"
};
function parsePlayMedia(text) {
  const value = text.trim();
  if (!value) {
    return void 0;
  }
  if (value.includes("://")) {
    return { uri: value };
  }
  const match = value.match(/^([a-z]+)\s*:\s*(.+)$/i);
  if (match && SEARCH_PREFIXES[match[1].toLowerCase()]) {
    return { query: match[2].trim(), mediaType: match[1].toLowerCase() };
  }
  return { query: value };
}
const EXACT_MATCH_ORDER = [
  "artists",
  "playlists",
  "albums",
  "tracks",
  "radio",
  "podcasts",
  "audiobooks",
  "genres"
];
const FALLBACK_ORDER = [
  "tracks",
  "albums",
  "artists",
  "playlists",
  "radio",
  "podcasts",
  "audiobooks",
  "genres"
];
function pickSearchResult(results, query, mediaType) {
  var _a, _b;
  const lists = mediaType ? [SEARCH_PREFIXES[mediaType]] : EXACT_MATCH_ORDER;
  const wanted = query.trim().toLowerCase();
  for (const list of lists) {
    const exact = ((_a = results[list]) != null ? _a : []).find((item) => {
      var _a2;
      return ((_a2 = item.name) == null ? void 0 : _a2.trim().toLowerCase()) === wanted && item.uri;
    });
    if (exact) {
      return exact.uri;
    }
  }
  for (const list of mediaType ? lists : FALLBACK_ORDER) {
    const first = ((_b = results[list]) != null ? _b : []).find((item) => item.uri);
    if (first) {
      return first.uri;
    }
  }
  return void 0;
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MEDIA_STATE,
  NUMBER_TO_REPEAT,
  PLAYER_BUTTONS,
  PLAYER_STATES,
  QUEUE_BUTTONS,
  QUEUE_STATES,
  REPEAT_TO_NUMBER,
  defaultValue,
  parsePlayMedia,
  pickSearchResult
});
//# sourceMappingURL=objects.js.map
