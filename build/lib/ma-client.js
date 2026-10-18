"use strict";
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
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
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var ma_client_exports = {};
__export(ma_client_exports, {
  MaClient: () => MaClient
});
module.exports = __toCommonJS(ma_client_exports);
var import_node_events = require("node:events");
var import_ws = __toESM(require("ws"));
function isServerInfo(msg) {
  return "server_id" in msg && "server_version" in msg;
}
function isEvent(msg) {
  return "event" in msg;
}
function isResult(msg) {
  return "message_id" in msg;
}
const AUTH_TIMEOUT_MS = 15e3;
const RECONNECT_DELAY_MS = 5e3;
class MaClient extends import_node_events.EventEmitter {
  url;
  token;
  scheduler;
  ws = null;
  pending = /* @__PURE__ */ new Map();
  partialResults = /* @__PURE__ */ new Map();
  msgIdCounter = 0;
  reconnectTimer = void 0;
  closing = false;
  authenticated = false;
  constructor(host, port, token, scheduler) {
    super();
    this.url = `ws://${host}:${port}/ws`;
    this.token = token;
    this.scheduler = scheduler;
  }
  /** Connect and authenticate. Resolves once the connection is usable. */
  connect() {
    this.closing = false;
    return this.connectOnce();
  }
  connectOnce() {
    return new Promise((resolve, reject) => {
      let settled = false;
      const ws = new import_ws.default(this.url);
      this.ws = ws;
      const authTimeout = this.scheduler.setTimeout(() => {
        if (!settled) {
          settled = true;
          ws.terminate();
          reject(new Error("Timed out waiting for Music Assistant server/auth response"));
        }
      }, AUTH_TIMEOUT_MS);
      ws.on("open", () => {
      });
      ws.on("message", (data) => {
        const text = Array.isArray(data) ? Buffer.concat(data).toString() : Buffer.isBuffer(data) ? data.toString() : Buffer.from(data).toString();
        let msg;
        try {
          msg = JSON.parse(text);
        } catch {
          return;
        }
        if (isServerInfo(msg)) {
          this.emit("serverInfo", msg);
          this.authCommand().then(() => {
            this.authenticated = true;
            this.scheduler.clearTimeout(authTimeout);
            if (!settled) {
              settled = true;
              resolve();
            }
            this.emit("connected");
          }).catch((err) => {
            this.scheduler.clearTimeout(authTimeout);
            if (!settled) {
              settled = true;
              reject(err);
            }
          });
          return;
        }
        if (isEvent(msg)) {
          this.emit("event", msg);
          return;
        }
        if (isResult(msg)) {
          this.handleResult(msg);
        }
      });
      ws.on("close", () => {
        this.scheduler.clearTimeout(authTimeout);
        const wasAuthenticated = this.authenticated;
        this.authenticated = false;
        this.failPending(new Error("Connection to Music Assistant server closed"));
        if (!settled) {
          settled = true;
          reject(new Error("Connection closed before it was ready"));
        }
        if (wasAuthenticated) {
          this.emit("disconnected");
        }
        if (!this.closing) {
          this.scheduleReconnect();
        }
      });
      ws.on("error", (err) => {
        this.scheduler.clearTimeout(authTimeout);
        if (!settled) {
          settled = true;
          reject(err);
        }
        this.emit("error", err);
      });
    });
  }
  scheduleReconnect() {
    if (this.reconnectTimer) {
      return;
    }
    this.reconnectTimer = this.scheduler.setTimeout(() => {
      this.reconnectTimer = void 0;
      if (this.closing) {
        return;
      }
      this.connectOnce().catch(() => {
        this.scheduleReconnect();
      });
    }, RECONNECT_DELAY_MS);
  }
  authCommand() {
    return this.sendCommand("auth", { token: this.token, device_name: "ioBroker.music-assistant" });
  }
  nextMessageId() {
    this.msgIdCounter += 1;
    return this.msgIdCounter.toString();
  }
  handleResult(msg) {
    var _a, _b, _c;
    const pending = this.pending.get(msg.message_id);
    if (!pending) {
      return;
    }
    if (msg.partial) {
      const existing = (_a = this.partialResults.get(msg.message_id)) != null ? _a : [];
      existing.push(...(_b = msg.result) != null ? _b : []);
      this.partialResults.set(msg.message_id, existing);
      return;
    }
    const partial = this.partialResults.get(msg.message_id);
    if (partial) {
      this.partialResults.delete(msg.message_id);
      msg.result = partial.concat((_c = msg.result) != null ? _c : []);
    }
    this.pending.delete(msg.message_id);
    if (msg.error_code) {
      pending.reject(new Error(msg.details || msg.error_code));
    } else {
      pending.resolve(msg.result);
    }
  }
  failPending(err) {
    for (const pending of this.pending.values()) {
      pending.reject(err);
    }
    this.pending.clear();
    this.partialResults.clear();
  }
  /**
   * Send a command and resolve with its result once the server responds.
   *
   * @param command
   * @param args
   */
  sendCommand(command, args) {
    if (!this.ws || this.ws.readyState !== import_ws.default.OPEN) {
      return Promise.reject(new Error("Not connected to Music Assistant server"));
    }
    const messageId = this.nextMessageId();
    return new Promise((resolve, reject) => {
      this.pending.set(messageId, { resolve, reject });
      try {
        this.ws.send(JSON.stringify({ command, message_id: messageId, args }));
      } catch (err) {
        this.pending.delete(messageId);
        reject(err instanceof Error ? err : new Error(String(err)));
      }
    });
  }
  /** Close the connection and stop reconnecting. */
  close() {
    var _a, _b;
    this.closing = true;
    if (this.reconnectTimer) {
      this.scheduler.clearTimeout(this.reconnectTimer);
      this.reconnectTimer = void 0;
    }
    this.authenticated = false;
    this.failPending(new Error("Client closed"));
    (_a = this.ws) == null ? void 0 : _a.removeAllListeners();
    (_b = this.ws) == null ? void 0 : _b.terminate();
    this.ws = null;
  }
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  MaClient
});
//# sourceMappingURL=ma-client.js.map
