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
var ids_exports = {};
__export(ids_exports, {
  SafeIdRegistry: () => SafeIdRegistry,
  sanitizeId: () => sanitizeId
});
module.exports = __toCommonJS(ids_exports);
var import_node_crypto = require("node:crypto");
function sanitizeId(id) {
  return id.replace(/[^a-zA-Z0-9_-]/g, "_");
}
class SafeIdRegistry {
  /** lower-case sanitized id -> raw id that owns it */
  owners = /* @__PURE__ */ new Map();
  /**
   * The id of the channel of a player or queue
   *
   * @param rawId the id Music Assistant uses
   * @returns the same id for the same raw id, and a different one for every other raw id
   */
  get(rawId) {
    const base = sanitizeId(rawId);
    const owner = this.owners.get(base.toLowerCase());
    if (owner === void 0) {
      this.owners.set(base.toLowerCase(), rawId);
      return base;
    }
    if (owner === rawId) {
      return base;
    }
    const suffixed = `${base}_${(0, import_node_crypto.createHash)("sha1").update(rawId).digest("hex").substring(0, 8)}`;
    if (!this.owners.has(suffixed.toLowerCase())) {
      this.owners.set(suffixed.toLowerCase(), rawId);
    }
    return suffixed;
  }
  /**
   * Forgets a raw id, e.g. after its player was deleted, so that its id can be used by another one
   *
   * @param rawId the id Music Assistant used
   */
  release(rawId) {
    for (const [key, owner] of this.owners) {
      if (owner === rawId) {
        this.owners.delete(key);
      }
    }
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  SafeIdRegistry,
  sanitizeId
});
//# sourceMappingURL=ids.js.map
