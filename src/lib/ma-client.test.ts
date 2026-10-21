import { expect } from 'chai';
import { createServer, type Server } from 'node:http';
import type { AddressInfo } from 'node:net';
import { type WebSocket, WebSocketServer } from 'ws';

import { MaAuthError, MaClient, type MaClientAuth, type MaClientScheduler } from './ma-client';

/** State of the fake Music Assistant server */
interface FakeState {
    user: { username: string; password: string } | null;
    tokenCounter: number;
    validTokens: Set<string>;
    setupCalls: number;
    connections: number;
    commands: string[];
    authedWith: string[];
    sockets: Set<WebSocket>;
}

function freshState(): FakeState {
    return {
        user: null,
        tokenCounter: 0,
        validTokens: new Set(),
        setupCalls: 0,
        connections: 0,
        commands: [],
        authedWith: [],
        sockets: new Set(),
    };
}

/** A fake Music Assistant server: `POST /setup` plus the WebSocket API with `auth/login` and `auth` */
class FakeServer {
    public readonly state = freshState();
    private readonly http: Server;
    private readonly wss: WebSocketServer;

    public constructor() {
        const state = this.state;
        this.http = createServer((req, res) => {
            if (req.method !== 'POST' || req.url !== '/setup') {
                res.writeHead(404).end();
                return;
            }
            let body = '';
            req.on('data', (chunk: Buffer) => (body += chunk.toString()));
            req.on('end', () => {
                state.setupCalls++;
                const { username, password } = JSON.parse(body) as { username: string; password: string };
                const reply = (status: number, data: Record<string, unknown>): void => {
                    res.writeHead(status, { 'Content-Type': 'application/json' }).end(JSON.stringify(data));
                };
                if (state.user) {
                    return reply(409, { success: false, error: 'Setup already completed' });
                }
                if (password.length < 8) {
                    return reply(400, { success: false, error: 'Password must be at least 8 characters' });
                }
                state.user = { username, password };
                const token = `setup-${++state.tokenCounter}`;
                state.validTokens.add(token);
                reply(200, { success: true, token, user: { username } });
            });
        });
        this.wss = new WebSocketServer({ server: this.http, path: '/ws' });
        this.wss.on('connection', ws => {
            state.connections++;
            state.sockets.add(ws);
            ws.on('close', () => state.sockets.delete(ws));
            ws.send(JSON.stringify({ server_id: 'fake', server_version: '2.9.0' }));
            ws.on('message', (raw: Buffer) => {
                const msg = JSON.parse(raw.toString('utf8')) as {
                    command: string;
                    message_id: string;
                    args: Record<string, string>;
                };
                state.commands.push(msg.command);
                const reply = (data: Record<string, unknown>): void =>
                    ws.send(JSON.stringify({ message_id: msg.message_id, ...data }));
                if (msg.command === 'auth/login') {
                    const { username, password } = msg.args;
                    if (state.user?.username !== username || state.user?.password !== password) {
                        return reply({ result: { success: false, error: 'Invalid username or password' } });
                    }
                    const token = `login-${++state.tokenCounter}`;
                    state.validTokens.add(token);
                    return reply({ result: { success: true, access_token: token } });
                }
                if (msg.command === 'auth') {
                    if (!state.validTokens.has(msg.args.token)) {
                        return reply({ error_code: 20, details: 'Invalid or expired token' });
                    }
                    state.authedWith.push(msg.args.token);
                    return reply({ result: { authenticated: true } });
                }
                reply({ result: [] });
            });
        });
    }

    public listen(port = 0): Promise<number> {
        return new Promise(resolve => this.http.listen(port, '127.0.0.1', () => resolve(this.port)));
    }

    public get port(): number {
        return (this.http.address() as AddressInfo).port;
    }

    /** Drops all WebSocket connections, as a restart of the server would */
    public dropConnections(): void {
        for (const ws of this.state.sockets) {
            ws.terminate();
        }
    }

    public async close(): Promise<void> {
        this.dropConnections();
        this.wss.close();
        this.http.closeAllConnections();
        await new Promise(resolve => this.http.close(resolve));
    }
}

/** Real timers, but the reconnect delay of 5 s is shortened so the tests do not wait for it */
const RECONNECT_DELAY_MS = 5000;
const scheduler: MaClientScheduler = {
    setTimeout: (cb, ms) => setTimeout(cb, ms === RECONNECT_DELAY_MS ? 50 : ms) as unknown as ioBroker.Timeout,
    clearTimeout: timer => clearTimeout(timer as unknown as NodeJS.Timeout),
};

function waitFor<T = unknown>(client: MaClient, event: string, ms = 3000): Promise<T> {
    return new Promise((resolve, reject) => {
        const timer = setTimeout(() => reject(new Error(`timeout waiting for "${event}"`)), ms);
        client.once(event, (value: T) => {
            clearTimeout(timer);
            resolve(value);
        });
    });
}

const sleep = (ms: number): Promise<void> => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Resolves with the error the promise rejected with; fails if it resolved
 *
 * @param promise the promise that must be rejected
 */
async function rejectionOf(promise: Promise<unknown>): Promise<Error> {
    try {
        await promise;
    } catch (err) {
        return err as Error;
    }
    throw new Error('expected the promise to be rejected');
}

const CREDENTIALS: MaClientAuth = { username: 'admin', password: 'secret123', setupIfNeeded: true };

describe('MaClient authentication', function () {
    this.timeout(10000);

    let server: FakeServer;
    let client: MaClient | undefined;

    beforeEach(async () => {
        server = new FakeServer();
        await server.listen();
    });

    afterEach(async () => {
        client?.close();
        client = undefined;
        await server.close();
    });

    const connectClient = (auth: MaClientAuth, port = server.port): MaClient =>
        (client = new MaClient('127.0.0.1', port, auth, scheduler));

    it('creates the admin on a fresh server and uses the token of the setup', async () => {
        const c = connectClient(CREDENTIALS);
        const setupDone = waitFor<string>(c, 'setupDone');
        await c.connect();
        expect(await setupDone).to.equal('admin');
        expect(server.state.authedWith).to.deep.equal(['setup-1']);
        expect(server.state.commands).to.not.include('auth/login');
    });

    it('reuses the token on a reconnect and signs in again once it expired', async () => {
        const c = connectClient(CREDENTIALS);
        await c.connect();

        let reconnected = waitFor(c, 'connected');
        server.dropConnections();
        await reconnected;
        expect(server.state.authedWith).to.deep.equal(['setup-1', 'setup-1']);

        server.state.validTokens.clear();
        reconnected = waitFor(c, 'connected');
        server.dropConnections();
        await reconnected;
        expect(server.state.commands.filter(cmd => cmd === 'auth/login')).to.have.length(1);
        expect(server.state.authedWith.at(-1)).to.equal('login-2');
    });

    it('signs in with auth/login when the server is already set up', async () => {
        server.state.user = { username: 'admin', password: 'secret123' };
        const c = connectClient(CREDENTIALS);
        let setupEmitted = false;
        c.on('setupDone', () => (setupEmitted = true));
        await c.connect();
        expect(setupEmitted).to.equal(false);
        expect(server.state.setupCalls).to.equal(1);
        expect(server.state.commands).to.deep.equal(['auth/login', 'auth']);
    });

    it('stops for good when the credentials are refused', async () => {
        server.state.user = { username: 'admin', password: 'secret123' };
        const c = connectClient({ ...CREDENTIALS, password: 'wrong-password' });
        const failed = waitFor<Error>(c, 'authFailed');
        expect(await rejectionOf(c.connect())).to.be.instanceOf(MaAuthError);
        expect(await failed).to.be.instanceOf(MaAuthError);
        await sleep(300);
        expect(server.state.connections).to.equal(1);
    });

    it('does not retry a setup the server refused', async () => {
        const c = connectClient({ ...CREDENTIALS, password: 'short' });
        const err = await rejectionOf(c.connect());
        expect(err).to.be.instanceOf(MaAuthError);
        expect(err.message).to.contain('at least 8 characters');
        await sleep(300);
        expect(server.state.setupCalls).to.equal(1);
    });

    it('treats a refused token without credentials as an auth error', async () => {
        const c = connectClient({ token: 'bogus' });
        const err = await rejectionOf(c.connect());
        expect(err).to.be.instanceOf(MaAuthError);
        expect(err.message).to.contain('rejected the token');
    });

    it('retries the setup until the server comes up', async () => {
        // a port that nothing listens on yet - like a container that is still being created
        const port = server.port;
        await server.close();
        const c = connectClient(CREDENTIALS, port);
        const connected = waitFor(c, 'connected', 5000);
        await rejectionOf(c.connect());

        server = new FakeServer();
        await server.listen(port);
        await connected;
        expect(server.state.authedWith).to.deep.equal(['setup-1']);
    });
});
