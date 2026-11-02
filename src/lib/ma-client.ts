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

/** Result of the `auth/login` command; a failed sign-in is a regular result with `success: false` */
interface LoginResult {
    success: boolean;
    access_token?: string;
    error?: string;
}

/** Response of `POST /setup`, which creates the first admin user of a fresh server */
interface SetupResponse {
    success: boolean;
    token?: string;
    error?: string;
}

const AUTH_TIMEOUT_MS = 15000;
const RECONNECT_DELAY_MS = 5000;
const DEVICE_NAME = 'ioBroker.music-assistant';

/** Timer scheduling, routed through the adapter so pending timers get cleared automatically on unload. */
export interface MaClientScheduler {
    setTimeout: (callback: () => void, ms: number) => ioBroker.Timeout | undefined;
    clearTimeout: (timer: ioBroker.Timeout | undefined) => void;
}

/** How the client signs in: with a token, with username/password, or both (the token is tried first) */
export interface MaClientAuth {
    /** Long-lived token from Settings → Profile */
    token?: string;
    /** Username of a Music Assistant user, signs in via `auth/login` */
    username?: string;
    /** Password of that user */
    password?: string;
    /** Create the first admin user with username/password if the server has no user yet */
    setupIfNeeded?: boolean;
}

/** The server answered with an error to a command */
export class MaCommandError extends Error {
    /**
     * @param message the details the server sent
     * @param code the error code of the server
     */
    public constructor(
        message: string,
        public readonly code: string,
    ) {
        super(message);
    }
}

/** The server refused the credentials. Retrying with the same ones is pointless, so the client stops. */
export class MaAuthError extends Error {}

/**
 * Minimal WebSocket client for the Music Assistant server API.
 * Connects to <host>:<port>/ws, authenticates with a token or with username/password and
 * exposes sendCommand() plus an 'event' emission for every server-pushed event.
 *
 * Events: 'connected', 'disconnected', 'event', 'error', 'serverInfo', 'setupDone' (username of the
 * created admin) and 'authFailed' (MaAuthError - the client does not reconnect after it).
 */
export class MaClient extends EventEmitter {
    private readonly url: string;
    private readonly httpUrl: string;
    private readonly auth: MaClientAuth;
    private readonly scheduler: MaClientScheduler;
    /** The configured token or the session token of the last login, reused on every reconnect */
    private accessToken: string | undefined;
    private setupDone = false;
    private ws: WebSocket | null = null;
    private pending = new Map<string, { resolve: (v: unknown) => void; reject: (e: Error) => void }>();
    private partialResults = new Map<string, unknown[]>();
    private msgIdCounter = 0;
    private reconnectTimer: ioBroker.Timeout | undefined = undefined;
    private closing = false;
    private authenticated = false;

    public constructor(host: string, port: number, auth: MaClientAuth, scheduler: MaClientScheduler) {
        super();
        this.url = `ws://${host}:${port}/ws`;
        this.httpUrl = `http://${host}:${port}`;
        this.auth = auth;
        this.accessToken = auth.token || undefined;
        this.scheduler = scheduler;
    }

    /** Connect and authenticate. Resolves once the connection is usable. */
    public connect(): Promise<void> {
        this.closing = false;
        return this.connectOnce();
    }

    private async connectOnce(): Promise<void> {
        if (this.auth.setupIfNeeded && !this.setupDone) {
            try {
                await this.runFirstTimeSetup();
            } catch (err) {
                if (err instanceof MaAuthError) {
                    this.failAuth(err);
                } else {
                    // usually the server is not up yet, e.g. while its container is still being created
                    this.scheduleReconnect();
                }
                throw err;
            }
        }
        return this.openSocket();
    }

    /**
     * Creates the first admin user of a fresh server with the configured credentials. A server that
     * already has a user answers with 409, then the normal login follows.
     */
    private async runFirstTimeSetup(): Promise<void> {
        const { username, password } = this.auth;
        if (!username || !password) {
            throw new MaAuthError('Username and password are required to set up Music Assistant');
        }
        const res = await fetch(`${this.httpUrl}/setup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ username, password, device_name: DEVICE_NAME }),
            signal: AbortSignal.timeout(AUTH_TIMEOUT_MS),
        });
        const body = (await res.json().catch(() => null)) as SetupResponse | null;
        // Current servers answer an existing admin with 409, older ones with 400 and the same error
        // text - which must not be taken for invalid credentials
        if (res.status === 409 || (!res.ok && /already completed/i.test(body?.error ?? ''))) {
            this.setupDone = true;
            return;
        }
        if (res.ok && body?.success && body.token) {
            this.setupDone = true;
            this.accessToken = body.token;
            this.emit('setupDone', username);
            return;
        }
        const reason = body?.error || `HTTP ${res.status}`;
        if (res.status === 400) {
            // invalid username or password (e.g. too short): the same request would fail again
            throw new MaAuthError(`Cannot set up Music Assistant: ${reason}`);
        }
        throw new Error(`Cannot set up Music Assistant: ${reason}`);
    }

    /** Signs in with the token if there is one, otherwise (or if it expired) with username/password */
    private async authenticate(): Promise<void> {
        const { username, password } = this.auth;
        if (this.accessToken) {
            try {
                await this.sendCommand('auth', { token: this.accessToken, device_name: DEVICE_NAME });
                return;
            } catch (err) {
                if (!(err instanceof MaCommandError)) {
                    throw err;
                }
                if (!username || !password) {
                    throw new MaAuthError(`Music Assistant rejected the token: ${err.message}`);
                }
                // the session token of an earlier login expired or was revoked: sign in again
                this.accessToken = undefined;
            }
        }
        if (!username || !password) {
            throw new MaAuthError('Neither a token nor username and password are configured');
        }
        const result = await this.sendCommand<LoginResult>('auth/login', {
            username,
            password,
            device_name: DEVICE_NAME,
        });
        if (!result?.success || !result.access_token) {
            throw new MaAuthError(
                `Login to Music Assistant as "${username}" failed: ${result?.error || 'unknown error'}`,
            );
        }
        this.accessToken = result.access_token;
        await this.sendCommand('auth', { token: this.accessToken, device_name: DEVICE_NAME });
    }

    /**
     * Stops the client for good after the server refused the credentials
     *
     * @param err why the credentials were refused
     */
    private failAuth(err: MaAuthError): void {
        this.closing = true;
        if (this.reconnectTimer) {
            this.scheduler.clearTimeout(this.reconnectTimer);
            this.reconnectTimer = undefined;
        }
        this.ws?.close();
        this.emit('authFailed', err);
    }

    private openSocket(): Promise<void> {
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
                    this.authenticate()
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
                            if (err instanceof MaAuthError) {
                                this.failAuth(err);
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
        if (this.reconnectTimer || this.closing) {
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
            pending.reject(new MaCommandError(msg.details || String(msg.error_code), String(msg.error_code)));
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
