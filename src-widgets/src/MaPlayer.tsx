import React from 'react';

import { Chip, IconButton, LinearProgress, Slider, Tooltip, Typography } from '@mui/material';
import {
    MusicNote,
    PauseRounded,
    PlayArrowRounded,
    PowerSettingsNew,
    Repeat,
    RepeatOne,
    ShuffleRounded,
    SkipNextRounded,
    SkipPreviousRounded,
    VolumeOff,
    VolumeUp,
} from '@mui/icons-material';

import type { RxRenderWidgetProps, RxWidgetInfo, VisRxWidgetProps, VisRxWidgetState } from '@iobroker/types-vis-2';

import CoverBox from './CoverBox';
import Generic, { CHIP_STATES, PLAYER_STATES, type MaPlayerInfo, type PlayerStateName } from './Generic';
import { playerField } from './PlayerField';

const styles: Record<string, React.CSSProperties> = {
    root: { display: 'flex', flexDirection: 'column', gap: 8, width: '100%', height: '100%', minHeight: 0 },
    players: { display: 'flex', flexWrap: 'wrap', gap: 4 },
    main: { display: 'flex', gap: 12, minHeight: 0 },
    cover: {
        width: 120,
        height: 120,
        flex: '0 0 auto',
        borderRadius: 8,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
    },
    meta: { display: 'flex', flexDirection: 'column', gap: 4, flex: 1, minWidth: 0 },
    title: { fontSize: '130%', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    sub: { opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    buttons: { display: 'flex', alignItems: 'center', flexWrap: 'wrap' },
    seek: { display: 'flex', alignItems: 'center', gap: 8 },
    volume: { display: 'flex', alignItems: 'center', gap: 8 },
};

/** Tooltip of the repeat button per value of the `repeat` state: 0 = off, 1 = all, 2 = one */
const REPEAT_WORDS = ['repeat', 'repeat_all', 'repeat_one'];

interface MaPlayerRxData {
    noCard: boolean;
    widgetTitle: string;
    /** Number of the instance, e.g. `0` */
    instance: string;
    /** Channel name of the player shown first, or its name; empty: the first player */
    defaultPlayer: string;
    showPlayers: boolean;
    hideUnavailable: boolean;
    showCover: boolean;
    showVolume: boolean;
    showModes: boolean;
}

interface MaPlayerState extends VisRxWidgetState {
    players: MaPlayerInfo[];
    /** Whether the players were read - until then a progress bar is shown instead of "no players" */
    loaded: boolean;
    selectedPlayer: string;
    /** The subscribed states, by ID */
    ma: Record<string, ioBroker.State | null>;
    /** Volume while the slider is dragged, so it does not jump back */
    localVolume: number | null;
    /** Position in seconds while the slider is dragged, and until the player reports the jump */
    localSeek: number | null;
    /** Ticks every second while the player plays: the adapter writes the elapsed time only now and then */
    now: number;
}

export default class MaPlayer extends Generic<MaPlayerRxData, MaPlayerState> {
    private subscribed: string[] = [];

    private volumeTimer: ReturnType<typeof setTimeout> | null = null;

    private seekTimer: ReturnType<typeof setTimeout> | null = null;

    private clock: ReturnType<typeof setInterval> | null = null;

    constructor(props: VisRxWidgetProps) {
        super(props);
        this.state = {
            ...this.state,
            players: [],
            loaded: false,
            selectedPlayer: '',
            ma: {},
            localVolume: null,
            localSeek: null,
            now: Date.now(),
        };
    }

    static getWidgetInfo(): RxWidgetInfo {
        return {
            id: 'tplMusicAssistantPlayer',
            // The set of the web component <iob-ma-player> is the name of the adapter too. With the same
            // name in the same set, the palette offers this widget and leaves the web component out.
            visSet: 'music-assistant',
            visSetLabel: 'set_label',
            visSetColor: '#18bcf2',
            visName: 'Music Assistant player',
            visWidgetLabel: 'player',
            visAttrs: [
                {
                    name: 'common',
                    fields: [
                        {
                            name: 'instance',
                            type: 'instance',
                            adapter: 'music-assistant',
                            isShort: true,
                            default: '0',
                            label: 'instance',
                        },
                        {
                            name: 'defaultPlayer',
                            type: 'custom',
                            label: 'default_player',
                            tooltip: 'default_player_tooltip',
                            component: playerField(() => MaPlayer.t('first_player')),
                        },
                        { name: 'noCard', type: 'checkbox', label: 'without_card' },
                        { name: 'widgetTitle', label: 'name', hidden: '!!data.noCard' },
                    ],
                },
                {
                    name: 'parts',
                    label: 'parts',
                    fields: [
                        { name: 'showPlayers', type: 'checkbox', default: true, label: 'show_players' },
                        {
                            name: 'hideUnavailable',
                            type: 'checkbox',
                            default: false,
                            label: 'hide_unavailable',
                            hidden: '!data.showPlayers',
                        },
                        { name: 'showCover', type: 'checkbox', default: true, label: 'show_cover' },
                        { name: 'showVolume', type: 'checkbox', default: true, label: 'show_volume' },
                        { name: 'showModes', type: 'checkbox', default: true, label: 'show_modes' },
                    ],
                },
            ],
            visDefaultStyle: { width: 440, height: 250, position: 'relative' },
            visPrev: 'widgets/music-assistant/img/prev_player.png',
        };
    }

    getWidgetInfo(): RxWidgetInfo {
        return MaPlayer.getWidgetInfo();
    }

    async componentDidMount(): Promise<void> {
        super.componentDidMount();
        this.clock = setInterval(() => {
            if (this.playing(this.state.selectedPlayer)) {
                this.setState({ now: Date.now() });
            }
        }, 1000);
        await this.refreshPlayers();
    }

    componentWillUnmount(): void {
        for (const timer of [this.volumeTimer, this.seekTimer]) {
            if (timer) {
                clearTimeout(timer);
            }
        }
        this.volumeTimer = null;
        this.seekTimer = null;
        if (this.clock) {
            clearInterval(this.clock);
            this.clock = null;
        }
        this.unsubscribeAll();
        super.componentWillUnmount();
    }

    async onRxDataChanged(prevRxData: MaPlayerRxData): Promise<void> {
        if (prevRxData.instance !== this.state.rxData.instance) {
            this.setState({ selectedPlayer: '', ma: {} });
            await this.refreshPlayers();
        } else if (prevRxData.defaultPlayer !== this.state.rxData.defaultPlayer) {
            await this.refreshPlayers(true);
        }
    }

    /**
     * Reads the players of the instance and selects the one to show: the start player, else the one shown
     * so far, else the first one
     *
     * @param toDefault go to the start player even if another one is shown
     */
    private async refreshPlayers(toDefault?: boolean): Promise<void> {
        let players: MaPlayerInfo[] = [];
        try {
            players = await this.loadPlayers();
        } catch (e) {
            console.warn(`Cannot read the players of ${this.getNamespace()}: ${e as string}`);
        }

        const wanted = String(this.state.rxData.defaultPlayer || '').trim();
        const start = wanted
            ? players.find(item => item.player === wanted) ||
              players.find(item => item.name.toLowerCase() === wanted.toLowerCase())
            : undefined;
        const current = toDefault ? undefined : players.find(item => item.player === this.state.selectedPlayer);
        const preferred = current || start || players[0];

        this.setState({ players, loaded: true, selectedPlayer: preferred?.player || '' }, () => this.resubscribe());
    }

    /** Every player for its chip, and everything of the selected one */
    private wantedIds(): string[] {
        const ids: string[] = [];
        if (this.state.rxData.showPlayers !== false) {
            this.state.players.forEach(item =>
                CHIP_STATES.forEach(name => ids.push(this.getPlayerStateId(item.player, name))),
            );
        }
        const selected = this.state.selectedPlayer;
        if (selected) {
            PLAYER_STATES.forEach(name => ids.push(this.getPlayerStateId(selected, name)));
        }
        return [...new Set(ids)];
    }

    private onMaState = (id: string, state: ioBroker.State | null | undefined): void => {
        this.setState(prev => ({ ma: { ...prev.ma, [id]: state || null } }));
    };

    private unsubscribeAll(): void {
        if (this.subscribed.length) {
            this.props.context.socket.unsubscribeState(this.subscribed, this.onMaState);
            this.subscribed = [];
        }
    }

    private resubscribe(): void {
        const wanted = this.wantedIds();
        if (wanted.length === this.subscribed.length && wanted.every(id => this.subscribed.includes(id))) {
            return;
        }
        this.unsubscribeAll();
        if (!wanted.length) {
            return;
        }
        this.subscribed = wanted;
        this.props.context.socket.subscribeState(wanted, this.onMaState).catch((e: unknown) => {
            console.warn(`Cannot subscribe the states of Music Assistant: ${e as string}`);
        });
    }

    // ---- state access -------------------------------------------------------

    private stateOf(player: string, name: PlayerStateName): ioBroker.State | null {
        return this.state.ma[this.getPlayerStateId(player, name)] || null;
    }

    private val(player: string, name: PlayerStateName): ioBroker.StateValue {
        return this.stateOf(player, name)?.val ?? null;
    }

    private str(player: string, name: PlayerStateName): string {
        const value = this.val(player, name);
        return value === null || value === undefined ? '' : String(value);
    }

    private num(player: string, name: PlayerStateName): number {
        return Number(this.val(player, name)) || 0;
    }

    /** A player whose state has not arrived yet counts as reachable, so it is not greyed out for a moment */
    private available(player: string): boolean {
        return this.val(player, 'available') !== false;
    }

    private powered(player: string): boolean {
        return this.val(player, 'powered') !== false;
    }

    /** `media.state`: 0 = pause, 1 = play, 2 = stop */
    private playing(player: string): boolean {
        return !!player && this.num(player, 'state') === 1;
    }

    private set(player: string, name: string, value: ioBroker.StateValue): void {
        this.props.context.setValue(this.getPlayerStateId(player, name), value);
    }

    /** Seconds played; between two updates of the adapter it runs on by the clock */
    private elapsed(player: string): number {
        const state = this.stateOf(player, 'elapsedTime');
        const duration = this.num(player, 'duration');
        let elapsed = Number(state?.val) || 0;
        if (this.playing(player) && state?.ts) {
            elapsed += Math.max(0, this.state.now - state.ts) / 1000;
        }
        return duration > 0 ? Math.min(duration, elapsed) : elapsed;
    }

    private static timeString(seconds: number): string {
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

    // ---- actions ------------------------------------------------------------

    private selectPlayer(player: string): void {
        if (this.volumeTimer) {
            clearTimeout(this.volumeTimer);
            this.volumeTimer = null;
        }
        this.setState({ selectedPlayer: player, localVolume: null, localSeek: null }, () => this.resubscribe());
    }

    private onVolumeChange(player: string, value: number): void {
        this.setState({ localVolume: value });
        if (this.volumeTimer) {
            clearTimeout(this.volumeTimer);
        }
        // written 200 ms after the last move, so dragging does not flood the player
        this.volumeTimer = setTimeout(() => {
            this.volumeTimer = null;
            this.set(player, 'volume', value);
            this.setState({ localVolume: null });
        }, 200);
    }

    private onSeekChange(player: string, value: number, commit: boolean): void {
        if (this.seekTimer) {
            clearTimeout(this.seekTimer);
            this.seekTimer = null;
        }
        this.setState({ localSeek: value });
        if (!commit) {
            return;
        }
        this.set(player, 'seek', Math.round(value));
        // the elapsed time follows only once the player jumped: keep the new position until then
        this.seekTimer = setTimeout(() => {
            this.seekTimer = null;
            this.setState({ localSeek: null });
        }, 1500);
    }

    // ---- render helpers -----------------------------------------------------

    private renderPlayers(): React.JSX.Element | null {
        const { showPlayers, hideUnavailable } = this.state.rxData;
        const players = hideUnavailable
            ? this.state.players.filter(
                  item => this.available(item.player) || item.player === this.state.selectedPlayer,
              )
            : this.state.players;
        if (showPlayers === false || players.length < 2) {
            return null;
        }

        return (
            <div style={styles.players}>
                {players.map(item => {
                    const selected = item.player === this.state.selectedPlayer;
                    return (
                        <Chip
                            key={item.player}
                            size="small"
                            label={item.name}
                            icon={this.playing(item.player) ? <PlayArrowRounded fontSize="small" /> : undefined}
                            color={selected ? 'primary' : 'default'}
                            variant={selected ? 'filled' : 'outlined'}
                            // a player that is off can be selected: it shows the power button
                            disabled={!this.available(item.player)}
                            onClick={() => this.selectPlayer(item.player)}
                        />
                    );
                })}
            </div>
        );
    }

    /** Mute toggle. It starts the volume row - without that row it is appended to the buttons */
    private renderMute(player: string, size: 'small' | 'medium', edge: 'start' | false): React.JSX.Element {
        const muted = this.val(player, 'muted') === true;
        return (
            <Tooltip title={MaPlayer.t(muted ? 'unmute' : 'mute')}>
                <IconButton
                    size={size}
                    edge={edge}
                    color={muted ? 'primary' : 'default'}
                    onClick={() => this.set(player, 'muted', !muted)}
                >
                    {muted ? <VolumeOff fontSize={size} /> : <VolumeUp fontSize={size} />}
                </IconButton>
            </Tooltip>
        );
    }

    private renderTransport(player: string): React.JSX.Element {
        if (!this.powered(player)) {
            return (
                <div style={styles.buttons}>
                    <Tooltip title={MaPlayer.t('power_on')}>
                        <IconButton
                            edge="start"
                            onClick={() => this.set(player, 'powered', true)}
                        >
                            <PowerSettingsNew fontSize="large" />
                        </IconButton>
                    </Tooltip>
                </div>
            );
        }

        const playing = this.playing(player);
        const repeat = Math.min(2, Math.max(0, this.num(player, 'repeat')));
        const shuffle = this.val(player, 'shuffle') === true;
        const showModes = this.state.rxData.showModes !== false;

        return (
            <div style={styles.buttons}>
                <Tooltip title={MaPlayer.t('previous')}>
                    <IconButton
                        edge="start"
                        onClick={() => this.set(player, 'previous', true)}
                    >
                        <SkipPreviousRounded fontSize="large" />
                    </IconButton>
                </Tooltip>
                <Tooltip title={MaPlayer.t(playing ? 'pause' : 'play')}>
                    <IconButton onClick={() => this.set(player, 'playPause', true)}>
                        {playing ? <PauseRounded fontSize="large" /> : <PlayArrowRounded fontSize="large" />}
                    </IconButton>
                </Tooltip>
                <Tooltip title={MaPlayer.t('next')}>
                    <IconButton onClick={() => this.set(player, 'next', true)}>
                        <SkipNextRounded fontSize="large" />
                    </IconButton>
                </Tooltip>
                {showModes ? (
                    <Tooltip title={MaPlayer.t('shuffle')}>
                        <IconButton
                            color={shuffle ? 'primary' : 'default'}
                            onClick={() => this.set(player, 'shuffle', !shuffle)}
                        >
                            <ShuffleRounded />
                        </IconButton>
                    </Tooltip>
                ) : null}
                {showModes ? (
                    <Tooltip title={MaPlayer.t(REPEAT_WORDS[repeat])}>
                        <IconButton
                            color={repeat ? 'primary' : 'default'}
                            // off -> all -> one track -> off
                            onClick={() => this.set(player, 'repeat', (repeat + 1) % 3)}
                        >
                            {repeat === 2 ? <RepeatOne /> : <Repeat />}
                        </IconButton>
                    </Tooltip>
                ) : null}
                {this.state.rxData.showVolume === false ? this.renderMute(player, 'medium', false) : null}
            </div>
        );
    }

    private renderSeek(player: string): React.JSX.Element | null {
        const duration = this.num(player, 'duration');
        if (duration <= 0 || !this.powered(player)) {
            return null;
        }
        const position = this.state.localSeek ?? this.elapsed(player);

        return (
            <div style={styles.seek}>
                <Typography variant="caption">{MaPlayer.timeString(position)}</Typography>
                <Slider
                    size="small"
                    min={0}
                    max={duration}
                    step={1}
                    value={Math.min(duration, Math.max(0, position))}
                    valueLabelDisplay="off"
                    onChange={(_e, value) => this.onSeekChange(player, Array.isArray(value) ? value[0] : value, false)}
                    onChangeCommitted={(_e, value) =>
                        this.onSeekChange(player, Array.isArray(value) ? value[0] : value, true)
                    }
                />
                <Typography variant="caption">{MaPlayer.timeString(duration)}</Typography>
            </div>
        );
    }

    private renderVolume(player: string): React.JSX.Element | null {
        if (this.state.rxData.showVolume === false || !this.powered(player)) {
            return null;
        }
        const volume = this.state.localVolume ?? this.num(player, 'volume');

        return (
            <div style={styles.volume}>
                {this.renderMute(player, 'small', 'start')}
                <Slider
                    size="small"
                    min={0}
                    max={100}
                    value={volume}
                    valueLabelDisplay="auto"
                    onChange={(_e, value) => this.onVolumeChange(player, Array.isArray(value) ? value[0] : value)}
                />
                <Typography
                    variant="caption"
                    style={{ minWidth: 28, textAlign: 'right' }}
                >
                    {volume}
                </Typography>
            </div>
        );
    }

    renderWidgetBody(props: RxRenderWidgetProps): React.JSX.Element | React.JSX.Element[] | null {
        super.renderWidgetBody(props);

        const player = this.state.selectedPlayer;
        if (!player) {
            const content = (
                <div style={{ padding: 8 }}>
                    {this.state.loaded ? (
                        <Typography variant="body2">{MaPlayer.t('no_players')}</Typography>
                    ) : (
                        <LinearProgress />
                    )}
                </div>
            );
            return this.state.rxData.noCard ? content : this.wrapContent(content);
        }

        const available = this.available(player);
        const name = this.state.players.find(item => item.player === player)?.name || player;
        let title = this.str(player, 'mediaTitle') || MaPlayer.t('nothing_playing');
        let sub = [this.str(player, 'mediaArtist'), this.str(player, 'mediaAlbum')].filter(Boolean).join(' · ');
        if (!available) {
            title = name;
            sub = MaPlayer.t('not_available');
        } else if (!this.powered(player)) {
            title = name;
            sub = MaPlayer.t('switched_off');
        }

        const content = (
            <div style={styles.root}>
                {this.renderPlayers()}
                <div style={{ ...styles.main, opacity: available ? 1 : 0.5 }}>
                    {this.state.rxData.showCover !== false ? (
                        <CoverBox
                            url={available ? this.str(player, 'mediaImage') : ''}
                            style={styles.cover}
                        >
                            <MusicNote fontSize="large" />
                        </CoverBox>
                    ) : null}
                    <div style={{ ...styles.meta, pointerEvents: available ? undefined : 'none' }}>
                        <div style={styles.title}>{title}</div>
                        <div style={styles.sub}>{sub}</div>
                        {this.renderTransport(player)}
                        {this.renderSeek(player)}
                        {this.renderVolume(player)}
                    </div>
                </div>
            </div>
        );

        if (this.state.rxData.noCard || props.widget.usedInWidget) {
            return <div style={{ width: '100%', height: '100%', overflow: 'auto' }}>{content}</div>;
        }

        return this.wrapContent(content, null, { display: 'flex', flexDirection: 'column', minHeight: 0 });
    }
}
