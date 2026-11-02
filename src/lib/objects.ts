/*
 * Object structure of the players and queues, and the pure helpers around it.
 *
 * The player channel is laid out the way @iobroker/type-detector expects a media player (pattern
 * `mediaPlayer`), so that ioBroker.assistant, ioBroker.devices, the material UI and others recognize
 * it: a numeric `media.state`, buttons with `button.play`/`button.pause`/..., repeat as a number.
 */
import type { PlayerQueue, SearchResults } from './ma-types';

/** A button of a player or queue and the Music Assistant command it triggers */
export interface ButtonDefinition {
    /** Name of the state */
    name: string;
    /** Role of the state, e.g. `button.play` */
    role: string;
    /** Music Assistant command sent when the button is pressed */
    command: string;
}

/** `media.state` of a player: 0 = pause, 1 = play, 2 = stop (the ioBroker convention) */
export const MEDIA_STATE: Record<string, number> = { paused: 0, playing: 1, idle: 2, unknown: 2 };

/** `media.mode.repeat` of a player: 0 = off, 1 = all, 2 = one (the ioBroker convention) */
export const REPEAT_TO_NUMBER: Record<string, number> = { off: 0, all: 1, one: 2, unknown: 0 };
export const NUMBER_TO_REPEAT: Record<number, PlayerQueue['repeat_mode']> = { 0: 'off', 1: 'all', 2: 'one' };

/** The states of `players.<id>` - all of them directly in the channel, as the type-detector expects */
export const PLAYER_STATES: Record<string, ioBroker.StateCommon> = {
    playerId: { name: 'Player ID', type: 'string', role: 'text', read: true, write: false },
    name: { name: 'Name', type: 'string', role: 'media.player.name', read: true, write: false },
    available: { name: 'Available', type: 'boolean', role: 'indicator.reachable', read: true, write: false },
    powered: { name: 'Powered', type: 'boolean', role: 'switch.power', read: true, write: true },
    state: {
        name: 'State',
        type: 'number',
        role: 'media.state',
        read: true,
        write: false,
        states: { 0: 'pause', 1: 'play', 2: 'stop' },
    },
    playbackState: { name: 'Playback state (raw)', type: 'string', role: 'text', read: true, write: false },
    volume: {
        name: 'Volume',
        type: 'number',
        role: 'level.volume',
        min: 0,
        max: 100,
        unit: '%',
        read: true,
        write: true,
    },
    muted: { name: 'Muted', type: 'boolean', role: 'media.mute', read: true, write: true },
    shuffle: { name: 'Shuffle', type: 'boolean', role: 'media.mode.shuffle', read: true, write: true },
    repeat: {
        name: 'Repeat',
        type: 'number',
        role: 'media.mode.repeat',
        read: true,
        write: true,
        states: { 0: 'off', 1: 'all', 2: 'one' },
    },
    activeSource: { name: 'Active source', type: 'string', role: 'text', read: true, write: false },
    queueId: { name: 'Queue ID', type: 'string', role: 'text', read: true, write: false },
    elapsedTime: { name: 'Elapsed time', type: 'number', role: 'media.elapsed', unit: 's', read: true, write: false },
    duration: { name: 'Duration', type: 'number', role: 'media.duration', unit: 's', read: true, write: false },
    seek: { name: 'Seek to position', type: 'number', role: 'media.seek', unit: 's', read: true, write: true },
    mediaTitle: { name: 'Title', type: 'string', role: 'media.title', read: true, write: false },
    mediaArtist: { name: 'Artist', type: 'string', role: 'media.artist', read: true, write: false },
    mediaAlbum: { name: 'Album', type: 'string', role: 'media.album', read: true, write: false },
    mediaImage: { name: 'Cover image URL', type: 'string', role: 'media.cover', read: true, write: false },
    playMedia: {
        name: 'Play media (URI or search text)',
        desc: 'A Music Assistant URI, or a search text with an optional prefix "artist:", "album:", "track:", "playlist:" or "radio:"',
        type: 'string',
        role: 'text',
        read: true,
        write: true,
    },
};

/** Buttons of a player. `playPause` gets a plain role: `button.play.*` would be taken for PLAY */
export const PLAYER_BUTTONS: Record<string, ButtonDefinition> = {
    play: { name: 'Play', role: 'button.play', command: 'players/cmd/play' },
    pause: { name: 'Pause', role: 'button.pause', command: 'players/cmd/pause' },
    playPause: { name: 'Play/pause', role: 'button', command: 'players/cmd/play_pause' },
    stop: { name: 'Stop', role: 'button.stop', command: 'players/cmd/stop' },
    next: { name: 'Next', role: 'button.next', command: 'players/cmd/next' },
    previous: { name: 'Previous', role: 'button.prev', command: 'players/cmd/previous' },
};

/**
 * The states of `queues.<id>`. A queue is deliberately not shaped as a media player (its state is a
 * string), so it does not show up as a second device next to its player.
 */
export const QUEUE_STATES: Record<string, ioBroker.StateCommon> = {
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
    elapsedTime: { name: 'Elapsed time', type: 'number', role: 'media.elapsed', unit: 's', read: true, write: false },
    currentItemName: { name: 'Current item', type: 'string', role: 'media.title', read: true, write: false },
};

/** Buttons of a queue, in the sub-channel `control` */
export const QUEUE_BUTTONS: Record<string, ButtonDefinition> = {
    play: { name: 'play', role: 'button', command: 'player_queues/play' },
    pause: { name: 'pause', role: 'button', command: 'player_queues/pause' },
    playPause: { name: 'playPause', role: 'button', command: 'player_queues/play_pause' },
    stop: { name: 'stop', role: 'button', command: 'player_queues/stop' },
    next: { name: 'next', role: 'button', command: 'player_queues/next' },
    previous: { name: 'previous', role: 'button', command: 'player_queues/previous' },
};

/**
 * Default value of a state by its type
 *
 * @param common common part of the state object
 */
export function defaultValue(common: ioBroker.StateCommon): ioBroker.StateValue {
    return common.type === 'boolean' ? false : common.type === 'number' ? 0 : '';
}

/** Media types that may prefix a search text, e.g. `artist:Queen`, with the matching result list */
const SEARCH_PREFIXES: Record<string, keyof SearchResults> = {
    artist: 'artists',
    album: 'albums',
    track: 'tracks',
    playlist: 'playlists',
    radio: 'radio',
    podcast: 'podcasts',
    audiobook: 'audiobooks',
    genre: 'genres',
};

/** The parsed value of a `playMedia` state: either a URI to play, or a search */
export type PlayMediaRequest = { uri: string } | { query: string; mediaType?: string };

/**
 * Parses what was written into `playMedia`.
 *
 * @param text a Music Assistant URI (`spotify://track/...`, `library://playlist/1`, an http URL),
 *   or a search text with an optional media type prefix (`artist:Queen`)
 * @returns undefined for an empty text
 */
export function parsePlayMedia(text: string): PlayMediaRequest | undefined {
    const value = text.trim();
    if (!value) {
        return undefined;
    }
    if (value.includes('://')) {
        return { uri: value };
    }
    const match = value.match(/^([a-z]+)\s*:\s*(.+)$/i);
    if (match && SEARCH_PREFIXES[match[1].toLowerCase()]) {
        return { query: match[2].trim(), mediaType: match[1].toLowerCase() };
    }
    return { query: value };
}

/** Order in which result lists are searched for an exact name match */
const EXACT_MATCH_ORDER: (keyof SearchResults)[] = [
    'artists',
    'playlists',
    'albums',
    'tracks',
    'radio',
    'podcasts',
    'audiobooks',
    'genres',
];
/** Order in which result lists are used when nothing matches exactly: the best track first */
const FALLBACK_ORDER: (keyof SearchResults)[] = [
    'tracks',
    'albums',
    'artists',
    'playlists',
    'radio',
    'podcasts',
    'audiobooks',
    'genres',
];

/**
 * Picks the item to play from the results of `music/search`: an item whose name is the search text
 * (an artist before a playlist, album or track of the same name), otherwise the best hit of the first
 * non-empty list, tracks first.
 *
 * @param results what `music/search` returned
 * @param query the search text
 * @param mediaType restricts the pick to one media type, as given by the prefix of the search text
 * @returns the URI of the picked item, or undefined if nothing was found
 */
export function pickSearchResult(results: SearchResults, query: string, mediaType?: string): string | undefined {
    const lists = mediaType ? [SEARCH_PREFIXES[mediaType]] : EXACT_MATCH_ORDER;
    const wanted = query.trim().toLowerCase();
    for (const list of lists) {
        const exact = (results[list] ?? []).find(item => item.name?.trim().toLowerCase() === wanted && item.uri);
        if (exact) {
            return exact.uri;
        }
    }
    for (const list of mediaType ? lists : FALLBACK_ORDER) {
        const first = (results[list] ?? []).find(item => item.uri);
        if (first) {
            return first.uri;
        }
    }
    return undefined;
}
