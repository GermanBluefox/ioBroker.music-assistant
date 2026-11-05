/** Tag of the custom element; a host checks that the module defines exactly this one */
export const TAG = 'iob-ma-player';

/** The built module, next to its manifest */
export const MODULE_FILE = 'ma-player.js';

/** The manifest the build writes next to the module; `common.webComponents` names this one */
export const MANIFEST_FILE = 'ma-player.json';

/** Where `tasks.mts` puts the module in the admin folder; the React import is relative to it */
export const MODULE_PATH = `webcomponents/${MODULE_FILE}`;

/** The states of `music-assistant.<n>.players.<id>` the player shows */
export const PLAYER_STATES = [
    'name',
    'available',
    'powered',
    'state',
    'volume',
    'muted',
    'shuffle',
    'repeat',
    'elapsedTime',
    'duration',
    'mediaTitle',
    'mediaArtist',
    'mediaAlbum',
    'mediaImage',
] as const;

/** The states the player writes - buttons, levels and switches of the player channel */
export type PlayerCommand =
    'playPause' | 'next' | 'previous' | 'volume' | 'muted' | 'shuffle' | 'repeat' | 'seek' | 'powered';

/** The values of the settings of the manifest; a setting without a value is missing */
export type PlayerSettings = {
    player?: string;
    title?: string;
    showCover?: boolean;
    showVolume?: boolean;
    showModes?: boolean;
    accent?: string;
};

/**
 * The channel of a player for an ID of the setting: the channel itself or one of its states
 *
 * @param id what the user picked, e.g. `music-assistant.0.players.kitchen` or `music-assistant.0.players.kitchen.volume`
 * @returns `music-assistant.0.players.kitchen`, or null if the ID is no player of Music Assistant
 */
export function getPlayerChannel(id: string | undefined): string | null {
    const match = id?.match(/^(music-assistant\.\d+\.players\.[^.]+)(\.|$)/);
    return match ? match[1] : null;
}

/**
 * Seconds as `m:ss`, or `h:mm:ss` from an hour on
 *
 * @param seconds the time in seconds
 */
export function formatTime(seconds: number): string {
    const total = Math.max(0, Math.floor(seconds || 0));
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = String(total % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}
