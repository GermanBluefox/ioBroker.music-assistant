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
var players_exports = {};
__export(players_exports, {
  playerOptions: () => playerOptions
});
module.exports = __toCommonJS(players_exports);
function playerOptions(channels, prefix, lang = "en") {
  var _a;
  const options = [];
  for (const [id, obj] of Object.entries(channels)) {
    if (!id.startsWith(prefix)) {
      continue;
    }
    const value = id.substring(prefix.length);
    if (!value || value.includes(".")) {
      continue;
    }
    const name = (_a = obj == null ? void 0 : obj.common) == null ? void 0 : _a.name;
    const label = typeof name === "string" ? name : (name == null ? void 0 : name[lang]) || (name == null ? void 0 : name.en) || "";
    options.push({ value, label: label || value });
  }
  return options.sort((a, b) => a.label.localeCompare(b.label));
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  playerOptions
});
//# sourceMappingURL=players.js.map
