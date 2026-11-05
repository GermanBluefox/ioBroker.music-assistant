import type { RxWidgetInfoCustomComponentContext, VisRxWidgetState } from '@iobroker/types-vis-2';
import type VisRxWidget from '@iobroker/types-vis-2/visRxWidget';

/** The adapter whose players the widgets show */
export const ADAPTER = 'music-assistant';

/**
 * The states of a player channel `music-assistant.<n>.players.<id>` the player widget reads. Buttons
 * (`playPause`, `next`, `previous`) are written only.
 */
export const PLAYER_STATES = [
    'available',
    'duration',
    'elapsedTime',
    'mediaAlbum',
    'mediaArtist',
    'mediaImage',
    'mediaTitle',
    'muted',
    'name',
    'powered',
    'repeat',
    'shuffle',
    'state',
    'volume',
] as const;

export type PlayerStateName = (typeof PLAYER_STATES)[number];

/** The states of every player the widget shows as a chip: reachable, on, playing */
export const CHIP_STATES: PlayerStateName[] = ['available', 'powered', 'state'];

/** One player of an instance, taken from the channel objects under `music-assistant.<n>.players` */
export interface MaPlayerInfo {
    /** Last part of the channel ID: the player ID of Music Assistant, made safe for an object ID */
    player: string;
    /** Name of the player in Music Assistant */
    name: string;
}

type Socket = RxWidgetInfoCustomComponentContext['socket'];

/** `common.name` may be a plain string or a translation object */
export function getName(name: ioBroker.StringOrTranslated | undefined, lang: string): string {
    if (!name) {
        return '';
    }
    if (typeof name === 'string') {
        return name;
    }
    return name[lang as ioBroker.Languages] || name.en || '';
}

/**
 * `music-assistant.<n>` of the `instance` attribute, which is short and holds `0` - or a whole
 * `music-assistant.0`, as a binding may give it
 */
export function getNamespace(instance: string | number | undefined | null): string {
    const match = String(instance ?? '').match(/(\d+)$/);
    return `${ADAPTER}.${match ? parseInt(match[1], 10) : 0}`;
}

/**
 * All players of an instance, sorted by name. The adapter creates one channel per player directly under
 * `players`, with the name of the player as `common.name`.
 *
 * @param socket connection of vis-2
 * @param namespace `music-assistant.<n>`
 * @param lang language for a translated name
 */
export async function loadPlayers(socket: Socket, namespace: string, lang: string): Promise<MaPlayerInfo[]> {
    const prefix = `${namespace}.players.`;
    const channels: Record<string, ioBroker.Object | null | undefined> =
        (await socket.getObjectViewSystem('channel', prefix, `${prefix}香`)) || {};
    const players: MaPlayerInfo[] = [];
    for (const [id, obj] of Object.entries(channels)) {
        const player = id.substring(prefix.length);
        // only the players themselves, no channels below them
        if (player && !player.includes('.')) {
            players.push({ player, name: getName(obj?.common?.name, lang) || player });
        }
    }
    return players.sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Base class of the Music Assistant vis-2 widgets.
 *
 * `window.visRxWidget` is provided by the vis-2 runtime and must not be imported as a value:
 * a second copy of the base class would not be recognised by vis-2.
 */
export default class Generic<
    RxData extends Record<string, any>,
    State extends Partial<VisRxWidgetState> = VisRxWidgetState,
> extends (window.visRxWidget as typeof VisRxWidget)<RxData, State> {
    /** Prepended to every i18n key of this widget set, see `translations.ts` */
    static getI18nPrefix(): string {
        return 'mawidgets_';
    }

    /** `music-assistant.<n>` */
    getNamespace(): string {
        return getNamespace((this.state.rxData as { instance?: string }).instance);
    }

    /** `music-assistant.<n>.players.<player>.<name>` */
    getPlayerStateId(player: string, name: string): string {
        return `${this.getNamespace()}.players.${player}.${name}`;
    }

    /** All players of the instance, sorted by name */
    loadPlayers(): Promise<MaPlayerInfo[]> {
        return loadPlayers(this.props.context.socket, this.getNamespace(), this.props.context.lang);
    }
}
