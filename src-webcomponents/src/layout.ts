/**
 * How the player fills its box. The element measures the box (`ResizeObserver`) and picks one of four layouts;
 * the sizes of the icons, the cover and the fonts follow from the box, and what does not fit is left out: if the box
 * is too narrow, shuffle/repeat first and then "previous"; if it is too low, the progress first and then the volume.
 *
 * - `wide`  (width : height from 1.45): the cover left, beside it the texts, the progress, the buttons and the volume
 * - `card`  (0.8 to 1.45): a small cover beside the texts, below them the progress, the buttons and the volume
 * - `tall`  (under 0.8): the cover on top, below it everything else
 * - `row`   (lower than 120 px, or where the rows do not fit): one row - cover, texts, previous/play/next
 */

export type LayoutKind = 'wide' | 'card' | 'tall' | 'row';

/** What the player wants to show; the layout says what fits */
export interface LayoutNeeds {
    /** The setting "show cover" */
    cover: boolean;
    /** The player is on (or unavailable): all buttons; otherwise just the power button */
    powered: boolean;
    /** The track has an end, so it has a progress */
    progress: boolean;
    /** The setting "show volume" */
    volume: boolean;
    /** The setting "show shuffle and repeat" */
    modes: boolean;
}

export interface LayoutFonts {
    name: number;
    title: number;
    artist: number;
    time: number;
}

export interface Layout {
    kind: LayoutKind;
    /** Padding of the box in px */
    pad: number;
    /** Space between the parts in px */
    gap: number;
    /** Edge of the cover in px; 0: no cover */
    cover: number;
    /** Size of an icon in px; play/pause is 1.25 times, shuffle/repeat/mute 0.8 times as big */
    icon: number;
    /** The line with the name of the player */
    name: boolean;
    /** The line with artist and album */
    artist: boolean;
    /** Lines of the title: two where there is room for a second one */
    titleLines: 1 | 2;
    progress: boolean;
    volume: boolean;
    /** Shuffle and repeat */
    modes: boolean;
    previous: boolean;
    fonts: LayoutFonts;
}

/** Below this, an icon cannot be hit any more */
const MIN_ICON = 16;
/** A button is its icon plus 0.2 icon of padding on each side */
const BUTTON = 1.4;
/** Play/pause: icon 1.25 */
const MAIN_BUTTON = 1.65;
/** Shuffle, repeat, mute: icon 0.8 */
const SMALL_BUTTON = 1.2;
/** Height of a slider */
const SLIDER = 18;
/** Narrower than this, the texts beside the cover are cut too short */
const MIN_TEXT = 90;
/** Line heights as in the styles */
const LINE_NAME = 1.4;
const LINE_TITLE = 1.3;
const LINE_ARTIST = 1.4;

function clamp(min: number, value: number, max: number): number {
    return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
    return Math.floor(value * 10) / 10;
}

function infoHeight(fonts: LayoutFonts, name: boolean, artist: boolean): number {
    return (name ? fonts.name * LINE_NAME : 0) + fonts.title * LINE_TITLE + (artist ? fonts.artist * LINE_ARTIST : 0);
}

interface ControlsFit {
    icon: number;
    modes: boolean;
    previous: boolean;
}

/** The biggest icon with which the buttons fit into `width`; without the modes or "previous" if they do not */
function fitControls(width: number, maxIcon: number, needs: LayoutNeeds): ControlsFit {
    if (!needs.powered) {
        return { icon: clamp(MIN_ICON, width / MAIN_BUTTON, maxIcon), modes: false, previous: false };
    }
    // [width in icons, number of buttons, modes, previous]
    const options: [number, number, boolean, boolean][] = [
        [2 * SMALL_BUTTON + 2 * BUTTON + MAIN_BUTTON, 5, true, true],
        [2 * BUTTON + MAIN_BUTTON, 3, false, true],
        [BUTTON + MAIN_BUTTON, 2, false, false],
    ];
    for (const [units, buttons, modes, previous] of options) {
        if (modes && !needs.modes) {
            continue;
        }
        // at least 4 px between two buttons
        const icon = (width - (buttons - 1) * 4) / units;
        if (icon >= MIN_ICON) {
            return { icon: Math.min(icon, maxIcon), modes, previous };
        }
    }
    return { icon: MIN_ICON, modes: false, previous: false };
}

/** Height of the rows below the texts: progress, buttons, volume */
function rowsHeight(icon: number, gap: number, progress: boolean, volume: boolean): number {
    return (
        MAIN_BUTTON * icon + (progress ? gap + SLIDER : 0) + (volume ? gap + Math.max(SLIDER, SMALL_BUTTON * icon) : 0)
    );
}

interface RowsFit {
    icon: number;
    progress: boolean;
    volume: boolean;
}

/**
 * The rows below the texts in the height `height`: the icon shrinks down to `MIN_ICON`, then the progress is left
 * out, then the volume. Null if not even the buttons fit.
 */
function fitRows(height: number, gap: number, maxIcon: number, needs: LayoutNeeds): RowsFit | null {
    const progress = needs.powered && needs.progress;
    const volume = needs.powered && needs.volume;
    const options: [boolean, boolean][] = [
        [progress, volume],
        [false, volume],
        [false, false],
    ];
    for (const [withProgress, withVolume] of options) {
        const fixed = (withProgress ? gap + SLIDER : 0) + (withVolume ? gap : 0);
        const units = MAIN_BUTTON + (withVolume ? SMALL_BUTTON : 0);
        const icon = Math.min(maxIcon, (height - fixed) / units);
        if (icon >= MIN_ICON) {
            return { icon, progress: withProgress, volume: withVolume };
        }
    }
    return null;
}

interface Box {
    width: number;
    height: number;
    innerWidth: number;
    innerHeight: number;
    pad: number;
    gap: number;
    maxIcon: number;
    fonts: LayoutFonts;
}

function wide(box: Box, needs: LayoutNeeds): Layout | null {
    const { innerWidth, innerHeight, gap, fonts } = box;
    let cover = needs.cover ? Math.min(innerHeight, box.width * 0.42) : 0;
    if (cover && innerWidth - cover - gap < 150) {
        // the column beside the cover needs room for the buttons
        cover = innerWidth - gap - 150;
    }
    if (cover < 56) {
        cover = 0;
    }
    const column = innerWidth - (cover ? cover + gap : 0);
    const controls = fitControls(column, box.maxIcon, needs);
    const rows = fitRows(innerHeight - infoHeight(fonts, true, true) - gap, gap, controls.icon, needs);
    if (!rows) {
        return null;
    }
    const slack =
        innerHeight - infoHeight(fonts, true, true) - gap - rowsHeight(rows.icon, gap, rows.progress, rows.volume);
    return {
        kind: 'wide',
        pad: box.pad,
        gap,
        cover: Math.floor(cover),
        icon: round(rows.icon),
        name: true,
        artist: true,
        titleLines: slack >= fonts.title * LINE_TITLE ? 2 : 1,
        progress: rows.progress,
        volume: rows.volume,
        modes: controls.modes,
        previous: controls.previous,
        fonts,
    };
}

function card(box: Box, needs: LayoutNeeds): Layout | null {
    const { innerWidth, innerHeight, gap, fonts } = box;
    const controls = fitControls(innerWidth, box.maxIcon, needs);
    const info = infoHeight(fonts, true, true);
    // the cover beside the texts is at least as high as they are
    const rows = fitRows(innerHeight - info - gap, gap, controls.icon, needs);
    if (!rows) {
        return null;
    }
    const rest = rowsHeight(rows.icon, gap, rows.progress, rows.volume) + gap;
    let cover = needs.cover ? Math.min(innerHeight - rest, innerWidth * 0.45, innerWidth - gap - MIN_TEXT) : 0;
    if (cover < 40) {
        cover = 0;
    }
    // the texts beside the cover may be as high as the cover
    const slack = (cover || innerHeight - rest) - info;
    return {
        kind: 'card',
        pad: box.pad,
        gap,
        cover: Math.floor(cover),
        icon: round(rows.icon),
        name: true,
        artist: true,
        titleLines: slack >= fonts.title * LINE_TITLE ? 2 : 1,
        progress: rows.progress,
        volume: rows.volume,
        modes: controls.modes,
        previous: controls.previous,
        fonts,
    };
}

function tall(box: Box, needs: LayoutNeeds): Layout | null {
    const { innerWidth, innerHeight, gap, fonts } = box;
    const controls = fitControls(innerWidth, box.maxIcon, needs);
    const info = infoHeight(fonts, true, true);
    const rows = fitRows(innerHeight - info - gap, gap, controls.icon, needs);
    if (!rows) {
        return null;
    }
    const rest = info + gap + rowsHeight(rows.icon, gap, rows.progress, rows.volume);
    let cover = needs.cover ? Math.min(innerWidth, innerHeight - rest - gap) : 0;
    if (cover < 48) {
        cover = 0;
    }
    const slack = innerHeight - rest - (cover ? cover + gap : 0);
    return {
        kind: 'tall',
        pad: box.pad,
        gap,
        cover: Math.floor(cover),
        icon: round(rows.icon),
        name: true,
        artist: true,
        titleLines: slack >= fonts.title * LINE_TITLE ? 2 : 1,
        progress: rows.progress,
        volume: rows.volume,
        modes: controls.modes,
        previous: controls.previous,
        fonts,
    };
}

function row(box: Box, needs: LayoutNeeds): Layout {
    const { height, innerWidth, innerHeight, gap } = box;
    const fonts: LayoutFonts = {
        name: clamp(10, height * 0.11, 13),
        title: clamp(13, height * 0.17, 18),
        artist: clamp(11, height * 0.13, 14),
        time: box.fonts.time,
    };
    let icon = clamp(MIN_ICON, innerHeight / MAIN_BUTTON, 28);
    let cover = needs.cover && innerWidth >= 200 ? innerHeight : 0;
    // what is left for the buttons beside the cover and the texts
    let free = innerWidth - (cover ? cover + gap : 0) - MIN_TEXT - gap;
    let previous = needs.powered && free >= (2 * BUTTON + MAIN_BUTTON) * icon + 8;
    const units = needs.powered ? (previous ? 2 * BUTTON : BUTTON) + MAIN_BUTTON : MAIN_BUTTON;
    if (free < units * icon && cover) {
        // rather no cover than buttons that are too small
        cover = 0;
        free = innerWidth - MIN_TEXT - gap;
    }
    if (free < units * icon) {
        icon = Math.max(MIN_ICON, free / units);
    }
    if (!needs.powered) {
        previous = false;
    }
    const name = innerHeight >= infoHeight(fonts, true, true);
    return {
        kind: 'row',
        pad: box.pad,
        gap,
        cover: Math.floor(cover),
        icon: round(icon),
        name,
        artist: innerHeight >= infoHeight(fonts, false, true),
        titleLines: 1,
        progress: false,
        volume: false,
        modes: false,
        previous,
        fonts,
    };
}

/** The layout for a box of `width` × `height` px */
export function getLayout(width: number, height: number, needs: LayoutNeeds): Layout {
    const side = Math.min(width, height);
    const pad = Math.round(clamp(6, side * 0.045, 16));
    const gap = Math.round(clamp(6, side * 0.04, 16));
    const box: Box = {
        width,
        height,
        innerWidth: Math.max(0, width - 2 * pad),
        innerHeight: Math.max(0, height - 2 * pad),
        pad,
        gap,
        maxIcon: clamp(24, side * 0.1, 36),
        fonts: {
            name: clamp(10, side * 0.04, 13),
            title: clamp(13, side * 0.07, 22),
            artist: clamp(11, side * 0.05, 16),
            time: clamp(10, side * 0.036, 13),
        },
    };
    if (height >= 120) {
        const ratio = width / height;
        const layout = ratio >= 1.45 ? wide(box, needs) : ratio >= 0.8 ? card(box, needs) : tall(box, needs);
        if (layout) {
            return layout;
        }
    }
    // low, or the rows do not fit one above the other
    return row(box, needs);
}
