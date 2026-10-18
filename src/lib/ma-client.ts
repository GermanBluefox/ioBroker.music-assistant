import { EventEmitter } from 'node:events';
import WebSocket from 'ws';

export interface MaEvent {
    event: string;
    object_id: string;
    data?: unknown;
}

interface ServerInfoMessage {
    server_id: string;
    server_version: string;
    [key: string]: unknown;
}

interface ResultMessage {
    message_id: string;
    result?: unknown;
    partial?: boolean;
    error_code?: string;
    details?: string;
}

type IncomingMessage = ServerInfoMessage | MaEvent | ResultMessage;

function isServerInfo(msg: IncomingMessage): msg is ServerInfoMessage {
    return 'server_id' in msg && 'server_version' in msg;
}

function isEvent(msg: IncomingMessage): msg is MaEvent {
    return 'event' in msg;
}

function isResult(msg: IncomingMessage): msg is ResultMessage {
    return 'message_id' in msg;
}

const AUTH_TIMEOUT_MS = 15000;
const RECONNECT_DELAY_MS = 5000;

/** Timer scheduling, routed through the adapter so pending timers get cleared automatically on unload. */
export interface MaClientScheduler {
    setTimeout: (callback: () => void, ms: number) => ioBroker.Timeout | undefined;
    clearTimeout: (timer: ioBroker.Timeout | undefined) => void;
}

/**
 * Minimal WebSocket client for the Music Assistant server API.
 * Connects to <host>:<port>/ws, authenticates with a long-lived token and
 * exposes sendCommand() plus an 'event' emission for every server-pushed event.
 */
export class MaClient extends EventEmitter {
    private readonly url: string;
    private readonly token: string;
    private readonly scheduler: MaClientScheduler;
    private ws: WebSocket | null = null;
    private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
    private partialResults = new Map<string, unknown[]>();
    private msgIdCounter = 0;
    private reconnectTimer: ioBroker.Timeout | undefined = undefined;
    private closing = false;
    private authenticated = false;

    public constructor(host: string, port: number, token: string, scheduler: MaClientScheduler) {
        super();
        this.url = `ws://${host}:${port}/ws`;
        this.token = token;
        this.scheduler = scheduler;
    }

    /** Connect and authenticate. Resolves once the connection is usable. */
    public connect(): Promise<void> {
        this.closing = false;
        return this.connectOnce();
    }

    private connectOnce(): Promise<void> {
        return new Promise((resolve, reject) => {
            let settled = false;
            const ws = new WebSocket(this.url);
            this.ws = ws;

            const authTimeout = this.scheduler.setTimeout(() => {
                if (!settled) {
                    settled = true;
                    ws.terminate();
                    reject(new Error('Timed out waiting for Music Assistant server/auth response'));
                }
            }, AUTH_TIMEOUT_MS);

            ws.on('open', () => {
                // wait for the ServerInfo message before doing anything else
            });

            ws.on('message', (data: WebSocket.RawData) => {
                const text = Array.isArray(data)
                    ? Buffer.concat(data).toString()
                    : Buffer.isBuffer(data)
                      ? data.toString()
                      : Buffer.from(data).toString();
                let msg: IncomingMessage;
                try {
                    msg = JSON.parse(text) as IncomingMessage;
                } catch {
                    return;
                }

                if (isServerInfo(msg)) {
                    this.emit('serverInfo', msg);
                    this.authCommand()
                        .then(() => {
                            this.authenticated = true;
                            this.scheduler.clearTimeout(authTimeout);
                            if (!settled) {
                                settled = true;
                                resolve();
                            }
                            this.emit('connected');
                        })
                        .catch((err: Error) => {
                            this.scheduler.clearTimeout(authTimeout);
                            if (!settled) {
                                settled = true;
                                reject(err);
                            }
                        });
                    return;
                }

                if (isEvent(msg)) {
                    this.emit('event', msg);
                    return;
                }

                if (isResult(msg)) {
                    this.handleResult(msg);
                }
            });

            ws.on('close', () => {
                this.scheduler.clearTimeout(authTimeout);
                const wasAuthenticated = this.authenticated;
                this.authenticated = false;
                this.failPending(new Error('Connection to Music Assistant server closed'));
                if (!settled) {
                    settled = true;
                    reject(new Error('Connection closed before it was ready'));
                }
                if (wasAuthenticated) {
                    this.emit('disconnected');
                }
                if (!this.closing) {
                    this.scheduleReconnect();
                }
            });

            ws.on('error', (err: Error) => {
                this.scheduler.clearTimeout(authTimeout);
                if (!settled) {
                    settled = true;
                    reject(err);
                }
                this.emit('error', err);
            });
        });
    }

    private scheduleReconnect(): void {
        if (this.reconnectTimer) {
            return;
        }
        this.reconnectTimer = this.scheduler.setTimeout(() => {
            this.reconnectTimer = undefined;
            if (this.closing) {
                return;
            }
            this.connectOnce().catch(() => {
                this.scheduleReconnect();
            });
        }, RECONNECT_DELAY_MS);
    }

    private authCommand(): Promise<unknown> {
        return this.sendCommand('auth', { token: this.token, device_name: 'ioBroker.music-assistant' });
    }

    private nextMessageId(): string {
        this.msgIdCounter += 1;
        return this.msgIdCounter.toString();
    }

    private handleResult(msg: ResultMessage): void {
        const pending = this.pending.get(msg.message_id);
        if (!pending) {
            return;
        }

        if (msg.partial) {
            const existing = this.partialResults.get(msg.message_id) ?? [];
            existing.push(...((msg.result as unknown[] | undefined) ?? []));
            this.partialResults.set(msg.message_id, existing);
            return;
        }

        const partial = this.partialResults.get(msg.message_id);
        if (partial) {
            this.partialResults.delete(msg.message_id);
            msg.result = partial.concat((msg.result as unknown[] | undefined) ?? []);
        }

        this.pending.delete(msg.message_id);

        if (msg.error_code) {
            pending.reject(new Error(msg.details || msg.error_code));
        } else {
            pending.resolve(msg.result);
        }
    }

    private failPending(err: Error): void {
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
    public sendCommand<T = unknown>(command: string, args?: Record<string, unknown>): Promise<T> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            return Promise.reject(new Error('Not connected to Music Assistant server'));
        }

        const messageId = this.nextMessageId();
        return new Promise<unknown>((resolve, reject) => {
            this.pending.set(messageId, { resolve, reject });
            try {
                this.ws!.send(JSON.stringify({ command, message_id: messageId, args }));
            } catch (err) {
                this.pending.delete(messageId);
                reject(err instanceof Error ? err : new Error(String(err)));
            }
        }) as Promise<T>;
    }

    /** Close the connection and stop reconnecting. */
    public close(): void {
        this.closing = true;
        if (this.reconnectTimer) {
            this.scheduler.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        this.authenticated = false;
        this.failPending(new Error('Client closed'));
        this.ws?.removeAllListeners();
        this.ws?.terminate();
        this.ws = null;
    }
}
