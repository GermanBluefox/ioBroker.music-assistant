/**
 * The styles of the shadow root. The element fills the box of the host; it has a transparent background and
 * inherits `color` and `font`, so it follows the theme of the host.
 *
 * Which layout (`wide`, `card`, `tall`, `row`) and how big the parts are is decided in `layout.ts` from the
 * measured size of the box; the sizes come in as variables: `--pad`, `--gap`, `--icon`, `--cover` and `--fs-*`.
 */
export const STYLES = `
:host {
    display: block;
    width: 100%;
    height: 100%;
}
.mount {
    width: 100%;
    height: 100%;
    /* the size of the box does not depend on what is in it - no loop between measuring and laying out */
    container-type: size;
}
.player {
    --track: color-mix(in srgb, currentColor 22%, transparent);
    --hover: color-mix(in srgb, currentColor 10%, transparent);
    box-sizing: border-box;
    width: 100%;
    height: 100%;
    padding: var(--pad, 8px);
    display: flex;
    gap: var(--gap, 8px);
    overflow: hidden;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
}
.player.edit {
    pointer-events: none;
}
.player.wide,
.player.row {
    flex-direction: row;
    align-items: center;
}
.player.card,
.player.tall {
    flex-direction: column;
    justify-content: center;
}
.main {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    justify-content: center;
    gap: var(--gap);
}
.head {
    display: flex;
    align-items: center;
    gap: var(--gap);
    min-width: 0;
}
.cover {
    flex: none;
    width: var(--cover);
    height: var(--cover);
    border-radius: clamp(4px, calc(var(--cover) * 0.06), 12px);
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background: var(--hover);
}
.tall .cover {
    align-self: center;
}
.cover img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
}
.cover svg {
    width: 45%;
    height: 45%;
    fill: currentColor;
    opacity: 0.35;
}
.info {
    min-width: 0;
}
.head .info,
.row .info {
    flex: 1;
}
.tall .info {
    text-align: center;
}
.name,
.title,
.artist {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
.name {
    font-size: var(--fs-name);
    line-height: 1.4;
    opacity: 0.6;
    letter-spacing: 0.04em;
    text-transform: uppercase;
}
.title {
    font-size: var(--fs-title);
    line-height: 1.3;
    font-weight: 600;
}
.title.two {
    white-space: normal;
    overflow-wrap: anywhere;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 2;
}
.artist {
    font-size: var(--fs-artist);
    line-height: 1.4;
    opacity: 0.75;
}
.unavailable .cover,
.unavailable .progress,
.unavailable .controls,
.unavailable .volume {
    opacity: 0.4;
}
.progress,
.volume {
    display: flex;
    align-items: center;
    gap: calc(var(--gap) * 0.6);
    min-width: 0;
}
.time {
    font-size: var(--fs-time);
    font-variant-numeric: tabular-nums;
    opacity: 0.7;
    min-width: 3.2em;
}
.time:last-child {
    text-align: right;
}
.controls {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 4px;
    width: 100%;
    max-width: calc(var(--icon) * 11);
}
.card .controls,
.tall .controls {
    align-self: center;
}
.row .controls {
    flex: none;
    width: auto;
}
.controls.power {
    justify-content: center;
}
.wide .controls.power {
    justify-content: flex-start;
}
button {
    font: inherit;
    color: inherit;
    background: none;
    border: none;
    margin: 0;
    padding: calc(var(--icon) * 0.2);
    border-radius: 50%;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex: none;
}
button:hover:not(:disabled) {
    background: var(--hover);
}
button:focus-visible {
    outline: 2px solid var(--accent);
    outline-offset: 1px;
}
button:disabled {
    cursor: default;
}
button svg {
    width: var(--icon);
    height: var(--icon);
    fill: currentColor;
    display: block;
}
button.main-action {
    color: var(--accent);
    box-shadow: inset 0 0 0 2px var(--accent);
}
button.main-action svg {
    width: calc(var(--icon) * 1.25);
    height: calc(var(--icon) * 1.25);
}
button.mode {
    opacity: 0.45;
}
button.mode.active {
    opacity: 1;
    color: var(--accent);
}
button.mode svg,
.volume button svg {
    width: calc(var(--icon) * 0.8);
    height: calc(var(--icon) * 0.8);
}
input[type='range'] {
    --fill: 0%;
    /* a form control does not inherit the color; the thumb and the track are drawn in it */
    color: inherit;
    flex: 1;
    min-width: 0;
    height: 18px;
    margin: 0;
    background: transparent;
    cursor: pointer;
    -webkit-appearance: none;
    appearance: none;
}
input[type='range']:disabled {
    cursor: default;
}
input[type='range']:focus-visible {
    outline: none;
}
input[type='range']::-webkit-slider-runnable-track {
    height: 4px;
    border-radius: 2px;
    background: linear-gradient(to right, var(--accent) var(--fill), var(--track) var(--fill));
}
input[type='range']::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 12px;
    height: 12px;
    margin-top: -4px;
    border: none;
    border-radius: 50%;
    background: var(--accent);
}
input[type='range']:focus-visible::-webkit-slider-thumb {
    box-shadow: 0 0 0 4px var(--track);
}
input[type='range']::-moz-range-track {
    height: 4px;
    border-radius: 2px;
    background: var(--track);
}
input[type='range']::-moz-range-progress {
    height: 4px;
    border-radius: 2px;
    background: var(--accent);
}
input[type='range']::-moz-range-thumb {
    width: 12px;
    height: 12px;
    border: none;
    border-radius: 50%;
    background: var(--accent);
}
.hint {
    flex-direction: column;
    align-items: center;
    justify-content: center;
    text-align: center;
    opacity: 0.7;
    font-size: clamp(11px, 5cqmin, 15px);
}
.hint svg {
    width: clamp(18px, 10cqmin, 30px);
    height: clamp(18px, 10cqmin, 30px);
    fill: currentColor;
}
`;
