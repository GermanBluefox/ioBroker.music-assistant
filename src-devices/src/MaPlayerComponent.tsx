// Music Assistant player widget for ioBroker.devices - one player per tile.
//
// Built like the SONOS player of ioBroker.sonos: the tile shows cover, title, artist and the progress,
// and a click on it opens the full player as a dialog - transport, shuffle, repeat, seek and volume.
//
//     music-assistant.<instance>.players.<player>.state         number   0 = pause, 1 = play, 2 = stop
//     music-assistant.<instance>.players.<player>.playPause     boolean  write-only button
//     music-assistant.<instance>.players.<player>.previous|next boolean  write-only buttons
//     music-assistant.<instance>.players.<player>.volume        number   0..100
//     music-assistant.<instance>.players.<player>.muted         boolean
//     music-assistant.<instance>.players.<player>.shuffle       boolean
//     music-assistant.<instance>.players.<player>.repeat        number   0 = off, 1 = all, 2 = one track
//     music-assistant.<instance>.players.<player>.seek          number   seconds
//     music-assistant.<instance>.players.<player>.powered       boolean  on/off
//     music-assistant.<instance>.players.<player>.available     boolean  player reachable
//     music-assistant.<instance>.players.<player>.source        string   active source; common.states lists them
//     music-assistant.<instance>.players.<player>.playMedia     string   URI to play, from the library (`getMedia`)
//     music-assistant.<instance>.players.<player>.media*        playback information
//
// The settings dialog fills the player picker from the `getPlayers` message of the adapter.

import WidgetGeneric, {
    React,
    MuiMaterial,
    getTileStyles,
    isNeumorphicTheme,
    AdapterReact,
    type WidgetGenericProps,
    type WidgetGenericState,
    type CustomWidgetPlugin,
} from '@iobroker/dm-widgets';
import type {
    BoxProps,
    DialogProps,
    MenuItemProps,
    SelectProps,
    SliderProps,
    Theme,
    TooltipProps,
    TypographyProps,
} from '@mui/material';
// `WidgetGeneric.getConfigSchema()` declares its return through dm-utils' copy of these types, so
// the override signature has to use the same source, while the schema literal is authored against
// the richer json-config types - hence the second import plus one cast at the return.
import type { ConfigItemPanel, ConfigItemTabs } from '@iobroker/dm-utils';
import type { ConfigItemPanel as JsonConfigItemPanel } from '@iobroker/json-config';
import type { I18n as I18nType, Icon as IconType } from '@iobroker/gui-components';

import { getSources, stateId, timeString, type MaSource } from './utils';
import { LibraryPanel, type LibraryAnswer, type LibraryList } from './LibraryPanel';
import {
    BackIcon,
    CollapseIcon,
    LibraryIcon,
    MA_BLUE,
    MusicIcon,
    MutedIcon,
    NextIcon,
    PauseIcon,
    PlayIcon,
    PowerIcon,
    PrevIcon,
    RepeatIcon,
    SourceIcon,
    RepeatOneIcon,
    ShuffleIcon,
    VolumeIcon,
} from './icons';

// Pull the components from the host-shared bridge instead of importing `@mui/material` directly,
// so the widget uses the host's React and MUI instances rather than a second copy of its own.
const Box: React.ComponentType<BoxProps> = MuiMaterial?.Box;
const Typography: React.ComponentType<TypographyProps> = MuiMaterial?.Typography;
const Slider: React.ComponentType<SliderProps> = MuiMaterial?.Slider;
const Tooltip: React.ComponentType<TooltipProps> = MuiMaterial?.Tooltip;
const Dialog: React.ComponentType<DialogProps> = MuiMaterial?.Dialog;
const Select: React.ComponentType<SelectProps<string>> = MuiMaterial?.Select;
const MenuItem: React.ComponentType<MenuItemProps> = MuiMaterial?.MenuItem;
const I18n = AdapterReact.I18n as typeof I18nType;
const Icon = AdapterReact.Icon as typeof IconType;

/** Every state the widget subscribes to, relative to the player channel */
const STATES = [
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
    'source',
    'state',
    'volume',
] as const;

type StateName = (typeof STATES)[number];

/** Tooltip of the repeat button per value of the `repeat` state */
const REPEAT_TITLES = ['madm_repeat', 'madm_repeat_all', 'madm_repeat_one'];

const DEFAULT_INSTANCE = 'music-assistant.0';

/** Translates a key of the widget, for the library panel */
const translate = (key: string): string => I18n.t(key);

/** How long the instance may take for the list of the library */
const LIBRARY_TIMEOUT = 15000;

interface MaPlayerSettings extends CustomWidgetPlugin {
    /** Adapter instance, e.g. `music-assistant.0` */
    instance?: string;
    /** Channel name of the player below `players` */
    player?: string;
    /** Show the album cover */
    showCover?: boolean;
    /** Show the volume slider */
    showVolume?: boolean;
    /** Show the progress bar with elapsed / total time */
    showSeek?: boolean;
    /** Show shuffle and repeat next to the transport buttons */
    showModes?: boolean;
    /** Show the choice of the source in the player, if the player has more than its own queue */
    showSource?: boolean;
    /** Show the button of the library of Music Assistant in the player */
    showLibrary?: boolean;
}

interface MaPlayerComponentState extends WidgetGenericState {
    /** Latest value of every subscribed state, keyed by the state name */
    values: Partial<Record<StateName, ioBroker.StateValue>>;
    /** When `elapsedTime` was written, in ms: the time runs on from there while the player plays */
    elapsedTs: number;
    /** Ticks every second while the player plays */
    now: number;
    /** Volume while the slider is being dragged, so it does not jump back to the old value */
    localVolume: number | null;
    /** Position in seconds while the progress slider is dragged or the jump is not confirmed yet */
    localSeek: number | null;
    /** The full player is a dialog on top of the tile, like the media player of ioBroker.devices */
    playerOpen: boolean;
    /** Cover URL that did not load (404, or http on an https page) - the placeholder is drawn instead */
    brokenCover: string;
    /** The sources of the player, from `common.states` of its `source` state */
    sources: MaSource[];
    /** The source the user picked, shown until the state follows: `was` is the value of the state then */
    pickedSource: { id: string; was: string } | null;
    /** The player dialog shows the library instead of the player */
    libraryOpen: boolean;
}

interface ButtonOptions {
    size?: number;
    /** Drawn in the accent colour with a dot below - shuffle and repeat while they are on */
    active?: boolean;
    title?: string;
    /** `primary` is the big filled play/pause button, everything else is a flat round button */
    variant?: 'plain' | 'primary';
}

/** A slider hands over an array for range sliders - all sliders here have a single value */
function sliderValue(value: number | number[]): number {
    return Array.isArray(value) ? value[0] : value;
}

/** CSS `background-image` value of a cover URL */
function coverImage(url: string): string {
    return `url("${encodeURI(url)}")`;
}

export class MaPlayerComponent extends WidgetGeneric<MaPlayerComponentState, MaPlayerSettings> {
    private subscribed: { id: string; handler: (id: string, state: ioBroker.State) => void }[] = [];

    /** Debounces the writes while the volume slider is dragged */
    private volumeTimer: ReturnType<typeof setTimeout> | null = null;

    /** Keeps the new position after a jump until the adapter reports it */
    private seekTimer: ReturnType<typeof setTimeout> | null = null;

    /** Lets the elapsed time run on between two updates of the adapter */
    private clock: ReturnType<typeof setInterval> | null = null;

    /** Shows the real source again if the player does not take the picked one */
    private sourceTimer: ReturnType<typeof setTimeout> | null = null;

    /** The object `players.<id>.source`, subscribed for the list of the sources */
    private sourceObjectId = '';

    /** Loads the cover a second time to notice a URL that does not load, see `checkCover` */
    private coverProbe: HTMLImageElement | null = null;

    /** The cover URL the last probe was started for */
    private probedCover = '';

    constructor(props: WidgetGenericProps<MaPlayerSettings>) {
        super(props);
        this.state = {
            ...this.state,
            values: {},
            elapsedTs: 0,
            now: Date.now(),
            localVolume: null,
            localSeek: null,
            playerOpen: false,
            brokenCover: '',
            sources: [],
            pickedSource: null,
            libraryOpen: false,
        };
    }

    static override getConfigSchema(): { name: string; schema: ConfigItemPanel | ConfigItemTabs } {
        const schema: JsonConfigItemPanel = {
            type: 'panel',
            items: {
                instance: {
                    type: 'instance',
                    adapter: 'music-assistant',
                    label: 'madm_instance',
                    default: DEFAULT_INSTANCE,
                    sm: 12,
                },
                player: {
                    // Asks the selected instance for its players, see `getPlayers` in src/main.ts
                    type: 'selectSendTo',
                    label: 'madm_player_select',
                    command: 'getPlayers',
                    // Re-query the list when the user picks another instance
                    alsoDependsOn: ['instance'],
                    instance: '${data.instance}',
                    sm: 12,
                },
                showCover: {
                    type: 'checkbox',
                    label: 'madm_show_cover',
                    default: true,
                    sm: 6,
                },
                showVolume: {
                    type: 'checkbox',
                    label: 'madm_show_volume',
                    default: true,
                    sm: 6,
                },
                showSeek: {
                    type: 'checkbox',
                    label: 'madm_show_seek',
                    default: true,
                    sm: 6,
                },
                showModes: {
                    type: 'checkbox',
                    label: 'madm_show_modes',
                    default: true,
                    sm: 6,
                },
                showSource: {
                    type: 'checkbox',
                    label: 'madm_show_source',
                    default: true,
                    sm: 6,
                },
                showLibrary: {
                    type: 'checkbox',
                    label: 'madm_show_library',
                    default: true,
                    sm: 6,
                },
                icon: {
                    type: 'component',
                    subType: 'iconSelect',
                    label: 'madm_icon',
                    sm: 6,
                },
                name: {
                    type: 'text',
                    label: 'madm_name',
                    sm: 6,
                },
            },
        };

        return { name: 'MaPlayer', schema };
    }

    private get instance(): string {
        return this.props.settings.instance || DEFAULT_INSTANCE;
    }

    private get player(): string {
        return this.props.settings.player || '';
    }

    componentDidMount(): void {
        super.componentDidMount?.();
        this.subscribeStates();
        this.subscribeSource();
        this.clock = setInterval(() => {
            if (this.playing) {
                this.setState({ now: Date.now() });
            }
        }, 1000);
    }

    componentDidUpdate(prevProps: Readonly<WidgetGenericProps<MaPlayerSettings>>): void {
        super.componentDidUpdate?.(prevProps, this.state);
        this.checkCover();
        // Compare the normalized values: `settings.player` may be undefined while the getter falls back
        // to an empty string. A raw comparison would then be true on every update and the setState below
        // would trigger the next componentDidUpdate forever (React error #185).
        const prevInstance = prevProps.settings.instance || DEFAULT_INSTANCE;
        const prevPlayer = prevProps.settings.player || '';
        if (prevInstance !== this.instance || prevPlayer !== this.player) {
            this.unsubscribeStates();
            this.setState({ values: {}, elapsedTs: 0, localVolume: null, localSeek: null, playerOpen: false }, () =>
                this.subscribeStates(),
            );
        }
        // the ID only changes with the player or the setting: no loop of updates
        if (this.wantedSourceObjectId() !== this.sourceObjectId) {
            this.subscribeSource();
        }
    }

    componentWillUnmount(): void {
        super.componentWillUnmount?.();
        this.unsubscribeStates();
        this.unsubscribeSource();
        if (this.coverProbe) {
            this.coverProbe.onload = null;
            this.coverProbe.onerror = null;
            this.coverProbe = null;
        }
        for (const timer of [this.volumeTimer, this.seekTimer, this.sourceTimer]) {
            if (timer) {
                clearTimeout(timer);
            }
        }
        this.volumeTimer = null;
        this.seekTimer = null;
        this.sourceTimer = null;
        if (this.clock) {
            clearInterval(this.clock);
            this.clock = null;
        }
    }

    private subscribeStates(): void {
        if (!this.player) {
            return;
        }
        const context = this.props.stateContext;
        for (const name of STATES) {
            const id = stateId(this.instance, this.player, name);
            const handler = (_id: string, state: ioBroker.State): void => {
                this.setState(prev => ({
                    values: { ...prev.values, [name]: state ? state.val : null },
                    elapsedTs: name === 'elapsedTime' ? state?.ts || 0 : prev.elapsedTs,
                    now: name === 'elapsedTime' ? Date.now() : prev.now,
                }));
            };
            context.getState(id, handler);
            this.subscribed.push({ id, handler });
        }
    }

    private unsubscribeStates(): void {
        const context = this.props.stateContext;
        for (const { id, handler } of this.subscribed) {
            context.removeState(id, handler);
        }
        this.subscribed = [];
    }

    /** The object with the sources of the player - none if they are not shown */
    private wantedSourceObjectId(): string {
        return this.player && this.props.settings.showSource !== false
            ? stateId(this.instance, this.player, 'source')
            : '';
    }

    private onSourceObject = (id: string, obj: ioBroker.Object | null | undefined): void => {
        if (id === this.sourceObjectId) {
            this.setState({ sources: getSources(obj) });
        }
    };

    private unsubscribeSource(): void {
        if (this.sourceObjectId) {
            const id = this.sourceObjectId;
            this.sourceObjectId = '';
            this.props.stateContext
                .getSocket()
                .unsubscribeObject(id, this.onSourceObject)
                .catch(() => {});
        }
    }

    /**
     * Reads the sources of the player and keeps them up to date. Through the socket, not `getObjectProperty` of
     * the host: that one keeps one listener per object, and two tiles may show the same player.
     */
    private subscribeSource(): void {
        this.unsubscribeSource();
        const id = this.wantedSourceObjectId();
        this.setState({ sources: [], pickedSource: null });
        if (!id) {
            return;
        }
        this.sourceObjectId = id;
        const socket = this.props.stateContext.getSocket();
        socket
            .getObject(id)
            .then(obj => this.onSourceObject(id, obj))
            // the player may have changed meanwhile
            .then(() => (this.sourceObjectId === id ? socket.subscribeObject(id, this.onSourceObject) : undefined))
            .catch((e: unknown) => console.warn(`Cannot read the sources of ${id}: ${e as string}`));
    }

    // ---- state access -------------------------------------------------------

    private str(name: StateName): string {
        const value = this.state.values[name];
        return value === null || value === undefined ? '' : String(value);
    }

    private num(name: StateName): number {
        return Number(this.state.values[name]) || 0;
    }

    /** Write to a state of this player */
    private set(name: string, value: ioBroker.StateValue): void {
        void this.props.stateContext.getSocket().setState(stateId(this.instance, this.player, name), value, false);
    }

    /** `media.state`: 0 = pause, 1 = play, 2 = stop */
    private get playing(): boolean {
        return this.num('state') === 1;
    }

    /** A player whose state has not arrived yet counts as on, so the tile does not flicker */
    private get powered(): boolean {
        return this.state.values.powered !== false;
    }

    private get muted(): boolean {
        return this.state.values.muted === true;
    }

    private get volume(): number {
        return this.state.localVolume ?? this.num('volume');
    }

    /** Seconds played; between two updates of the adapter it runs on by the clock */
    private get elapsed(): number {
        const duration = this.num('duration');
        let elapsed = this.num('elapsedTime');
        if (this.playing && this.state.elapsedTs) {
            elapsed += Math.max(0, this.state.now - this.state.elapsedTs) / 1000;
        }
        return duration > 0 ? Math.min(duration, elapsed) : elapsed;
    }

    private get displayName(): string {
        return (
            this.props.settings.name || this.state.name || this.str('name') || this.player || I18n.t('madm_no_player')
        );
    }

    /** The cover to draw, or an empty string - then the placeholder is shown - also when it does not load */
    private get cover(): string {
        const url = this.coverUrl;
        return url === this.state.brokenCover ? '' : url;
    }

    /**
     * A background image has no `onerror`, so the cover is loaded once more with an `Image`. If that
     * fails - the server of Music Assistant is not reachable from the browser, or the page is https and
     * the cover http - the placeholder is drawn instead. The next track brings a new URL, which is tried again.
     */
    private checkCover(): void {
        const url = this.coverUrl;
        if (url === this.probedCover) {
            return;
        }
        this.probedCover = url;
        if (this.coverProbe) {
            this.coverProbe.onload = null;
            this.coverProbe.onerror = null;
            this.coverProbe = null;
        }
        if (!url || url === this.state.brokenCover) {
            return;
        }
        const probe = new Image();
        probe.onload = () => {
            if (this.coverProbe === probe) {
                this.coverProbe = null;
            }
        };
        probe.onerror = () => {
            if (this.coverProbe === probe) {
                this.coverProbe = null;
                this.setState({ brokenCover: url });
            }
        };
        this.coverProbe = probe;
        probe.src = encodeURI(url);
    }

    /** The cover URL, or an empty string when there is none or it is switched off */
    private get coverUrl(): string {
        const cover = this.props.settings.showCover === false || !this.powered ? '' : this.str('mediaImage');
        if (!cover || /^(https?:|data:|\/\/)/.test(cover)) {
            return cover;
        }
        // a path in the file storage: the host knows its own prefix
        return this.props.stateContext.getImagePath(cover) || cover;
    }

    /** The widget colour if the user set one, otherwise the blue of Music Assistant */
    private get accent(): string {
        return this.getAccentColor() || MA_BLUE;
    }

    /** Title of the track, or a hint that nothing plays */
    private get title(): string {
        return this.str('mediaTitle') || I18n.t('madm_nothing_playing');
    }

    /** Artist, and the album if there is one */
    private get artist(): string {
        return this.str('mediaArtist') || this.str('mediaAlbum');
    }

    /** Why the player cannot be used - none selected or not reachable - or `null` */
    private get hint(): string | null {
        if (!this.player) {
            return I18n.t('madm_no_player');
        }
        return this.state.values.available === false ? I18n.t('madm_not_available') : null;
    }

    /** A stream has no duration, so there is no progress to show */
    private get showsProgress(): boolean {
        return this.props.settings.showSeek !== false && this.powered && this.num('duration') > 0;
    }

    /** Main and second line of the tiles: what is playing, or the player and why it is silent */
    private tileLines(): { title: string; subtitle: string } {
        const hint = this.hint;
        const name = this.displayName;
        if (hint) {
            return { title: name, subtitle: hint === name ? '' : hint };
        }
        if (!this.powered) {
            return { title: name, subtitle: I18n.t('madm_switched_off') };
        }
        return { title: this.title, subtitle: this.artist };
    }

    // ---- actions ------------------------------------------------------------

    private openPlayer = (): void => {
        if (!this.hint) {
            this.setState({ playerOpen: true });
        }
    };

    private closePlayer = (): void => this.setState({ playerOpen: false, libraryOpen: false });

    /** Asks the instance for a list of the library, see `getMedia` in src/main.ts */
    private loadLibrary = (
        list: LibraryList,
        search: string,
        offset: number,
        limit: number,
    ): Promise<LibraryAnswer> => {
        let timer: ReturnType<typeof setTimeout> | undefined;
        const timeout = new Promise<LibraryAnswer>((_resolve, reject) => {
            timer = setTimeout(() => reject(new Error(I18n.t('madm_library_error'))), LIBRARY_TIMEOUT);
        });
        const answer = this.props.stateContext
            .getSocket()
            .sendTo<LibraryAnswer>(this.instance, 'getMedia', { list, search, offset, limit });
        return Promise.race([answer, timeout]).finally(() => clearTimeout(timer));
    };

    private onLibraryPick = (uri: string): void => {
        this.set('playMedia', uri);
        this.setState({ libraryOpen: false });
    };

    /** The value is written 200 ms after the last move, so dragging does not flood the player */
    private onVolumeChange(value: number): void {
        this.setState({ localVolume: value });
        if (this.volumeTimer) {
            clearTimeout(this.volumeTimer);
        }
        this.volumeTimer = setTimeout(() => {
            this.volumeTimer = null;
            this.set('volume', value);
            this.setState({ localVolume: null });
        }, 200);
    }

    private onSourceChange(id: string): void {
        if (this.sourceTimer) {
            clearTimeout(this.sourceTimer);
        }
        this.setState({ pickedSource: { id, was: this.str('source') } });
        this.set('source', id);
        this.sourceTimer = setTimeout(() => {
            this.sourceTimer = null;
            this.setState({ pickedSource: null });
        }, 5000);
    }

    private onSeekChange(value: number, commit: boolean): void {
        if (this.seekTimer) {
            clearTimeout(this.seekTimer);
            this.seekTimer = null;
        }
        this.setState({ localSeek: value });
        if (!commit) {
            return;
        }
        this.set('seek', Math.round(value));
        // `elapsedTime` only follows once the player jumped - keep the new position until then,
        // so the slider does not snap back for a moment.
        this.seekTimer = setTimeout(() => {
            this.seekTimer = null;
            this.setState({ localSeek: null });
        }, 1500);
    }

    // ---- WidgetGeneric override points --------------------------------------

    protected isTileActive(): boolean {
        return this.playing;
    }

    protected hasTileAction(): boolean {
        return !this.hint;
    }

    protected onTileClick(): void {
        this.openPlayer();
    }

    protected getHistoryIds(): { id: string; color: string }[] {
        return this.player ? [{ id: stateId(this.instance, this.player, 'volume'), color: MA_BLUE }] : [];
    }

    protected renderTileIcon(): React.JSX.Element | null {
        const custom = this.playing
            ? this.props.settings?.iconActive || this.props.settings?.icon
            : this.props.settings?.icon;
        if (custom) {
            return (
                <Icon
                    src={custom}
                    style={{ width: 22, height: 22, flex: '0 0 auto' }}
                />
            );
        }
        return <MusicIcon />;
    }

    // ---- pieces -------------------------------------------------------------

    /** Round button. Rendered as a styled Box so no MUI button has to be bridged */
    private renderButton(
        key: string,
        content: React.ReactNode,
        onClick: () => void,
        opts?: ButtonOptions,
    ): React.JSX.Element {
        const size = opts?.size || 40;
        const primary = opts?.variant === 'primary';
        const accent = this.accent;

        const button = (
            <Box
                key={key}
                component="button"
                aria-label={opts?.title}
                onClick={(e: React.MouseEvent) => {
                    e.stopPropagation();
                    onClick();
                }}
                sx={theme => ({
                    all: 'unset',
                    boxSizing: 'border-box',
                    position: 'relative',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flex: '0 0 auto',
                    width: size,
                    height: size,
                    borderRadius: '50%',
                    cursor: 'pointer',
                    fontSize: `${Math.round(size * (primary ? 0.56 : 0.6))}px`,
                    lineHeight: 1,
                    transition: 'background-color 0.15s ease, transform 0.12s ease, opacity 0.15s ease',
                    '&:focus-visible': { outline: `2px solid ${accent}`, outlineOffset: '2px' },
                    ...(primary
                        ? {
                              color: theme.palette.background.paper,
                              backgroundColor: theme.palette.text.primary,
                              '&:hover': { opacity: 0.85, transform: 'scale(1.04)' },
                          }
                        : {
                              color: opts?.active ? accent : theme.palette.text.primary,
                              '&:hover': { backgroundColor: 'rgba(127,127,127,0.18)' },
                          }),
                    ...(opts?.active && !primary
                        ? {
                              '&::after': {
                                  content: '""',
                                  position: 'absolute',
                                  bottom: '2px',
                                  left: '50%',
                                  width: '4px',
                                  height: '4px',
                                  marginLeft: '-2px',
                                  borderRadius: '50%',
                                  backgroundColor: 'currentColor',
                              },
                          }
                        : {}),
                    '&:active': { transform: 'scale(0.92)' },
                })}
            >
                {content}
            </Box>
        );

        return opts?.title ? (
            <Tooltip
                key={key}
                title={opts.title}
            >
                <span style={{ display: 'flex' }}>{button}</span>
            </Tooltip>
        ) : (
            button
        );
    }

    /** Music note where no cover is available */
    private renderPlaceholder(fontSize: string, active: boolean): React.JSX.Element {
        return (
            <MusicIcon
                sx={{ fontSize, color: active ? this.accent : 'text.disabled', transition: 'color 0.25s ease' }}
            />
        );
    }

    /** Thin, non-interactive progress bar of the tiles */
    private renderProgressBar(height: number): React.JSX.Element | null {
        if (!this.showsProgress) {
            return null;
        }
        const percent = Math.min(100, Math.max(0, (this.elapsed / this.num('duration')) * 100));

        return (
            <Box
                sx={{
                    width: '100%',
                    height,
                    borderRadius: `${height / 2}px`,
                    overflow: 'hidden',
                    flexShrink: 0,
                    backgroundColor: 'rgba(127,127,127,0.3)',
                }}
            >
                <Box
                    sx={{
                        width: `${percent}%`,
                        height: '100%',
                        borderRadius: 'inherit',
                        backgroundColor: this.accent,
                        transition: 'width 1s linear',
                    }}
                />
            </Box>
        );
    }

    /** Progress bar with elapsed and total time, as the tiles show it */
    private renderTileProgress(fontSize: string, height: number, onCover: boolean): React.JSX.Element | null {
        if (this.hint || !this.showsProgress) {
            return null;
        }
        const label = {
            fontSize,
            lineHeight: 1,
            fontVariantNumeric: 'tabular-nums',
            color: onCover ? 'rgba(255,255,255,0.6)' : 'text.secondary',
        };

        return (
            <Box sx={{ mt: 0.5, display: 'flex', alignItems: 'center', gap: 0.5 }}>
                <Typography
                    variant="caption"
                    sx={label}
                >
                    {timeString(this.elapsed)}
                </Typography>
                <Box sx={{ flex: 1 }}>{this.renderProgressBar(height)}</Box>
                <Typography
                    variant="caption"
                    sx={label}
                >
                    {timeString(this.num('duration'))}
                </Typography>
            </Box>
        );
    }

    /** Name of the player as a small pill in the top left corner of the cover */
    private renderPlayerPill(): React.JSX.Element {
        return (
            <Box
                sx={{
                    position: 'absolute',
                    top: 'max(6px, 3cqi)',
                    left: 'max(6px, 3cqi)',
                    zIndex: 2,
                    display: 'flex',
                    maxWidth: 'calc(100% - 64px)',
                    px: 1,
                    py: 0.25,
                    borderRadius: '8px',
                    backgroundColor: 'rgba(0,0,0,0.5)',
                    backdropFilter: 'blur(4px)',
                    color: '#fff',
                }}
            >
                <Typography
                    ref={this.nameRef}
                    variant="caption"
                    noWrap
                    sx={{ fontWeight: 600, lineHeight: 1.5 }}
                >
                    {this.displayName}
                </Typography>
            </Box>
        );
    }

    /** Play/pause state and - while muted - the muted marker, drawn over the cover */
    private renderBadges(size: number, position: Record<string, string | number>): React.JSX.Element | null {
        if (this.hint || !this.powered) {
            return null;
        }
        const badge = (key: string, icon: React.JSX.Element): React.JSX.Element => (
            <Box
                key={key}
                sx={{
                    width: size,
                    height: size,
                    borderRadius: '8px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    backgroundColor: 'rgba(0,0,0,0.55)',
                    backdropFilter: 'blur(4px)',
                    color: '#fff',
                    fontSize: `${Math.round(size * 0.62)}px`,
                }}
            >
                {icon}
            </Box>
        );

        return (
            <Box sx={{ position: 'absolute', zIndex: 2, display: 'flex', alignItems: 'center', gap: 0.5, ...position }}>
                {this.muted ? badge('muted', <MutedIcon sx={{ fontSize: 'inherit' }} />) : null}
                {badge(
                    'play',
                    this.playing ? (
                        <PauseIcon sx={{ fontSize: 'inherit' }} />
                    ) : (
                        <PlayIcon sx={{ fontSize: 'inherit' }} />
                    ),
                )}
            </Box>
        );
    }

    /** The host's indicators and settings button - a click on them must not open the player */
    private renderTileIndicators(): React.JSX.Element {
        return (
            <div
                onClick={(e: React.MouseEvent) => e.stopPropagation()}
                style={{ display: 'contents' }}
            >
                {this.renderIndicators(this.renderSettingsButton())}
            </div>
        );
    }

    /** Frame and surface of the clickable tile - the same the host draws around its own widgets */
    private tileSx(theme: Theme): Record<string, unknown> {
        const clickable = !this.hint;
        return {
            boxSizing: 'border-box',
            position: 'relative',
            width: '100%',
            overflow: 'hidden',
            userSelect: 'none',
            cursor: clickable ? 'pointer' : 'default',
            ...(getTileStyles(
                theme,
                this.isTileActive(),
                this.getAccentColor(),
                clickable,
                this.getInactiveColor(),
            ) as Record<string, unknown>),
        };
    }

    /** The outer box the host sizes. The dialog sits next to the tile, so its clicks do not reach it */
    private renderFrame(outerStyle: (theme: Theme) => React.CSSProperties, tile: React.JSX.Element): React.JSX.Element {
        return (
            <Box
                id={String(this.props.widget.id)}
                className={this.getWidgetClass()}
                sx={outerStyle}
            >
                {tile}
                {this.renderPlayerDialog()}
            </Box>
        );
    }

    // ---- player dialog ------------------------------------------------------

    /** The source of the player as a small list below its name - if it has more than its own queue */
    private renderSource(): React.JSX.Element | null {
        const sources = this.state.sources;
        if (this.props.settings.showSource === false || sources.length < 2 || !Select || !MenuItem) {
            return null;
        }
        const value = this.str('source');
        const picked = this.state.pickedSource;
        // the state has moved on: show it
        const shown = picked && picked.was === value ? picked.id : value;
        // an active source the adapter has not named yet is shown with its ID
        const options = sources.some(s => s.id === shown) ? sources : [...sources, { id: shown, name: shown }];
        const accent = this.accent;

        return (
            <Select
                variant="standard"
                size="small"
                disableUnderline
                value={shown}
                inputProps={{ 'aria-label': I18n.t('madm_source') }}
                onChange={e => this.onSourceChange(String(e.target.value))}
                renderValue={id => (
                    <Box
                        component="span"
                        sx={{ display: 'flex', alignItems: 'center', gap: 0.5, minWidth: 0 }}
                    >
                        <SourceIcon sx={{ fontSize: '1rem', flex: '0 0 auto' }} />
                        <Box
                            component="span"
                            sx={{ overflow: 'hidden', textOverflow: 'ellipsis' }}
                        >
                            {options.find(s => s.id === id)?.name || id}
                        </Box>
                    </Box>
                )}
                sx={{
                    maxWidth: '100%',
                    fontSize: '0.8rem',
                    fontWeight: 600,
                    color: accent,
                    '& .MuiSelect-select': { py: 0.25 },
                    '& .MuiSelect-icon': { color: accent },
                }}
            >
                {options.map(source => (
                    <MenuItem
                        key={source.id}
                        value={source.id}
                    >
                        {source.name}
                    </MenuItem>
                ))}
            </Select>
        );
    }

    /** Collapse button and the player, below it the source; the button of the library on the right */
    private renderDialogHeader(): React.JSX.Element {
        if (this.state.libraryOpen) {
            return (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                    {this.renderButton(
                        'back',
                        <BackIcon sx={{ fontSize: 'inherit' }} />,
                        () => this.setState({ libraryOpen: false }),
                        { size: 34, title: I18n.t('madm_back') },
                    )}
                    <Typography
                        variant="subtitle1"
                        noWrap
                        sx={{ flex: 1, minWidth: 0, textAlign: 'center', fontWeight: 700 }}
                    >
                        {I18n.t('madm_library')}
                    </Typography>
                    <Box sx={{ width: 34, flex: '0 0 auto' }} />
                </Box>
            );
        }
        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, flexShrink: 0 }}>
                {this.renderButton('close', <CollapseIcon sx={{ fontSize: 'inherit' }} />, this.closePlayer, {
                    size: 34,
                    title: I18n.t('madm_close'),
                })}
                <Box sx={{ flex: 1, minWidth: 0, textAlign: 'center' }}>
                    <Typography
                        variant="caption"
                        noWrap
                        sx={{
                            display: 'block',
                            textTransform: 'uppercase',
                            fontWeight: 700,
                            letterSpacing: '0.1em',
                            fontSize: '0.65rem',
                            color: 'text.secondary',
                        }}
                    >
                        {this.displayName}
                    </Typography>
                    {this.renderSource()}
                </Box>
                {this.props.settings.showLibrary !== false ? (
                    this.renderButton(
                        'library',
                        <LibraryIcon sx={{ fontSize: 'inherit' }} />,
                        () => this.setState({ libraryOpen: true }),
                        { size: 34, title: I18n.t('madm_library') },
                    )
                ) : (
                    <Box sx={{ width: 34, flex: '0 0 auto' }} />
                )}
            </Box>
        );
    }

    /** The cover as large as the dialog allows, limited in landscape so the controls stay visible */
    private renderDialogCover(): React.JSX.Element | null {
        if (this.props.settings.showCover === false) {
            return null;
        }
        const cover = this.cover;

        return (
            <Box
                sx={{
                    width: '100%',
                    maxWidth: '40vh',
                    aspectRatio: '1',
                    alignSelf: 'center',
                    flexShrink: 0,
                    borderRadius: '12px',
                    overflow: 'hidden',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    ...(cover
                        ? { backgroundImage: coverImage(cover), backgroundSize: 'cover', backgroundPosition: 'center' }
                        : { backgroundColor: 'rgba(127,127,127,0.12)' }),
                }}
            >
                {cover ? null : this.renderPlaceholder('80px', false)}
            </Box>
        );
    }

    /** Title, artist and - when it adds something - the album */
    private renderDialogTitle(): React.JSX.Element {
        const { title, subtitle } = this.tileLines();
        const album = this.str('mediaAlbum');

        return (
            <Box sx={{ minWidth: 0 }}>
                <Typography
                    variant="h6"
                    noWrap
                    sx={{ fontWeight: 700, lineHeight: 1.3 }}
                >
                    {title}
                </Typography>
                <Typography
                    variant="body2"
                    noWrap
                    sx={{ color: 'text.secondary', fontWeight: 500 }}
                >
                    {subtitle || ' '}
                </Typography>
                {this.powered && album && album !== subtitle ? (
                    <Typography
                        variant="caption"
                        noWrap
                        sx={{ display: 'block', color: 'text.secondary', opacity: 0.8 }}
                    >
                        {album}
                    </Typography>
                ) : null}
            </Box>
        );
    }

    /** Progress slider to jump within the track, with elapsed and total time */
    private renderSeek(): React.JSX.Element | null {
        if (!this.showsProgress) {
            return null;
        }
        const duration = this.num('duration');
        const position = this.state.localSeek ?? this.elapsed;
        const label = { color: 'text.secondary', fontSize: '0.7rem', fontVariantNumeric: 'tabular-nums' };

        return (
            <Box>
                <Slider
                    size="small"
                    min={0}
                    max={duration}
                    step={1}
                    value={Math.min(duration, Math.max(0, position))}
                    valueLabelDisplay="off"
                    onChange={(_e: Event, value: number | number[]) => this.onSeekChange(sliderValue(value), false)}
                    onChangeCommitted={(_e: Event | React.SyntheticEvent, value: number | number[]) =>
                        this.onSeekChange(sliderValue(value), true)
                    }
                    sx={{
                        color: this.accent,
                        height: 4,
                        p: '4px 0 !important',
                        '& .MuiSlider-thumb': { width: 12, height: 12 },
                        '& .MuiSlider-rail': { opacity: 0.2 },
                    }}
                />
                <Box sx={{ display: 'flex', justifyContent: 'space-between', mt: -0.5 }}>
                    <Typography
                        variant="caption"
                        sx={label}
                    >
                        {timeString(position)}
                    </Typography>
                    <Typography
                        variant="caption"
                        sx={label}
                    >
                        {timeString(duration)}
                    </Typography>
                </Box>
            </Box>
        );
    }

    /** Shuffle - previous / play-pause / next - repeat; a player that is off gets the power button */
    private renderTransport(): React.JSX.Element {
        if (!this.powered) {
            return (
                <Box sx={{ display: 'flex', justifyContent: 'center' }}>
                    {this.renderButton(
                        'power',
                        <PowerIcon sx={{ fontSize: 'inherit' }} />,
                        () => this.set('powered', true),
                        {
                            size: 64,
                            variant: 'primary',
                            title: I18n.t('madm_power_on'),
                        },
                    )}
                </Box>
            );
        }
        const showModes = this.props.settings.showModes !== false;
        const shuffle = this.state.values.shuffle === true;
        const repeat = Math.min(2, Math.max(0, this.num('repeat')));

        return (
            <Box
                sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: showModes ? 'space-between' : 'center',
                    gap: 1,
                }}
            >
                {showModes
                    ? this.renderButton(
                          'shuffle',
                          <ShuffleIcon sx={{ fontSize: 'inherit' }} />,
                          () => this.set('shuffle', !shuffle),
                          {
                              size: 40,
                              active: shuffle,
                              title: I18n.t('madm_shuffle'),
                          },
                      )
                    : null}
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
                    {this.renderButton(
                        'prev',
                        <PrevIcon sx={{ fontSize: 'inherit' }} />,
                        () => this.set('previous', true),
                        {
                            size: 48,
                            title: I18n.t('madm_previous'),
                        },
                    )}
                    {this.renderButton(
                        'play',
                        this.playing ? (
                            <PauseIcon sx={{ fontSize: 'inherit' }} />
                        ) : (
                            <PlayIcon sx={{ fontSize: 'inherit' }} />
                        ),
                        () => this.set('playPause', true),
                        {
                            size: 64,
                            variant: 'primary',
                            title: I18n.t(this.playing ? 'madm_pause' : 'madm_play'),
                        },
                    )}
                    {this.renderButton(
                        'next',
                        <NextIcon sx={{ fontSize: 'inherit' }} />,
                        () => this.set('next', true),
                        {
                            size: 48,
                            title: I18n.t('madm_next'),
                        },
                    )}
                </Box>
                {showModes
                    ? this.renderButton(
                          'repeat',
                          repeat === 2 ? (
                              <RepeatOneIcon sx={{ fontSize: 'inherit' }} />
                          ) : (
                              <RepeatIcon sx={{ fontSize: 'inherit' }} />
                          ),
                          // off -> all -> one track -> off
                          () => this.set('repeat', (repeat + 1) % 3),
                          { size: 40, active: !!repeat, title: I18n.t(REPEAT_TITLES[repeat]) },
                      )
                    : null}
            </Box>
        );
    }

    /** Mute toggle and - unless switched off - the volume slider with the level */
    private renderVolume(): React.JSX.Element | null {
        if (!this.powered) {
            return null;
        }
        const muted = this.muted;
        const showVolume = this.props.settings.showVolume !== false;

        return (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                {this.renderButton(
                    'mute',
                    muted ? <MutedIcon sx={{ fontSize: 'inherit' }} /> : <VolumeIcon sx={{ fontSize: 'inherit' }} />,
                    () => this.set('muted', !muted),
                    { size: 34, active: muted, title: I18n.t(muted ? 'madm_unmute' : 'madm_mute') },
                )}
                {showVolume ? (
                    <Slider
                        size="small"
                        min={0}
                        max={100}
                        value={this.volume}
                        valueLabelDisplay="off"
                        onChange={(_e: Event, value: number | number[]) => this.onVolumeChange(sliderValue(value))}
                        sx={{
                            flex: 1,
                            color: this.accent,
                            '& .MuiSlider-thumb': { width: 12, height: 12 },
                            '& .MuiSlider-rail': { opacity: 0.2 },
                        }}
                    />
                ) : null}
                {showVolume ? (
                    <Typography
                        variant="caption"
                        sx={{
                            minWidth: 26,
                            textAlign: 'right',
                            color: 'text.secondary',
                            fontVariantNumeric: 'tabular-nums',
                        }}
                    >
                        {this.volume}
                    </Typography>
                ) : null}
            </Box>
        );
    }

    /** The full player, opened by a click on the tile */
    private renderPlayerDialog(): React.JSX.Element | null {
        if (!this.state.playerOpen) {
            return null;
        }

        return (
            <Dialog
                open
                onClose={this.closePlayer}
                fullWidth
                maxWidth="xs"
                slotProps={{
                    paper: {
                        sx: (theme: Theme) => ({
                            borderRadius: '24px',
                            background:
                                theme.palette.mode === 'dark'
                                    ? 'linear-gradient(180deg, #1a1a2e 0%, #0d0d14 100%)'
                                    : 'linear-gradient(180deg, #f5f5f5 0%, #e0e0e0 100%)',
                            overflow: 'hidden',
                            maxHeight: '90vh',
                        }),
                    },
                }}
            >
                <Box
                    sx={{
                        p: 3,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 2,
                        overflowY: 'auto',
                        maxHeight: '85vh',
                    }}
                >
                    {this.renderDialogHeader()}
                    {this.state.libraryOpen ? (
                        <LibraryPanel
                            load={this.loadLibrary}
                            t={translate}
                            storageKey={`${this.instance}.library`}
                            accent={this.accent}
                            onPick={this.onLibraryPick}
                        />
                    ) : (
                        <>
                            {this.renderDialogCover()}
                            {this.renderDialogTitle()}
                            {this.renderSeek()}
                            {this.renderTransport()}
                            {this.renderVolume()}
                        </>
                    )}
                </Box>
            </Dialog>
        );
    }

    // ---- sizes --------------------------------------------------------------

    /** 1x1 - the cover fills the tile, title, artist and progress over its lower part */
    renderCompact(): React.JSX.Element {
        const hint = this.hint;
        const cover = this.cover;
        const { title, subtitle } = this.tileLines();

        const tile = (
            <Box
                onClick={this.openPlayer}
                sx={theme => ({
                    ...this.tileSx(theme),
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'flex-end',
                    aspectRatio: '1',
                    textAlign: 'left',
                    padding: 0,
                })}
            >
                {cover ? (
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            backgroundImage: coverImage(cover),
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                        }}
                    />
                ) : (
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                        }}
                    >
                        {this.renderPlaceholder('max(3rem, 30cqi)', this.isTileActive())}
                    </Box>
                )}
                {cover ? (
                    // Darkens the lower part, so the text stays readable on a bright cover
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            pointerEvents: 'none',
                            background:
                                'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0.4) 50%, transparent 100%)',
                        }}
                    />
                ) : null}
                {hint ? null : this.renderPlayerPill()}
                {this.renderTileIndicators()}
                {cover ? this.renderBadges(28, { bottom: 'calc(50% + 4px)', left: 8 }) : null}

                <Box
                    sx={{
                        position: 'relative',
                        zIndex: 1,
                        minWidth: 0,
                        p: 'max(8px, 6cqi)',
                        pt: 0,
                        color: cover ? '#fff' : undefined,
                    }}
                >
                    <Typography
                        ref={hint ? this.nameRef : undefined}
                        variant="body2"
                        noWrap
                        sx={{
                            fontWeight: 700,
                            lineHeight: 1.3,
                            fontSize: 'max(0.75rem, 7.5cqi)',
                            textShadow: cover ? '0 1px 3px rgba(0,0,0,0.5)' : undefined,
                        }}
                    >
                        {title}
                    </Typography>
                    {subtitle ? (
                        <Typography
                            variant="caption"
                            noWrap
                            sx={{
                                display: 'block',
                                fontWeight: 500,
                                fontSize: 'max(0.6rem, 6cqi)',
                                color: cover ? 'rgba(255,255,255,0.7)' : 'text.secondary',
                                textShadow: cover ? '0 1px 2px rgba(0,0,0,0.5)' : undefined,
                            }}
                        >
                            {subtitle}
                        </Typography>
                    ) : null}
                    {this.renderTileProgress('max(0.5rem, 5cqi)', 3, !!cover)}
                </Box>
                {this.renderChart()}
            </Box>
        );

        return this.renderFrame(theme => WidgetGeneric.getStyleCompact(theme), tile);
    }

    /** 2x0.5 - blurred cover behind a thumbnail, the player, title · artist and the progress */
    renderWide(): React.JSX.Element {
        const hint = this.hint;
        const cover = this.cover;
        const { title, subtitle } = this.tileLines();
        const playing = !hint && this.powered;

        const tile = (
            <Box
                onClick={this.openPlayer}
                sx={theme => ({
                    ...this.tileSx(theme),
                    display: 'flex',
                    alignItems: 'center',
                    gap: 1.5,
                    height: 80,
                })}
            >
                {cover ? (
                    <Box
                        sx={{
                            position: 'absolute',
                            inset: 0,
                            backgroundImage: coverImage(cover),
                            backgroundSize: 'cover',
                            backgroundPosition: 'center',
                            filter: 'blur(12px) brightness(0.4)',
                            transform: 'scale(1.15)',
                        }}
                    />
                ) : null}

                <Box
                    sx={{
                        position: 'relative',
                        zIndex: 1,
                        flexShrink: 0,
                        width: 48,
                        height: 48,
                        borderRadius: '8px',
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        ...(cover
                            ? {
                                  backgroundImage: coverImage(cover),
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                              }
                            : {}),
                    }}
                >
                    {cover ? null : this.renderPlaceholder('28px', this.isTileActive())}
                </Box>

                <Box
                    sx={{
                        position: 'relative',
                        zIndex: 1,
                        flex: 1,
                        minWidth: 0,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 0.25,
                        color: cover ? '#fff' : undefined,
                    }}
                >
                    <Typography
                        ref={this.nameRef}
                        variant="caption"
                        noWrap
                        sx={{ fontWeight: 600, lineHeight: 1.2, opacity: 0.75 }}
                    >
                        {this.displayName}
                    </Typography>
                    <Typography
                        variant="body2"
                        noWrap
                        sx={theme => ({
                            fontWeight: 600,
                            fontSize: '0.85rem',
                            textShadow: cover ? '0 1px 3px rgba(0,0,0,0.5)' : undefined,
                            ...(isNeumorphicTheme(theme)
                                ? { textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.75rem' }
                                : {}),
                        })}
                    >
                        {playing ? title : subtitle || title}
                        {playing && subtitle ? (
                            <Box
                                component="span"
                                sx={{ fontWeight: 400, opacity: 0.7 }}
                            >
                                {` · ${subtitle}`}
                            </Box>
                        ) : null}
                    </Typography>
                    {playing ? this.renderProgressBar(4) : null}
                </Box>
                {this.renderTileIndicators()}
                {this.renderChart()}
            </Box>
        );

        return this.renderFrame(theme => WidgetGeneric.getStyleWide(theme), tile);
    }

    /** 2x1 and 2x2 - the large cover with the player on it, title, artist and progress below */
    renderWideTall(): React.JSX.Element {
        const hint = this.hint;
        const cover = this.cover;
        const active = this.isTileActive();
        const { title, subtitle } = this.tileLines();

        const tile = (
            <Box
                onClick={this.openPlayer}
                sx={theme => ({
                    ...this.tileSx(theme),
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100%',
                    padding: 0,
                })}
            >
                <Box
                    sx={{
                        position: 'relative',
                        flex: '1 1 60%',
                        minHeight: 0,
                        overflow: 'hidden',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        ...(cover
                            ? {
                                  backgroundImage: coverImage(cover),
                                  backgroundSize: 'cover',
                                  backgroundPosition: 'center',
                              }
                            : { backgroundColor: 'rgba(127,127,127,0.08)' }),
                    }}
                >
                    {cover ? null : this.renderPlaceholder('64px', active)}
                    {hint ? null : this.renderPlayerPill()}
                    {this.renderBadges(36, { bottom: 8, right: 12 })}
                    {this.renderTileIndicators()}
                </Box>

                <Box sx={{ p: 1.5, pt: 1, minWidth: 0 }}>
                    <Typography
                        ref={hint ? this.nameRef : undefined}
                        variant="body2"
                        noWrap
                        sx={theme => ({
                            fontWeight: 700,
                            fontSize: '0.9rem',
                            ...(isNeumorphicTheme(theme)
                                ? { textTransform: 'uppercase', letterSpacing: '0.08em', fontSize: '0.8rem' }
                                : {}),
                        })}
                    >
                        {title}
                    </Typography>
                    {subtitle ? (
                        <Typography
                            variant="caption"
                            noWrap
                            sx={{ display: 'block', fontWeight: 500, color: active ? this.accent : 'text.secondary' }}
                        >
                            {subtitle}
                        </Typography>
                    ) : null}
                    {this.renderTileProgress('0.65rem', 4, false)}
                </Box>
                {this.renderChart()}
            </Box>
        );

        return this.renderFrame(theme => WidgetGeneric.getStyleWideTall(theme), tile);
    }
}

export default MaPlayerComponent;
