/*
 * ioBroker.music-assistant
 */
import * as utils from '@iobroker/adapter-core';

import { MaAuthError, MaClient, type MaEvent } from './lib/ma-client';
import type { Player, PlayerQueue, SearchResults } from './lib/ma-types';
import {
    type ButtonDefinition,
    defaultValue,
    MEDIA_STATE,
    NUMBER_TO_REPEAT,
    parsePlayMedia,
    pickSearchResult,
    PLAYER_BUTTONS,
    PLAYER_STATES,
    QUEUE_BUTTONS,
    QUEUE_STATES,
    REPEAT_TO_NUMBER,
} from './lib/objects';

/** Port of the web interface and the API of the Music Assistant container (host network mode) */
const DOCKER_PORT = 8095;
/** Ports the Music Assistant container occupies on the host: web interface/API and audio streams */
const DOCKER_USED_PORTS = [DOCKER_PORT, 8097];
/** Music Assistant refuses shorter passwords on the first-time setup */
const MIN_PASSWORD_LENGTH = 8;
/** Settings with folders of the host that docker-compose.yaml mounts into the container */
const MEDIA_FOLDER_SETTINGS = ['mediaFolder1', 'mediaFolder2', 'mediaFolder3'] as const;
/**
 * `/path/on/host:/path/in/container` with an optional `:ro`/`:rw`, as the validator in jsonConfig checks
 * it. `/data` is taken by the volume with the settings and the library of Music Assistant.
 */
const MEDIA_FOLDER_RE = /^\/[^:]+:\/(?!data(?:[/:]|$))[^:]+(?::(?:ro|rw))?$/;

/** Feature of js-controller 8 for the registry of exclusive resources (e.g. TCP ports) */
const USED_RESOURCES_FEATURE = 'CONTROLLER_USED_RESOURCES';

type TcpPortResource = { port: number; bind?: string };

/** What happens after a command: acknowledge the written value, read the real values back, or nothing */
type CommandResult = 'ack' | 'refresh' | 'none';

/**
 * The part of the exclusive-resource API of js-controller 8 used here. The installed types and older
 * controllers do not have it, so it is probed at runtime.
 */
interface UsedResourcesApi {
    registerUsedResource?: (type: 'tcpPort', data: TcpPortResource) => Promise<void>;
    checkUsedResource?: (type: 'tcpPort', data?: Partial<TcpPortResource>) => Promise<{ instance: string }[]>;
    supportsFeature?: (feature: string) => boolean;
}

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
        // Writing the own instance object makes js-controller restart the instance, so nothing
        // else may be started before. It only writes when the link differs.
        if (await this.updateWebUiLink()) {
            this.log.info('The link to the Music Assistant web interface was updated, the instance restarts');
            return;
        }

        await this.setState('info.connection', false, true);

        const docker = !!this.config.dockerMusicAssistant?.enabled;
        // The container runs in the network of the host (see docker-compose.yaml), so the server
        // is always reachable on the default port of the ioBroker host itself.
        const host = (docker ? '127.0.0.1' : (this.config.host as string | undefined)?.trim()) || '';
        const port = docker ? DOCKER_PORT : Number(this.config.port) || 8095;
        // In Docker mode the adapter owns the server: it creates the admin user itself and signs in with
        // username/password, so no token is needed. Otherwise, a token or username/password may be used.
        const token = docker ? undefined : (this.config.token as string | undefined)?.trim();
        const username = (this.config.username as string | undefined)?.trim();
        const password = this.config.password as string | undefined;

        if (docker) {
            void this.reportUsedPorts();
            // the plugin has already created the container with them, an invalid entry is skipped or
            // taken for a named volume by it
            for (const key of MEDIA_FOLDER_SETTINGS) {
                const folder = this.config.dockerMusicAssistant?.[key];
                if (folder && !MEDIA_FOLDER_RE.test(folder)) {
                    this.log.warn(
                        `Folder "${folder}" is not of the form "/path/on/host:/path/in/container[:ro]" and is not mounted as intended`,
                    );
                }
            }
            if (!username || !password || password.length < MIN_PASSWORD_LENGTH) {
                this.log.error(
                    `Music Assistant runs in Docker: enter a username and a password with at least ${MIN_PASSWORD_LENGTH} characters in the adapter settings`,
                );
                return;
            }
        } else if (!host || (!token && !(username && password))) {
            this.log.error(
                'Music Assistant host and an API token or username/password must be configured in the adapter settings',
            );
            return;
        }

        // the parent objects must not be devices: the type-detector would name every player after them
        await this.extendObjectAsync('players', { type: 'folder', common: { name: 'Players' }, native: {} });
        await this.extendObjectAsync('queues', { type: 'folder', common: { name: 'Queues' }, native: {} });

        // only writes with ack=false are handled, see onStateChange
        this.subscribeStates('players.*');
        this.subscribeStates('queues.*');

        const client = new MaClient(
            host,
            port,
            { token, username, password, setupIfNeeded: docker },
            {
                setTimeout: (cb, ms) => this.setTimeout(cb, ms),
                clearTimeout: timer => this.clearTimeout(timer),
            },
        );
        this.client = client;

        client.on('setupDone', (user: string) =>
            this.log.info(
                `Created the admin user "${user}" in Music Assistant. Log in with it at http://<ioBroker-host>:${DOCKER_PORT} to finish the setup (music sources, player providers)`,
            ),
        );
        client.on('authFailed', (err: MaAuthError) => {
            this.log.error(`${err.message}. Correct the credentials in the adapter settings`);
            void this.setState('info.connection', false, true);
        });

        client.on('connected', () => {
            this.log.info('Connected to Music Assistant server');
            void this.setState('info.connection', true, true);
            this.syncAll().catch((err: Error) => this.log.error(`Initial sync failed: ${err.message}`));
        });
        client.on('disconnected', () => {
            this.log.warn('Lost connection to Music Assistant server, will keep retrying');
            void this.setState('info.connection', false, true);
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
            // refused credentials are reported by 'authFailed' already
            if (!(err instanceof MaAuthError)) {
                // the client keeps retrying in the background; just log the first failure
                this.log.warn(`Could not connect to Music Assistant server: ${(err as Error).message}`);
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
    private async updateWebUiLink(): Promise<boolean> {
        const instanceObj = await this.getForeignObjectAsync(`system.adapter.${this.namespace}`);
        if (!instanceObj?.common) {
            return false;
        }
        const localLinks: Record<string, any> = { ...((instanceObj.common.localLinks as Record<string, any>) || {}) };
        let link: Record<string, any> | undefined;
        if (this.config.dockerMusicAssistant?.enabled) {
            link = {
                // `%ip%` lets admin find the address of the host that is reachable from the browser
                link: `http://%ip%:${DOCKER_PORT}/`,
                name: 'Music Assistant',
                description: {
                    en: 'Web interface of Music Assistant running in Docker',
                    de: 'Weboberfläche des in Docker laufenden Music Assistant',
                    ru: 'Веб-интерфейс Music Assistant, работающего в Docker',
                },
                color: '#03A9F4',
                intro: true,
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
            this.log.warn(`Cannot update the link to the Music Assistant web interface: ${(err as Error).message}`);
            return false;
        }
        return true;
    }

    /**
     * Whether the used ports may be reported to the registry of js-controller 8.
     * A host without the feature never answers, so every call would sit out the timeout of the adapter API.
     */
    private canReportUsedResources(): boolean {
        const api = this as unknown as UsedResourcesApi;
        if (typeof api.registerUsedResource !== 'function' || typeof api.checkUsedResource !== 'function') {
            this.log.debug('Used ports are not reported: js-controller is older than 8');
            return false;
        }
        if (typeof api.supportsFeature !== 'function' || !api.supportsFeature(USED_RESOURCES_FEATURE)) {
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
    private async reportUsedPorts(): Promise<void> {
        if (!this.canReportUsedResources()) {
            return;
        }
        const api = this as unknown as Required<UsedResourcesApi>;
        for (const port of DOCKER_USED_PORTS) {
            try {
                const holders = await api.checkUsedResource('tcpPort', { port });
                if (holders.length) {
                    this.log.warn(
                        `Port ${port} is already used by ${holders.map(h => h.instance).join(', ')}. Music Assistant in Docker will probably not work.`,
                    );
                }
            } catch (err) {
                this.log.debug(`Cannot check if port ${port} is free: ${(err as Error).message}`);
            }
            try {
                await api.registerUsedResource('tcpPort', { port });
            } catch (err) {
                this.log.warn(`Cannot register port ${port} as used: ${(err as Error).message}`);
            }
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
    private async removeDeletedPlayers(players: Player[], queues: PlayerQueue[]): Promise<void> {
        if (!this.client) {
            return;
        }
        let configs: { player_id: string }[];
        try {
            configs = await this.client.sendCommand<{ player_id: string }[]>('config/players');
        } catch (err) {
            // e.g. a user without the right to read the player configuration: better keep stale objects
            this.log.debug(`Cannot read the player configurations, no clean-up: ${(err as Error).message}`);
            return;
        }
        const keep = new Set([...players, ...configs].map(p => sanitizeId(p.player_id)));
        await this.removeStaleChannels('players', keep);
        for (const queue of queues) {
            keep.add(sanitizeId(queue.queue_id));
        }
        await this.removeStaleChannels('queues', keep);
    }

    /**
     * Deletes the channels below `players` or `queues` whose player or queue Music Assistant no longer reports.
     *
     * @param folder `players` or `queues`
     * @param keep the sanitized ids that still exist
     */
    private async removeStaleChannels(folder: 'players' | 'queues', keep: Set<string>): Promise<void> {
        const channels = await this.getForeignObjectsAsync(`${this.namespace}.${folder}.*`, 'channel');
        const prefix = `${this.namespace}.${folder}.`;
        const stale = new Set<string>();
        for (const id of Object.keys(channels)) {
            const safeId = id.substring(prefix.length).split('.')[0];
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
    private async removeChannel(folder: 'players' | 'queues', safeId: string): Promise<void> {
        if (folder === 'players') {
            this.playerIds.delete(safeId);
            this.knownPlayerObjects.delete(safeId);
        } else {
            this.queueIds.delete(safeId);
            this.knownQueueObjects.delete(safeId);
        }
        try {
            await this.delObjectAsync(`${folder}.${safeId}`, { recursive: true });
        } catch (err) {
            this.log.warn(`Cannot delete ${folder}.${safeId}: ${(err as Error).message}`);
        }
    }

    private async handleEvent(evt: MaEvent): Promise<void> {
        switch (evt.event) {
            case 'player_added':
            case 'player_updated':
                await this.applyPlayer(evt.data as Player);
                break;
            case 'player_removed': {
                // a player is only reported as removed when it is deleted for good; its queue goes with it
                const safeId = sanitizeId(evt.object_id);
                this.log.info(`Player ${evt.object_id} was removed from Music Assistant`);
                await this.removeChannel('players', safeId);
                await this.removeChannel('queues', safeId);
                break;
            }
            case 'queue_added':
            case 'queue_updated':
                await this.applyQueue(evt.data as PlayerQueue);
                break;
            case 'queue_time_updated': {
                const safeId = sanitizeId(evt.object_id);
                const data = evt.data as { elapsed_time?: number } | undefined;
                if (data && typeof data.elapsed_time === 'number') {
                    if (this.queueIds.has(safeId)) {
                        await this.setStateChangedAsync(`queues.${safeId}.elapsedTime`, data.elapsed_time, true);
                    }
                    // the queue of a player has the id of the player
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
    private async writeChannelObjects(
        base: string,
        name: string,
        channelRole: string | undefined,
        states: Record<string, ioBroker.StateCommon>,
        buttons: Record<string, ButtonDefinition>,
        buttonChannel: string,
    ): Promise<void> {
        await this.extendObjectAsync(base, {
            type: 'channel',
            common: channelRole ? { name, role: channelRole } : { name },
            native: {},
        });
        for (const [key, common] of Object.entries(states)) {
            await this.extendObjectAsync(`${base}.${key}`, {
                type: 'state',
                common: { ...common, def: defaultValue(common) },
                native: {},
            });
        }
        const buttonBase = buttonChannel ? `${base}.${buttonChannel}` : base;
        if (buttonChannel) {
            await this.extendObjectAsync(buttonBase, { type: 'channel', common: { name: 'Control' }, native: {} });
        }
        for (const [key, btn] of Object.entries(buttons)) {
            await this.extendObjectAsync(`${buttonBase}.${key}`, {
                type: 'state',
                common: { name: btn.name, type: 'boolean', role: btn.role, read: false, write: true, def: false },
                native: {},
            });
        }
    }

    // ---------- Players ----------

    private async ensurePlayerObjects(safeId: string, name: string): Promise<void> {
        if (this.knownPlayerObjects.has(safeId)) {
            return;
        }
        this.knownPlayerObjects.add(safeId);
        const base = `players.${safeId}`;

        // Up to 0.0.2 the buttons were in `players.<id>.control` with the role `button`. The type-detector
        // only recognizes a media player with the buttons in the channel itself, so they moved there.
        if (await this.getObjectAsync(`${base}.control`)) {
            this.log.info(`Moving the buttons of ${base} from "control" into the player channel`);
            await this.delObjectAsync(`${base}.control`, { recursive: true });
        }

        await this.writeChannelObjects(base, name, 'media.music', PLAYER_STATES, PLAYER_BUTTONS, '');
    }

    private async applyPlayer(player: Player): Promise<void> {
        const safeId = sanitizeId(player.player_id);
        this.playerIds.set(safeId, player.player_id);
        await this.ensurePlayerObjects(safeId, player.name);

        const base = `players.${safeId}`;
        const media = player.current_media;
        const values: Record<string, ioBroker.StateValue> = {
            playerId: player.player_id,
            name: player.name,
            available: !!player.available,
            powered: !!player.powered,
            state: MEDIA_STATE[player.playback_state] ?? MEDIA_STATE.unknown,
            playbackState: player.playback_state,
            volume: player.volume_level ?? 0,
            muted: !!player.volume_muted,
            activeSource: player.active_source ?? '',
            // the own queue of a player has the id of the player
            queueId: player.player_id,
            mediaTitle: media?.title ?? '',
            mediaArtist: media?.artist ?? '',
            mediaAlbum: media?.album ?? '',
            mediaImage: media?.image_url ?? '',
            elapsedTime: player.elapsed_time ?? media?.elapsed_time ?? 0,
            duration: media?.duration ?? 0,
        };
        for (const [key, val] of Object.entries(values)) {
            await this.setStateChangedAsync(`${base}.${key}`, val, true);
        }
    }

    // ---------- Player queues ----------

    private async ensureQueueObjects(safeId: string, name: string): Promise<void> {
        if (this.knownQueueObjects.has(safeId)) {
            return;
        }
        this.knownQueueObjects.add(safeId);
        await this.writeChannelObjects(`queues.${safeId}`, name, undefined, QUEUE_STATES, QUEUE_BUTTONS, 'control');
    }

    private async applyQueue(queue: PlayerQueue): Promise<void> {
        const safeId = sanitizeId(queue.queue_id);
        this.queueIds.set(safeId, queue.queue_id);
        await this.ensureQueueObjects(safeId, queue.display_name);

        const base = `queues.${safeId}`;
        const values: Record<string, ioBroker.StateValue> = {
            queueId: queue.queue_id,
            displayName: queue.display_name,
            available: !!queue.available,
            state: queue.state,
            shuffleEnabled: !!queue.shuffle_enabled,
            repeatMode: queue.repeat_mode,
            elapsedTime: queue.elapsed_time ?? 0,
            currentItemName: queue.current_item?.name ?? '',
        };
        for (const [key, val] of Object.entries(values)) {
            await this.setStateChangedAsync(`${base}.${key}`, val, true);
        }

        // shuffle and repeat belong to the queue; the player of the same id shows them too
        if (this.playerIds.has(safeId)) {
            await this.setStateChangedAsync(`players.${safeId}.shuffle`, !!queue.shuffle_enabled, true);
            await this.setStateChangedAsync(
                `players.${safeId}.repeat`,
                REPEAT_TO_NUMBER[queue.repeat_mode] ?? REPEAT_TO_NUMBER.off,
                true,
            );
        }
    }

    // ---------- Command dispatch ----------

    private async onStateChange(id: string, state: ioBroker.State | null | undefined): Promise<void> {
        if (!state || state.ack !== false || !this.client) {
            return;
        }

        const relative = id.substring(this.namespace.length + 1); // strip "music-assistant.0."
        const parts = relative.split('.');
        if (parts.length < 3 || (parts[0] !== 'players' && parts[0] !== 'queues')) {
            return;
        }

        let result: CommandResult = 'none';
        try {
            result =
                parts[0] === 'players'
                    ? await this.handlePlayerCommand(parts[1], parts.slice(2), state)
                    : await this.handleQueueCommand(parts[1], parts.slice(2), state);
        } catch (err) {
            this.log.error(`Command for ${id} failed: ${(err as Error).message}`);
            // show the real value again instead of the refused one
            result = 'refresh';
        }

        try {
            if (result === 'ack') {
                // buttons, seek and playMedia have no value of their own to read back
                await this.setState(id, state.val, true);
            } else if (result === 'refresh') {
                // Acknowledge with what Music Assistant reports, not with what was requested
                await this.refresh(parts[0], parts[1]);
            }
        } catch (err) {
            this.log.debug(`Cannot confirm ${id}: ${(err as Error).message}`);
        }
    }

    /**
     * Reads a player or queue anew and applies it, which acknowledges its states with the real values.
     *
     * @param folder `players` or `queues`
     * @param safeId sanitized id of the player or queue
     */
    private async refresh(folder: string, safeId: string): Promise<void> {
        if (!this.client) {
            return;
        }
        if (folder === 'players') {
            const playerId = this.playerIds.get(safeId);
            const player = playerId
                ? await this.client.sendCommand<Player | null>('players/get', { player_id: playerId })
                : null;
            if (player) {
                await this.applyPlayer(player);
            }
        }
        // shuffle/repeat of a player are those of its queue
        const queueId = this.queueIds.get(safeId);
        const queue = queueId
            ? await this.client.sendCommand<PlayerQueue | null>('player_queues/get', { queue_id: queueId })
            : null;
        if (queue) {
            await this.applyQueue(queue);
        }
    }

    private async handlePlayerCommand(safeId: string, path: string[], state: ioBroker.State): Promise<CommandResult> {
        const playerId = this.playerIds.get(safeId);
        if (!playerId || !this.client || path.length !== 1) {
            return 'none';
        }
        const key = path[0];

        const button = PLAYER_BUTTONS[key];
        if (button) {
            if (state.val) {
                await this.client.sendCommand(button.command, { player_id: playerId });
            }
            return 'ack';
        }

        switch (key) {
            case 'powered':
                await this.client.sendCommand('players/cmd/power', { player_id: playerId, powered: !!state.val });
                return 'refresh';
            case 'volume':
                await this.client.sendCommand('players/cmd/volume_set', {
                    player_id: playerId,
                    volume_level: Math.round(Math.min(100, Math.max(0, Number(state.val) || 0))),
                });
                return 'refresh';
            case 'muted':
                await this.client.sendCommand('players/cmd/volume_mute', { player_id: playerId, muted: !!state.val });
                return 'refresh';
            case 'shuffle':
                await this.client.sendCommand('player_queues/shuffle', {
                    queue_id: playerId,
                    shuffle_enabled: !!state.val,
                });
                return 'refresh';
            case 'repeat': {
                const mode = NUMBER_TO_REPEAT[Number(state.val)];
                if (!mode) {
                    throw new Error(`Unknown repeat mode ${String(state.val)}, use 0 (off), 1 (all) or 2 (one)`);
                }
                await this.client.sendCommand('player_queues/repeat', { queue_id: playerId, repeat_mode: mode });
                return 'refresh';
            }
            case 'seek':
                await this.client.sendCommand('players/cmd/seek', {
                    player_id: playerId,
                    position: Math.max(0, Math.round(Number(state.val) || 0)),
                });
                return 'ack';
            case 'playMedia':
                await this.playMedia(playerId, String(state.val ?? ''));
                return 'ack';
            default:
                return 'none';
        }
    }

    /**
     * Plays a URI, or searches for the text and plays the best hit, on the queue of a player.
     *
     * @param playerId id of the player in Music Assistant
     * @param text what was written into `playMedia`
     */
    private async playMedia(playerId: string, text: string): Promise<void> {
        const request = parsePlayMedia(text);
        if (!request || !this.client) {
            return;
        }
        let uri: string | undefined;
        if ('uri' in request) {
            uri = request.uri;
        } else {
            const results = await this.client.sendCommand<SearchResults>('music/search', {
                search_query: request.query,
                limit: 5,
                ...(request.mediaType ? { media_types: [request.mediaType] } : {}),
            });
            uri = pickSearchResult(results, request.query, request.mediaType);
            if (!uri) {
                throw new Error(`Nothing found for "${text}"`);
            }
            this.log.debug(`"${text}" → ${uri}`);
        }
        await this.client.sendCommand('player_queues/play_media', { queue_id: playerId, media: uri });
    }

    private async handleQueueCommand(safeId: string, path: string[], state: ioBroker.State): Promise<CommandResult> {
        const queueId = this.queueIds.get(safeId);
        if (!queueId || !this.client) {
            return 'none';
        }

        if (path[0] === 'control' && path.length === 2) {
            const button = QUEUE_BUTTONS[path[1]];
            if (!button) {
                return 'none';
            }
            if (state.val) {
                await this.client.sendCommand(button.command, { queue_id: queueId });
            }
            return 'ack';
        }

        if (path[0] === 'shuffleEnabled') {
            await this.client.sendCommand('player_queues/shuffle', { queue_id: queueId, shuffle_enabled: !!state.val });
            return 'refresh';
        }
        if (path[0] === 'repeatMode') {
            await this.client.sendCommand('player_queues/repeat', { queue_id: queueId, repeat_mode: state.val });
            return 'refresh';
        }
        return 'none';
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
