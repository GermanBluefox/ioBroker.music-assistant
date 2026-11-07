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
var media_exports = {};
__export(media_exports, {
  FAVORITE_TYPES: () => FAVORITE_TYPES,
  MEDIA_LISTS: () => MEDIA_LISTS,
  imageUrl: () => imageUrl,
  libraryCommand: () => libraryCommand,
  listType: () => listType,
  normalizeBaseUrl: () => normalizeBaseUrl,
  parseMediaRequest: () => parseMediaRequest,
  toMediaEntry: () => toMediaEntry
});
module.exports = __toCommonJS(media_exports);
const MEDIA_LISTS = [
  "favorites",
  "artists",
  "albums",
  "tracks",
  "playlists",
  "radios",
  "podcasts",
  "audiobooks"
];
const LIST_TYPE = {
  artists: "artist",
  albums: "album",
  tracks: "track",
  playlists: "playlist",
  radios: "radio",
  podcasts: "podcast",
  audiobooks: "audiobook"
};
const LIBRARY_BASE = {
  playlist: "playlists",
  radio: "radios",
  album: "albums",
  artist: "artists",
  track: "tracks",
  podcast: "podcasts",
  audiobook: "audiobooks"
};
const FAVORITE_TYPES = ["playlist", "radio", "album", "artist", "track", "podcast", "audiobook"];
const DEFAULT_LIMIT = 100;
const MAX_LIMIT = 500;
const THUMB_SIZE = 160;
function libraryCommand(type) {
  return `music/${LIBRARY_BASE[type] || `${type}s`}/library_items`;
}
function listType(list) {
  return list === "favorites" ? void 0 : LIST_TYPE[list];
}
function parseMediaRequest(message) {
  const msg = message && typeof message === "object" ? message : {};
  const list = msg.list;
  if (!MEDIA_LISTS.includes(list)) {
    return `Unknown list "${String(msg.list)}", use one of ${MEDIA_LISTS.join(", ")}`;
  }
  const search = typeof msg.search === "string" ? msg.search.trim() : "";
  const limit = Math.min(MAX_LIMIT, Math.max(1, Math.round(Number(msg.limit) || DEFAULT_LIMIT)));
  const offset = Math.max(0, Math.round(Number(msg.offset) || 0));
  return { list, limit, offset, ...search ? { search } : {} };
}
function imageUrl(image, baseUrl) {
  if (!(image == null ? void 0 : image.path) && !(image == null ? void 0 : image.proxy_id)) {
    return "";
  }
  if (image.proxy_id && baseUrl) {
    return `${baseUrl}/imageproxy/${encodeURIComponent(image.proxy_id)}?size=${THUMB_SIZE}`;
  }
  if (image.remotely_accessible && image.path) {
    return image.path;
  }
  if (baseUrl && image.path && image.provider) {
    const path = encodeURIComponent(encodeURIComponent(image.path));
    return `${baseUrl}/imageproxy?path=${path}&provider=${encodeURIComponent(image.provider)}&size=${THUMB_SIZE}`;
  }
  return "";
}
function toMediaEntry(item, baseUrl) {
  var _a, _b;
  if (!(item == null ? void 0 : item.uri)) {
    return null;
  }
  const images = ((_a = item.metadata) == null ? void 0 : _a.images) || [];
  const image = item.image || images.find((i) => (i == null ? void 0 : i.type) === "thumb") || images[0];
  const artists = (item.artists || []).map((a) => a == null ? void 0 : a.name).filter(Boolean).join(", ");
  const byArtists = [artists, item.media_type === "track" ? (_b = item.album) == null ? void 0 : _b.name : ""].filter(Boolean).join(" \xB7 ");
  const subtitle = byArtists || item.owner || item.publisher || (item.authors || []).join(", ") || "";
  return {
    uri: item.uri,
    name: item.name || item.uri,
    subtitle,
    image: imageUrl(image, baseUrl),
    type: item.media_type || ""
  };
}
function normalizeBaseUrl(baseUrl, fallback) {
  const url = typeof baseUrl === "string" && /^https?:\/\//i.test(baseUrl) ? baseUrl : fallback;
  return url.replace(/\/+$/, "");
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  FAVORITE_TYPES,
  MEDIA_LISTS,
  imageUrl,
  libraryCommand,
  listType,
  normalizeBaseUrl,
  parseMediaRequest,
  toMediaEntry
});
//# sourceMappingURL=media.js.map
