import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type JSX, type RefObject } from 'react';

import { formatTime, type PlayerCommand } from './constants';
import type { WordKey } from './i18n';
import { Icon } from './icons';
import { getLayout } from './layout';

/** What the player shows, read from the states of its channel */
export interface PlayerValues {
    name: string;
    available: boolean;
    powered: boolean;
    playing: boolean;
    /** 0..100 */
    volume: number;
    muted: boolean;
    shuffle: boolean;
    /** 0 = off, 1 = all, 2 = one */
    repeat: number;
    /** Seconds, as of `elapsedTs` */
    elapsed: number;
    /** When `elapsed` was written, in ms */
    elapsedTs: number;
    /** Seconds; 0 for a stream without an end */
    duration: number;
    title: string;
    artist: string;
    album: string;
    image: string;
}

export interface PlayerViewProps {
    values: PlayerValues;
    showCover: boolean;
    showVolume: boolean;
    showModes: boolean;
    /** Color of the sliders and the active buttons; the color of the text if empty */
    accent?: string;
    editMode: boolean;
    word: (key: WordKey) => string;
    onCommand: (command: PlayerCommand, value: ioBroker.StateValue) => void;
}

const REPEAT_WORDS: WordKey[] = ['repeatOff', 'repeatAll', 'repeatOne'];

/**
 * The current time, ticking every second while `active` - the elapsed time is written by the adapter only now
 * and then and runs on in between
 */
function useNow(active: boolean): number {
    const [now, setNow] = useState(() => Date.now());
    useEffect(() => {
        if (!active) {
            return undefined;
        }
        const timer = setInterval(() => setNow(Date.now()), 1000);
        return () => clearInterval(timer);
    }, [active]);
    return now;
}

interface SliderProps {
    value: number;
    max: number;
    label: string;
    disabled?: boolean;
    /** Called once the user lets go, not while dragging */
    onCommit: (value: number) => void;
}

/**
 * A slider that writes when the user lets go. What the user picked stays shown for a moment, until the state
 * follows - otherwise the thumb would jump back to the old value first.
 */
function Slider({ value, max, label, disabled, onCommit }: SliderProps): JSX.Element {
    const [local, setLocal] = useState<number | null>(null);
    const ref = useRef<HTMLInputElement>(null);
    const commitRef = useRef(onCommit);
    const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

    useEffect(() => {
        commitRef.current = onCommit;
    });

    useEffect(() => {
        const input = ref.current;
        if (!input) {
            return undefined;
        }
        // `change` of the DOM fires when the user lets go (or with each key), unlike `onChange` of React
        const onChange = (): void => {
            commitRef.current(Number(input.value));
            clearTimeout(timer.current);
            timer.current = setTimeout(() => setLocal(null), 2500);
        };
        input.addEventListener('change', onChange);
        return () => {
            input.removeEventListener('change', onChange);
            clearTimeout(timer.current);
        };
    }, []);

    const shown = Math.min(max, Math.max(0, local ?? value));
    const fill = max > 0 ? (shown / max) * 100 : 0;
    return (
        <input
            ref={ref}
            type="range"
            min={0}
            max={max}
            step={1}
            value={shown}
            disabled={disabled}
            aria-label={label}
            title={label}
            style={{ '--fill': `${fill}%` } as CSSProperties}
            onChange={e => {
                clearTimeout(timer.current);
                setLocal(Number(e.currentTarget.value));
            }}
        />
    );
}

/** The cover, or a note if there is none or it cannot be loaded */
function Cover({ image }: { image: string }): JSX.Element {
    const [failed, setFailed] = useState('');
    return (
        <div className="cover">
            {image && failed !== image ? (
                <img
                    src={image}
                    alt=""
                    referrerPolicy="no-referrer"
                    onError={() => setFailed(image)}
                />
            ) : (
                <Icon name="music" />
            )}
        </div>
    );
}

/** A hint instead of the player: no player chosen, or the ID is not one */
export function Hint({ text, editMode }: { text: string; editMode: boolean }): JSX.Element {
    return (
        <div className={`player hint${editMode ? ' edit' : ''}`}>
            <Icon name="music" />
            <span>{text}</span>
        </div>
    );
}

interface BoxSize {
    width: number;
    height: number;
}

/**
 * The size of the element in px, measured before the first paint and again whenever it changes - the host may
 * resize the box at any time (vis-2 in edit mode, a tile of devices, a window). `offsetWidth`/`offsetHeight`
 * ignore a CSS transform, so a scaled view of vis-2 keeps its layout.
 */
function useBoxSize(ref: RefObject<HTMLElement | null>): BoxSize | null {
    const [size, setSize] = useState<BoxSize | null>(null);
    useLayoutEffect(() => {
        const element = ref.current;
        if (!element) {
            return undefined;
        }
        const measure = (): void => {
            const width = element.offsetWidth;
            const height = element.offsetHeight;
            setSize(old => (old?.width === width && old.height === height ? old : { width, height }));
        };
        measure();
        const observer = new ResizeObserver(measure);
        observer.observe(element);
        return () => observer.disconnect();
    }, [ref]);
    return size;
}

export function PlayerView(props: PlayerViewProps): JSX.Element {
    const { values, word, onCommand, editMode } = props;
    const ref = useRef<HTMLDivElement>(null);
    const size = useBoxSize(ref);
    const now = useNow(values.playing && !editMode);

    const disabled = !values.available;
    // an unavailable player shows its buttons greyed out, a player that is off only the power button
    const on = values.powered || disabled;
    const running = values.playing && values.elapsedTs ? Math.max(0, now - values.elapsedTs) / 1000 : 0;
    const elapsed =
        values.duration > 0 ? Math.min(values.duration, values.elapsed + running) : values.elapsed + running;
    const repeat = values.repeat >= 0 && values.repeat <= 2 ? values.repeat : 0;
    const silent = values.muted || values.volume <= 0;
    const subtitle = [values.artist, values.album].filter(Boolean).join(' · ');

    const layout = size
        ? getLayout(size.width, size.height, {
              cover: props.showCover,
              powered: on,
              progress: values.duration > 0,
              volume: props.showVolume,
              modes: props.showModes,
          })
        : null;

    const classes = ['player'];
    const style: Record<string, string> = { '--accent': props.accent || 'currentColor' };
    if (layout) {
        classes.push(layout.kind);
        style['--pad'] = `${layout.pad}px`;
        style['--gap'] = `${layout.gap}px`;
        style['--icon'] = `${layout.icon}px`;
        style['--cover'] = `${layout.cover}px`;
        style['--fs-name'] = `${layout.fonts.name}px`;
        style['--fs-title'] = `${layout.fonts.title}px`;
        style['--fs-artist'] = `${layout.fonts.artist}px`;
        style['--fs-time'] = `${layout.fonts.time}px`;
    }
    if (editMode) {
        classes.push('edit');
    }
    if (disabled) {
        classes.push('unavailable');
    }

    let content: JSX.Element | null = null;
    if (layout) {
        const cover = layout.cover ? <Cover image={values.image} /> : null;

        const info = (
            <div className="info">
                {layout.name ? (
                    <div className="name">
                        {values.name}
                        {disabled ? ` · ${word('notAvailable')}` : ''}
                    </div>
                ) : null}
                <div className={`title${layout.titleLines > 1 ? ' two' : ''}`}>
                    {values.title || word('nothingPlaying')}
                </div>
                {subtitle && layout.artist ? <div className="artist">{subtitle}</div> : null}
            </div>
        );

        const progress = layout.progress ? (
            <div className="progress">
                <span className="time">{formatTime(elapsed)}</span>
                <Slider
                    value={Math.round(elapsed)}
                    max={Math.round(values.duration)}
                    label={word('position')}
                    disabled={disabled}
                    onCommit={val => onCommand('seek', val)}
                />
                <span className="time">{formatTime(values.duration)}</span>
            </div>
        ) : null;

        const controls = on ? (
            <div className="controls">
                {layout.modes ? (
                    <button
                        className={`mode${values.shuffle ? ' active' : ''}`}
                        title={word('shuffle')}
                        aria-label={word('shuffle')}
                        aria-pressed={values.shuffle}
                        disabled={disabled}
                        onClick={() => onCommand('shuffle', !values.shuffle)}
                    >
                        <Icon name="shuffle" />
                    </button>
                ) : null}
                {layout.previous ? (
                    <button
                        title={word('previous')}
                        aria-label={word('previous')}
                        disabled={disabled}
                        onClick={() => onCommand('previous', true)}
                    >
                        <Icon name="previous" />
                    </button>
                ) : null}
                <button
                    className="main-action"
                    title={word(values.playing ? 'pause' : 'play')}
                    aria-label={word(values.playing ? 'pause' : 'play')}
                    disabled={disabled}
                    onClick={() => onCommand('playPause', true)}
                >
                    <Icon name={values.playing ? 'pause' : 'play'} />
                </button>
                <button
                    title={word('next')}
                    aria-label={word('next')}
                    disabled={disabled}
                    onClick={() => onCommand('next', true)}
                >
                    <Icon name="next" />
                </button>
                {layout.modes ? (
                    <button
                        className={`mode${repeat ? ' active' : ''}`}
                        title={word(REPEAT_WORDS[repeat])}
                        aria-label={word(REPEAT_WORDS[repeat])}
                        disabled={disabled}
                        onClick={() => onCommand('repeat', (repeat + 1) % 3)}
                    >
                        <Icon name={repeat === 2 ? 'repeatOne' : 'repeat'} />
                    </button>
                ) : null}
            </div>
        ) : (
            <div className="controls power">
                <button
                    className="main-action"
                    title={word('powerOn')}
                    aria-label={word('powerOn')}
                    onClick={() => onCommand('powered', true)}
                >
                    <Icon name="power" />
                </button>
            </div>
        );

        const volume = layout.volume ? (
            <div className="volume">
                <button
                    title={word(values.muted ? 'unmute' : 'mute')}
                    aria-label={word(values.muted ? 'unmute' : 'mute')}
                    aria-pressed={values.muted}
                    disabled={disabled}
                    onClick={() => onCommand('muted', !values.muted)}
                >
                    <Icon name={silent ? 'volumeOff' : 'volume'} />
                </button>
                <Slider
                    value={values.volume}
                    max={100}
                    label={word('volume')}
                    disabled={disabled}
                    onCommit={val => onCommand('volume', val)}
                />
            </div>
        ) : null;

        if (layout.kind === 'wide') {
            content = (
                <>
                    {cover}
                    <div className="main">
                        {info}
                        {progress}
                        {controls}
                        {volume}
                    </div>
                </>
            );
        } else if (layout.kind === 'card') {
            content = (
                <>
                    <div className="head">
                        {cover}
                        {info}
                    </div>
                    {progress}
                    {controls}
                    {volume}
                </>
            );
        } else if (layout.kind === 'tall') {
            content = (
                <>
                    {cover}
                    {info}
                    {progress}
                    {controls}
                    {volume}
                </>
            );
        } else {
            content = (
                <>
                    {cover}
                    {info}
                    {controls}
                </>
            );
        }
    }

    return (
        <div
            ref={ref}
            className={classes.join(' ')}
            style={style}
        >
            {content}
        </div>
    );
}
