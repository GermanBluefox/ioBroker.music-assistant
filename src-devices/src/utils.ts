// Helpers of the Music Assistant widget for ioBroker.devices.
//
// The adapter creates one channel per player under `music-assistant.<instance>.players.<player>`, where
// `<player>` is the player ID of Music Assistant made safe for an object ID, and `common.name` of that
// channel is the name of the player. Every value the widget needs is a state directly below that channel.

/** `music-assistant.<instance>.players.<player>.<name>` */
export function stateId(instance: string, player: string, name: string): string {
    return `${instance}.players.${player}.${name}`;
}

/** `125` -> `2:05`, `3725` -> `1:02:05`. Used for the elapsed/duration labels. */
export function timeString(seconds: number): string {
    if (!seconds || seconds < 0 || !isFinite(seconds)) {
        return '0:00';
    }
    const s = Math.floor(seconds % 60)
        .toString()
        .padStart(2, '0');
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    return h ? `${h}:${m.toString().padStart(2, '0')}:${s}` : `${m}:${s}`;
}

/** A source of a player: its own queue of Music Assistant or a native one (Spotify Connect, AirPlay, ...) */
export interface MaSource {
    id: string;
    name: string;
}

/**
 * The sources of a player from `common.states` of its `source` state, which the adapter keeps up to date - the
 * own queue first
 *
 * @param obj the object `music-assistant.<instance>.players.<player>.source`
 */
export function getSources(obj: ioBroker.Object | null | undefined): MaSource[] {
    const states = obj?.type === 'state' ? obj.common.states : undefined;
    if (!states) {
        return [];
    }
    if (typeof states === 'string') {
        return states
            .split(';')
            .map(part => part.split(':'))
            .filter(([id]) => id)
            .map(([id, ...name]) => ({ id, name: name.join(':') || id }));
    }
    if (Array.isArray(states)) {
        return states.map(name => ({ id: String(name), name: String(name) }));
    }
    return Object.entries(states).map(([id, name]) => ({ id, name: String(name ?? id) }));
}
