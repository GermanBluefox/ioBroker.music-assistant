// Players tab of the instance configuration.
//
// Rendered by JsonConfig as a `custom` item (see the tab `playersTab` in `admin/jsonConfig.json`), so
// the players of Music Assistant can be watched and controlled without leaving the adapter settings.
//
// Everything runs over the states the adapter creates below `music-assistant.<instance>.players.<id>`
// (see src/lib/objects.ts) - the component needs no message handler of its own:
//
//     name / available / powered / state / activeSource       status
//     mediaTitle / mediaArtist / mediaAlbum / mediaImage      what is playing
//     elapsedTime / duration / seek                           position
//     play / pause / stop / next / previous                   buttons
//     volume / muted / shuffle / repeat / playMedia           settings and playing something

import React from 'react';

import {
    Box,
    Button,
    Chip,
    IconButton,
    InputAdornment,
    LinearProgress,
    Paper,
    Slider,
    TextField,
    Tooltip,
    Typography,
} from '@mui/material';
import {
    MusicNote,
    OpenInNew,
    PauseRounded,
    PlayArrowRounded,
    PowerSettingsNew,
    Refresh,
    Repeat,
    RepeatOne,
    ShuffleRounded,
    SkipNextRounded,
    SkipPreviousRounded,
    StopRounded,
    VolumeOff,
    VolumeUp,
} from '@mui/icons-material';
import { I18n } from '@iobroker/gui-components';
import { ConfigGeneric, type ConfigGenericProps, type ConfigGenericState } from '@iobroker/json-config';

/** States of a player the component shows */
const PLAYER_STATES = [
    'name',
    'available',
    'powered',
    'state',
    'activeSource',
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

/** `state` of a player: 0 = pause, 1 = play, 2 = stop */
const STATE_PLAY = 1;

/** Port of Music Assistant in Docker mode, see DOCKER_PORT in src/main.ts */
const DOCKER_PORT = 8095;

const styles: Record<string, React.CSSProperties> = {
    header: { display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginBottom: 12 },
    grid: { display: 'grid', gap: 16, gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))' },
    card: { padding: 12, display: 'flex', flexDirection: 'column', gap: 4 },
    top: { display: 'flex', gap: 12, minWidth: 0 },
    cover: {
        width: 96,
        height: 96,
        flex: '0 0 auto',
        borderRadius: 8,
        objectFit: 'cover',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(128, 128, 128, 0.2)',
    },
    info: { display: 'flex', flexDirection: 'column', minWidth: 0, flex: 1 },
    name: { display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 },
    ellipsis: { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    sub: { opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' },
    row: { display: 'flex', alignItems: 'center', gap: 8 },
    time: { fontSize: 12, opacity: 0.7, minWidth: 36, textAlign: 'center' },
};

/** One player, taken from the channel objects under `music-assistant.<instance>.players` */
interface PlayerInfo {
    /** Last part of the object id, the sanitized player_id of Music Assistant */
    id: string;
    /** Name of the channel, as a fallback for the `name` state */
    name: string;
}

interface PlayersState extends ConfigGenericState {
    players: PlayerInfo[];
    /** Latest value of every subscribed state, keyed by the full object id */
    values: Record<string, ioBroker.StateValue>;
    /** Volume and position while a slider is dragged, keyed by the state id, so they do not jump back */
    dragging: Record<string, number>;
    /** Text of the `playMedia` fields, keyed by player id */
    playMedia: Record<string, string>;
    loading: boolean;
}

/** The cover, or a note when there is none or it does not load */
function Cover(props: { url: string }): React.JSX.Element {
    const [broken, setBroken] = React.useState('');
    if (!props.url || props.url === broken) {
        return (
            <Box style={styles.cover}>
                <MusicNote fontSize="large" />
            </Box>
        );
    }
    return (
        <img
            src={props.url}
            alt=""
            style={styles.cover}
            onError={() => setBroken(props.url)}
        />
    );
}

export default class PlayersComponent extends ConfigGeneric<ConfigGenericProps, PlayersState> {
    private subscribed: string[] = [];

    private objectsSubscribed = '';

    private reloadTimer: ReturnType<typeof setTimeout> | null = null;

    constructor(props: ConfigGenericProps) {
        super(props);
        this.state = {
            ...this.state,
            players: [],
            values: {},
            dragging: {},
            playMedia: {},
            loading: true,
        };
    }

    async componentDidMount(): Promise<void> {
        await super.componentDidMount();
        await this.loadPlayers();
        // players appear when Music Assistant registers them and vanish when they are deleted there
        this.objectsSubscribed = `${this.namespace}.players.*`;
        this.props.oContext.socket
            .subscribeObject(this.objectsSubscribed, this.onObjectChange)
            .catch((error: unknown) => console.warn(`Cannot subscribe on the player objects: ${error as string}`));
    }

    componentWillUnmount(): void {
        super.componentWillUnmount();
        if (this.reloadTimer) {
            clearTimeout(this.reloadTimer);
            this.reloadTimer = null;
        }
        if (this.objectsSubscribed) {
            void this.props.oContext.socket.unsubscribeObject(this.objectsSubscribed, this.onObjectChange);
            this.objectsSubscribed = '';
        }
        this.unsubscribeAll();
    }

    private get namespace(): string {
        return `music-assistant.${this.props.oContext.instance}`;
    }

    private stateId(player: string, name: string): string {
        return `${this.namespace}.players.${player}.${name}`;
    }

    /** All players of the instance, read from the object tree */
    private async loadPlayers(): Promise<void> {
        const prefix = `${this.namespace}.players.`;
        const players: PlayerInfo[] = [];
        try {
            const channels = await this.props.oContext.socket.getObjectViewSystem('channel', prefix, `${prefix}香`);
            for (const id of Object.keys(channels || {})) {
                const player = id.substring(prefix.length);
                // only the direct children are players
                if (player && !player.includes('.')) {
                    players.push({ id: player, name: PlayersComponent.getText(channels[id]?.common?.name) || player });
                }
            }
        } catch (error) {
            console.warn(`Cannot read the players: ${error as string}`);
        }
        players.sort((a, b) => a.name.localeCompare(b.name));
        this.setState({ players, loading: false }, () => this.resubscribe());
    }

    /** Reloads the list once a burst of object changes (a new player has ~30 objects) is over */
    private onObjectChange = (id: string): void => {
        if (id.split('.').length !== 4) {
            return;
        }
        if (this.reloadTimer) {
            clearTimeout(this.reloadTimer);
        }
        this.reloadTimer = setTimeout(() => {
            this.reloadTimer = null;
            void this.loadPlayers();
        }, 500);
    };

    /** `common.name` may be a plain string or a translation object */
    private static getText(text: ioBroker.StringOrTranslated | undefined): string {
        if (!text) {
            return '';
        }
        if (typeof text === 'string') {
            return text;
        }
        return text[I18n.getLanguage()] || text.en || '';
    }

    // ---- subscriptions ------------------------------------------------------

    private wantedIds(): string[] {
        const ids = [`${this.namespace}.info.connection`];
        for (const player of this.state.players) {
            for (const name of PLAYER_STATES) {
                ids.push(this.stateId(player.id, name));
            }
        }
        return ids;
    }

    private onStateChange = (id: string, state: ioBroker.State | null | undefined): void => {
        this.setState(prev => ({ values: { ...prev.values, [id]: state ? state.val : null } }));
    };

    private unsubscribeAll(): void {
        if (this.subscribed.length) {
            this.props.oContext.socket.unsubscribeState(this.subscribed, this.onStateChange);
            this.subscribed = [];
        }
    }

    private resubscribe(): void {
        const wanted = this.wantedIds();
        if (wanted.length === this.subscribed.length && wanted.every(id => this.subscribed.includes(id))) {
            return;
        }
        this.unsubscribeAll();
        this.subscribed = wanted;
        this.props.oContext.socket.subscribeState(wanted, this.onStateChange).catch((error: unknown) => {
            console.warn(`Cannot subscribe on the player states: ${error as string}`);
        });
    }

    // ---- state access -------------------------------------------------------

    private val(player: string, name: string): ioBroker.StateValue {
        return this.state.values[this.stateId(player, name)] ?? null;
    }

    private str(player: string, name: string): string {
        const value = this.val(player, name);
        return value === null || value === undefined ? '' : String(value);
    }

    private num(player: string, name: string): number {
        return Number(this.val(player, name)) || 0;
    }

    private set(player: string, name: string, value: ioBroker.StateValue): void {
        const id = this.stateId(player, name);
        this.props.oContext.socket.setState(id, value, false).catch((error: unknown) => {
            console.warn(`Cannot write ${id}: ${error as string}`);
        });
    }

    /** The value of a slider: the dragged one while it is dragged, otherwise the one of the state */
    private sliderValue(player: string, name: string): number {
        return this.state.dragging[this.stateId(player, name)] ?? this.num(player, name);
    }

    private drag(player: string, name: string, value: number | null): void {
        const id = this.stateId(player, name);
        this.setState(prev => {
            const dragging = { ...prev.dragging };
            if (value === null) {
                delete dragging[id];
            } else {
                dragging[id] = value;
            }
            return { dragging };
        });
    }

    private static timeString(seconds: number): string {
        if (!seconds || seconds < 0 || !isFinite(seconds)) {
            return '0:00';
        }
        const s = Math.floor(seconds % 60)
            .toString()
            .padStart(2, '0');
        const m = Math.floor(seconds / 60);
        return m >= 60 ? `${Math.floor(m / 60)}:${(m % 60).toString().padStart(2, '0')}:${s}` : `${m}:${s}`;
    }

    /** Web interface of Music Assistant: the container on this host, or the configured server */
    private webUiUrl(): string {
        const data = this.props.data as {
            host?: string;
            port?: number;
            dockerMusicAssistant?: { enabled?: boolean };
        };
        if (data.dockerMusicAssistant?.enabled) {
            return `http://${window.location.hostname}:${DOCKER_PORT}/`;
        }
        return data.host ? `http://${data.host}:${data.port || DOCKER_PORT}/` : '';
    }

    // ---- rendering ----------------------------------------------------------

    private renderHeader(connected: boolean): React.JSX.Element {
        const url = this.webUiUrl();
        return (
            <div style={styles.header}>
                <Chip
                    size="small"
                    color={connected ? 'success' : 'warning'}
                    label={I18n.t(connected ? 'ma_ctrl_connected' : 'ma_ctrl_disconnected')}
                />
                <Typography variant="body2">
                    {I18n.t('ma_ctrl_players')}: {this.state.players.length}
                </Typography>
                <Tooltip title={I18n.t('ma_ctrl_refresh')}>
                    <IconButton
                        size="small"
                        onClick={() => void this.loadPlayers()}
                    >
                        <Refresh fontSize="small" />
                    </IconButton>
                </Tooltip>
                <div style={{ flex: 1 }} />
                {url ? (
                    <Button
                        size="small"
                        variant="outlined"
                        startIcon={<OpenInNew />}
                        href={url}
                        target="_blank"
                        rel="noreferrer"
                    >
                        {I18n.t('ma_ctrl_open_ui')}
                    </Button>
                ) : null}
            </div>
        );
    }

    private renderPlayer(player: PlayerInfo, connected: boolean): React.JSX.Element {
        const id = player.id;
        const available = this.val(id, 'available') !== false;
        const powered = this.val(id, 'powered') !== false;
        const disabled = !connected || !available;
        const playing = this.num(id, 'state') === STATE_PLAY;
        const title = this.str(id, 'mediaTitle');
        const subtitle = [this.str(id, 'mediaArtist'), this.str(id, 'mediaAlbum')].filter(Boolean).join(' – ');
        const duration = this.num(id, 'duration');
        const position = this.sliderValue(id, 'elapsedTime');
        const volume = this.sliderValue(id, 'volume');
        const muted = this.val(id, 'muted') === true;
        const shuffle = this.val(id, 'shuffle') === true;
        const repeat = this.num(id, 'repeat');
        const media = this.state.playMedia[id] ?? '';

        const playMedia = (): void => {
            if (media.trim()) {
                this.set(id, 'playMedia', media.trim());
            }
        };

        return (
            <Paper
                key={id}
                style={{ ...styles.card, opacity: available ? 1 : 0.6 }}
            >
                <div style={styles.top}>
                    <Cover url={this.str(id, 'mediaImage')} />
                    <div style={styles.info}>
                        <div style={styles.name}>
                            <Typography
                                variant="subtitle1"
                                style={{ ...styles.ellipsis, fontWeight: 500 }}
                                title={id}
                            >
                                {this.str(id, 'name') || player.name}
                            </Typography>
                            {!available ? (
                                <Chip
                                    size="small"
                                    label={I18n.t('ma_ctrl_unavailable')}
                                />
                            ) : !powered ? (
                                <Chip
                                    size="small"
                                    label={I18n.t('ma_ctrl_off')}
                                />
                            ) : null}
                            <div style={{ flex: 1 }} />
                            <Tooltip title={I18n.t('ma_ctrl_power')}>
                                <span>
                                    <IconButton
                                        size="small"
                                        disabled={disabled}
                                        color={powered ? 'primary' : 'default'}
                                        onClick={() => this.set(id, 'powered', !powered)}
                                    >
                                        <PowerSettingsNew fontSize="small" />
                                    </IconButton>
                                </span>
                            </Tooltip>
                        </div>
                        <Typography
                            variant="body2"
                            style={styles.ellipsis}
                        >
                            {title || I18n.t('ma_ctrl_nothing_playing')}
                        </Typography>
                        {subtitle ? (
                            <Typography
                                variant="body2"
                                style={styles.sub}
                            >
                                {subtitle}
                            </Typography>
                        ) : null}
                        {this.str(id, 'activeSource') ? (
                            <Typography
                                variant="caption"
                                style={styles.sub}
                            >
                                {this.str(id, 'activeSource')}
                            </Typography>
                        ) : null}
                    </div>
                </div>

                {duration > 0 ? (
                    <div style={styles.row}>
                        <span style={styles.time}>{PlayersComponent.timeString(position)}</span>
                        <Slider
                            size="small"
                            min={0}
                            max={duration}
                            value={Math.min(position, duration)}
                            disabled={disabled}
                            onChange={(_e, value) => this.drag(id, 'elapsedTime', value)}
                            onChangeCommitted={(_e, value) => {
                                this.set(id, 'seek', Math.round(value));
                                this.drag(id, 'elapsedTime', null);
                            }}
                        />
                        <span style={styles.time}>{PlayersComponent.timeString(duration)}</span>
                    </div>
                ) : null}

                <div style={{ ...styles.row, justifyContent: 'center' }}>
                    <Tooltip title={I18n.t('ma_ctrl_shuffle')}>
                        <span>
                            <IconButton
                                size="small"
                                disabled={disabled}
                                color={shuffle ? 'primary' : 'default'}
                                onClick={() => this.set(id, 'shuffle', !shuffle)}
                            >
                                <ShuffleRounded fontSize="small" />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={I18n.t('ma_ctrl_previous')}>
                        <span>
                            <IconButton
                                disabled={disabled}
                                onClick={() => this.set(id, 'previous', true)}
                            >
                                <SkipPreviousRounded />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={I18n.t(playing ? 'ma_ctrl_pause' : 'ma_ctrl_play')}>
                        <span>
                            <IconButton
                                disabled={disabled}
                                color="primary"
                                onClick={() => this.set(id, playing ? 'pause' : 'play', true)}
                            >
                                {playing ? <PauseRounded fontSize="large" /> : <PlayArrowRounded fontSize="large" />}
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={I18n.t('ma_ctrl_stop')}>
                        <span>
                            <IconButton
                                disabled={disabled}
                                onClick={() => this.set(id, 'stop', true)}
                            >
                                <StopRounded />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip title={I18n.t('ma_ctrl_next')}>
                        <span>
                            <IconButton
                                disabled={disabled}
                                onClick={() => this.set(id, 'next', true)}
                            >
                                <SkipNextRounded />
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Tooltip
                        title={I18n.t(
                            repeat === 1
                                ? 'ma_ctrl_repeat_all'
                                : repeat === 2
                                  ? 'ma_ctrl_repeat_one'
                                  : 'ma_ctrl_repeat_off',
                        )}
                    >
                        <span>
                            <IconButton
                                size="small"
                                disabled={disabled}
                                color={repeat ? 'primary' : 'default'}
                                // off -> all -> one -> off
                                onClick={() => this.set(id, 'repeat', (repeat + 1) % 3)}
                            >
                                {repeat === 2 ? <RepeatOne fontSize="small" /> : <Repeat fontSize="small" />}
                            </IconButton>
                        </span>
                    </Tooltip>
                </div>

                <div style={styles.row}>
                    <Tooltip title={I18n.t('ma_ctrl_mute')}>
                        <span>
                            <IconButton
                                size="small"
                                disabled={disabled}
                                color={muted ? 'primary' : 'default'}
                                onClick={() => this.set(id, 'muted', !muted)}
                            >
                                {muted ? <VolumeOff fontSize="small" /> : <VolumeUp fontSize="small" />}
                            </IconButton>
                        </span>
                    </Tooltip>
                    <Slider
                        size="small"
                        min={0}
                        max={100}
                        value={volume}
                        disabled={disabled}
                        valueLabelDisplay="auto"
                        onChange={(_e, value) => this.drag(id, 'volume', value)}
                        onChangeCommitted={(_e, value) => {
                            this.set(id, 'volume', value);
                            this.drag(id, 'volume', null);
                        }}
                    />
                    <span style={styles.time}>{Math.round(volume)}</span>
                </div>

                <TextField
                    size="small"
                    variant="standard"
                    fullWidth
                    disabled={disabled}
                    value={media}
                    placeholder={I18n.t('ma_ctrl_play_media')}
                    onChange={e => this.setState(prev => ({ playMedia: { ...prev.playMedia, [id]: e.target.value } }))}
                    onKeyDown={e => {
                        if (e.key === 'Enter') {
                            playMedia();
                        }
                    }}
                    slotProps={{
                        input: {
                            endAdornment: (
                                <InputAdornment position="end">
                                    <IconButton
                                        size="small"
                                        disabled={disabled || !media.trim()}
                                        onClick={playMedia}
                                    >
                                        <PlayArrowRounded fontSize="small" />
                                    </IconButton>
                                </InputAdornment>
                            ),
                        },
                    }}
                />
            </Paper>
        );
    }

    renderItem(): React.JSX.Element {
        if (this.state.loading) {
            return <LinearProgress />;
        }

        if (!this.props.alive) {
            return (
                <Typography
                    variant="body2"
                    style={{ padding: 8 }}
                >
                    {I18n.t('ma_ctrl_instance_not_running')}
                </Typography>
            );
        }

        const connected = this.state.values[`${this.namespace}.info.connection`] === true;

        return (
            <div style={{ width: '100%' }}>
                {this.renderHeader(connected)}
                {this.state.players.length ? (
                    <div style={styles.grid}>
                        {this.state.players.map(player => this.renderPlayer(player, connected))}
                    </div>
                ) : (
                    <Typography variant="body2">{I18n.t('ma_ctrl_no_players')}</Typography>
                )}
            </div>
        );
    }
}
