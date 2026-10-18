/*
 * ioBroker.music-assistant
 */
import * as utils from '@iobroker/adapter-core';

import { MaClient, type MaEvent } from './lib/ma-client';
import type { Player, PlayerQueue } from './lib/ma-types';

/**
 * ioBroker object ids may only contain a limited character set.
 *
 * @param id
 */
function sanitizeId(id: string): string {
    return id.replace(/[^a-zA-Z0-9_-]/g, '_');
}

class MusicAssistant extends utils.Adapter {
    private client: MaClient | null = null;
    private readonly playerIds = new Map<string, string>(); // sanitized -> raw player_id
    private readonly queueIds = new Map<string, string>(); // sanitized -> raw queue_id
    private readonly knownPlayerObjects = new Set<string>();
    private readonly knownQueueObjects = new Set<string>();

    public constructor(options: Partial<utils.AdapterOptions> = {}) {
        super({
            ...options,
            name: 'music-assistant',
        });
        this.on('ready', this.onReady.bind(this));
        this.on('stateChange', this.onStateChange.bind(this));
        this.on('unload', this.onUnload.bind(this));
    }

    private async onReady(): Promise<void> {
        await this.setStateAsync('info.connection', false, true);

        const host = (this.config.host as string | undefined)?.trim();
        const port = Number(this.config.port) || 8095;
        const token = (this.config.token as string | undefined)?.trim();

        if (!host || !token) {
            this.log.error('Music Assistant host and API token must be configured in the adapter settings');
            return;
        }

        this.subscribeStates('players.*.control.*');
        this.subscribeStates('players.*.powered');
        this.subscribeStates('players.*.volume');
        this.subscribeStates('players.*.muted');
        this.subscribeStates('queues.*.control.*');
        this.subscribeStates('queues.*.shuffleEnabled');
        this.subscribeStates('queues.*.repeatMode');

        const client = new MaClient(host, port, token);
        this.client = client;

        client.on('connected', () => {
            this.log.info('Connected to Music Assistant server');
            void this.setStateAsync('info.connection', true, true);
            this.syncAll().catch((err: Error) => this.log.error(`Initial sync failed: ${err.message}`));
        });
        client.on('disconnected', () => {
            this.log.warn('Lost connection to Music Assistant server, will keep retrying');
            void this.setStateAsync('info.connection', false, true);
        });
        client.on('error', (err: Error) => this.log.debug(`Music Assistant client error: ${err.message}`));
        client.on('event', (evt: MaEvent) => {
            this.handleEvent(evt).catch((err: Error) =>
                this.log.error(`Failed to handle event ${evt.event}: ${err.message}`),
            );
        });

        try {
            await client.connect();
        } catch (err) {
            // the client keeps retrying in the background; just log the first failure
            this.log.warn(`Could not connect to Music Assistant server: ${(err as Error).message}`);
        }
    }

    private async syncAll(): Promise<void> {
        if (!this.client) {
            return;
        }
        const players = await this.client.sendCommand<Player[]>('players/all');
        for (const player of players) {
            await this.applyPlayer(player);
        }
        const queues = await this.client.sendCommand<PlayerQueue[]>('player_queues/all');
        for (const queue of queues) {
            await this.applyQueue(queue);
        }
    }

    private async handleEvent(evt: MaEvent): Promise<void> {
        switch (evt.event) {
            case 'player_added':
            case 'player_updated':
                await this.applyPlayer(evt.data as Player);
                break;
            case 'queue_added':
            case 'queue_updated':
                await this.applyQueue(evt.data as PlayerQueue);
                break;
            case 'queue_time_updated': {
                const safeId = sanitizeId(evt.object_id);
                const data = evt.data as { elapsed_time?: number } | undefined;
                if (data && typeof data.elapsed_time === 'number' && this.queueIds.has(safeId)) {
                    await this.setStateAsync(`queues.${safeId}.elapsedTime`, data.elapsed_time, true);
                }
                break;
            }
            default:
                break;
        }
    }

    // ---------- Players ----------

    private async ensurePlayerObjects(safeId: string, name: string): Promise<void> {
        if (this.knownPlayerObjects.has(safeId)) {
            return;
        }
        this.knownPlayerObjects.add(safeId);
        const base = `players.${safeId}`;

        await this.setObjectNotExistsAsync(base, {
            type: 'channel',
            common: { name },
            native: {},
        });

        const states: Record<string, ioBroker.StateCommon> = {
            playerId: { name: 'Player ID', type: 'string', role: 'text', read: true, write: false },
            name: { name: 'Name', type: 'string', role: 'text', read: true, write: false },
            available: { name: 'Available', type: 'boolean', role: 'indicator.reachable', read: true, write: false },
            powered: { name: 'Powered', type: 'boolean', role: 'switch.power', read: true, write: true },
            playbackState: { name: 'Playback state', type: 'string', role: 'media.state', read: true, write: false },
            volume: { name: 'Volume', type: 'number', role: 'level.volume', min: 0, max: 100, read: true, write: true },
            muted: { name: 'Muted', type: 'boolean', role: 'media.mute', read: true, write: true },
            activeSource: { name: 'Active source', type: 'string', role: 'text', read: true, write: false },
            queueId: { name: 'Queue ID', type: 'string', role: 'text', read: true, write: false },
            elapsedTime: {
                name: 'Elapsed time',
                type: 'number',
                role: 'media.elapsed',
                unit: 's',
                read: true,
                write: false,
            },
            mediaTitle: { name: 'Title', type: 'string', role: 'media.title', read: true, write: false },
            mediaArtist: { name: 'Artist', type: 'string', role: 'media.artist', read: true, write: false },
            mediaAlbum: { name: 'Album', type: 'string', role: 'media.album', read: true, write: false },
            mediaImage: { name: 'Cover image URL', type: 'string', role: 'media.cover', read: true, write: false },
        };
        for (const [key, common] of Object.entries(states)) {
            await this.setObjectNotExistsAsync(`${base}.${key}`, {
                type: 'state',
                common: { ...common, def: common.type === 'boolean' ? false : common.type === 'number' ? 0 : '' },
                native: {},
            });
        }

        await this.setObjectNotExistsAsync(`${base}.control`, {
            type: 'channel',
            common: { name: 'Control' },
            native: {},
        });
        const buttons = ['play', 'pause', 'playPause', 'stop', 'next', 'previous'];
        for (const btn of buttons) {
            await this.setObjectNotExistsAsync(`${base}.control.${btn}`, {
                type: 'state',
                common: { name: btn, type: 'boolean', role: 'button', read: false, write: true, def: false },
                native: {},
            });
        }
    }

    private async applyPlayer(player: Player): Promise<void> {
        const safeId = sanitizeId(player.player_id);
        this.playerIds.set(safeId, player.player_id);
        await this.ensurePlayerObjects(safeId, player.name);

        const base = `players.${safeId}`;
        await this.setStateAsync(`${base}.playerId`, player.player_id, true);
        await this.setStateAsync(`${base}.name`, player.name, true);
        await this.setStateAsync(`${base}.available`, !!player.available, true);
        await this.setStateAsync(`${base}.powered`, !!player.powered, true);
        await this.setStateAsync(`${base}.playbackState`, player.playback_state, true);
        await this.setStateAsync(`${base}.volume`, player.volume_level ?? 0, true);
        await this.setStateAsync(`${base}.muted`, !!player.volume_muted, true);
        await this.setStateAsync(`${base}.activeSource`, player.active_source ?? '', true);

        const media = player.current_media;
        await this.setStateAsync(`${base}.mediaTitle`, media?.title ?? '', true);
        await this.setStateAsync(`${base}.mediaArtist`, media?.artist ?? '', true);
        await this.setStateAsync(`${base}.mediaAlbum`, media?.album ?? '', true);
        await this.setStateAsync(`${base}.mediaImage`, media?.image_url ?? '', true);
        await this.setStateAsync(`${base}.elapsedTime`, player.elapsed_time ?? media?.elapsed_time ?? 0, true);
    }

    // ---------- Player queues ----------

    private async ensureQueueObjects(safeId: string, name: string): Promise<void> {
        if (this.knownQueueObjects.has(safeId)) {
            return;
        }
        this.knownQueueObjects.add(safeId);
        const base = `queues.${safeId}`;

        await this.setObjectNotExistsAsync(base, {
            type: 'channel',
            common: { name },
            native: {},
        });

        const states: Record<string, ioBroker.StateCommon> = {
            queueId: { name: 'Queue ID', type: 'string', role: 'text', read: true, write: false },
            displayName: { name: 'Display name', type: 'string', role: 'text', read: true, write: false },
            available: { name: 'Available', type: 'boolean', role: 'indicator.reachable', read: true, write: false },
            state: { name: 'State', type: 'string', role: 'media.state', read: true, write: false },
            shuffleEnabled: { name: 'Shuffle', type: 'boolean', role: 'media.mode.shuffle', read: true, write: true },
            repeatMode: {
                name: 'Repeat mode',
                type: 'string',
                role: 'media.mode.repeat',
                read: true,
                write: true,
                states: { off: 'off', one: 'one', all: 'all' },
            },
            elapsedTime: {
                name: 'Elapsed time',
                type: 'number',
                role: 'media.elapsed',
                unit: 's',
                read: true,
                write: false,
            },
            currentItemName: { name: 'Current item', type: 'string', role: 'media.title', read: true, write: false },
        };
        for (const [key, common] of Object.entries(states)) {
            await this.setObjectNotExistsAsync(`${base}.${key}`, {
                type: 'state',
                common: { ...common, def: common.type === 'boolean' ? false : common.type === 'number' ? 0 : '' },
                native: {},
            });
        }

        await this.setObjectNotExistsAsync(`${base}.control`, {
            type: 'channel',
            common: { name: 'Control' },
            native: {},
        });
        const buttons = ['play', 'pause', 'playPause', 'stop', 'next', 'previous'];
        for (const btn of buttons) {
            await this.setObjectNotExistsAsync(`${base}.control.${btn}`, {
                type: 'state',
                common: { name: btn, type: 'boolean', role: 'button', read: false, write: true, def: false },
                native: {},
            });
        }
    }

    private async applyQueue(queue: PlayerQueue): Promise<void> {
        const safeId = sanitizeId(queue.queue_id);
        this.queueIds.set(safeId, queue.queue_id);
        await this.ensureQueueObjects(safeId, queue.display_name);

        const base = `queues.${safeId}`;
        await this.setStateAsync(`${base}.queueId`, queue.queue_id, true);
        await this.setStateAsync(`${base}.displayName`, queue.display_name, true);
        await this.setStateAsync(`${base}.available`, !!queue.available, true);
        await this.setStateAsync(`${base}.state`, queue.state, true);
        await this.setStateAsync(`${base}.shuffleEnabled`, !!queue.shuffle_enabled, true);
        await this.setStateAsync(`${base}.repeatMode`, queue.repeat_mode, true);
        await this.setStateAsync(`${base}.elapsedTime`, queue.elapsed_time ?? 0, true);
        await this.setStateAsync(`${base}.currentItemName`, queue.current_item?.name ?? '', true);
    }

    // ---------- Command dispatch ----------

    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (!state || state.ack !== false || !this.client) {
            return;
        }

        const relative = id.substring(this.namespace.length + 1); // strip "music-assistant.0."
        const parts = relative.split('.');

        try {
            if (parts[0] === 'players' && parts.length >= 3) {
                await this.handlePlayerCommand(parts[1], parts.slice(2), state);
            } else if (parts[0] === 'queues' && parts.length >= 3) {
                await this.handleQueueCommand(parts[1], parts.slice(2), state);
            }
            await this.setStateAsync(id, state.val, true);
        } catch (err) {
            this.log.error(`Command for ${id} failed: ${(err as Error).message}`);
        }
    }

    private async handlePlayerCommand(safeId: string, path: string[], state: ioBroker.State): Promise<void> {
        const playerId = this.playerIds.get(safeId);
        if (!playerId || !this.client) {
            return;
        }

        if (path[0] === 'control' && path[1]) {
            const cmdByButton: Record<string, string> = {
                play: 'players/cmd/play',
                pause: 'players/cmd/pause',
                playPause: 'players/cmd/play_pause',
                stop: 'players/cmd/stop',
                next: 'players/cmd/next',
                previous: 'players/cmd/previous',
            };
            const command = cmdByButton[path[1]];
            if (command) {
                await this.client.sendCommand(command, { player_id: playerId });
            }
            return;
        }

        if (path[0] === 'powered') {
            await this.client.sendCommand('players/cmd/power', { player_id: playerId, powered: !!state.val });
        } else if (path[0] === 'volume') {
            await this.client.sendCommand('players/cmd/volume_set', {
                player_id: playerId,
                volume_level: Number(state.val),
            });
        } else if (path[0] === 'muted') {
            await this.client.sendCommand('players/cmd/volume_mute', { player_id: playerId, muted: !!state.val });
        }
    }

    private async handleQueueCommand(safeId: string, path: string[], state: ioBroker.State): Promise<void> {
        const queueId = this.queueIds.get(safeId);
        if (!queueId || !this.client) {
            return;
        }

        if (path[0] === 'control' && path[1]) {
            const cmdByButton: Record<string, string> = {
                play: 'player_queues/play',
                pause: 'player_queues/pause',
                playPause: 'player_queues/play_pause',
                stop: 'player_queues/stop',
                next: 'player_queues/next',
                previous: 'player_queues/previous',
            };
            const command = cmdByButton[path[1]];
            if (command) {
                await this.client.sendCommand(command, { queue_id: queueId });
            }
            return;
        }

        if (path[0] === 'shuffleEnabled') {
            await this.client.sendCommand('player_queues/shuffle', { queue_id: queueId, shuffle_enabled: !!state.val });
        } else if (path[0] === 'repeatMode') {
            await this.client.sendCommand('player_queues/repeat', { queue_id: queueId, repeat_mode: state.val });
        }
    }

    private onUnload(callback: () => void): void {
        try {
            this.client?.close();
            this.client = null;
            callback();
        } catch (error) {
            this.log.error(`Error during unloading: ${(error as Error).message}`);
            callback();
        }
    }
}

if (require.main !== module) {
    module.exports = (options: Partial<utils.AdapterOptions> | undefined) => new MusicAssistant(options);
} else {
    (() => new MusicAssistant())();
}
